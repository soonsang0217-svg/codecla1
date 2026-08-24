"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Stepper from "@/components/Stepper";
import type { GenerateOutput } from "@/lib/ai/types";

const TRANSCRIPT_HINT = "업로드 가능 형식: .txt, .docx";
const QUESTIONNAIRE_HINT = "업로드 가능 형식: .txt, .docx, .pdf";
// 이 도구는 항상 업로드된 녹취록 전체를 대상으로 기사를 작성합니다.
const SCOPE = "전체";

interface FileSlot {
  fileName: string;
  text: string;
}

async function uploadAndExtract(file: File, kind: "transcript" | "questionnaire"): Promise<FileSlot> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("kind", kind);
  const res = await fetch("/api/extract", { method: "POST", body: formData });
  const raw = await res.text();
  let data: { fileName?: string; text?: string; error?: string };
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(`서버 오류로 파일을 처리하지 못했습니다 (status ${res.status})`);
  }
  if (!res.ok) throw new Error(data.error ?? `파일을 처리하지 못했습니다 (status ${res.status})`);
  return { fileName: data.fileName ?? file.name, text: data.text ?? "" };
}

function FileDropInput({
  label,
  hint,
  accept,
  slot,
  error,
  uploading,
  onFile,
  onRemove,
}: {
  label: string;
  hint: string;
  accept: string;
  slot: FileSlot | null;
  error: string | null;
  uploading: boolean;
  onFile: (file: File) => void;
  onRemove: () => void;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (file) onFile(file);
  }

  const showUploaded = !!slot && !uploading;

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-neutral-800">
        {label}
      </label>
      <p className="text-xs text-neutral-400">{hint}</p>

      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={
          "rounded-lg border-2 border-dashed px-4 py-3 text-center transition-colors " +
          (showUploaded
            ? "cursor-default border-green-200 bg-green-50 py-2.5"
            : "cursor-pointer py-6 " + (dragging ? "border-neutral-900 bg-neutral-100" : "border-neutral-300 hover:border-neutral-400"))
        }
      >
        {showUploaded ? (
          <div className="flex items-center justify-between gap-2 text-left">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-green-800">{slot.fileName}</p>
              <p className="text-xs text-green-600">{slot.text.length.toLocaleString()}자 추출됨</p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
                inputRef.current?.click();
              }}
              className="shrink-0 rounded border border-green-300 bg-white px-2 py-1 text-xs font-medium text-green-800 hover:bg-green-100"
            >
              파일 변경
            </button>
          </div>
        ) : uploading ? (
          <p className="text-sm text-neutral-500">업로드 중...</p>
        ) : (
          <p className="flex flex-col items-center gap-1 text-sm text-neutral-600">
            파일을 여기로 <span className="font-medium text-neutral-900">드래그 앤 드롭</span>하거나 클릭해서 선택하세요
          </p>
        )}
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept={accept}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
          className="hidden"
        />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export default function NewInterviewPage() {
  const router = useRouter();
  const [step, setStep] = useState<2 | 3>(2);

  const [intervieweeName, setIntervieweeName] = useState("");
  const [transcript, setTranscript] = useState<FileSlot | null>(null);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [transcriptUploading, setTranscriptUploading] = useState(false);
  const [questionnaire, setQuestionnaire] = useState<FileSlot | null>(null);
  const [questionnaireError, setQuestionnaireError] = useState<string | null>(null);
  const [questionnaireUploading, setQuestionnaireUploading] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [result, setResult] = useState<(GenerateOutput & { id: string }) | null>(null);

  const canProceed = !!transcript && intervieweeName.trim().length > 0;

  async function handleTranscriptFile(file: File) {
    setTranscriptError(null);
    setTranscriptUploading(true);
    try {
      setTranscript(await uploadAndExtract(file, "transcript"));
    } catch (err) {
      setTranscript(null);
      setTranscriptError(err instanceof Error ? err.message : "업로드 실패");
    } finally {
      setTranscriptUploading(false);
    }
  }

  async function handleQuestionnaireFile(file: File) {
    setQuestionnaireError(null);
    setQuestionnaireUploading(true);
    try {
      setQuestionnaire(await uploadAndExtract(file, "questionnaire"));
    } catch (err) {
      setQuestionnaire(null);
      setQuestionnaireError(err instanceof Error ? err.message : "업로드 실패");
    } finally {
      setQuestionnaireUploading(false);
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
          scope: SCOPE,
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
          <div>
            <h1 className="text-lg font-semibold">업로드</h1>
            <p className="mt-1 text-sm text-neutral-500">
              업로드한 녹취록 전체를 대상으로 기사 초안을 만듭니다. 일부만 반영하고 싶다면, 필요한 부분만 담은 파일을 올려주세요.
            </p>
          </div>

          <FileDropInput
            label="인터뷰 녹취 텍스트"
            hint={TRANSCRIPT_HINT}
            accept=".txt,.docx"
            slot={transcript}
            error={transcriptError}
            uploading={transcriptUploading}
            onFile={handleTranscriptFile}
            onRemove={() => setTranscript(null)}
          />
          <FileDropInput
            label="질문지 (선택)"
            hint={QUESTIONNAIRE_HINT}
            accept=".txt,.docx,.pdf"
            slot={questionnaire}
            error={questionnaireError}
            uploading={questionnaireUploading}
            onFile={handleQuestionnaireFile}
            onRemove={() => setQuestionnaire(null)}
          />

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-neutral-800">인터뷰이 이름</label>
            <p className="text-xs text-neutral-400">기사 제목, 저장 목록, 완료 후 워드 파일명에 쓰입니다.</p>
            <input
              value={intervieweeName}
              onChange={(e) => setIntervieweeName(e.target.value)}
              placeholder="예: 김민준"
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
