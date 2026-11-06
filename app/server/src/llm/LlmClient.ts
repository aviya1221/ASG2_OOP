import type {
  LlmJsonRequest,
  LlmJsonResult,
  LlmRequest,
  LlmTextResult,
  LocalFile,
  UploadedFile,
} from "./types.ts";

/**
 * The only way the rest of the server talks to a large language model.
 *
 * Features (video summary, homework review) depend on this interface, never
 * on a provider's SDK. That keeps the provider swappable and lets tests and
 * the offline demo use `FakeLlmClient` instead of real calls
 * (lecture 03a, risk R4: "mock the API; integrate behind an interface").
 *
 * Every method throws `LlmError` on failure.
 */
export interface LlmClient {
  /** A free-text answer, e.g. a homework review written for the student. */
  generateText(request: LlmRequest): Promise<LlmTextResult>;

  /** An answer that follows a JSON schema, e.g. rubric scores per criterion. */
  generateJson<T = unknown>(request: LlmJsonRequest<T>): Promise<LlmJsonResult<T>>;

  /**
   * Uploads a large file (a class video, a long PDF) once, so several requests
   * can use it. Resolves only when the provider has finished processing the
   * file and it is ready to be used.
   */
  uploadFile(file: LocalFile): Promise<UploadedFile>;

  /** Deletes an uploaded file as soon as we no longer need it (student data). */
  deleteFile(file: UploadedFile): Promise<void>;

  /**
   * Turns each text into a vector of numbers ("embedding"). Texts with a
   * similar meaning get similar vectors, which is how we compare one
   * student's homework with the others (see `cosineSimilarity`).
   * Returns one vector per input text, in the same order.
   */
  embed(texts: string[]): Promise<number[][]>;
}
