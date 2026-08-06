import { getKV, setKV } from "./db";

export interface GeoPoint {
  lat: number;
  lng: number;
  name: string;
}

/** Reads ?lat=&lng= off a request (GET query or POST URL) sent by the browser's live geolocation. */
export function parseLocationFromRequest(request: Request): GeoPoint | null {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, name: "현재 위치" };
}

export interface CommuteInfo {
  destination: string;
  durationMinutes: number | null;
  distanceKm: number | null;
  mapLink: string;
  note?: string;
  /** ISO timestamp to leave by, to arrive DEPARTURE_BUFFER_MINUTES early. Null if unknown. */
  departureBy: string | null;
}

const GEOCODE_CACHE_TTL_SECONDS = 60 * 60 * 24; // 24h

// Kakao's public Directions API has no "depart at a future time" option, so
// durationMinutes always reflects *current* traffic conditions — this is a
// reasonable estimate when checked close to departure, but drifts the
// further ahead of time it's checked (e.g. the night before).
const DEPARTURE_BUFFER_MINUTES = 5;

function computeDepartureBy(
  eventStartIso: string | null | undefined,
  durationMinutes: number | null
): string | null {
  if (!eventStartIso || durationMinutes == null) return null;
  const start = new Date(eventStartIso);
  if (Number.isNaN(start.getTime())) return null;
  return new Date(start.getTime() - (durationMinutes + DEPARTURE_BUFFER_MINUTES) * 60_000).toISOString();
}

interface KakaoKeywordDoc {
  place_name: string;
  address_name?: string;
  road_address_name?: string;
  x: string; // lng
  y: string; // lat
}

interface KakaoKeywordResponse {
  documents: KakaoKeywordDoc[];
}

export interface PlaceSuggestion {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

/** Live search-as-you-type suggestions for the event location field. */
export async function searchPlaceSuggestions(query: string, limit = 5): Promise<PlaceSuggestion[]> {
  const apiKey = process.env.KAKAO_REST_API_KEY;
  if (!apiKey || !query.trim()) return [];

  try {
    const res = await fetch(
      `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=${limit}`,
      { headers: { Authorization: `KakaoAK ${apiKey}` }, cache: "no-store" }
    );
    if (!res.ok) return [];

    const data = (await res.json()) as KakaoKeywordResponse;
    return (data.documents ?? []).map((doc) => ({
      name: doc.place_name,
      address: doc.road_address_name || doc.address_name || "",
      lat: Number(doc.y),
      lng: Number(doc.x),
    }));
  } catch (err) {
    console.error("Failed to fetch place suggestions", err);
    return [];
  }
}

interface KakaoAddressDoc {
  address_name: string;
  x: string; // lng
  y: string; // lat
}

interface KakaoAddressResponse {
  documents: KakaoAddressDoc[];
}

// Structured addresses ("서울 강남구 테헤란로 123") match best against the
// address search endpoint; place names ("강남역 스타벅스") match best against
// keyword search. Try address search first, then fall back to keyword search.
async function searchAddress(query: string, apiKey: string): Promise<GeoPoint | null> {
  const res = await fetch(
    `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query)}&size=1`,
    { headers: { Authorization: `KakaoAK ${apiKey}` }, cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Kakao address search returned ${res.status}`);

  const data = (await res.json()) as KakaoAddressResponse;
  const doc = data.documents?.[0];
  if (!doc) return null;
  return { lat: Number(doc.y), lng: Number(doc.x), name: doc.address_name };
}

async function searchKeyword(query: string, apiKey: string): Promise<GeoPoint | null> {
  const res = await fetch(
    `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=1`,
    { headers: { Authorization: `KakaoAK ${apiKey}` }, cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Kakao keyword search returned ${res.status}`);

  const data = (await res.json()) as KakaoKeywordResponse;
  const doc = data.documents?.[0];
  if (!doc) return null;
  return { lat: Number(doc.y), lng: Number(doc.x), name: doc.place_name };
}

// Calendar locations often come as "장소명, 대한민국 주소..." (e.g. pasted from
// Google Maps). Searching that whole blob rarely matches, so also try it
// without the country name, and each comma-separated segment on its own
// (address-like segments tend to trail, so try those first).
function buildGeocodeCandidates(raw: string): string[] {
  const stripCountry = (s: string) => s.replace(/^대한민국\s*/, "").trim();

  const candidates = new Set<string>();
  const trimmed = raw.trim();
  candidates.add(trimmed);
  candidates.add(stripCountry(trimmed));

  const parts = trimmed
    .split(",")
    .map((p) => stripCountry(p.trim()))
    .filter(Boolean);
  if (parts.length > 1) {
    for (const part of [...parts].reverse()) {
      candidates.add(part);
    }
  }

  return Array.from(candidates).filter(Boolean);
}

/** Geocodes an arbitrary address/place text using the same cache as commute lookups. */
export async function geocodeAddress(query: string): Promise<GeoPoint | null> {
  const apiKey = process.env.KAKAO_REST_API_KEY;
  if (!apiKey || !query.trim()) return null;
  return geocode(query, apiKey);
}

interface KakaoCoord2AddressDoc {
  address?: { address_name: string; region_1depth_name?: string; region_2depth_name?: string };
  road_address?: { address_name: string; region_1depth_name?: string; region_2depth_name?: string };
}

interface KakaoCoord2AddressResponse {
  documents: KakaoCoord2AddressDoc[];
}

export interface RegionInfo {
  address: string;
  /** 시/도, e.g. "경기도" — Kakao's full form, not KMA's 2-syllable abbreviation. */
  region1: string;
  /** 시/군/구, e.g. "안산시" or "천안시 서북구". */
  region2: string;
}

async function fetchRegionInfo(lat: number, lng: number): Promise<RegionInfo | null> {
  const apiKey = process.env.KAKAO_REST_API_KEY;
  if (!apiKey) return null;

  const cacheKey = `coord2address:${lat.toFixed(3)}:${lng.toFixed(3)}`;
  const cached = await getKV<RegionInfo>(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(
      `https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${lng}&y=${lat}`,
      { headers: { Authorization: `KakaoAK ${apiKey}` }, cache: "no-store" }
    );
    if (!res.ok) throw new Error(`Kakao coord2address returned ${res.status}`);

    const data = (await res.json()) as KakaoCoord2AddressResponse;
    const doc = data.documents?.[0];
    const address = doc?.road_address?.address_name || doc?.address?.address_name;
    const region1 = doc?.address?.region_1depth_name || doc?.road_address?.region_1depth_name;
    const region2 = doc?.address?.region_2depth_name || doc?.road_address?.region_2depth_name;
    if (!address || !region1) return null;

    const info: RegionInfo = { address, region1, region2: region2 ?? "" };
    await setKV(cacheKey, info, GEOCODE_CACHE_TTL_SECONDS);
    return info;
  } catch (err) {
    console.error("Failed to reverse geocode", err);
    return null;
  }
}

/** Reverse-geocodes coordinates (e.g. live browser geolocation) to a display address. */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const info = await fetchRegionInfo(lat, lng);
  return info?.address ?? null;
}

/** Reverse-geocodes coordinates to structured 시/도 + 시/군/구 names (for KMA region matching). */
export async function reverseGeocodeRegions(lat: number, lng: number): Promise<RegionInfo | null> {
  return fetchRegionInfo(lat, lng);
}

async function geocode(query: string, apiKey: string): Promise<GeoPoint | null> {
  const cacheKey = `geocode:${query}`;
  const cached = await getKV<GeoPoint>(cacheKey);
  if (cached) return cached;

  for (const candidate of buildGeocodeCandidates(query)) {
    const point = (await searchAddress(candidate, apiKey)) ?? (await searchKeyword(candidate, apiKey));
    if (point) {
      await setKV(cacheKey, point, GEOCODE_CACHE_TTL_SECONDS);
      return point;
    }
  }
  return null;
}

interface KakaoDirectionsResponse {
  routes: Array<{
    result_code: number;
    summary?: { duration: number; distance: number };
  }>;
}

async function drivingRoute(
  origin: GeoPoint,
  destination: GeoPoint,
  apiKey: string
): Promise<{ durationMinutes: number; distanceKm: number } | null> {
  const params = new URLSearchParams({
    origin: `${origin.lng},${origin.lat}`,
    destination: `${destination.lng},${destination.lat}`,
  });

  const res = await fetch(`https://apis-navi.kakaomobility.com/v1/directions?${params.toString()}`, {
    headers: { Authorization: `KakaoAK ${apiKey}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Kakao directions returned ${res.status}`);

  const data = (await res.json()) as KakaoDirectionsResponse;
  const route = data.routes?.[0];
  if (!route || route.result_code !== 0 || !route.summary) return null;

  return {
    durationMinutes: Math.round(route.summary.duration / 60),
    distanceKm: Math.round((route.summary.distance / 1000) * 10) / 10,
  };
}

// Kakao Map's link scheme places a pin (and pre-fills 길찾기) for both ends
// only when both /from/ and /to/ segments are given; /to/ alone leaves the
// start point for the user to type in manually.
function kakaoMapLink(origin: GeoPoint, destination: GeoPoint): string {
  const from = `${encodeURIComponent(origin.name)},${origin.lat},${origin.lng}`;
  const to = `${encodeURIComponent(destination.name)},${destination.lat},${destination.lng}`;
  return `https://map.kakao.com/link/from/${from}/to/${to}`;
}

function notFoundCommuteResult(destinationText: string): CommuteInfo {
  return {
    destination: destinationText,
    durationMinutes: null,
    distanceKm: null,
    mapLink: `https://map.kakao.com/?q=${encodeURIComponent(destinationText)}`,
    note: "위치를 찾을 수 없어 경로를 계산하지 못했습니다.",
    departureBy: null,
  };
}

function errorCommuteResult(destinationText: string): CommuteInfo {
  return {
    destination: destinationText,
    durationMinutes: null,
    distanceKm: null,
    mapLink: `https://map.kakao.com/?q=${encodeURIComponent(destinationText)}`,
    note: "경로 계산 중 오류가 발생했습니다.",
    departureBy: null,
  };
}

async function buildCommuteResult(
  origin: GeoPoint | null,
  destination: GeoPoint | null,
  destinationText: string,
  eventStartIso: string | null | undefined,
  apiKey: string
): Promise<CommuteInfo> {
  if (!origin || !destination) return notFoundCommuteResult(destinationText);

  const route = await drivingRoute(origin, destination, apiKey);
  return {
    destination: destination.name,
    durationMinutes: route?.durationMinutes ?? null,
    distanceKm: route?.distanceKm ?? null,
    mapLink: kakaoMapLink(origin, destination),
    note: route ? undefined : "자동차 경로를 계산하지 못했습니다. 지도에서 대중교통 경로를 확인하세요.",
    departureBy: computeDepartureBy(eventStartIso, route?.durationMinutes ?? null),
  };
}

/**
 * Resolves commute time/distance from homeAddress to the event's location text.
 * Only driving directions are available via Kakao's public REST API; a Kakao
 * Map link is always included so the user can check transit routes themselves.
 */
export async function getCommuteInfo(
  homeAddress: string,
  destinationText: string,
  eventStartIso?: string | null
): Promise<CommuteInfo | null> {
  const apiKey = process.env.KAKAO_REST_API_KEY;
  if (!apiKey || !homeAddress || !destinationText) return null;

  try {
    const [origin, destination] = await Promise.all([
      geocode(homeAddress, apiKey),
      geocode(destinationText, apiKey),
    ]);
    return await buildCommuteResult(origin, destination, destinationText, eventStartIso, apiKey);
  } catch (err) {
    console.error("Failed to compute commute info", err);
    return errorCommuteResult(destinationText);
  }
}

/**
 * Same as getCommuteInfo, but the origin is an already-known point (e.g. the
 * user's live browser geolocation) instead of a home address to geocode.
 */
export async function getCommuteInfoFromPoint(
  origin: GeoPoint,
  destinationText: string,
  eventStartIso?: string | null
): Promise<CommuteInfo | null> {
  const apiKey = process.env.KAKAO_REST_API_KEY;
  if (!apiKey || !destinationText) return null;

  try {
    const destination = await geocode(destinationText, apiKey);
    return await buildCommuteResult(origin, destination, destinationText, eventStartIso, apiKey);
  } catch (err) {
    console.error("Failed to compute commute info", err);
    return errorCommuteResult(destinationText);
  }
}
