import { NextRequest, NextResponse } from "next/server";
import { requireGoogleClient, handleApiError } from "@/lib/apiAuth";
import { listEvents, createEvent, type CalendarEventInput } from "@/lib/googleCalendar";
import { getTodayRangeInKst } from "@/lib/timezone";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireGoogleClient();
    const { startOfDay } = getTodayRangeInKst();
    const defaultFrom = startOfDay.toISOString();
    const defaultTo = new Date(startOfDay.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const from = request.nextUrl.searchParams.get("from") ?? defaultFrom;
    const to = request.nextUrl.searchParams.get("to") ?? defaultTo;

    const events = await listEvents(auth, from, to);
    return NextResponse.json({ events });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireGoogleClient();
    const body = (await request.json()) as CalendarEventInput;

    if (!body.summary || !body.start || !body.end) {
      return NextResponse.json({ error: "summary, start, end are required" }, { status: 400 });
    }

    const event = await createEvent(auth, body);
    return NextResponse.json({ event }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
