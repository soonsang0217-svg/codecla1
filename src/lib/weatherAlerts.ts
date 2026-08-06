import { XMLParser } from "fast-xml-parser";
import { getKV, setKV } from "./db";
import { reverseGeocodeRegions } from "./directions";
import { KMA_REGIONS, type KmaRegion } from "./kmaRegions";

export interface WeatherAlert {
  /** e.g. "폭염경보" */
  title: string;
  /** The specific area name this was resolved for, e.g. "천안" or "충청남도" */
  regions: string;
}

// KMA's public "특보코드조회" endpoint (기상청_기상특보 조회서비스, data.go.kr).
// Unlike the free-text nationwide bulletin (getPwnStatus), this returns
// structured per-area warning *events* (issued/extended/corrected/cancelled)
// filtered by an official 특보구역코드 (area code) — the area code table
// (KMA_REGIONS) is the same reference spreadsheet KMA ships with the API
// docs. "Currently active" isn't a field on its own; it's derived below by
// taking, per (area, warning type), the most recent event and checking
// whether it's still in an issued state.
const KMA_ENDPOINT = "https://apis.data.go.kr/1360000/WthrWrnInfoService/getPwnCd";
const CACHE_TTL_SECONDS = 600; // 10 minutes
const LOOKBACK_DAYS = 14; // long enough to catch a still-active, multi-day advisory
const parser = new XMLParser({ ignoreAttributes: true });

const WARN_TYPE_LABELS: Record<string, string> = {
  "1": "강풍",
  "2": "호우",
  "3": "한파",
  "4": "건조",
  "5": "폭풍해일",
  "6": "풍랑",
  "7": "태풍",
  "8": "대설",
  "9": "황사",
  "12": "폭염",
  "13": "열대야",
};
const WARN_STRESS_LABELS: Record<string, string> = {
  "0": "주의보",
  "1": "경보",
  "2": "중대경보",
};
// 특보발표코드: 1-발표, 2-해제, 3-연장, 6-정정, 7-변경발표, 8-변경해제.
// A correction (6) is treated as still-active since it corrects an existing
// active warning rather than changing its issued/cleared state.
const ACTIVE_COMMANDS = new Set(["1", "3", "6", "7"]);

const REGIONS_BY_CODE = new Map(KMA_REGIONS.map((r) => [r.code, r]));
const NATIONWIDE_CODE = "L1000000";

// Kakao's region_1depth_name suffix conventions don't match KMA's area-code
// table naming 1:1 (e.g. Kakao may say "전라북도"/"전북특별자치도", KMA's
// table says "전북자치도"; "제주특별자치도" vs KMA's "제주도") — map the
// suffix-stripped root to the exact name used in KMA_REGIONS.
const PROVINCE_NAME_MAP: Record<string, string> = {
  서울: "서울",
  부산: "부산",
  대구: "대구",
  인천: "인천",
  광주: "광주",
  대전: "대전",
  울산: "울산",
  세종: "세종",
  경기: "경기도",
  강원: "강원도",
  충청북: "충청북도",
  충청남: "충청남도",
  전라북: "전북자치도",
  전북: "전북자치도",
  전라남: "전라남도",
  경상북: "경상북도",
  경상남: "경상남도",
  제주: "제주도",
};
const SIDO_SUFFIXES = ["특별자치도", "특별자치시", "광역시", "특별시", "도"];

function findProvinceCode(region1: string): string | null {
  const suffix = SIDO_SUFFIXES.find((s) => region1.endsWith(s));
  const root = suffix ? region1.slice(0, -suffix.length) : region1;
  const kmaName = PROVINCE_NAME_MAP[root];
  if (!kmaName) return null;

  const entry = KMA_REGIONS.find((r) => r.parent === NATIONWIDE_CODE && r.name === kmaName);
  return entry?.code ?? null;
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

function isDescendantOf(region: KmaRegion, ancestorCode: string): boolean {
  let current: KmaRegion | undefined = region;
  let guard = 0;
  while (current && guard++ < 10) {
    if (current.code === ancestorCode) return true;
    current = current.parent ? REGIONS_BY_CODE.get(current.parent) : undefined;
  }
  return false;
}

// Some city names are reused across provinces (e.g. "광주" is both
// 광주광역시 and 경기도 광주시; "고성" is both 강원도 and 경상남도) — prefer
// whichever candidate actually descends from the already-resolved province.
function findCityCode(region2: string, provinceCode: string | null): string | null {
  const city = cityKeyword(region2);
  if (!city) return null;

  const candidates = KMA_REGIONS.filter((r) => r.name === city);
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0].code;

  if (provinceCode) {
    const match = candidates.find((r) => isDescendantOf(r, provinceCode));
    if (match) return match.code;
  }
  return candidates[0].code;
}

function formatYmdKst(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(date)
    .replace(/-/g, "");
}

interface KmaPwnCdItem {
  areaCode?: string;
  areaName?: string;
  warnVar?: string | number;
  warnStress?: string | number;
  command?: string | number;
  cancel?: string | number;
  tmFc?: string;
}

interface KmaPwnCdResponse {
  response?: {
    body?: {
      items?: { item?: KmaPwnCdItem | KmaPwnCdItem[] };
    };
  };
}

async function fetchAreaEvents(
  apiKey: string,
  areaCode: string,
  fromTmFc: string,
  toTmFc: string
): Promise<KmaPwnCdItem[]> {
  const cacheKey = `weather-alerts:${areaCode}:${fromTmFc}:${toTmFc}`;
  const cached = await getKV<KmaPwnCdItem[]>(cacheKey);
  if (cached) return cached;

  try {
    const url =
      `${KMA_ENDPOINT}?serviceKey=${encodeURIComponent(apiKey)}` +
      `&numOfRows=50&pageNo=1&areaCode=${areaCode}&fromTmFc=${fromTmFc}&toTmFc=${toTmFc}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`KMA getPwnCd returned ${res.status}`);

    const xml = await res.text();
    const data = parser.parse(xml) as KmaPwnCdResponse;
    const rawItem = data.response?.body?.items?.item;
    const items = rawItem ? (Array.isArray(rawItem) ? rawItem : [rawItem]) : [];

    await setKV(cacheKey, items, CACHE_TTL_SECONDS);
    return items;
  } catch (err) {
    console.error(`Failed to fetch KMA warnings for area ${areaCode}`, err);
    return [];
  }
}

// Reduces a stream of issue/extend/correct/cancel events down to whatever is
// currently in effect: group by (area, warning type), keep only the most
// recent event per group, then keep the group if that event is still an
// active state (not cancelled/cleared).
function determineActiveAlerts(items: KmaPwnCdItem[]): WeatherAlert[] {
  const latestByKey = new Map<string, KmaPwnCdItem>();
  for (const item of items) {
    const key = `${item.areaCode}:${item.warnVar}`;
    const existing = latestByKey.get(key);
    if (!existing || String(item.tmFc ?? "") > String(existing.tmFc ?? "")) {
      latestByKey.set(key, item);
    }
  }

  const alerts: WeatherAlert[] = [];
  for (const item of latestByKey.values()) {
    const cancelled = String(item.cancel ?? "0") === "1";
    if (cancelled || !ACTIVE_COMMANDS.has(String(item.command ?? ""))) continue;

    const typeLabel = WARN_TYPE_LABELS[String(item.warnVar ?? "")];
    const stressLabel = WARN_STRESS_LABELS[String(item.warnStress ?? "")];
    if (!typeLabel || !stressLabel) continue;

    alerts.push({ title: `${typeLabel}${stressLabel}`, regions: item.areaName ?? "" });
  }
  return alerts;
}

/**
 * Currently active KMA (기상청) advisories/warnings for the given
 * coordinates, resolved via the official 특보구역코드 table rather than
 * text-matching the nationwide bulletin. Reverse-geocodes to a 시/도 +
 * 시/군/구, resolves both to their KMA area codes, and queries both (a
 * warning can be issued at either granularity) over the last two weeks to
 * reliably catch a still-active multi-day advisory.
 */
export async function getActiveWeatherAlerts(lat: number, lng: number): Promise<WeatherAlert[]> {
  const apiKey = process.env.KMA_WARNING_API_KEY;
  if (!apiKey) return [];

  const region = await reverseGeocodeRegions(lat, lng);
  if (!region) return [];

  const provinceCode = findProvinceCode(region.region1);
  const cityCode = findCityCode(region.region2, provinceCode);
  const areaCodes = [...new Set([provinceCode, cityCode].filter((c): c is string => !!c))];
  if (areaCodes.length === 0) return [];

  const now = new Date();
  const toTmFc = formatYmdKst(now);
  const fromTmFc = formatYmdKst(new Date(now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000));

  const results = await Promise.all(
    areaCodes.map((code) => fetchAreaEvents(apiKey, code, fromTmFc, toTmFc))
  );

  return determineActiveAlerts(results.flat());
}
