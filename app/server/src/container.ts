import type { IdentityVerifier } from "./auth/index.ts";
import { loadConfig, type AppConfig, type LlmSettings } from "./config/env.ts";
import { GeminiLlmClient } from "./integrations/gemini/index.ts";
import { GoogleIdTokenVerifier } from "./integrations/google-identity/index.ts";
import { FakeLlmClient, type LlmClient } from "./llm/index.ts";

/**
 * Composition root: the one place that decides which concrete classes the
 * server uses. Everything else receives these services through its
 * constructor and only knows the interfaces (dependency injection).
 */
export interface Services {
  llm: LlmClient;
  /** Undefined when Google sign-in is not configured (no GOOGLE_CLIENT_ID). */
  googleSignIn: IdentityVerifier | undefined;
}

export function createServices(config: AppConfig = loadConfig()): Services {
  return {
    llm: createLlmClient(config.llm),
    googleSignIn: config.googleSignIn ? new GoogleIdTokenVerifier(config.googleSignIn) : undefined,
  };
}

function createLlmClient(settings: LlmSettings): LlmClient {
  switch (settings.provider) {
    case "gemini":
      return new GeminiLlmClient(settings.gemini);
    case "fake":
      return new FakeLlmClient();
  }
}
