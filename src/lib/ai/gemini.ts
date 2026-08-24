import { GoogleGenAI, ApiError, createPartFromBase64, createPartFromText, type PartUnion } from "@google/genai";
import { z } from "zod";
import { SYSTEM_PROMPT, buildUserPromptText } from "./prompt";
import { generateOutputSchema, type GenerateOutput } from "./schema";
import type { AIProvider, GenerateArticleInput } from "./types";

// Paid Gemini Flash model. gemini-2.5-flash (not the newer 3.x line) on
// purpose: freshly-launched Gemini models routinely hit 503 "high demand"
// for weeks after release while Google scales up capacity, regardless of
// paid billing — 2.5-flash has been GA long enough to have that headroom.
// Bump this once a newer generation has had time to mature.
const GEMINI_MODEL = "gemini-2.5-flash";

// Gemini occasionally returns 503 ("model currently experiencing high
// demand") or 429 under normal load — both are transient, so a short retry
// clears most of them instead of surfacing an error for what's often a
// one-off blip.
const RETRYABLE_STATUS = new Set([429, 503]);
const RETRY_DELAYS_MS = [1000, 2500];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

    let lastError: unknown;
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
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
      } catch (err) {
        lastError = err;
        const retryable = err instanceof ApiError && RETRYABLE_STATUS.has(err.status);
        if (!retryable || attempt === RETRY_DELAYS_MS.length) throw err;
        await sleep(RETRY_DELAYS_MS[attempt]);
      }
    }
    throw lastError;
  }
}
