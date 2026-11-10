/**
 * Request and result types of the LLM layer.
 *
 * These types are provider-neutral: they describe what our features need
 * (a review text, a JSON rubric, a summary of a video), never how a specific
 * provider's API spells it. Only the adapters in src/integrations/ translate
 * them into a provider's own request format.
 */

/** How much the model may "think" before answering. More effort = slower and costlier. */
export type LlmEffort = "minimal" | "low" | "medium" | "high";

/** A file that was uploaded to the provider once and can be used in several requests. */
export interface UploadedFile {
  /** Provider's id for the file, needed to delete it. */
  id: string;
  /** Address the provider uses to read the file inside a request. */
  uri: string;
  mimeType: string;
  /** When the provider deletes the file on its own (Gemini: after 48 hours). */
  expiresAt?: Date;
}

/**
 * A file sent together with a prompt.
 * - `{ mimeType, data }` sends small files inline (a homework PDF, a photo).
 * - `{ file }` points at a file uploaded earlier with `LlmClient.uploadFile`
 *   (large files such as a recorded class video).
 */
export type Attachment =
  | { mimeType: string; data: Uint8Array }
  | { file: UploadedFile };

/** A local file to upload: either a path on disk or bytes already in memory. */
export type LocalFile = { mimeType: string; displayName?: string } & (
  | { path: string }
  | { data: Uint8Array }
);

export interface LlmRequest {
  /** What we ask, e.g. "Review this homework against the rubric below: ...". */
  prompt: string;
  /** Standing instructions for the model (role, tone, language, rules). */
  instructions?: string;
  attachments?: Attachment[];
  /** Upper limit on the answer's length, in tokens. */
  maxOutputTokens?: number;
  effort?: LlmEffort;
  /**
   * The same request with the same seed tends to get the same answer, which keeps
   * scores steady. Providers treat it as best effort (ADR-9).
   */
  seed?: number;
}

/** A plain JSON Schema object (type, properties, required, items, enum...). */
export type JsonSchema = Record<string, unknown>;

export interface LlmJsonRequest<T> extends LlmRequest {
  /** The shape the answer must follow. */
  schema: JsonSchema;
  /**
   * Optional runtime check of the parsed answer. Providers do not enforce
   * every schema rule (Gemini ignores e.g. minLength / maxLength), so a
   * feature that relies on such a rule validates it here and throws if needed.
   */
  validate?: (value: unknown) => T;
}

/** Token counts, used to watch cost and free-tier limits. */
export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface LlmTextResult {
  text: string;
  /** The model that actually answered. */
  model: string;
  usage?: LlmUsage;
}

export interface LlmJsonResult<T> {
  data: T;
  model: string;
  usage?: LlmUsage;
}
