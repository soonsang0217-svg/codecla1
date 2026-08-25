// Shared structured-article shape produced by the AI providers (step 3),
// edited in the review step (step 4), and rendered to docx (step 5).

export const DEFAULT_SUBTITLE = "[대신 만나드립니다]";

export interface QaItem {
  question: string;
  answer: string;
  /** True when the question wasn't in the uploaded questionnaire but came up during the interview. */
  isExtra?: boolean;
}

export interface ArticleSection {
  heading: string;
  qa: QaItem[];
}

export interface ArticleContent {
  title: string;
  subtitle: string;
  /** Free-form text, one or more paragraphs separated by a blank line. Rendered with a left border. */
  intro: string;
  /** "[약력]" box content. */
  bio: string;
  sections: ArticleSection[];
  /** Free-form text; empty means the outro block is omitted entirely (e.g. a partial-scope interview with no wrap-up). */
  outro: string;
}

export interface NeedsCheckItem {
  item: string;
  reason: string;
  /** Checked off in the review editor once someone has verified it. Never set by the AI. */
  resolved?: boolean;
}

export interface RevisionSummary {
  /** STT(음성인식) 오류 교정 내역 — e.g. "김민수 → 김민수(가나전자 대표)" */
  sttFixes: string[];
  /** 오프 더 레코드로 제외한 항목 (내용은 담지 않고, 제외했다는 사실만) */
  offRecordExcluded: string[];
}

export function emptyArticle(intervieweeName: string): ArticleContent {
  return {
    title: `${intervieweeName} 인터뷰`,
    subtitle: DEFAULT_SUBTITLE,
    intro: "",
    bio: "",
    sections: [],
    outro: "",
  };
}

const AVG_CHARS_PER_MINUTE = 550; // 분당 한국어 평균 독서 속도(500~600자) 기준 상수. 조정 가능.

/** Split free-form intro/outro text into paragraphs on blank lines (docx/clipboard render each as its own paragraph). */
export function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function articlePlainText(article: ArticleContent): string {
  const parts: string[] = [article.title, article.subtitle, article.intro, article.bio];
  for (const section of article.sections) {
    parts.push(section.heading);
    for (const qa of section.qa) {
      parts.push(qa.question, qa.answer);
    }
  }
  if (article.outro.trim()) parts.push(article.outro);
  return parts.filter(Boolean).join("\n");
}

/** 공백 포함 글자 수. */
export function characterCount(article: ArticleContent): number {
  return articlePlainText(article).replace(/\n/g, "").length;
}

/** 예상 읽기 시간(분), 최소 1분. */
export function estimatedReadingMinutes(article: ArticleContent): number {
  const chars = characterCount(article);
  return Math.max(1, Math.round(chars / AVG_CHARS_PER_MINUTE));
}
