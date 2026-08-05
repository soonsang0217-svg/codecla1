import { NextResponse } from "next/server";
import { requireGoogleClient, handleApiError } from "@/lib/apiAuth";
import { listEvents } from "@/lib/googleCalendar";
import { listTasks } from "@/lib/googleTasks";
import { getStockQuotes } from "@/lib/stocks";
import { getTopHeadlines } from "@/lib/news";
import { getCommuteInfo } from "@/lib/directions";
import { getSettings } from "@/lib/config";

export async function GET() {
  try {
    const auth = await requireGoogleClient();
    const settings = getSettings();

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const endOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1
    ).toISOString();

    const [events, tasks, stocks, news] = await Promise.all([
      listEvents(auth, startOfDay, endOfDay),
      listTasks(auth, false),
      getStockQuotes(settings.stockSymbols),
      getTopHeadlines(settings.newsCountry, settings.newsQuery),
    ]);

    const eventsWithCommute = await Promise.all(
      events.map(async (event) => {
        if (!event.location || !settings.homeAddress) {
          return { ...event, commute: null };
        }
        const commute = await getCommuteInfo(settings.homeAddress, event.location);
        return { ...event, commute };
      })
    );

    return NextResponse.json({
      date: startOfDay,
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
