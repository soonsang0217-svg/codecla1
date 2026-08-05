import { getKV, setKV } from "./db";

export interface GeoPoint {
  lat: number;
  lng: number;
  name: string;
}

export interface CommuteInfo {
  destination: string;
  durationMinutes: number | null;
  distanceKm: number | null;
  mapLink: string;
  note?: string;
}

const GEOCODE_CACHE_TTL_SECONDS = 60 * 60 * 24; // 24h

interface KakaoKeywordDoc {
  place_name: string;
  x: string; // lng
  y: string; // lat
}

interface KakaoKeywordResponse {
  documents: KakaoKeywordDoc[];
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

async function geocode(query: string, apiKey: string): Promise<GeoPoint | null> {
  const cacheKey = `geocode:${query}`;
  const cached = await getKV<GeoPoint>(cacheKey);
  if (cached) return cached;

  const point = (await searchAddress(query, apiKey)) ?? (await searchKeyword(query, apiKey));
  if (!point) return null;

  await setKV(cacheKey, point, GEOCODE_CACHE_TTL_SECONDS);
  return point;
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

function kakaoMapLink(destination: GeoPoint): string {
  return `https://map.kakao.com/link/to/${encodeURIComponent(destination.name)},${destination.lat},${destination.lng}`;
}

/**
 * Resolves commute time/distance from homeAddress to the event's location text.
 * Only driving directions are available via Kakao's public REST API; a Kakao
 * Map link is always included so the user can check transit routes themselves.
 */
export async function getCommuteInfo(
  homeAddress: string,
  destinationText: string
): Promise<CommuteInfo | null> {
  const apiKey = process.env.KAKAO_REST_API_KEY;
  if (!apiKey || !homeAddress || !destinationText) return null;

  try {
    const [origin, destination] = await Promise.all([
      geocode(homeAddress, apiKey),
      geocode(destinationText, apiKey),
    ]);

    if (!origin || !destination) {
      return {
        destination: destinationText,
        durationMinutes: null,
        distanceKm: null,
        mapLink: `https://map.kakao.com/?q=${encodeURIComponent(destinationText)}`,
        note: "위치를 찾을 수 없어 경로를 계산하지 못했습니다.",
      };
    }

    const route = await drivingRoute(origin, destination, apiKey);
    return {
      destination: destination.name,
      durationMinutes: route?.durationMinutes ?? null,
      distanceKm: route?.distanceKm ?? null,
      mapLink: kakaoMapLink(destination),
      note: route ? undefined : "자동차 경로를 계산하지 못했습니다. 지도에서 대중교통 경로를 확인하세요.",
    };
  } catch (err) {
    console.error("Failed to compute commute info", err);
    return {
      destination: destinationText,
      durationMinutes: null,
      distanceKm: null,
      mapLink: `https://map.kakao.com/?q=${encodeURIComponent(destinationText)}`,
      note: "경로 계산 중 오류가 발생했습니다.",
    };
  }
}
