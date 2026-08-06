import { NextResponse } from "next/server";
import { getBriefingData } from "@/lib/briefing";
import { getTopHeadlines } from "@/lib/news";
import { getSettings, requireEnv } from "@/lib/config";
import { sendEmail } from "@/lib/email";
import { renderBriefingEmailHtml } from "@/lib/briefingEmail";
import { formatTodayKorean } from "@/lib/format";

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
    const settings = await getSettings();
    // No browser geolocation is available from a cron job, so this always
    // uses the configured home address (currentLocation: null).
    const [data, news] = await Promise.all([
      getBriefingData(null),
      getTopHeadlines(settings.newsCountry),
    ]);

    const html = renderBriefingEmailHtml(data, news);
    await sendEmail({
      to: requireEnv("BRIEFING_EMAIL_TO"),
      subject: `아침 브리핑 · ${formatTodayKorean(data.date)}`,
      html,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to send daily briefing email", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
