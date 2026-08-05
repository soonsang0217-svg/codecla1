import { NextRequest, NextResponse } from "next/server";
import { getTopHeadlines } from "@/lib/news";
import { getSettings } from "@/lib/config";
import { handleApiError } from "@/lib/apiAuth";

const TAB_QUERIES: Record<string, string> = {
  politics: "정치",
  economy: "경제",
  society: "사회",
  world: "세계",
};

export async function GET(request: NextRequest) {
  try {
    const settings = await getSettings();
    const searchQuery = request.nextUrl.searchParams.get("q")?.trim();
    const tab = request.nextUrl.searchParams.get("tab") ?? "";

    const query = searchQuery || TAB_QUERIES[tab] || undefined;
    const news = await getTopHeadlines(settings.newsCountry, query);
    return NextResponse.json({ news });
  } catch (err) {
    return handleApiError(err);
  }
}
