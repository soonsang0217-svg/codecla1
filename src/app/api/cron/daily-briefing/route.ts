import { NextResponse } from "next/server";
import { sendBriefingEmailNow } from "@/lib/briefingEmailJob";

// Vercel Cron automatically sends `Authorization: Bearer $CRON_SECRET` when
// that env var is set on the project, so this doubles as both the schedule
// trigger and the auth check — no separate secret needs to be shared.
function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    // No browser geolocation is available from a cron job, so this always
    // uses the configured home address (currentLocation: null).
    await sendBriefingEmailNow(null);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to send daily briefing email", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
