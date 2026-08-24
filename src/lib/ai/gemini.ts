import { GoogleGenAI, createPartFromBase64, createPartFromText, type PartUnion } from "@google/genai";
import { z } from "zod";
import { SYSTEM_PROMPT, buildUserPromptText } from "./prompt";
import { generateOutputSchema, type GenerateOutput } from "./schema";
import type { AIProvider, GenerateArticleInput } from "./types";

// Paid Gemini Flash model — override by changing this constant if a newer
// Flash generation becomes the better cost/quality tradeoff.
const GEMINI_MODEL = "gemini-3.7-flash";

/** Google's responseJsonSchema accepts standard JSON Schema but not the `$schema` key. */
function responseJsonSchema() {
  const schema = z.toJSONSchema(generateOutputSchema) as Record<string, unknown>;
  delete schema.$schema;
  return schema;
}

export class GeminiProvider implements AIProvider {
  private client: GoogleGenAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not set");
    }
    this.client = new GoogleGenAI({ apiKey });
  }

  async generateArticle(input: GenerateArticleInput): Promise<GenerateOutput> {
    const parts: PartUnion[] = [];
    if (input.questionnaire.type === "pdf") {
      parts.push(createPartFromBase64(input.questionnaire.base64, "application/pdf"));
    }
    parts.push(createPartFromText(buildUserPromptText(input)));

    const response = await this.client.models.generateContent({
      model: GEMINI_MODEL,
      contents: parts,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseJsonSchema: responseJsonSchema(),
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("Gemini 응답을 받지 못했습니다");
    }
    return generateOutputSchema.parse(JSON.parse(text));
  }
}
