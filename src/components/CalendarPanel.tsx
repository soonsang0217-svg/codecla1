"use client";

import { useEffect, useMemo, useState } from "react";
import { DayPicker } from "react-day-picker";
import { ko } from "react-day-picker/locale";
import "react-day-picker/style.css";
import { format } from "date-fns";

interface CalendarEvent {
  id: string;
  intervieweeName: string;
  publishDate: string; // YYYY-MM-DD
  memo: string | null;
}

function toDateKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export default function CalendarPanel() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selected, setSelected] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ intervieweeName: "", memo: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/calendar-events")
      .then((r) => r.json())
      .then((data) => setEvents(data.events ?? []))
      .catch(() => setError("일정을 불러오지 못했습니다"))
      .finally(() => setLoading(false));
  }, []);

  const eventDates = useMemo(() => events.map((e) => new Date(e.publishDate + "T00:00:00")), [events]);
  const selectedKey = toDateKey(selected);
  const eventsOnSelected = events.filter((e) => e.publishDate === selectedKey);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.intervieweeName.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/calendar-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intervieweeName: form.intervieweeName,
          publishDate: selectedKey,
          memo: form.memo || undefined,
        }),
      });
      const raw = await res.text();
      const data = raw ? JSON.parse(raw) : {};
      if (!res.ok) {
        throw new Error(data.error ?? `일정 등록에 실패했습니다 (status ${res.status})`);
      }
      setEvents((prev) => [...prev, data.event]);
      setForm({ intervieweeName: "", memo: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "일정 등록에 실패했습니다");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    const removed = events.find((e) => e.id === id);
    setEvents((prev) => prev.filter((e) => e.id !== id));
    try {
      const res = await fetch(`/api/calendar-events/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      setError("일정 삭제에 실패했습니다");
      if (removed) setEvents((prev) => [...prev, removed]);
    }
  }

  return (
    <div className="grid gap-6 sm:grid-cols-[auto_1fr]">
      <DayPicker
        mode="single"
        locale={ko}
        selected={selected}
        onSelect={(d) => d && setSelected(d)}
        modifiers={{ hasEvent: eventDates }}
        modifiersClassNames={{ hasEvent: "rdp-has-event" }}
        className="rounded-lg border border-neutral-200 bg-white p-3"
      />
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium text-neutral-700">{format(selected, "yyyy년 M월 d일")} 일정</h3>
          {loading ? (
            <p className="mt-2 text-sm text-neutral-400">불러오는 중...</p>
          ) : eventsOnSelected.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-400">등록된 일정이 없습니다</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {eventsOnSelected.map((e) => (
                <li key={e.id} className="flex items-start justify-between rounded-md bg-neutral-100 px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium">{e.intervieweeName}</p>
                    {e.memo && <p className="text-neutral-500">{e.memo}</p>}
                  </div>
                  <button onClick={() => handleDelete(e.id)} className="text-xs text-neutral-400 hover:text-red-600">
                    삭제
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <form onSubmit={handleAdd} className="space-y-2 rounded-lg border border-dashed border-neutral-300 p-3">
          <p className="text-xs font-medium text-neutral-500">이 날짜에 발행 일정 추가</p>
          <input
            value={form.intervieweeName}
            onChange={(e) => setForm((f) => ({ ...f, intervieweeName: e.target.value }))}
            placeholder="인터뷰이 이름"
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
          <input
            value={form.memo}
            onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))}
            placeholder="메모 (선택)"
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting || !form.intervieweeName.trim()}
            className="w-full rounded bg-neutral-900 px-2 py-1.5 text-sm font-medium text-white disabled:opacity-40"
          >
            {submitting ? "등록 중..." : "일정 등록"}
          </button>
        </form>
      </div>
    </div>
  );
}
