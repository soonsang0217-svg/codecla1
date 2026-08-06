import { requireGoogleClient } from "./apiAuth";
import { listEvents } from "./googleCalendar";
import { listTasks } from "./googleTasks";
import { getStockQuotes } from "./stocks";
import {
  getCommuteInfo,
  getCommuteInfoFromPoint,
  geocodeAddress,
  reverseGeocode,
  type GeoPoint,
} from "./directions";
import { getWeather, type WeatherInfo } from "./weather";
import { getSettings } from "./config";
import { getTodayRangeInKst } from "./timezone";
import type { BriefingResponse } from "./types";

async function getHomeWeather(homeAddress: string): Promise<WeatherInfo | null> {
  if (!homeAddress) return null;
  const home = await geocodeAddress(homeAddress);
  if (!home) return null;
  return getWeather(home.lat, home.lng);
}

/**
 * Aggregates today's events/tasks/stocks/weather/commute. Shared by the
 * browser-facing /api/briefing route (which may pass live geolocation) and
 * the daily cron email job (which has no browser location, so it always
 * falls back to the configured home address).
 */
export async function getBriefingData(currentLocation: GeoPoint | null): Promise<BriefingResponse> {
  const auth = await requireGoogleClient();
  const settings = await getSettings();

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

  return {
    date: startOfDay.toISOString(),
    events: eventsWithCommute,
    tasks,
    stocks,
    weather,
    homeAddressConfigured: !!settings.homeAddress,
    locationSource: currentLocation ? "current" : "home",
    locationLabel,
  };
}
