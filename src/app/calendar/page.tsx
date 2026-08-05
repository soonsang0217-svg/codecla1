"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns";
import type { BriefingEvent } from "@/lib/types";
import EventCard from "@/components/EventCard";
import EventFormModal, { type EventFormValues } from "@/components/EventFormModal";

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

type EventModalState = "closed" | { defaultDate: Date } | { event: BriefingEvent };

function eventDate(event: BriefingEvent): Date | null {
  const iso = event.start?.dateTime ?? (event.start?.date ? `${event.start.date}T00:00:00` : null);
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export default function CalendarPage() {
  const router = useRouter();
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [events, setEvents] = useState<BriefingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventModal, setEventModal] = useState<EventModalState>("closed");

  const gridStart = useMemo(() => startOfWeek(startOfMonth(monthCursor)), [monthCursor]);
  const gridEnd = useMemo(() => endOfWeek(endOfMonth(monthCursor)), [monthCursor]);
  const days = useMemo(
    () => eachDayOfInterval({ start: gridStart, end: gridEnd }),
    [gridStart, gridEnd]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const from = gridStart.toISOString();
      const to = new Date(gridEnd.getTime() + 24 * 60 * 60 * 1000).toISOString();
      const res = await fetch(
        `/api/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        { cache: "no-store" }
      );
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      if (!res.ok) throw new Error("일정을 불러오지 못했습니다.");
      const data = (await res.json()) as { events: BriefingEvent[] };
      setEvents(data.events ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류");
    } finally {
      setLoading(false);
    }
  }, [gridStart, gridEnd, router]);

  useEffect(() => {
    queueMicrotask(load);
  }, [load]);

  function eventsOn(day: Date): BriefingEvent[] {
    return events
      .filter((event) => {
        const d = eventDate(event);
        return d ? isSameDay(d, day) : false;
      })
      .sort((a, b) => (eventDate(a)?.getTime() ?? 0) - (eventDate(b)?.getTime() ?? 0));
  }

  const selectedEvents = eventsOn(selectedDate);

  async function submitEvent(values: EventFormValues) {
    const editing = eventModal !== "closed" && "event" in eventModal ? eventModal.event : null;
    const res = await fetch(editing ? `/api/calendar/${editing.id}` : "/api/calendar", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) throw new Error("일정 저장에 실패했습니다.");
    setEventModal("closed");
    await load();
  }

  async function deleteEvent(id: string) {
    const res = await fetch(`/api/calendar/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("일정 삭제에 실패했습니다.");
    setEventModal("closed");
    await load();
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 p-4 pb-16 sm:p-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">캘린더</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/briefing"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            브리핑으로
          </Link>
          <Link
            href="/settings"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            설정
          </Link>
        </div>
      </header>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMonthCursor((m) => subMonths(m, 1))}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            ‹ 이전달
          </button>
          <button
            onClick={() => {
              const today = new Date();
              setMonthCursor(startOfMonth(today));
              setSelectedDate(today);
            }}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            오늘
          </button>
          <button
            onClick={() => setMonthCursor((m) => addMonths(m, 1))}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            다음달 ›
          </button>
        </div>
        <p className="text-lg font-bold text-slate-900">
          {monthCursor.getFullYear()}년 {monthCursor.getMonth() + 1}월
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-medium text-slate-500">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="py-2">
              {label}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const dayEvents = eventsOn(day);
            const inMonth = isSameMonth(day, monthCursor);
            const selected = isSameDay(day, selectedDate);
            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelectedDate(day)}
                className={`flex min-h-20 flex-col items-start gap-1 border-b border-r border-slate-100 p-2 text-left last:border-r-0 hover:bg-slate-50 ${
                  selected ? "bg-blue-50" : ""
                }`}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                    isToday(day)
                      ? "bg-slate-900 text-white"
                      : inMonth
                        ? "text-slate-900"
                        : "text-slate-300"
                  }`}
                >
                  {day.getDate()}
                </span>
                <div className="flex w-full flex-col gap-0.5">
                  {dayEvents.slice(0, 2).map((event) => (
                    <span
                      key={event.id}
                      className="truncate rounded bg-slate-100 px-1 py-0.5 text-[10px] text-slate-600"
                    >
                      {event.summary}
                    </span>
                  ))}
                  {dayEvents.length > 2 && (
                    <span className="text-[10px] text-slate-400">+{dayEvents.length - 2}개 더</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">
            {selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일 일정
          </h2>
          <button
            onClick={() => setEventModal({ defaultDate: selectedDate })}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
          >
            + 일정 추가
          </button>
        </div>
        <div className="space-y-3">
          {!loading && selectedEvents.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-400">
              이 날짜에는 일정이 없습니다.
            </p>
          )}
          {selectedEvents.map((event) => (
            <EventCard key={event.id} event={event} onClick={() => setEventModal({ event })} />
          ))}
        </div>
      </section>

      {eventModal !== "closed" && (
        <EventFormModal
          initial={"event" in eventModal ? eventModal.event : null}
          defaultDate={"defaultDate" in eventModal ? eventModal.defaultDate : undefined}
          onClose={() => setEventModal("closed")}
          onSubmit={submitEvent}
          onDelete={
            "event" in eventModal && eventModal.event.id
              ? () => deleteEvent(eventModal.event.id!)
              : undefined
          }
        />
      )}
    </main>
  );
}
