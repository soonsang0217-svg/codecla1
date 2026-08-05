import { getKV, setKV } from "./db";

export interface NewsItem {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
}

const CACHE_TTL_SECONDS = 600; // 10 minutes

interface NewsApiArticle {
  title: string;
  url: string;
  source: { name: string };
  publishedAt: string;
}

interface NewsApiResponse {
  status: string;
  articles: NewsApiArticle[];
}

export async function getTopHeadlines(country: string, query?: string): Promise<NewsItem[]> {
  const apiKey = process.env.NEWSAPI_KEY;
  if (!apiKey) return [];

  const cacheKey = `news:${country}:${query ?? ""}`;
  const cached = getKV<NewsItem[]>(cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams({ apiKey, pageSize: "8" });
  if (query) {
    params.set("q", query);
  } else {
    params.set("country", country);
  }

  try {
    const res = await fetch(`https://newsapi.org/v2/top-headlines?${params.toString()}`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`NewsAPI returned ${res.status}`);
    const data = (await res.json()) as NewsApiResponse;

    const items: NewsItem[] = (data.articles ?? []).map((a) => ({
      title: a.title,
      url: a.url,
      source: a.source?.name ?? "",
      publishedAt: a.publishedAt,
    }));

    setKV(cacheKey, items, CACHE_TTL_SECONDS);
    return items;
  } catch (err) {
    console.error("Failed to fetch news", err);
    return [];
  }
}
