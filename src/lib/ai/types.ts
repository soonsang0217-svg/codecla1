import type { GenerateOutput } from "./schema";

export interface GenerateArticleInput {
  transcript: string;
  questionnaire: string;
  scope: string;
  intervieweeName: string;
}

export interface AIProvider {
  generateArticle(input: GenerateArticleInput): Promise<GenerateOutput>;
}

export type { GenerateOutput };
