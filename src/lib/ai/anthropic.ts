import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { SYSTEM_PROMPT, buildUserPromptText } from "./prompt";
import { generateOutputSchema, type GenerateOutput } from "./schema";
import type { AIProvider, GenerateArticleInput } from "./types";

export class AnthropicProvider implements AIProvider {
  private client: Anthropic;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY environment variable is not set");
    }
    this.client = new Anthropic({ apiKey });
  }

  async generateArticle(input: GenerateArticleInput): Promise<GenerateOutput> {
    const content: Anthropic.ContentBlockParam[] = [];
    if (input.questionnaire.type === "pdf") {
      content.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: input.questionnaire.base64 },
      });
    }
    content.push({ type: "text", text: buildUserPromptText(input) });

    const response = await this.client.messages.parse({
      model: "claude-opus-5",
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content }],
      output_config: {
        format: zodOutputFormat(generateOutputSchema),
      },
    });

    if (!response.parsed_output) {
      throw new Error("AI 응답을 구조화된 형식으로 파싱하지 못했습니다");
    }
    return response.parsed_output;
  }
}
