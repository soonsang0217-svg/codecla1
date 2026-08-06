import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/apiAuth";
import { getBriefingData } from "@/lib/briefing";
import type { GeoPoint } from "@/lib/directions";

// The browser sends its live geolocation as ?lat=&lng= on every load/refresh
// (see briefing/page.tsx); when present it takes priority over the
// configured home address for both weather and commute calculations.
function parseCurrentLocation(request: Request): GeoPoint | null {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, name: "현재 위치" };
}

export async function GET(request: Request) {
  try {
    const currentLocation = parseCurrentLocation(request);
    const data = await getBriefingData(currentLocation);
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
