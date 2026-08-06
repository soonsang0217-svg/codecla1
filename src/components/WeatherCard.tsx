import type { WeatherInfo } from "@/lib/types";

function formatTemp(value: number | null): string {
  return value != null ? `${Math.round(value)}°` : "-";
}

export default function WeatherCard({ weather }: { weather: WeatherInfo | null }) {
  if (!weather) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-400">
        집 주소를 등록하면 오늘 날씨를 볼 수 있어요.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="text-4xl leading-none">{weather.icon}</span>
        <div>
          <p className="text-sm font-medium text-slate-500">{weather.description}</p>
          <p className="text-xl font-bold text-slate-900">
            최고 {formatTemp(weather.tempMax)}
            <span className="ml-1 text-sm font-normal text-slate-400">
              / 최저 {formatTemp(weather.tempMin)}
            </span>
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          <p className="text-xs text-slate-400">강수확률</p>
          <p className="font-semibold text-slate-900">
            {weather.precipitationProbability != null
              ? `${weather.precipitationProbability}%`
              : "-"}
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          <p className="text-xs text-slate-400">미세먼지 (PM2.5)</p>
          <p className="font-semibold text-slate-900">
            {weather.airQuality?.label ?? "-"}
            {weather.airQuality?.pm25 != null && (
              <span className="ml-1 text-xs font-normal text-slate-400">
                {Math.round(weather.airQuality.pm25)}㎍/㎥
              </span>
            )}
          </p>
        </div>
      </div>

      {weather.rainStartTime && (
        <p className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">
          ☔ {weather.rainStartTime}부터 비/눈이 예상돼요
        </p>
      )}
    </div>
  );
}
