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

// KMA's bulletin text uses each 시/도's 2-syllable short form (e.g. "충남"),
// not Kakao's full administrative name (e.g. "충청남도").
const SIDO_ABBREVIATIONS: Record<string, string> = {
  서울특별시: "서울",
  부산광역시: "부산",
  대구광역시: "대구",
  인천광역시: "인천",
  광주광역시: "광주",
  대전광역시: "대전",
  울산광역시: "울산",
  세종특별자치시: "세종",
  경기도: "경기",
  강원도: "강원",
  강원특별자치도: "강원",
  충청북도: "충북",
  충청남도: "충남",
  전라북도: "전북",
  전북특별자치도: "전북",
  전라남도: "전남",
  경상북도: "경북",
  경상남도: "경남",
  제주특별자치도: "제주",
};

interface KmaWarningItem {
  /** 특보발효현황 내용 — e.g. "o 강풍주의보 : 울릉도.독도\n o 풍랑주의보 : ..." */
  t6?: string;
}

interface KmaWarningResponse {
  response?: {
    body?: {
      items?: { item?: KmaWarningItem | KmaWarningItem[] };
    };
  };
}

function parseAlertLines(t6: string): WeatherAlert[] {
  return t6
    .split("\n")
    .map((line) => line.replace(/^\s*o\s*/i, "").trim())
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

// Kakao's region_2depth_name comes back as e.g. "안산시" or "천안시 서북구" —
// take the first token and drop the trailing 시/군/구 to match KMA's plain
// city name style (e.g. "안산", "천안").
function cityKeyword(region2: string): string | null {
  const firstToken = region2.trim().split(/\s+/)[0];
  if (!firstToken) return null;
  const stripped = firstToken.replace(/(시|군|구)$/, "");
  return stripped || null;
}

/**
 * Currently active KMA (기상청) advisories/warnings relevant to the given
 * coordinates. Matching is a best-effort substring match against KMA's
 * free-text bulletin — tried at both 시/군/구 (e.g. "안산") and 시/도 (e.g.
 * "경기") granularity, since many warnings are only issued at the broader
 * 시/도 level. A warning for a different city in the same province can still
 * show; there's no finer official region-code lookup wired up here.
 */
export async function getActiveWeatherAlerts(lat: number, lng: number): Promise<WeatherAlert[]> {
  const apiKey = process.env.KMA_WARNING_API_KEY;
  if (!apiKey) return [];

  const region = await reverseGeocodeRegions(lat, lng);
  if (!region) return [];

  const keywords = [SIDO_ABBREVIATIONS[region.region1], cityKeyword(region.region2)].filter(
    (kw): kw is string => !!kw
  );
  if (keywords.length === 0) return [];

  const alerts = await fetchNationwideAlerts(apiKey);
  return alerts.filter((alert) => keywords.some((kw) => alert.regions.includes(kw)));
}
