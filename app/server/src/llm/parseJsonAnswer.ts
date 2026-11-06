import { LlmError } from "./LlmError.ts";

/**
 * Turns the model's raw answer into a typed value: parse the JSON, then run
 * the feature's own `validate` check if it gave one. Shared by every client so
 * a bad answer always fails the same way (`LlmError` of kind "bad-output").
 */
export function parseJsonAnswer<T>(raw: string, validate?: (value: unknown) => T): T {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch (cause) {
    throw new LlmError("bad-output", "The model's answer is not valid JSON", { cause });
  }
  if (!validate) return value as T;
  try {
    return validate(value);
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    throw new LlmError("bad-output", `The model's answer failed validation: ${reason}`, {
      cause,
    });
  }
}
