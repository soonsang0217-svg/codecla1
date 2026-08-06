import { XMLParser } from "fast-xml-parser";
import { getKV, setKV } from "./db";
import { reverseGeocodeRegions, type RegionInfo } from "./directions";
import { KMA_REGIONS, type KmaRegion } from "./kmaRegions";
import { KMA_SUBREGION_SPLITS } from "./kmaSubRegions";

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

// Kakao's region_2depth_name comes back as e.g. "안산시" or "천안시 서북구".
// Most KMA_REGIONS city entries drop the 시/군/구 suffix ("안산", "천안"),
// but a few keep it because the bare form would collide with something else
// ("제주시(산지 제외)", "서귀포시(산지 제외)" — "제주"/"서귀포" alone would be
// ambiguous with the province). Try both forms rather than guessing which.
function cityKeywordCandidates(region2: string): string[] {
  const firstToken = region2.trim().split(/\s+/)[0];
  if (!firstToken) return [];
  const stripped = firstToken.replace(/(시|군|구)$/, "");
  return stripped && stripped !== firstToken ? [firstToken, stripped] : [firstToken];
}

function pickBestCandidate(candidates: KmaRegion[], provinceCode: string | null): string {
  if (candidates.length === 1) return candidates[0].code;
  if (provinceCode) {
    const match = candidates.find((r) => isDescendantOf(r, provinceCode));
    if (match) return match.code;
  }
  return candidates[0].code;
}

// Some city names are reused across provinces (e.g. "광주" is both
// 광주광역시 and 경기도 광주시; "고성" is both 강원도 and 경상남도) — prefer
// whichever candidate actually descends from the already-resolved province.
function findCityCode(region2: string, provinceCode: string | null): string | null {
  const candidates = cityKeywordCandidates(region2);
  if (candidates.length === 0) return null;

  for (const candidate of candidates) {
    const exact = KMA_REGIONS.filter((r) => r.name === candidate);
    if (exact.length > 0) return pickBestCandidate(exact, provinceCode);
  }
  // Fallback for entries with no bare-name node at all, only a qualified
  // one — e.g. "신안" only exists as "신안(흑산면제외)" in the table.
  for (const candidate of candidates) {
    const prefixed = KMA_REGIONS.filter((r) => r.name.startsWith(`${candidate}(`));
    if (prefixed.length > 0) return pickBestCandidate(prefixed, provinceCode);
  }
  return null;
}

// A handful of guide entries read "OO 동지역 전체, <읍/면 list>" — the city's
// entire built-up 동 core belongs to that one subregion, only the listed
// 읍/면 go elsewhere. Rather than enumerate every 법정동 (Sejong's urban
// core alone has a dozen), KMA_SUBREGION_SPLITS marks that rule with this
// sentinel; it's safe as a plain string since no real KMA district name
// starts with "*".
const DONG_WILDCARD = "*동";

function districtMatchesRule(districts: string[], district: string, region3: string): boolean {
  if (districts.includes(district) || districts.includes(region3)) return true;
  return districts.includes(DONG_WILDCARD) && (district.endsWith("동") || region3.endsWith("동"));
}

// Given the most specific area code already resolved (a city, or a metro
// resolved at 시/도 level), checks whether that area is one KMA further
// splits (KMA_SUBREGION_SPLITS, transcribed from KMA's own 세분구역 guide)
// and if so, matches the exact 구/읍/면/동 (region2 or region3, whichever
// the split is defined at) to pick the single precise sub-area code —
// e.g. 인천 -> 미추홀구 -> 인천남부, not "wherever in 인천".
function resolvePreciseSubRegionCode(leafCode: string, region2: string, region3: string): string | null {
  const leaf = REGIONS_BY_CODE.get(leafCode);
  if (!leaf) return null;

  const rules = SUBREGION_SPLITS_BY_PARENT.get(leaf.name);
  if (!rules) return null;

  // For cities with their own 구 (청주시 상당구, 천안시 서북구, ...), Kakao's
  // region_2depth_name is the compound "OO시 OO구" — the split rules list
  // just the district ("상당구"), so match on the last token, which is
  // exactly the district in both the compound and plain ("미추홀구") cases.
  const district = region2.trim().split(/\s+/).at(-1) ?? region2;

  const descendants = collectDescendants(leafCode);
  for (const rule of rules) {
    if (!districtMatchesRule(rule.districts, district, region3)) continue;
    const match = descendants.find((code) => REGIONS_BY_CODE.get(code)?.name === rule.sub);
    if (match) return match;
  }
  return null;
}

const SUBREGION_SPLITS_BY_PARENT = new Map(KMA_SUBREGION_SPLITS.map((s) => [s.parent, s.rules]));

function isDescendantOf(region: KmaRegion, ancestorCode: string): boolean {
  let current: KmaRegion | undefined = region;
  let guard = 0;
  while (current && guard++ < 10) {
    if (current.code === ancestorCode) return true;
    current = current.parent ? REGIONS_BY_CODE.get(current.parent) : undefined;
  }
  return false;
}

const CHILDREN_BY_PARENT = new Map<string, string[]>();
for (const r of KMA_REGIONS) {
  if (!r.parent) continue;
  const siblings = CHILDREN_BY_PARENT.get(r.parent) ?? [];
  siblings.push(r.code);
  CHILDREN_BY_PARENT.set(r.parent, siblings);
}

/** All descendants at any depth — e.g. 인천 → 강화/옹진/인천(본토) → 인천남부/북부. */
function collectDescendants(code: string): string[] {
  const result: string[] = [];
  const queue = [...(CHILDREN_BY_PARENT.get(code) ?? [])];
  while (queue.length > 0) {
    const next = queue.shift()!;
    result.push(next);
    queue.push(...(CHILDREN_BY_PARENT.get(next) ?? []));
  }
  return result;
}

function collectAncestors(code: string): string[] {
  const result: string[] = [];
  let current = REGIONS_BY_CODE.get(code);
  let guard = 0;
  while (current?.parent && guard++ < 10) {
    result.push(current.parent);
    current = REGIONS_BY_CODE.get(current.parent);
  }
  return result;
}

// The 8 metro cities double as both a 시/도-level entity *and* their own
// city — KMA further splits several of them by compass direction (부산동부,
// 서울동남권, 인천남부, ...) as direct/indirect children of this same code.
const METRO_CODES = new Set([
  "L1100000", // 서울
  "L1150000", // 부산
  "L1140000", // 대구
  "L1110000", // 인천
  "L1130000", // 광주
  "L1120000", // 대전
  "L1160000", // 울산
  "L1170000", // 세종
]);

/**
 * Builds the full set of area codes worth checking for a location: every
 * ancestor up to 전국 (so a province- or nationwide-scoped warning isn't
 * missed), plus the most specific area resolved for this location. When
 * that area is one KMA splits further (KMA_SUBREGION_SPLITS), the exact
 * 구/읍/면/동 pins down a single precise sub-area code instead of every
 * sibling sub-region; only when no precise rule matches (or the area isn't
 * split at all beyond what's already been resolved) does it fall back to
 * every descendant, so a finer warning still isn't silently missed. This
 * never pulls in sibling cities the way expanding a whole province would.
 */
function resolveQueryAreaCodes(region: RegionInfo): string[] {
  const provinceCode = findProvinceCode(region.region1);
  const cityCode = findCityCode(region.region2, provinceCode);

  const codes = new Set<string>([NATIONWIDE_CODE]);
  if (provinceCode) {
    codes.add(provinceCode);
    for (const ancestor of collectAncestors(provinceCode)) codes.add(ancestor);
  }

  // A metro city (서울, 부산, ...) doubles as its own 시/도-level entity, so
  // it's a valid "leaf" to refine even without a separate city-level match.
  const leafCode = cityCode ?? (provinceCode && METRO_CODES.has(provinceCode) ? provinceCode : null);
  if (!leafCode) return [...codes];
  codes.add(leafCode);

  const preciseCode = resolvePreciseSubRegionCode(leafCode, region.region2, region.region3);
  if (preciseCode) {
    codes.add(preciseCode);
    // Some cities (인천, 세종) have an intermediate node between the leaf
    // and the precise sub-region (e.g. 인천 -> 인천(본토) -> 인천남부) that a
    // warning could be tagged at directly — collectAncestors(preciseCode)
    // walks all the way back past leafCode anyway, so re-adding is a no-op
    // for cities without that extra layer.
    for (const ancestor of collectAncestors(preciseCode)) codes.add(ancestor);
    for (const descendant of collectDescendants(preciseCode)) codes.add(descendant);
  } else {
    for (const descendant of collectDescendants(leafCode)) codes.add(descendant);
  }

  return [...codes];
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
 * text-matching the nationwide bulletin. Queries every area code on this
 * location's path through the region hierarchy — ancestors (시/도, 전국)
 * plus the precisely (or, failing that, broadly) resolved city/metro area —
 * over the last two weeks to reliably catch a still-active multi-day
 * advisory.
 */
export async function getActiveWeatherAlerts(lat: number, lng: number): Promise<WeatherAlert[]> {
  const apiKey = process.env.KMA_WARNING_API_KEY;
  if (!apiKey) return [];

  const region = await reverseGeocodeRegions(lat, lng);
  if (!region) return [];

  const areaCodes = resolveQueryAreaCodes(region);
  if (areaCodes.length === 0) return [];

  const now = new Date();
  const toTmFc = formatYmdKst(now);
  const fromTmFc = formatYmdKst(new Date(now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000));

  const results = await Promise.all(
    areaCodes.map((code) => fetchAreaEvents(apiKey, code, fromTmFc, toTmFc))
  );

  return determineActiveAlerts(results.flat());
}
