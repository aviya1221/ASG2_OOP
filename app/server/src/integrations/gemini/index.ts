/**
 * Gemini adapter: implements the LLM layer's `LlmClient` with Google's
 * official SDK. Nothing outside src/integrations/gemini/ imports @google/genai.
 */
export { GeminiLlmClient, type GeminiLlmClientDeps, type GeminiSdk } from "./GeminiLlmClient.ts";
export { GEMINI_DEFAULTS, type GeminiConfig } from "./GeminiConfig.ts";
export { toLlmError } from "./toLlmError.ts";
