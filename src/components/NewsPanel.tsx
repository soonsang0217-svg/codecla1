"use client";

import { useCallback, useEffect, useState } from "react";
import type { NewsItem } from "@/lib/types";
import { formatRelativeTime } from "@/lib/format";

const TABS: { id: string; label: string }[] = [
  { id: "headlines", label: "헤드라인" },
  { id: "politics", label: "정치" },
  { id: "economy", label: "경제" },
  { id: "society", label: "사회" },
  { id: "world", label: "세계" },
];

export default function NewsPanel() {
  const [activeTab, setActiveTab] = useState("headlines");
  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState<string | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (activeSearch) {
        params.set("q", activeSearch);
      } else {
        params.set("tab", activeTab);
      }
      const res = await fetch(`/api/news?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("뉴스를 불러오지 못했습니다.");
      const data = (await res.json()) as { news: NewsItem[] };
      setNews(data.news ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류");
    } finally {
      setLoading(false);
    }
  }, [activeTab, activeSearch]);

  useEffect(() => {
    queueMicrotask(load);
  }, [load]);

  function selectTab(tabId: string) {
    setActiveSearch(null);
    setSearchInput("");
    setActiveTab(tabId);
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = searchInput.trim();
    if (!trimmed) return;
    setActiveSearch(trimmed);
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => selectTab(tab.id)}
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                !activeSearch && activeTab === tab.id
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <form onSubmit={submitSearch} className="ml-auto flex items-center gap-1">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="뉴스 검색"
            className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-sm sm:w-40"
          />
          <button
            type="submit"
            className="rounded-lg border border-slate-300 px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
          >
            검색
          </button>
        </form>
      </div>

      {activeSearch && (
        <p className="mb-2 text-xs text-slate-400">
          &quot;{activeSearch}&quot; 검색 결과
          <button
            onClick={() => selectTab("headlines")}
            className="ml-2 text-blue-600 hover:underline"
          >
            지우기
          </button>
        </p>
      )}

      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

      <div className="space-y-2">
        {!loading && news.length === 0 && !error && (
          <p className="text-sm text-slate-400">불러올 뉴스가 없습니다.</p>
        )}
        {news.map((item) => (
          <a
            key={item.url}
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="block rounded-xl border border-slate-200 bg-white p-3 shadow-sm hover:border-slate-300"
          >
            <p className="text-sm font-medium text-slate-900">{item.title}</p>
            <p className="mt-1 text-xs text-slate-400">
              {item.source}
              {item.publishedAt && ` · ${formatRelativeTime(item.publishedAt)}`}
            </p>
          </a>
        ))}
      </div>
    </div>
  );
}
