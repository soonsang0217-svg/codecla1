import { NextRequest, NextResponse } from "next/server";
import { requireGoogleClient, handleApiError } from "@/lib/apiAuth";
import { updateEvent, deleteEvent, type CalendarEventInput } from "@/lib/googleCalendar";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/calendar/[id]">) {
  try {
    const { id } = await ctx.params;
    const auth = await requireGoogleClient();
    const body = (await request.json()) as Partial<CalendarEventInput>;
    const event = await updateEvent(auth, id, body);
    return NextResponse.json({ event });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/calendar/[id]">) {
  try {
    const { id } = await ctx.params;
    const auth = await requireGoogleClient();
    await deleteEvent(auth, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
