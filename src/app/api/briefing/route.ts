import { NextResponse } from "next/server";
import { requireGoogleClient, handleApiError } from "@/lib/apiAuth";
import { listEvents } from "@/lib/googleCalendar";
import { listTasks } from "@/lib/googleTasks";
import { getStockQuotes } from "@/lib/stocks";
import { getTopHeadlines } from "@/lib/news";
import { getCommuteInfo } from "@/lib/directions";
import { getSettings } from "@/lib/config";
import { getTodayRangeInKst } from "@/lib/timezone";

export async function GET() {
  try {
    const auth = await requireGoogleClient();
    const settings = await getSettings();

    const { startOfDay, endOfDay } = getTodayRangeInKst();

    const [events, tasks, stocks, news] = await Promise.all([
      listEvents(auth, startOfDay.toISOString(), endOfDay.toISOString()),
      listTasks(auth, false),
      getStockQuotes(settings.stockSymbols),
      getTopHeadlines(settings.newsCountry, settings.newsQuery),
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
      news,
      homeAddressConfigured: !!settings.homeAddress,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
