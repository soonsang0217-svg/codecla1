import type { HealthSnapshot } from "@/lib/types";
import { formatSleepDuration, formatClockTime } from "@/lib/format";

export default function HealthCard({ health }: { health: HealthSnapshot | null }) {
  if (
    !health ||
    (health.sleepDurationMinutes == null &&
      health.sleepScore == null &&
      health.heartRate == null &&
      health.heartRateVariability == null)
  ) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-400">
        아직 전송된 건강 데이터가 없습니다.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {health.sleepDurationMinutes != null && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">수면 시간</p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {formatSleepDuration(health.sleepDurationMinutes)}
          </p>
        </div>
      )}
      {health.sleepScore != null && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">수면 점수</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{health.sleepScore}점</p>
        </div>
      )}
      {health.heartRate != null && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">심박수</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{health.heartRate} bpm</p>
        </div>
      )}
      {health.heartRateVariability != null && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">심박 변이</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{health.heartRateVariability} ms</p>
        </div>
      )}
      {health.recordedAt && (
        <p className="col-span-full text-xs text-slate-400">
          기준: {formatClockTime(health.recordedAt)}
        </p>
      )}
    </div>
  );
}
