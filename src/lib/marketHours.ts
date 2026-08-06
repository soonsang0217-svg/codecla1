// Regular trading hours only (no pre/post-market), and no holiday calendar —
// a holiday will incorrectly report "장중"/an open-day boundary. Acceptable
// for a personal dashboard; exact enough for "is it worth checking right now."
export type Exchange = "US" | "KR";

interface MarketSchedule {
  timeZone: string;
  openMinutes: number; // minutes since local midnight
  closeMinutes: number;
}

const SCHEDULES: Record<Exchange, MarketSchedule> = {
  US: { timeZone: "America/New_York", openMinutes: 9 * 60 + 30, closeMinutes: 16 * 60 },
  KR: { timeZone: "Asia/Seoul", openMinutes: 9 * 60, closeMinutes: 15 * 60 + 30 },
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  minutesSinceMidnight: number;
  weekdayIndex: number; // 0 = Sun ... 6 = Sat
}

function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  // Some environments render midnight as hour "24" under hour12:false.
  const hour = map.hour === "24" ? 0 : Number(map.hour);

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    minutesSinceMidnight: hour * 60 + Number(map.minute),
    weekdayIndex: WEEKDAYS.indexOf(map.weekday),
  };
}

function getUtcOffsetMinutes(date: Date, timeZone: string): number {
  const tzPart = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
  })
    .formatToParts(date)
    .find((p) => p.type === "timeZoneName")?.value;

  const match = tzPart?.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = match[3] ? Number(match[3]) : 0;
  return sign * (hours * 60 + minutes);
}

/** Converts a wall-clock date+time *in timeZone* to the absolute instant it represents. */
function zonedWallTimeToDate(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  minutesSinceMidnight: number
): Date {
  const hour = Math.floor(minutesSinceMidnight / 60);
  const minute = minutesSinceMidnight % 60;
  // Offset lookup uses a UTC-guess instant on the target date; even right
  // next to a DST transition this is off by at most an hour, which only
  // affects a human-readable label, not any correctness-critical logic.
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const offsetMinutes = getUtcOffsetMinutes(guess, timeZone);
  return new Date(guess.getTime() - offsetMinutes * 60_000);
}

function addCalendarDays(
  year: number,
  month: number,
  day: number,
  delta: number
): { year: number; month: number; day: number } {
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + delta);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

export interface MarketStatus {
  isOpen: boolean;
  /** Absolute instant of the next close (if open) or next open (if closed). */
  nextBoundary: Date;
}

export function getMarketStatus(exchange: Exchange, now: Date = new Date()): MarketStatus {
  const schedule = SCHEDULES[exchange];
  const { year, month, day, minutesSinceMidnight, weekdayIndex } = getZonedParts(now, schedule.timeZone);
  const isWeekday = weekdayIndex >= 1 && weekdayIndex <= 5;
  const isOpen =
    isWeekday &&
    minutesSinceMidnight >= schedule.openMinutes &&
    minutesSinceMidnight < schedule.closeMinutes;

  if (isOpen) {
    return {
      isOpen: true,
      nextBoundary: zonedWallTimeToDate(schedule.timeZone, year, month, day, schedule.closeMinutes),
    };
  }

  if (isWeekday && minutesSinceMidnight < schedule.openMinutes) {
    return {
      isOpen: false,
      nextBoundary: zonedWallTimeToDate(schedule.timeZone, year, month, day, schedule.openMinutes),
    };
  }

  // Next open is a future weekday — day-of-week arithmetic here is plain
  // modular arithmetic on the calendar, so it needs no further timezone
  // lookups beyond the offset conversion at the very end.
  let weekday = weekdayIndex;
  let daysAhead = 0;
  do {
    daysAhead++;
    weekday = (weekday + 1) % 7;
  } while (weekday === 0 || weekday === 6);

  const next = addCalendarDays(year, month, day, daysAhead);
  return {
    isOpen: false,
    nextBoundary: zonedWallTimeToDate(schedule.timeZone, next.year, next.month, next.day, schedule.openMinutes),
  };
}

function isSameKstDay(a: Date, b: Date): boolean {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(a) === fmt.format(b);
}

/** Renders a MarketStatus boundary as a KST-local label, e.g. "15:30" or "8/7 09:00". */
function formatBoundary(date: Date, now: Date): string {
  if (isSameKstDay(date, now)) {
    return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" });
  }
  return date.toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  });
}

/** e.g. "장중 · 15:30 마감" or "장마감 · 8/7 09:00 개장" — always in KST regardless of exchange. */
export function formatMarketStatusLabel(status: MarketStatus, now: Date = new Date()): string {
  const boundaryLabel = formatBoundary(status.nextBoundary, now);
  return status.isOpen ? `장중 · ${boundaryLabel} 마감` : `장마감 · ${boundaryLabel} 개장`;
}
