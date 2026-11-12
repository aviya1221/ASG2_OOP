import { LlmError, type LlmErrorKind } from "../../llm/index.ts";

/**
 * Translates any error thrown by the Google Gen AI SDK into our `LlmError`.
 *
 * The SDK has several error classes, and not all of them are exported.
 * They do share two facts we can read safely: an HTTP status (`status` or
 * `statusCode`) and a class name for network problems. So we read those
 * instead of using `instanceof`.
 *
 * The SDK does not retry `models.generateContent`; `GeminiLlmClient` sends it
 * once more itself after a busy answer (`unavailable`).
 */
export function toLlmError(error: unknown): LlmError {
  if (error instanceof LlmError) return error;

  const message = error instanceof Error ? error.message : String(error);
  const status = readStatus(error);
  const name = error instanceof Error ? error.name : "";

  const kind = status !== undefined ? kindFromStatus(status) : kindFromName(name);
  return new LlmError(kind, `Gemini: ${message}`, { status, cause: error });
}

function readStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const { status, statusCode } = error as { status?: unknown; statusCode?: unknown };
  if (typeof status === "number") return status;
  if (typeof statusCode === "number") return statusCode;
  return undefined;
}

function kindFromStatus(status: number): LlmErrorKind {
  if (status === 401 || status === 403) return "auth";
  if (status === 408) return "timeout";
  if (status === 429) return "rate-limit";
  if (status >= 500) return "unavailable";
  if (status >= 400) return "invalid-request";
  return "unknown";
}

function kindFromName(name: string): LlmErrorKind {
  if (name === "AbortError" || name === "TimeoutError" || /Timeout/i.test(name)) return "timeout";
  if (/Connection/i.test(name)) return "unavailable";
  return "unknown";
}
