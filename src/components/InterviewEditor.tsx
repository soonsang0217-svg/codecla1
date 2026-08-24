"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Stepper from "@/components/Stepper";
import {
  characterCount,
  estimatedReadingMinutes,
  type ArticleContent,
  type NeedsCheckItem,
} from "@/lib/article";
import { articleToClipboardHtml } from "@/lib/clipboard-html";

interface Props {
  id: string;
  intervieweeName: string;
  status: "draft" | "complete";
  article: ArticleContent;
  needsCheck: NeedsCheckItem[];
  updatedAt: string;
}

type SaveState = "idle" | "saving" | "saved" | "error";

export default function InterviewEditor({ id, intervieweeName, status: initialStatus, article: initialArticle, needsCheck: initialNeedsCheck }: Props) {
  const [tab, setTab] = useState<"edit" | "finish">("edit");
  const [article, setArticle] = useState<ArticleContent>(initialArticle);
  const [needsCheck, setNeedsCheck] = useState<NeedsCheckItem[]>(initialNeedsCheck);
  const [status, setStatus] = useState(initialStatus);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextAutosave = useRef(true); // don't autosave on initial mount

  const save = useCallback(
    async (nextArticle: ArticleContent, nextNeedsCheck: NeedsCheckItem[]) => {
      setSaveState("saving");
      try {
        const res = await fetch(`/api/interviews/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ article: nextArticle, needsCheck: nextNeedsCheck }),
        });
        setSaveState(res.ok ? "saved" : "error");
      } catch {
        setSaveState("error");
      }
    },
    [id],
  );

  useEffect(() => {
    if (skipNextAutosave.current) {
      skipNextAutosave.current = false;
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save(article, needsCheck), 1500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article, needsCheck]);

  async function handleManualSave() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    await save(article, needsCheck);
  }

  async function toggleStatus() {
    const next = status === "draft" ? "complete" : "draft";
    setStatus(next);
    await fetch(`/api/interviews/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
  }

  async function handleCopyForBrunch() {
    const html = articleToClipboardHtml(article);
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([html.replace(/<[^>]+>/g, "")], { type: "text/plain" }),
        }),
      ]);
      setCopyMessage("복사되었습니다. 브런치 에디터에 붙여넣으세요.");
    } catch {
      setCopyMessage("클립보드 복사에 실패했습니다. 브라우저 권한을 확인해주세요.");
    }
    setTimeout(() => setCopyMessage(null), 4000);
  }

  const chars = characterCount(article);
  const minutes = estimatedReadingMinutes(article);

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Stepper current={tab === "edit" ? 4 : 5} />
        <span
          className={
            "rounded-full px-2 py-0.5 text-xs font-medium " +
            (status === "complete" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700")
          }
        >
          {status === "complete" ? "완료" : "작업중"}
        </span>
      </div>

      <div className="flex gap-1 border-b border-neutral-200">
        <button
          onClick={() => setTab("edit")}
          className={"px-3 py-2 text-sm font-medium " + (tab === "edit" ? "border-b-2 border-neutral-900" : "text-neutral-400")}
        >
          4. 검토·수정
        </button>
        <button
          onClick={() => setTab("finish")}
          className={"px-3 py-2 text-sm font-medium " + (tab === "finish" ? "border-b-2 border-neutral-900" : "text-neutral-400")}
        >
          5. 완료
        </button>
      </div>

      {tab === "edit" && (
        <div className="grid gap-6 lg:grid-cols-[1fr_240px]">
          <EditorForm article={article} setArticle={setArticle} needsCheck={needsCheck} setNeedsCheck={setNeedsCheck} />

          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-lg border border-neutral-200 bg-white p-4 text-sm">
              <p className="text-neutral-400">현재 분량</p>
              <p className="text-xl font-semibold">{chars.toLocaleString()}자</p>
              <p className="mt-3 text-neutral-400">예상 읽기 시간</p>
              <p className="text-xl font-semibold">약 {minutes}분</p>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-white p-4 text-sm">
              <button
                onClick={handleManualSave}
                className="w-full rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white"
              >
                저장
              </button>
              <p className="mt-2 text-center text-xs text-neutral-400">
                {saveState === "saving" && "저장 중..."}
                {saveState === "saved" && "자동 저장됨"}
                {saveState === "error" && "저장 실패"}
                {saveState === "idle" && "수정하면 자동 저장됩니다"}
              </p>
            </div>
          </aside>
        </div>
      )}

      {tab === "finish" && (
        <div className="max-w-xl space-y-4 rounded-lg border border-neutral-200 bg-white p-6">
          <button
            onClick={toggleStatus}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-50"
          >
            {status === "complete" ? "작업중으로 되돌리기" : "완료로 표시"}
          </button>

          <a
            href={`/api/interviews/${id}/docx`}
            className="block w-full rounded-lg bg-neutral-900 px-3 py-2 text-center text-sm font-medium text-white"
          >
            워드 파일 다운로드 (.docx)
          </a>

          <div className="space-y-2 rounded-lg border border-dashed border-neutral-300 p-4">
            <p className="text-sm font-medium text-neutral-800">브런치 업로드용 준비</p>
            <p className="text-xs text-neutral-500">
              브런치는 공식 발행 API가 없어 자동 업로드는 지원하지 않습니다. 아래 버튼으로 서식이 유지된 본문을
              복사한 뒤, 브런치 에디터에 붙여넣어 주세요.
            </p>
            <button
              onClick={handleCopyForBrunch}
              className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50"
            >
              브런치용 서식 복사
            </button>
            {copyMessage && <p className="text-xs text-neutral-500">{copyMessage}</p>}
            <div className="flex gap-3 pt-1 text-sm">
              <a href="https://brunch.co.kr" target="_blank" rel="noopener noreferrer" className="text-neutral-700 underline">
                브런치 메인 열기
              </a>
              <a href="https://brunch.co.kr/write" target="_blank" rel="noopener noreferrer" className="text-neutral-700 underline">
                브런치 글쓰기 페이지 열기
              </a>
            </div>
          </div>

          <p className="text-xs text-neutral-400">인터뷰이: {intervieweeName}</p>
        </div>
      )}
    </main>
  );
}

function EditorForm({
  article,
  setArticle,
  needsCheck,
  setNeedsCheck,
}: {
  article: ArticleContent;
  setArticle: React.Dispatch<React.SetStateAction<ArticleContent>>;
  needsCheck: NeedsCheckItem[];
  setNeedsCheck: React.Dispatch<React.SetStateAction<NeedsCheckItem[]>>;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
        <input
          value={article.title}
          onChange={(e) => setArticle((a) => ({ ...a, title: e.target.value }))}
          className="w-full border-b border-transparent text-lg font-semibold outline-none focus:border-neutral-300"
          placeholder="제목"
        />
        <input
          value={article.subtitle}
          onChange={(e) => setArticle((a) => ({ ...a, subtitle: e.target.value }))}
          className="w-full text-sm text-neutral-500 outline-none"
          placeholder="부제"
        />
      </div>

      <Field label="인트로 (3문단)">
        {article.intro.map((p, i) => (
          <textarea
            key={i}
            value={p}
            onChange={(e) =>
              setArticle((a) => ({ ...a, intro: a.intro.map((x, xi) => (xi === i ? e.target.value : x)) }))
            }
            rows={3}
            className="w-full rounded border border-neutral-300 p-2 text-sm italic"
          />
        ))}
      </Field>

      <Field label="[약력]">
        <textarea
          value={article.bio}
          onChange={(e) => setArticle((a) => ({ ...a, bio: e.target.value }))}
          rows={3}
          className="w-full rounded border border-neutral-300 bg-neutral-50 p-2 text-sm"
        />
      </Field>

      {article.sections.map((section, si) => (
        <div key={si} className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <input
              value={section.heading}
              onChange={(e) =>
                setArticle((a) => ({
                  ...a,
                  sections: a.sections.map((s, i) => (i === si ? { ...s, heading: e.target.value } : s)),
                }))
              }
              className="flex-1 border-b border-neutral-200 pb-1 text-sm font-semibold outline-none"
              placeholder="섹션 제목"
            />
            <button
              onClick={() => setArticle((a) => ({ ...a, sections: a.sections.filter((_, i) => i !== si) }))}
              className="text-xs text-neutral-400 hover:text-red-600"
            >
              섹션 삭제
            </button>
          </div>

          {section.qa.map((qa, qi) => (
            <div key={qi} className="space-y-1 rounded border border-neutral-100 bg-neutral-50 p-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-neutral-400">Q</span>
                <input
                  value={qa.question}
                  onChange={(e) =>
                    setArticle((a) => ({
                      ...a,
                      sections: a.sections.map((s, i) =>
                        i === si ? { ...s, qa: s.qa.map((q, j) => (j === qi ? { ...q, question: e.target.value } : q)) } : s,
                      ),
                    }))
                  }
                  className="flex-1 rounded border border-neutral-300 px-2 py-1 text-sm font-medium"
                />
                {qa.isExtra && <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700">현장 추가</span>}
                <button
                  onClick={() =>
                    setArticle((a) => ({
                      ...a,
                      sections: a.sections.map((s, i) => (i === si ? { ...s, qa: s.qa.filter((_, j) => j !== qi) } : s)),
                    }))
                  }
                  className="text-xs text-neutral-400 hover:text-red-600"
                >
                  삭제
                </button>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-1.5 text-xs font-medium text-neutral-400">A</span>
                <textarea
                  value={qa.answer}
                  onChange={(e) =>
                    setArticle((a) => ({
                      ...a,
                      sections: a.sections.map((s, i) =>
                        i === si ? { ...s, qa: s.qa.map((q, j) => (j === qi ? { ...q, answer: e.target.value } : q)) } : s,
                      ),
                    }))
                  }
                  rows={3}
                  className="flex-1 rounded border border-neutral-300 px-2 py-1 text-sm"
                />
              </div>
            </div>
          ))}
          <button
            onClick={() =>
              setArticle((a) => ({
                ...a,
                sections: a.sections.map((s, i) =>
                  i === si ? { ...s, qa: [...s.qa, { question: "", answer: "", isExtra: false }] } : s,
                ),
              }))
            }
            className="text-xs text-neutral-500 hover:text-neutral-900"
          >
            + 질문 추가
          </button>
        </div>
      ))}
      <button
        onClick={() => setArticle((a) => ({ ...a, sections: [...a.sections, { heading: "새 섹션", qa: [] }] }))}
        className="w-full rounded-lg border border-dashed border-neutral-300 py-2 text-sm text-neutral-500 hover:bg-neutral-50"
      >
        + 섹션 추가
      </button>

      <Field label="아웃트로">
        {article.outro.length === 0 ? (
          <button
            onClick={() => setArticle((a) => ({ ...a, outro: ["", ""] }))}
            className="text-xs text-neutral-500 hover:text-neutral-900"
          >
            + 아웃트로 추가 (구간 작업이라 없으면 생략)
          </button>
        ) : (
          <>
            {article.outro.map((p, i) => (
              <textarea
                key={i}
                value={p}
                onChange={(e) =>
                  setArticle((a) => ({ ...a, outro: a.outro.map((x, xi) => (xi === i ? e.target.value : x)) }))
                }
                rows={3}
                className="w-full rounded border border-neutral-300 p-2 text-sm italic"
              />
            ))}
            <button onClick={() => setArticle((a) => ({ ...a, outro: [] }))} className="text-xs text-neutral-400 hover:text-red-600">
              아웃트로 없음으로 변경
            </button>
          </>
        )}
      </Field>

      <Field label="확인 필요 항목">
        {needsCheck.length === 0 ? (
          <p className="text-sm text-neutral-400">없음</p>
        ) : (
          <ul className="space-y-2">
            {needsCheck.map((item, i) => (
              <li key={i} className="flex items-center gap-2 rounded bg-amber-50 p-2 text-sm">
                <input
                  value={item.item}
                  onChange={(e) => setNeedsCheck((list) => list.map((x, xi) => (xi === i ? { ...x, item: e.target.value } : x)))}
                  className="w-40 rounded border border-neutral-300 px-2 py-1"
                />
                <input
                  value={item.reason}
                  onChange={(e) => setNeedsCheck((list) => list.map((x, xi) => (xi === i ? { ...x, reason: e.target.value } : x)))}
                  className="flex-1 rounded border border-neutral-300 px-2 py-1"
                />
                <button onClick={() => setNeedsCheck((list) => list.filter((_, xi) => xi !== i))} className="text-neutral-400 hover:text-red-600">
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          onClick={() => setNeedsCheck((list) => [...list, { item: "", reason: "" }])}
          className="mt-2 text-xs text-neutral-500 hover:text-neutral-900"
        >
          + 항목 추가
        </button>
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 rounded-lg border border-neutral-200 bg-white p-4">
      <p className="text-xs font-medium text-neutral-500">{label}</p>
      {children}
    </div>
  );
}
