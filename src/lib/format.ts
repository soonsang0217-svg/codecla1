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
