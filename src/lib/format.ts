import type { BriefingEventTime } from "./types";

export function formatEventTime(time?: BriefingEventTime | null): string {
  if (!time) return "";
  if (time.date) return "종일";
  if (time.dateTime) {
    return new Date(time.dateTime).toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return "";
}

export function toDateTimeLocalInput(time?: BriefingEventTime | null): string {
  const iso = time?.dateTime ?? (time?.date ? `${time.date}T00:00` : null);
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export function formatClockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

export function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;

  return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

export function formatDueDate(due?: string | null): string {
  if (!due) return "";
  return new Date(due).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

export function formatTodayKorean(iso: string): string {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
}
