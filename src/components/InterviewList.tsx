"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";

interface InterviewSummary {
  id: string;
  intervieweeName: string;
  status: "draft" | "complete";
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function InterviewList({ currentUsername, isAdmin }: { currentUsername: string; isAdmin: boolean }) {
  const [interviews, setInterviews] = useState<InterviewSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/interviews");
        const raw = await res.text();
        const data = raw ? JSON.parse(raw) : {};
        if (!res.ok) throw new Error(data.error ?? `목록을 불러오지 못했습니다 (status ${res.status})`);
        setInterviews(data.interviews ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "목록을 불러오지 못했습니다");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <p className="text-sm text-neutral-400">불러오는 중...</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (interviews.length === 0) return <p className="text-sm text-neutral-400">아직 작업한 인터뷰가 없습니다</p>;

  return (
    <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
      {interviews.map((iv) => {
        const isOwner = isAdmin || iv.createdBy === currentUsername;
        return (
          <li key={iv.id}>
            <Link href={`/interview/${iv.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50">
              <div>
                <p className="flex items-center gap-1 text-sm font-medium">
                  {iv.intervieweeName}
                  {!isOwner && (
                    <span title="작성자만 열람 및 편집할 수 있습니다" className="text-xs text-neutral-400">
                      🔒
                    </span>
                  )}
                </p>
                <p className="text-xs text-neutral-400">
                  작성자: {iv.createdBy ?? "알 수 없음"} · 수정: {format(new Date(iv.updatedAt), "yyyy-MM-dd HH:mm")}
                </p>
              </div>
              <span
                className={
                  "rounded-full px-2 py-0.5 text-xs font-medium " +
                  (iv.status === "complete" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700")
                }
              >
                {iv.status === "complete" ? "완료" : "작업중"}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
