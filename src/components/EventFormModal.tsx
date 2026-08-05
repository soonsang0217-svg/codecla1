"use client";

import { useState } from "react";
import type { BriefingEvent } from "@/lib/types";
import { toDateTimeLocalInput } from "@/lib/format";
import LocationAutocomplete from "./LocationAutocomplete";

export interface EventFormValues {
  summary: string;
  location: string;
  description: string;
  start: string;
  end: string;
  allDay: boolean;
}

interface Props {
  initial?: BriefingEvent | null;
  /** Date to prefill the start/end time on for a new event (defaults to today). */
  defaultDate?: Date;
  onClose: () => void;
  onSubmit: (values: EventFormValues) => Promise<void>;
  onDelete?: () => Promise<void>;
}

function defaultTimes(base?: Date) {
  const start = base ? new Date(base) : new Date();
  start.setHours(new Date().getHours() + 1, 0, 0, 0);
  const end = new Date(start);
  end.setHours(end.getHours() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  const toLocal = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
      d.getMinutes()
    )}`;
  return { start: toLocal(start), end: toLocal(end) };
}

export default function EventFormModal({ initial, defaultDate, onClose, onSubmit, onDelete }: Props) {
  const defaults = defaultTimes(defaultDate);
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [allDay, setAllDay] = useState(!!initial?.start?.date);
  const [start, setStart] = useState(
    initial ? toDateTimeLocalInput(initial.start) : defaults.start
  );
  const [end, setEnd] = useState(initial ? toDateTimeLocalInput(initial.end) : defaults.end);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!summary.trim() || !start || !end) {
      setError("제목, 시작/종료 시간을 입력해주세요.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        summary: summary.trim(),
        location: location.trim(),
        description: description.trim(),
        start: allDay ? start.slice(0, 10) : new Date(start).toISOString(),
        end: allDay ? end.slice(0, 10) : new Date(end).toISOString(),
        allDay,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-bold text-slate-900">
          {initial ? "일정 수정" : "새 일정"}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">제목</label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="예: 팀 미팅"
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">장소</label>
            <LocationAutocomplete value={location} onChange={setLocation} />
            <p className="mt-1 text-xs text-slate-400">
              검색 결과에서 선택하면 이동 경로 계산이 더 정확해집니다.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
            종일 일정
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">시작</label>
              <input
                type={allDay ? "date" : "datetime-local"}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={allDay ? start.slice(0, 10) : start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">종료</label>
              <input
                type={allDay ? "date" : "datetime-local"}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={allDay ? end.slice(0, 10) : end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">메모</label>
            <textarea
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex items-center justify-between pt-2">
            <div>
              {onDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  삭제
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {submitting ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
