"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { AppSettings } from "@/lib/config";

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [stockSymbolsInput, setStockSymbolsInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data: AppSettings) => {
        setSettings(data);
        setStockSymbolsInput(data.stockSymbols.join(", "));
      });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setSaved(false);
    const stockSymbols = stockSymbolsInput
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);

    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...settings, stockSymbols }),
    });
    const next = (await res.json()) as AppSettings;
    setSettings(next);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!settings) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-slate-400">불러오는 중...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-lg flex-1 p-4 sm:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">설정</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/calendar"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            캘린더
          </Link>
          <Link
            href="/briefing"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            브리핑으로
          </Link>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6 rounded-2xl bg-white p-6 shadow-sm">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            집 주소 (이동 경로 계산 기준)
          </label>
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={settings.homeAddress}
            onChange={(e) => setSettings({ ...settings, homeAddress: e.target.value })}
            placeholder="예: 서울시 강남구 테헤란로 123"
          />
          <p className="mt-1 text-xs text-slate-400">
            일정에 장소가 포함되어 있으면 이 주소를 기준으로 이동 시간을 계산합니다.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">관심 종목 (쉼표로 구분)</label>
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={stockSymbolsInput}
            onChange={(e) => setStockSymbolsInput(e.target.value)}
            placeholder="예: AAPL, MSFT, 005930, 035420"
          />
          <p className="mt-1 text-xs text-slate-400">
            해외 종목은 Finnhub 티커(예: AAPL), 국내 종목은 6자리 종목코드(예: 005930 삼성전자)를
            입력하세요. 섞어서 입력해도 됩니다.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">뉴스 국가 코드</label>
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={settings.newsCountry}
            onChange={(e) => setSettings({ ...settings, newsCountry: e.target.value })}
            placeholder="kr"
          />
          <p className="mt-1 text-xs text-slate-400">
            뉴스 탭/검색 결과의 언어·지역 기준입니다. 카테고리 탭과 검색은 브리핑 화면에서
            바로 바꿀 수 있습니다.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
          {saved && <span className="text-sm text-green-600">저장되었습니다</span>}
        </div>
      </form>
    </main>
  );
}
