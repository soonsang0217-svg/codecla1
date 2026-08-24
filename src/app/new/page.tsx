"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Stepper from "@/components/Stepper";
import type { GenerateOutput } from "@/lib/ai/types";

const TRANSCRIPT_HINT = "업로드 가능 형식: .txt, .docx";
const QUESTIONNAIRE_HINT = "업로드 가능 형식: .txt, .docx, .pdf";

interface FileSlot {
  fileName: string;
  text: string;
}

async function uploadAndExtract(file: File, kind: "transcript" | "questionnaire"): Promise<FileSlot> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("kind", kind);
  const res = await fetch("/api/extract", { method: "POST", body: formData });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "파일을 처리하지 못했습니다");
  return { fileName: data.fileName, text: data.text };
}

function FileDropInput({
  label,
  hint,
  accept,
  slot,
  error,
  onFile,
}: {
  label: string;
  hint: string;
  accept: string;
  slot: FileSlot | null;
  error: string | null;
  onFile: (file: File) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-neutral-800">{label}</label>
      <p className="text-xs text-neutral-400">{hint}</p>
      <input
        type="file"
        accept={accept}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
        className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-neutral-900 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white"
      />
      {slot && <p className="text-xs text-green-700">업로드됨: {slot.fileName} ({slot.text.length.toLocaleString()}자 추출)</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export default function NewInterviewPage() {
  const router = useRouter();
  const [step, setStep] = useState<2 | 3>(2);

  const [intervieweeName, setIntervieweeName] = useState("");
  const [scope, setScope] = useState("전체");
  const [transcript, setTranscript] = useState<FileSlot | null>(null);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [questionnaire, setQuestionnaire] = useState<FileSlot | null>(null);
  const [questionnaireError, setQuestionnaireError] = useState<string | null>(null);

  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [result, setResult] = useState<(GenerateOutput & { id: string }) | null>(null);

  const canProceed = !!transcript && intervieweeName.trim().length > 0;

  async function handleTranscriptFile(file: File) {
    setTranscriptError(null);
    try {
      setTranscript(await uploadAndExtract(file, "transcript"));
    } catch (err) {
      setTranscript(null);
      setTranscriptError(err instanceof Error ? err.message : "업로드 실패");
    }
  }

  async function handleQuestionnaireFile(file: File) {
    setQuestionnaireError(null);
    try {
      setQuestionnaire(await uploadAndExtract(file, "questionnaire"));
    } catch (err) {
      setQuestionnaire(null);
      setQuestionnaireError(err instanceof Error ? err.message : "업로드 실패");
    }
  }

  async function handleGenerate() {
    if (!transcript) return;
    setGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: transcript.text,
          questionnaire: questionnaire?.text ?? "",
          scope,
          intervieweeName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "생성에 실패했습니다");
      setResult(data);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "생성에 실패했습니다");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <Stepper current={step} />

      {step === 2 && (
        <div className="space-y-5 rounded-lg border border-neutral-200 bg-white p-6">
          <h1 className="text-lg font-semibold">업로드</h1>

          <FileDropInput
            label="인터뷰 녹취 텍스트"
            hint={TRANSCRIPT_HINT}
            accept=".txt,.docx"
            slot={transcript}
            error={transcriptError}
            onFile={handleTranscriptFile}
          />
          <FileDropInput
            label="질문지 (선택)"
            hint={QUESTIONNAIRE_HINT}
            accept=".txt,.docx,.pdf"
            slot={questionnaire}
            error={questionnaireError}
            onFile={handleQuestionnaireFile}
          />

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-neutral-800">인터뷰이 이름</label>
            <input
              value={intervieweeName}
              onChange={(e) => setIntervieweeName(e.target.value)}
              placeholder="예: 김민준"
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-neutral-800">작업 범위</label>
            <input
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              placeholder='예: "전체", "질문 6번까지", "첨부한 분량까지"'
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>

          <button
            disabled={!canProceed}
            onClick={() => setStep(3)}
            className="w-full rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            다음: AI 생성
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-5 rounded-lg border border-neutral-200 bg-white p-6">
          <h1 className="text-lg font-semibold">AI 생성</h1>

          {!result && (
            <>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt className="text-neutral-400">인터뷰이</dt>
                <dd>{intervieweeName}</dd>
                <dt className="text-neutral-400">작업 범위</dt>
                <dd>{scope || "전체"}</dd>
                <dt className="text-neutral-400">녹취록</dt>
                <dd>{transcript?.fileName}</dd>
                <dt className="text-neutral-400">질문지</dt>
                <dd>{questionnaire?.fileName ?? "(없음)"}</dd>
              </dl>

              {generateError && <p className="text-sm text-red-600">{generateError}</p>}

              <div className="flex gap-2">
                <button
                  onClick={() => setStep(2)}
                  disabled={generating}
                  className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium disabled:opacity-40"
                >
                  이전
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="flex-1 rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  {generating ? "AI가 기사를 작성하는 중... (최대 1분)" : "AI 생성 시작"}
                </button>
              </div>
            </>
          )}

          {result && (
            <div className="space-y-4">
              <p className="text-sm text-green-700">초안 생성이 완료되었습니다.</p>

              <div>
                <h2 className="text-sm font-semibold text-neutral-800">AI가 수정한 부분</h2>
                <div className="mt-1 space-y-2 text-sm">
                  <div>
                    <p className="font-medium text-neutral-600">STT 오류 교정</p>
                    {result.revisionSummary.sttFixes.length === 0 ? (
                      <p className="text-neutral-400">없음</p>
                    ) : (
                      <ul className="list-disc space-y-0.5 pl-4">
                        {result.revisionSummary.sttFixes.map((f, i) => (
                          <li key={i}>{f}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-neutral-600">오프 더 레코드로 제외한 항목</p>
                    {result.revisionSummary.offRecordExcluded.length === 0 ? (
                      <p className="text-neutral-400">없음</p>
                    ) : (
                      <ul className="list-disc space-y-0.5 pl-4">
                        {result.revisionSummary.offRecordExcluded.map((f, i) => (
                          <li key={i}>{f}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-neutral-600">확인이 필요한 항목</p>
                    {result.needsCheck.length === 0 ? (
                      <p className="text-neutral-400">없음</p>
                    ) : (
                      <ul className="list-disc space-y-0.5 pl-4">
                        {result.needsCheck.map((f, i) => (
                          <li key={i}>
                            {f.item} — {f.reason}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={() => router.push(`/interview/${result.id}`)}
                className="w-full rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white"
              >
                검토·수정 하러 가기
              </button>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
