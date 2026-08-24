import { GoogleGenerativeAI, SchemaType, type Schema } from "@google/generative-ai";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt";
import { generateOutputSchema, type GenerateOutput } from "./schema";
import type { AIProvider, GenerateArticleInput } from "./types";

const qaItemSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    question: { type: SchemaType.STRING },
    answer: { type: SchemaType.STRING },
    isExtra: { type: SchemaType.BOOLEAN },
  },
  required: ["question", "answer", "isExtra"],
};

const responseSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    article: {
      type: SchemaType.OBJECT,
      properties: {
        title: { type: SchemaType.STRING },
        subtitle: { type: SchemaType.STRING },
        intro: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        bio: { type: SchemaType.STRING },
        sections: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              heading: { type: SchemaType.STRING },
              qa: { type: SchemaType.ARRAY, items: qaItemSchema },
            },
            required: ["heading", "qa"],
          },
        },
        outro: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
      },
      required: ["title", "subtitle", "intro", "bio", "sections", "outro"],
    },
    revisionSummary: {
      type: SchemaType.OBJECT,
      properties: {
        sttFixes: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        offRecordExcluded: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
      },
      required: ["sttFixes", "offRecordExcluded"],
    },
    needsCheck: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          item: { type: SchemaType.STRING },
          reason: { type: SchemaType.STRING },
        },
        required: ["item", "reason"],
      },
    },
  },
  required: ["article", "revisionSummary", "needsCheck"],
};

export class GeminiProvider implements AIProvider {
  private client: GoogleGenerativeAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not set");
    }
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async generateArticle(input: GenerateArticleInput): Promise<GenerateOutput> {
    const model = this.client.getGenerativeModel({
      model: "gemini-2.5-pro",
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema,
      },
    });

    const result = await model.generateContent(buildUserPrompt(input));
    const text = result.response.text();
    const parsed = JSON.parse(text);
    return generateOutputSchema.parse(parsed);
  }
}
