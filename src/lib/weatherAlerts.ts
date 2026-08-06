import { XMLParser } from "fast-xml-parser";
import { getKV, setKV } from "./db";
import { reverseGeocodeRegions } from "./directions";

export interface WeatherAlert {
  /** e.g. "강풍주의보" */
  title: string;
  /** Raw region list text as KMA wrote it, e.g. "울릉도.독도, 전라남도(거문도.초도)" */
  regions: string;
}

// KMA's public "특보 발효 현황" endpoint (기상청_기상특보 조회서비스, data.go.kr).
// getPwnStatus returns a single nationwide snapshot of currently-active
// advisories as free text — no region filter param exists on this operation,
// so matching to "is this relevant to me" happens client-side below.
const KMA_ENDPOINT = "https://apis.data.go.kr/1360000/WthrWrnInfoService/getPwnStatus";
const NATIONWIDE_CACHE_TTL_SECONDS = 600; // 10 minutes
const parser = new XMLParser({ ignoreAttributes: true });

// KMA's real bulletin text (verified against a live getPwnStatus response,
// which uses no newlines between entries and full 시/도 names, not
// Kakao's-adjacent short forms) writes metro cities bare ("서울", "부산") and
// provinces with their full administrative name ("충청남도", not "충남").
// Multiple candidates are listed per root to tolerate however Kakao's
// region_1depth_name happens to spell 강원/전북 (old vs "특별자치도" forms).
const ROOT_TO_KMA_KEYWORDS: Record<string, string[]> = {
  서울: ["서울"],
  부산: ["부산"],
  대구: ["대구"],
  인천: ["인천"],
  광주: ["광주"],
  대전: ["대전"],
  울산: ["울산"],
  세종: ["세종"],
  경기: ["경기도"],
  강원: ["강원도"],
  충청북: ["충청북도"],
  충청남: ["충청남도"],
  전라북: ["전북자치도", "전라북도"],
  전북: ["전북자치도", "전라북도"],
  전라남: ["전라남도"],
  경상북: ["경상북도"],
  경상남: ["경상남도"],
  제주: ["제주도"],
};

const SIDO_SUFFIXES = ["특별자치도", "특별자치시", "광역시", "특별시", "도"];

function sidoRootKeywords(region1: string): string[] {
  const suffix = SIDO_SUFFIXES.find((s) => region1.endsWith(s));
  const root = suffix ? region1.slice(0, -suffix.length) : region1;
  return ROOT_TO_KMA_KEYWORDS[root] ?? [];
}

// Kakao's region_2depth_name comes back as e.g. "안산시" or "천안시 서북구" —
// take the first token and drop the trailing 시/군/구 to match KMA's plain
// city name style (e.g. "안산", "천안").
function cityKeyword(region2: string): string | null {
  const firstToken = region2.trim().split(/\s+/)[0];
  if (!firstToken) return null;
  const stripped = firstToken.replace(/(시|군|구)$/, "");
  return stripped || null;
}

interface KmaWarningItem {
  /** 특보발효현황 내용 — real responses pack every "o 제목 : 지역목록" entry
   *  on one line with no separating newline, e.g.
   *  "o 풍랑주의보 : ... o 폭염경보 : ... o 폭염주의보 : ..." */
  t6?: string;
}

interface KmaWarningResponse {
  response?: {
    body?: {
      items?: { item?: KmaWarningItem | KmaWarningItem[] };
    };
  };
}

// Splits on a standalone "o" bullet marker (whitespace/newline on both
// sides) rather than on "\n", since real responses don't reliably separate
// entries with actual line breaks.
function parseAlertLines(t6: string): WeatherAlert[] {
  return t6
    .split(/\s*\bo\b\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((line) => {
      const separatorIndex = line.indexOf(":");
      if (separatorIndex === -1) return { title: line, regions: "" };
      return {
        title: line.slice(0, separatorIndex).trim(),
        regions: line.slice(separatorIndex + 1).trim(),
      };
    })
    .filter((alert) => alert.title && alert.regions);
}

// Splits a region list on top-level commas only — commas inside a "(...)"
// sub-region list (e.g. "경기도(광명, 안산, ...), 강원도(...)") don't count,
// so each returned piece is one whole "지역(선택적 하위목록)" entry.
function splitTopLevelRegions(regions: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of regions) {
    if (char === "(") depth++;
    if (char === ")") depth--;
    if (char === "," && depth === 0) {
      if (current.trim()) parts.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

// A region segment like "충청남도(보령도서 제외)" covers the whole province
// except what's listed; "충청남도(보령도서)" (no "제외") covers ONLY what's
// listed. Naively substring-matching the province name against either form
// treats them the same, which is wrong — e.g. it would show a warning
// scoped to just the Boryeong islands to every other city in Chungnam.
function isSegmentRelevant(segment: string, sidoKeywords: string[], city: string | null): boolean {
  const matches =
    sidoKeywords.some((kw) => segment.startsWith(kw)) || (city != null && segment.startsWith(city));
  if (!matches) return false;

  const parenMatch = segment.match(/\(([^)]*)\)/);
  if (!parenMatch) return true; // whole 시/도 (or whole city), no sub-list

  const inner = parenMatch[1];
  if (inner.includes("제외")) {
    // Broad coverage minus an exclusion list.
    return !(city && inner.includes(city));
  }
  // Inclusion-only sub-list.
  return !!(city && inner.includes(city));
}

function isAlertRelevant(alert: WeatherAlert, sidoKeywords: string[], city: string | null): boolean {
  return splitTopLevelRegions(alert.regions).some((segment) =>
    isSegmentRelevant(segment, sidoKeywords, city)
  );
}

async function fetchNationwideAlerts(apiKey: string): Promise<WeatherAlert[]> {
  const cacheKey = "weather-alerts:nationwide";
  const cached = await getKV<WeatherAlert[]>(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(
      `${KMA_ENDPOINT}?serviceKey=${encodeURIComponent(apiKey)}&numOfRows=10&pageNo=1`,
      { cache: "no-store" }
    );
    if (!res.ok) throw new Error(`KMA weather warning API returned ${res.status}`);

    const xml = await res.text();
    const data = parser.parse(xml) as KmaWarningResponse;
    const rawItem = data.response?.body?.items?.item;
    const item = Array.isArray(rawItem) ? rawItem[0] : rawItem;

    const alerts = item?.t6 ? parseAlertLines(item.t6) : [];
    await setKV(cacheKey, alerts, NATIONWIDE_CACHE_TTL_SECONDS);
    return alerts;
  } catch (err) {
    console.error("Failed to fetch weather alerts", err);
    return [];
  }
}

/**
 * Currently active KMA (기상청) advisories/warnings relevant to the given
 * coordinates. Matching is a best-effort parse of KMA's free-text bulletin
 * (there's no free-key structured region-code lookup wired up) — it
 * understands 시/도-wide coverage, "(X 제외)" exclusions, and "(X, Y)"
 * inclusion-only sub-lists, matched against the 시/도 and 시/군/구 name for
 * the given coordinates. It can still miss or over-match where KMA groups
 * areas by internal names Kakao's reverse geocoding wouldn't produce (e.g.
 * "인천남부", "부산동부" compass-direction groupings).
 */
export async function getActiveWeatherAlerts(lat: number, lng: number): Promise<WeatherAlert[]> {
  const apiKey = process.env.KMA_WARNING_API_KEY;
  if (!apiKey) return [];

  const region = await reverseGeocodeRegions(lat, lng);
  if (!region) return [];

  const sidoKeywords = sidoRootKeywords(region.region1);
  const city = cityKeyword(region.region2);
  if (sidoKeywords.length === 0 && !city) return [];

  const alerts = await fetchNationwideAlerts(apiKey);
  return alerts.filter((alert) => isAlertRelevant(alert, sidoKeywords, city));
}
