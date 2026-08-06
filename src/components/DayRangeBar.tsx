interface Props {
  low: number;
  high: number;
  current: number;
  up: boolean;
}

const UP_COLOR = "#dc2626"; // red-600, matches StockCard's up convention
const DOWN_COLOR = "#2563eb"; // blue-600, matches StockCard's down convention

export default function DayRangeBar({ low, high, current, up }: Props) {
  const range = high - low;
  const rawPct = range > 0 ? ((current - low) / range) * 100 : 50;
  const pct = Math.min(100, Math.max(0, rawPct));

  return (
    <div className="mt-2" aria-hidden="true">
      <div className="relative h-1.5 w-full rounded-full bg-slate-200">
        <div
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
          style={{ left: `${pct}%`, backgroundColor: up ? UP_COLOR : DOWN_COLOR }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-slate-400">
        <span>{low.toLocaleString()}</span>
        <span>{high.toLocaleString()}</span>
      </div>
    </div>
  );
}
