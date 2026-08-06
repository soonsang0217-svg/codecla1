import type { BriefingResponse } from "./types";
import type { NewsItem } from "./news";
import { formatEventTime, formatDueDate, formatTodayKorean } from "./format";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function section(title: string, bodyHtml: string): string {
  return `
    <tr><td style="padding:24px 0 8px;font-size:16px;font-weight:700;color:#0f172a;">${title}</td></tr>
    <tr><td>${bodyHtml}</td></tr>
  `;
}

function emptyRow(text: string): string {
  return `<p style="margin:0;padding:12px 0;color:#94a3b8;font-size:14px;">${text}</p>`;
}

function renderWeather(weather: BriefingResponse["weather"], locationLabel: string | null): string {
  if (!weather) return emptyRow("집 주소를 등록하면 오늘 날씨를 볼 수 있어요.");

  const tempMax = weather.tempMax != null ? `${Math.round(weather.tempMax)}°` : "-";
  const tempMin = weather.tempMin != null ? `${Math.round(weather.tempMin)}°` : "-";
  const precipitation =
    weather.precipitationProbability != null ? `${weather.precipitationProbability}%` : "-";
  const air = weather.airQuality?.label ?? "-";
  const rain = weather.rainStartTime
    ? `<p style="margin:8px 0 0;padding:8px 12px;background:#eff6ff;border-radius:8px;color:#1d4ed8;font-size:13px;">☔ ${weather.rainStartTime}부터 비/눈이 예상돼요</p>`
    : "";
  const location = locationLabel
    ? `<p style="margin:0 0 8px;color:#94a3b8;font-size:12px;">${escapeHtml(locationLabel)} 기준</p>`
    : "";

  return `
    <div style="border:1px solid #e2e8f0;border-radius:12px;padding:16px;">
      ${location}
      <table role="presentation" width="100%"><tr>
        <td style="width:48px;font-size:36px;vertical-align:top;">${weather.icon}</td>
        <td>
          <p style="margin:0;color:#64748b;font-size:13px;">${escapeHtml(weather.description)}</p>
          <p style="margin:2px 0 0;font-size:20px;font-weight:700;color:#0f172a;">
            최고 ${tempMax}<span style="font-weight:400;color:#94a3b8;font-size:13px;"> / 최저 ${tempMin}</span>
          </p>
          <p style="margin:6px 0 0;color:#64748b;font-size:13px;">강수확률 ${precipitation} · 미세먼지 ${escapeHtml(air)}</p>
        </td>
      </tr></table>
      ${rain}
    </div>
  `;
}

function renderEvents(events: BriefingResponse["events"]): string {
  if (events.length === 0) return emptyRow("오늘 일정이 없습니다.");

  return events
    .map((event) => {
      const time = formatEventTime(event.start);
      const location = event.location
        ? `<p style="margin:2px 0 0;color:#64748b;font-size:13px;">📍 ${escapeHtml(event.location)}</p>`
        : "";
      const commute =
        event.commute && event.commute.durationMinutes != null
          ? `<p style="margin:2px 0 0;color:#2563eb;font-size:13px;">🚗 ${event.commute.durationMinutes}분 소요${
              event.commute.departureBy
                ? ` · ${new Date(event.commute.departureBy).toLocaleTimeString("ko-KR", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Asia/Seoul",
                  })} 출발`
                : ""
            }</p>`
          : "";
      return `
        <div style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
          <p style="margin:0;font-size:14px;">
            <span style="display:inline-block;min-width:52px;color:#64748b;font-weight:600;">${time}</span>
            <span style="color:#0f172a;font-weight:600;">${escapeHtml(event.summary || "(제목 없음)")}</span>
          </p>
          ${location}
          ${commute}
        </div>
      `;
    })
    .join("");
}

function renderTasks(tasks: BriefingResponse["tasks"]): string {
  if (tasks.length === 0) return emptyRow("할 일이 없습니다.");

  return tasks
    .map((task) => {
      const due = task.due
        ? `<span style="color:#94a3b8;font-size:12px;"> · 기한 ${formatDueDate(task.due)}</span>`
        : "";
      return `
        <div style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:14px;color:#0f172a;">
          ☐ ${escapeHtml(task.title || "")}${due}
        </div>
      `;
    })
    .join("");
}

function renderStocks(stocks: BriefingResponse["stocks"]): string {
  if (stocks.length === 0) return emptyRow("설정에서 관심 종목을 추가해주세요.");

  return `
    <table role="presentation" width="100%" style="border-collapse:collapse;">
      ${stocks
        .map((quote) => {
          const up = (quote.changePercent ?? 0) >= 0;
          const color = up ? "#dc2626" : "#2563eb";
          const sign = up ? "+" : "";
          return `
            <tr style="border-bottom:1px solid #f1f5f9;">
              <td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:600;">${escapeHtml(quote.symbol)}</td>
              <td style="padding:8px 0;font-size:14px;text-align:right;color:#0f172a;">${
                quote.price != null ? quote.price.toLocaleString("ko-KR") : "-"
              }</td>
              <td style="padding:8px 0 8px 12px;font-size:13px;text-align:right;color:${color};white-space:nowrap;">
                ${quote.changePercent != null ? `${sign}${quote.changePercent.toFixed(2)}%` : "-"}
              </td>
            </tr>
          `;
        })
        .join("")}
    </table>
  `;
}

function renderNews(news: NewsItem[]): string {
  if (news.length === 0) return "";

  return news
    .slice(0, 5)
    .map(
      (item) => `
        <div style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:14px;">
          <a href="${item.url}" style="color:#0f172a;text-decoration:none;">${escapeHtml(item.title)}</a>
          <span style="color:#94a3b8;font-size:12px;"> · ${escapeHtml(item.source)}</span>
        </div>
      `
    )
    .join("");
}

export function renderBriefingEmailHtml(data: BriefingResponse, news: NewsItem[]): string {
  const appUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : null;
  const footerLink = appUrl
    ? `<p style="margin:24px 0 0;text-align:center;"><a href="${appUrl}/briefing" style="color:#2563eb;font-size:13px;text-decoration:none;">브리핑 앱에서 보기 →</a></p>`
    : "";

  return `<!doctype html>
<html lang="ko">
  <body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Segoe UI',sans-serif;">
    <table role="presentation" width="100%" style="background:#f8fafc;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;padding:24px;">
            <tr>
              <td>
                <p style="margin:0 0 4px;font-size:20px;font-weight:700;color:#0f172a;">아침 브리핑</p>
                <p style="margin:0;color:#64748b;font-size:13px;">${formatTodayKorean(data.date)}</p>
              </td>
            </tr>
            ${section("오늘 날씨", renderWeather(data.weather, data.locationLabel))}
            ${section("오늘 일정", renderEvents(data.events))}
            ${section("할 일", renderTasks(data.tasks))}
            ${section("주식 현황", renderStocks(data.stocks))}
            ${news.length > 0 ? section("주요 뉴스", renderNews(news)) : ""}
            <tr><td>${footerLink}</td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
