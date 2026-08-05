"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { BriefingEvent, BriefingResponse, BriefingTask } from "@/lib/types";
import { formatDueDate, formatTodayKorean } from "@/lib/format";
import EventCard from "@/components/EventCard";
import StockCard from "@/components/StockCard";
import HealthCard from "@/components/HealthCard";
import EventFormModal, { type EventFormValues } from "@/components/EventFormModal";
import TaskFormModal, { type TaskFormValues } from "@/components/TaskFormModal";

type EventModalState = "closed" | "new" | { event: BriefingEvent };
type TaskModalState = "closed" | "new" | { task: BriefingTask };

export default function BriefingPage() {
  const router = useRouter();
  const [data, setData] = useState<BriefingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventModal, setEventModal] = useState<EventModalState>("closed");
  const [taskModal, setTaskModal] = useState<TaskModalState>("closed");

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/briefing", { cache: "no-store" });
      if (res.status === 401) {
        const body = await res.json().catch(() => null);
        if (body?.error === "google_not_connected") {
          // Full navigation is required: this API route issues a further
          // server-side redirect to Google's OAuth consent screen.
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.href = "/api/auth/google";
          return;
        }
        router.replace("/login");
        return;
      }
      if (!res.ok) throw new Error("브리핑을 불러오지 못했습니다.");
      const json = (await res.json()) as BriefingResponse;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    queueMicrotask(load);
  }, [load]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  async function submitEvent(values: EventFormValues) {
    const editing = eventModal !== "closed" && eventModal !== "new" ? eventModal.event : null;
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

  async function submitTask(values: TaskFormValues) {
    const editing = taskModal !== "closed" && taskModal !== "new" ? taskModal.task : null;
    const payload = {
      title: values.title,
      notes: values.notes,
      ...(values.due && { due: values.due }),
    };
    const res = await fetch(editing ? `/api/tasks/${editing.id}` : "/api/tasks", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("할 일 저장에 실패했습니다.");
    setTaskModal("closed");
    await load();
  }

  async function deleteTask(id: string) {
    const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("할 일 삭제에 실패했습니다.");
    setTaskModal("closed");
    await load();
  }

  async function toggleTaskComplete(task: BriefingTask) {
    if (!task.id) return;
    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: task.status !== "completed" }),
    });
    await load();
  }

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-slate-400">불러오는 중...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 p-4 pb-16 sm:p-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">아침 브리핑</h1>
          {data && <p className="text-sm text-slate-500">{formatTodayKorean(data.date)}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            새로고침
          </button>
          <Link
            href="/calendar"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            캘린더
          </Link>
          <Link
            href="/settings"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            설정
          </Link>
          <button
            onClick={handleLogout}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            로그아웃
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      {data && !data.homeAddressConfigured && (
        <div className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
          집 주소를 등록하면 일정 장소까지의 이동 시간을 함께 볼 수 있어요.{" "}
          <Link href="/settings" className="font-medium underline">
            설정에서 등록하기
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">오늘 일정</h2>
            <button
              onClick={() => setEventModal("new")}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
            >
              + 일정 추가
            </button>
          </div>
          <div className="space-y-3">
            {data?.events.length === 0 && (
              <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-400">
                오늘 일정이 없습니다.
              </p>
            )}
            {data?.events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onClick={() => setEventModal({ event })}
              />
            ))}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">할 일</h2>
            <button
              onClick={() => setTaskModal("new")}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
            >
              + 할 일 추가
            </button>
          </div>
          <div className="space-y-2">
            {data?.tasks.length === 0 && (
              <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-400">
                할 일이 없습니다.
              </p>
            )}
            {data?.tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
              >
                <input
                  type="checkbox"
                  checked={task.status === "completed"}
                  onChange={() => toggleTaskComplete(task)}
                  className="h-5 w-5 shrink-0"
                />
                <button
                  onClick={() => setTaskModal({ task })}
                  className="flex-1 text-left"
                >
                  <p
                    className={`text-sm font-medium ${
                      task.status === "completed" ? "text-slate-400 line-through" : "text-slate-900"
                    }`}
                  >
                    {task.title}
                  </p>
                  {task.due && (
                    <p className="text-xs text-slate-400">기한: {formatDueDate(task.due)}</p>
                  )}
                </button>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-bold text-slate-900">건강</h2>
          <HealthCard health={data?.health ?? null} />
        </section>

        <section>
          <h2 className="mb-3 text-lg font-bold text-slate-900">주식 현황</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {data?.stocks.map((quote) => (
              <StockCard key={quote.symbol} quote={quote} />
            ))}
            {data?.stocks.length === 0 && (
              <p className="col-span-full text-sm text-slate-400">
                설정에서 관심 종목을 추가해주세요.
              </p>
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-bold text-slate-900">주요 뉴스</h2>
          <div className="space-y-2">
            {data?.news.map((item) => (
              <a
                key={item.url}
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="block rounded-xl border border-slate-200 bg-white p-3 shadow-sm hover:border-slate-300"
              >
                <p className="text-sm font-medium text-slate-900">{item.title}</p>
                <p className="mt-1 text-xs text-slate-400">{item.source}</p>
              </a>
            ))}
            {data?.news.length === 0 && (
              <p className="text-sm text-slate-400">불러올 뉴스가 없습니다.</p>
            )}
          </div>
        </section>
      </div>

      {eventModal !== "closed" && (
        <EventFormModal
          initial={eventModal === "new" ? null : eventModal.event}
          onClose={() => setEventModal("closed")}
          onSubmit={submitEvent}
          onDelete={
            eventModal !== "new" && eventModal.event.id
              ? () => deleteEvent(eventModal.event.id!)
              : undefined
          }
        />
      )}

      {taskModal !== "closed" && (
        <TaskFormModal
          initial={taskModal === "new" ? null : taskModal.task}
          onClose={() => setTaskModal("closed")}
          onSubmit={submitTask}
          onDelete={
            taskModal !== "new" && taskModal.task.id
              ? () => deleteTask(taskModal.task.id!)
              : undefined
          }
        />
      )}
    </main>
  );
}
