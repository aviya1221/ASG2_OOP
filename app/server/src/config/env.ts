import { GEMINI_DEFAULTS, type GeminiConfig } from "../integrations/gemini/index.ts";

/**
 * All server settings, read once from environment variables at start-up.
 * Every variable is listed (with an explanation) in app/server/.env.example.
 * A missing or wrong value stops the server at once with a clear message,
 * instead of failing later in the middle of a lesson.
 */
export interface AppConfig {
  llm: LlmSettings;
}

/** "gemini" makes real calls; "fake" gives canned answers with no key (tests, offline demo). */
export type LlmSettings = { provider: "gemini"; gemini: GeminiConfig } | { provider: "fake" };

export class ConfigError extends Error {
  constructor(message: string) {
    super(`${message} (see app/server/.env.example)`);
    this.name = "ConfigError";
  }
}

type Env = Record<string, string | undefined>;

export function loadConfig(env: Env = process.env): AppConfig {
  return { llm: loadLlmSettings(env) };
}

function loadLlmSettings(env: Env): LlmSettings {
  const provider = read(env, "LLM_PROVIDER") ?? "gemini";
  if (provider === "fake") return { provider: "fake" };
  if (provider !== "gemini") {
    throw new ConfigError(`LLM_PROVIDER must be "gemini" or "fake", got "${provider}"`);
  }

  const apiKey = read(env, "GEMINI_API_KEY");
  if (!apiKey) {
    throw new ConfigError(
      "GEMINI_API_KEY is missing: put your Google AI Studio key in app/server/.env, or set LLM_PROVIDER=fake",
    );
  }

  return {
    provider: "gemini",
    gemini: {
      ...GEMINI_DEFAULTS,
      apiKey,
      textModel: read(env, "GEMINI_TEXT_MODEL") ?? GEMINI_DEFAULTS.textModel,
      embeddingModel: read(env, "GEMINI_EMBEDDING_MODEL") ?? GEMINI_DEFAULTS.embeddingModel,
      storeInteractions: readBoolean(env, "GEMINI_STORE_INTERACTIONS") ?? GEMINI_DEFAULTS.storeInteractions,
    },
  };
}

/** The variable's value without surrounding spaces; undefined when unset or empty. */
function read(env: Env, name: string): string | undefined {
  const value = env[name]?.trim();
  return value ? value : undefined;
}

function readBoolean(env: Env, name: string): boolean | undefined {
  const value = read(env, name)?.toLowerCase();
  if (value === undefined) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new ConfigError(`${name} must be "true" or "false", got "${value}"`);
}
