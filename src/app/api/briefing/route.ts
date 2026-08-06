import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/apiAuth";
import { getBriefingData } from "@/lib/briefing";
import { parseLocationFromRequest } from "@/lib/directions";

export async function GET(request: Request) {
  try {
    const currentLocation = parseLocationFromRequest(request);
    const data = await getBriefingData(currentLocation);
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
