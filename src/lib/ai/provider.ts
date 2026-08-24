import type { AIProvider } from "./types";

export type { AIProvider, GenerateArticleInput, GenerateOutput } from "./types";

/**
 * Selects the AI provider implementation based on AI_PROVIDER (default: "anthropic").
 * Lazily imports the implementation so the unused provider's SDK/key requirement
 * never has to be satisfied.
 */
export async function getAIProvider(): Promise<AIProvider> {
  const providerName = (process.env.AI_PROVIDER || "anthropic").toLowerCase();

  switch (providerName) {
    case "anthropic": {
      const { AnthropicProvider } = await import("./anthropic");
      return new AnthropicProvider();
    }
    case "gemini": {
      const { GeminiProvider } = await import("./gemini");
      return new GeminiProvider();
    }
    default:
      throw new Error(
        `Unknown AI_PROVIDER "${providerName}". Supported values: "anthropic", "gemini".`,
      );
  }
}
