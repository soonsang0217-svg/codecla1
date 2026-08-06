import type { GeoPoint } from "./directions";
import { getBriefingData } from "./briefing";
import { getTopHeadlines } from "./news";
import { getSettings, requireEnv } from "./config";
import { sendEmail } from "./email";
import { renderBriefingEmailHtml } from "./briefingEmail";
import { formatTodayKorean } from "./format";

/**
 * Builds today's briefing email and sends it to BRIEFING_EMAIL_TO. Shared by
 * the 7am cron job (currentLocation: null, always uses the home address)
 * and the "지금 메일로 보내기" button in the dashboard (currentLocation from
 * the browser's live geolocation, same as the on-screen briefing).
 */
export async function sendBriefingEmailNow(currentLocation: GeoPoint | null): Promise<void> {
  const settings = await getSettings();
  const [data, news] = await Promise.all([
    getBriefingData(currentLocation),
    getTopHeadlines(settings.newsCountry),
  ]);

  const html = renderBriefingEmailHtml(data, news);
  await sendEmail({
    to: requireEnv("BRIEFING_EMAIL_TO"),
    subject: `아침 브리핑 · ${formatTodayKorean(data.date)}`,
    html,
  });
}
