import { NextRequest, NextResponse } from "next/server";
import { searchPlaceSuggestions } from "@/lib/directions";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") ?? "";
  const results = await searchPlaceSuggestions(query);
  return NextResponse.json({ results });
}
