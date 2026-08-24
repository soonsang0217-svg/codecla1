import type { GenerateOutput } from "./schema";

/**
 * The questionnaire is either pre-extracted text (.txt/.docx, extracted
 * server-side) or a PDF handed to the AI as a raw document attachment — both
 * Claude and Gemini can read PDF content natively, so we don't run our own
 * (error-prone) PDF text extraction at all.
 */
export type QuestionnaireInput = { type: "text"; value: string } | { type: "pdf"; base64: string };

export interface GenerateArticleInput {
  transcript: string;
  questionnaire: QuestionnaireInput;
  scope: string;
  intervieweeName: string;
}

export interface AIProvider {
  generateArticle(input: GenerateArticleInput): Promise<GenerateOutput>;
}

export type { GenerateOutput };
