import { XMLParser } from "fast-xml-parser";
import { getKV, setKV } from "./db";

export interface NewsItem {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
}

const CACHE_TTL_SECONDS = 600; // 10 minutes
const MAX_ITEMS = 8;

// Maps a 2-letter country code to the Google News UI language it publishes
// headlines in. Falls back to English for anything not listed.
const COUNTRY_TO_LANGUAGE: Record<string, string> = {
  kr: "ko",
  us: "en",
  gb: "en",
  jp: "ja",
  cn: "zh-Hans",
  fr: "fr",
  de: "de",
};

const parser = new XMLParser({ ignoreAttributes: true });

interface GoogleNewsRssItem {
  title?: string;
  link?: string;
  pubDate?: string;
  source?: string | { "#text"?: string };
}

function sourceName(source: GoogleNewsRssItem["source"]): string {
  if (typeof source === "string") return source;
  return source?.["#text"] ?? "";
}

export async function getTopHeadlines(country: string, query?: string): Promise<NewsItem[]> {
  const cacheKey = `news:${country}:${query ?? ""}`;
  const cached = await getKV<NewsItem[]>(cacheKey);
  if (cached) return cached;

  const gl = (country || "kr").toUpperCase();
  const hl = COUNTRY_TO_LANGUAGE[country.toLowerCase()] ?? "en";
  const ceid = `${gl}:${hl}`;

  const feedUrl = query
    ? `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${hl}&gl=${gl}&ceid=${ceid}`
    : `https://news.google.com/rss?hl=${hl}&gl=${gl}&ceid=${ceid}`;

  try {
    const res = await fetch(feedUrl, { cache: "no-store" });
    if (!res.ok) throw new Error(`Google News RSS returned ${res.status}`);

    const xml = await res.text();
    const data = parser.parse(xml);
    const rawItems: GoogleNewsRssItem | GoogleNewsRssItem[] = data?.rss?.channel?.item ?? [];
    const items = Array.isArray(rawItems) ? rawItems : [rawItems];

    const news: NewsItem[] = items
      .filter((item) => item.title && item.link)
      .slice(0, MAX_ITEMS)
      .map((item) => ({
        title: item.title!,
        url: item.link!,
        source: sourceName(item.source),
        publishedAt: item.pubDate ?? "",
      }));

    await setKV(cacheKey, news, CACHE_TTL_SECONDS);
    return news;
  } catch (err) {
    console.error("Failed to fetch news", err);
    return [];
  }
}
