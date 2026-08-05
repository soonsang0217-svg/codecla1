import type { StockQuote } from "@/lib/types";

export default function StockCard({ quote }: { quote: StockQuote }) {
  if (quote.error || quote.price == null) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-slate-900">{quote.symbol}</p>
        <p className="mt-1 text-xs text-slate-400">시세를 불러올 수 없습니다</p>
      </div>
    );
  }

  const up = (quote.change ?? 0) >= 0;
  const color = up ? "text-red-600" : "text-blue-600";
  const sign = up ? "+" : "";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-slate-900">{quote.symbol}</p>
      <p className="mt-1 text-xl font-bold text-slate-900">{quote.price?.toLocaleString()}</p>
      <p className={`mt-0.5 text-sm font-medium ${color}`}>
        {sign}
        {quote.change?.toFixed(2)} ({sign}
        {quote.changePercent?.toFixed(2)}%)
      </p>
    </div>
  );
}
