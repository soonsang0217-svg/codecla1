const APP_TIMEZONE = "Asia/Seoul";
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * Returns the [start, end) UTC instants for "today" in KST, regardless of
 * what timezone the server process itself runs in (Vercel runs in UTC).
 */
export function getTodayRangeInKst(now: Date = new Date()): { startOfDay: Date; endOfDay: Date } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  const year = Number(parts.year);
  const month = Number(parts.month) - 1;
  const day = Number(parts.day);

  return {
    startOfDay: new Date(Date.UTC(year, month, day) - KST_OFFSET_MS),
    endOfDay: new Date(Date.UTC(year, month, day + 1) - KST_OFFSET_MS),
  };
}
