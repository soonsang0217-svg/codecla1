import { z } from "zod";

// Structured output schema shared by every AI provider implementation.
// Keep this in sync with src/lib/article.ts's ArticleContent/RevisionSummary/NeedsCheckItem types.

export const qaItemSchema = z.object({
  question: z.string(),
  answer: z.string(),
  isExtra: z
    .boolean()
    .describe(
      "질문지에는 없었지만 인터뷰 현장에서 추가로 나온 좋은 질문이면 true, 원래 질문지에 있던 질문이면 false",
    ),
});

export const articleSectionSchema = z.object({
  heading: z.string().describe("섹션 제목 (예: '커리어에 대하여')"),
  qa: z.array(qaItemSchema),
});

export const articleContentSchema = z.object({
  title: z.string().describe("기사 제목"),
  subtitle: z.string().describe("부제. 고정값 '[대신 만나드립니다]'을 그대로 사용"),
  intro: z
    .array(z.string())
    .length(3)
    .describe("인트로 3문단. 각 배열 원소가 한 문단"),
  bio: z.string().describe("[약력] 박스에 들어갈 내용"),
  sections: z.array(articleSectionSchema),
  outro: z
    .array(z.string())
    .describe(
      "아웃트로 문단들(보통 2문단). 구간(부분) 작업이라 마무리 멘트가 없으면 빈 배열([])을 반환",
    ),
});

export const needsCheckItemSchema = z.object({
  item: z.string().describe("확인이 필요한 인명/기관명/연도/수치 등"),
  reason: z.string().describe("왜 확인이 필요한지 짧은 설명"),
});

export const revisionSummarySchema = z.object({
  sttFixes: z
    .array(z.string())
    .describe("STT 오류 교정 내역. 예: '김민수 → 김민준 (본문 문맥상 확인)'"),
  offRecordExcluded: z
    .array(z.string())
    .describe("오프 더 레코드 등으로 제외한 항목. 내용 자체는 담지 말고 무엇을 제외했는지만 짧게"),
});

export const generateOutputSchema = z.object({
  article: articleContentSchema,
  revisionSummary: revisionSummarySchema,
  needsCheck: z.array(needsCheckItemSchema),
});

export type GenerateOutput = z.infer<typeof generateOutputSchema>;
