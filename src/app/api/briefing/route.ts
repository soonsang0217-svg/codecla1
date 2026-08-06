import { NextResponse } from "next/server";
import { requireGoogleClient, handleApiError } from "@/lib/apiAuth";
import { listEvents } from "@/lib/googleCalendar";
import { listTasks } from "@/lib/googleTasks";
import { getStockQuotes } from "@/lib/stocks";
import { getCommuteInfo, geocodeAddress } from "@/lib/directions";
import { getWeather, type WeatherInfo } from "@/lib/weather";
import { getSettings } from "@/lib/config";
import { getTodayRangeInKst } from "@/lib/timezone";

async function getHomeWeather(homeAddress: string): Promise<WeatherInfo | null> {
  if (!homeAddress) return null;
  const home = await geocodeAddress(homeAddress);
  if (!home) return null;
  return getWeather(home.lat, home.lng);
}

export async function GET() {
  try {
    const auth = await requireGoogleClient();
    const settings = await getSettings();

    const { startOfDay, endOfDay } = getTodayRangeInKst();

    const [events, tasks, stocks, weather] = await Promise.all([
      listEvents(auth, startOfDay.toISOString(), endOfDay.toISOString()),
      listTasks(auth, false),
      getStockQuotes(settings.stockSymbols),
      getHomeWeather(settings.homeAddress),
    ]);

    const eventsWithCommute = await Promise.all(
      events.map(async (event) => {
        if (!event.location || !settings.homeAddress) {
          return { ...event, commute: null };
        }
        const commute = await getCommuteInfo(
          settings.homeAddress,
          event.location,
          event.start?.dateTime
        );
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
    });
  } catch (err) {
    return handleApiError(err);
  }
}
