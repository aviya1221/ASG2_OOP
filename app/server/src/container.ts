import { loadConfig, type AppConfig } from "./config/env.ts";
import { GeminiLlmClient } from "./integrations/gemini/index.ts";
import { FakeLlmClient, type LlmClient } from "./llm/index.ts";

/**
 * Composition root: the one place that decides which concrete classes the
 * server uses. Everything else receives these services through its
 * constructor and only knows the interfaces (dependency injection).
 */
export interface Services {
  /** Text and JSON answers: lesson summaries and review guides. */
  llm: LlmClient;
  /** Reviews of homework solutions, on the lighter model of ADR-9. */
  reviewLlm: LlmClient;
}

export function createServices(config: AppConfig = loadConfig()): Services {
  const settings = config.llm;
  if (settings.provider === "fake") {
    const fake = new FakeLlmClient();
    return { llm: fake, reviewLlm: fake };
  }
  return {
    llm: new GeminiLlmClient(settings.gemini),
    reviewLlm: new GeminiLlmClient({ ...settings.gemini, textModel: settings.gemini.reviewModel }),
  };
}
