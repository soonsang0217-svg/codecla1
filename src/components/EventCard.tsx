import type { BriefingEvent } from "@/lib/types";
import { formatEventTime } from "@/lib/format";

interface Props {
  event: BriefingEvent;
  onClick: () => void;
}

export default function EventCard({ event, onClick }: Props) {
  const start = formatEventTime(event.start);
  const end = formatEventTime(event.end);
  const commute = event.commute;

  return (
    <button
      onClick={onClick}
      className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-slate-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {start === "종일" ? "종일" : `${start} - ${end}`}
          </p>
          <p className="mt-0.5 text-base font-semibold text-slate-900">{event.summary}</p>
          {event.location && <p className="mt-1 text-sm text-slate-500">📍 {event.location}</p>}
        </div>
      </div>

      {commute && (
        <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          {commute.durationMinutes != null ? (
            <span>
              🚗 예상 이동 시간 {commute.durationMinutes}분 ({commute.distanceKm}km)
            </span>
          ) : (
            <span>{commute.note ?? "경로 정보를 확인할 수 없습니다."}</span>
          )}
          <a
            href={commute.mapLink}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="ml-2 font-medium text-blue-600 hover:underline"
          >
            지도에서 보기
          </a>
        </div>
      )}
    </button>
  );
}
