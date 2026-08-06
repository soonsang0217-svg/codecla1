"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { BriefingEvent, BriefingResponse, BriefingTask } from "@/lib/types";
import { formatDueDate, formatTodayKorean } from "@/lib/format";
import EventCard from "@/components/EventCard";
import StockCard from "@/components/StockCard";
import WeatherCard from "@/components/WeatherCard";
import NewsPanel from "@/components/NewsPanel";
import Clock from "@/components/Clock";
import EventFormModal, { type EventFormValues } from "@/components/EventFormModal";
import TaskFormModal, { type TaskFormValues } from "@/components/TaskFormModal";

type EventModalState = "closed" | "new" | { event: BriefingEvent };
type TaskModalState = "closed" | "new" | { task: BriefingTask };

// Best-effort: resolves to the browser's current coordinates, or null if the
// user denies/ignores the permission prompt or the browser doesn't support
// it. Never rejects, and never blocks the briefing load for long.
function getCurrentPosition(timeoutMs = 5000): Promise<GeolocationPosition | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position),
      () => resolve(null),
      { timeout: timeoutMs, maximumAge: 5 * 60 * 1000 }
    );
  });
}

export default function BriefingPage() {
  const router = useRouter();
  const [data, setData] = useState<BriefingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventModal, setEventModal] = useState<EventModalState>("closed");
  const [taskModal, setTaskModal] = useState<TaskModalState>("closed");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailMessage, setEmailMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [showCompletedTasks, setShowCompletedTasks] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const position = await getCurrentPosition();
      const url = position
        ? `/api/briefing?lat=${position.coords.latitude}&lng=${position.coords.longitude}`
        : "/api/briefing";
      const res = await fetch(url, { cache: "no-store" });
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

  async function handleSendEmailNow() {
    setSendingEmail(true);
    setEmailMessage(null);
    try {
      const position = await getCurrentPosition();
      const url = position
        ? `/api/briefing/send-email?lat=${position.coords.latitude}&lng=${position.coords.longitude}`
        : "/api/briefing/send-email";
      const res = await fetch(url, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "메일 발송에 실패했습니다.");
      }
      setEmailMessage({ text: "브리핑 메일을 보냈습니다.", error: false });
    } catch (err) {
      setEmailMessage({
        text: err instanceof Error ? err.message : "메일 발송에 실패했습니다.",
        error: true,
      });
    } finally {
      setSendingEmail(false);
      setTimeout(() => setEmailMessage(null), 5000);
    }
  }

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
        <div className="flex items-center gap-4">
          <Clock />
          <button
            onClick={load}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            새로고침
          </button>
          <button
            onClick={handleSendEmailNow}
            disabled={sendingEmail}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sendingEmail ? "보내는 중..." : "메일로 보내기"}
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

      {emailMessage && (
        <div
          className={`mb-4 rounded-lg px-4 py-3 text-sm ${
            emailMessage.error ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"
          }`}
        >
          {emailMessage.text}
        </div>
      )}

      {data && !data.homeAddressConfigured && (
        <div className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
          집 주소를 등록하면 일정 장소까지의 이동 시간을 함께 볼 수 있어요.{" "}
          <Link href="/settings" className="font-medium underline">
            설정에서 등록하기
          </Link>
        </div>
      )}

      <section className="mb-6">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-lg font-bold text-slate-900">오늘 날씨</h2>
          {data && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
              {data.locationSource === "current" ? "현재 위치 기준" : "집 주소 기준"}
              {data.locationLabel && ` · ${data.locationLabel}`}
            </span>
          )}
        </div>
        <WeatherCard weather={data?.weather ?? null} />
      </section>

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

          {data && data.completedTasks.length > 0 && (
            <div className="mt-4">
              <button
                onClick={() => setShowCompletedTasks((v) => !v)}
                className="text-sm font-medium text-slate-500 hover:text-slate-700"
              >
                {showCompletedTasks
                  ? "완료된 할 일 숨기기"
                  : `완료된 할 일 보기 (${data.completedTasks.length})`}
              </button>
              {showCompletedTasks && (
                <div className="mt-2 space-y-2">
                  {data.completedTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3"
                    >
                      <input
                        type="checkbox"
                        checked
                        onChange={() => toggleTaskComplete(task)}
                        className="h-5 w-5 shrink-0"
                        title="체크 해제하면 할 일 목록으로 되돌립니다"
                      />
                      <button onClick={() => setTaskModal({ task })} className="flex-1 text-left">
                        <p className="text-sm font-medium text-slate-400 line-through">
                          {task.title}
                        </p>
                        {task.completed && (
                          <p className="text-xs text-slate-400">
                            완료: {formatDueDate(task.completed)}
                          </p>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
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

        <section className="lg:col-span-2">
          <h2 className="mb-3 text-lg font-bold text-slate-900">주요 뉴스</h2>
          <NewsPanel />
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
