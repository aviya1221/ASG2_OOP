/**
 * Public entry of the LLM layer. Features import from here only:
 *   import { type LlmClient, LlmError } from "../llm/index.ts";
 */
export type { LlmClient } from "./LlmClient.ts";
export type {
  Attachment,
  JsonSchema,
  LlmEffort,
  LlmJsonRequest,
  LlmJsonResult,
  LlmRequest,
  LlmTextResult,
  LlmUsage,
  LocalFile,
  UploadedFile,
} from "./types.ts";
export { LlmError, type LlmErrorKind } from "./LlmError.ts";
export { FakeLlmClient, type FakeLlmCall, type FakeLlmOptions } from "./FakeLlmClient.ts";
export { parseJsonAnswer } from "./parseJsonAnswer.ts";
export { cosineSimilarity } from "./similarity.ts";
