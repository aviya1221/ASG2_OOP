/**
 * Why an LLM call failed, in terms a feature can act on:
 * - config:          the server is set up wrong (e.g. missing API key)
 * - auth:            the provider rejected our key
 * - rate-limit:      too many requests or the free quota is used up; try later
 * - invalid-request: the request itself is wrong (too large, bad schema)
 * - unavailable:     the provider is down or unreachable; try later
 * - timeout:         no answer in time
 * - incomplete:      the model stopped early (length limit, failed, cancelled)
 * - bad-output:      the answer could not be used (empty, not valid JSON)
 * - file-failed:     an uploaded file could not be processed
 * - unknown:         anything else
 */
export type LlmErrorKind =
  | "config"
  | "auth"
  | "rate-limit"
  | "invalid-request"
  | "unavailable"
  | "timeout"
  | "incomplete"
  | "bad-output"
  | "file-failed"
  | "unknown";

/** Kinds where the same request may succeed if sent again later. */
const RETRYABLE: ReadonlySet<LlmErrorKind> = new Set([
  "rate-limit",
  "unavailable",
  "timeout",
]);

/** The single error type thrown by every `LlmClient`. */
export class LlmError extends Error {
  readonly kind: LlmErrorKind;
  /** HTTP status from the provider, when there was one. */
  readonly status: number | undefined;

  constructor(
    kind: LlmErrorKind,
    message: string,
    options: { status?: number; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "LlmError";
    this.kind = kind;
    this.status = options.status;
  }

  /** True when trying again later makes sense (show "try again" to the user). */
  get retryable(): boolean {
    return RETRYABLE.has(this.kind);
  }
}
