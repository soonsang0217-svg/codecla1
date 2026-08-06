import { NextResponse } from "next/server";
import { requireGoogleClient, handleApiError } from "@/lib/apiAuth";
import { listEvents } from "@/lib/googleCalendar";
import { listTasks } from "@/lib/googleTasks";
import { getStockQuotes } from "@/lib/stocks";
import {
  getCommuteInfo,
  getCommuteInfoFromPoint,
  geocodeAddress,
  reverseGeocode,
  type GeoPoint,
} from "@/lib/directions";
import { getWeather, type WeatherInfo } from "@/lib/weather";
import { getSettings } from "@/lib/config";
import { getTodayRangeInKst } from "@/lib/timezone";

async function getHomeWeather(homeAddress: string): Promise<WeatherInfo | null> {
  if (!homeAddress) return null;
  const home = await geocodeAddress(homeAddress);
  if (!home) return null;
  return getWeather(home.lat, home.lng);
}

// The browser sends its live geolocation as ?lat=&lng= on every load/refresh
// (see briefing/page.tsx); when present it takes priority over the
// configured home address for both weather and commute calculations.
function parseCurrentLocation(request: Request): GeoPoint | null {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, name: "현재 위치" };
}

export async function GET(request: Request) {
  try {
    const auth = await requireGoogleClient();
    const settings = await getSettings();
    const currentLocation = parseCurrentLocation(request);

    const { startOfDay, endOfDay } = getTodayRangeInKst();

    const [events, tasks, stocks, weather, locationLabel] = await Promise.all([
      listEvents(auth, startOfDay.toISOString(), endOfDay.toISOString()),
      listTasks(auth, false),
      getStockQuotes(settings.stockSymbols),
      currentLocation
        ? getWeather(currentLocation.lat, currentLocation.lng)
        : getHomeWeather(settings.homeAddress),
      currentLocation
        ? reverseGeocode(currentLocation.lat, currentLocation.lng)
        : Promise.resolve(settings.homeAddress || null),
    ]);

    const eventsWithCommute = await Promise.all(
      events.map(async (event) => {
        if (!event.location) return { ...event, commute: null };
        const commute = currentLocation
          ? await getCommuteInfoFromPoint(currentLocation, event.location, event.start?.dateTime)
          : settings.homeAddress
            ? await getCommuteInfo(settings.homeAddress, event.location, event.start?.dateTime)
            : null;
        return { ...event, commute };
      })
    );

    return NextResponse.json({
      date: startOfDay.toISOString(),
      events: eventsWithCommute,
      tasks,
      stocks,
      weather,
      homeAddressConfigured: !!settings.homeAddress,
      locationSource: currentLocation ? "current" : "home",
      locationLabel,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
