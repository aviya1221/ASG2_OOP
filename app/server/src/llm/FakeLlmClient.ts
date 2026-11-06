import type { LlmClient } from "./LlmClient.ts";
import { parseJsonAnswer } from "./parseJsonAnswer.ts";
import type {
  JsonSchema,
  LlmJsonRequest,
  LlmJsonResult,
  LlmRequest,
  LlmTextResult,
  LocalFile,
  UploadedFile,
} from "./types.ts";

export interface FakeLlmOptions {
  /** Answer for `generateText`. Default: "[fake answer] " + the start of the prompt. */
  text?: (request: LlmRequest) => string;
  /** Answer for `generateJson`. Default: a placeholder value built from the schema. */
  json?: (request: LlmJsonRequest<unknown>) => unknown;
}

/** One recorded call, so tests can check what a feature asked for. */
export interface FakeLlmCall {
  method: keyof LlmClient;
  input: unknown;
}

const FAKE_MODEL = "fake-llm";

/**
 * An `LlmClient` that never leaves the process: canned answers, no key, no
 * network, no cost. Used by unit tests of the features and as the demo's
 * plan B when the real API is unreachable (set LLM_PROVIDER=fake).
 */
export class FakeLlmClient implements LlmClient {
  readonly calls: FakeLlmCall[] = [];
  readonly #options: FakeLlmOptions;
  readonly #files = new Map<string, UploadedFile>();
  #nextFileId = 1;

  constructor(options: FakeLlmOptions = {}) {
    this.#options = options;
  }

  async generateText(request: LlmRequest): Promise<LlmTextResult> {
    this.calls.push({ method: "generateText", input: request });
    const text = this.#options.text?.(request) ?? `[fake answer] ${request.prompt.slice(0, 80)}`;
    return { text, model: FAKE_MODEL };
  }

  async generateJson<T = unknown>(request: LlmJsonRequest<T>): Promise<LlmJsonResult<T>> {
    this.calls.push({ method: "generateJson", input: request });
    const value =
      this.#options.json?.(request as LlmJsonRequest<unknown>) ?? sampleFromSchema(request.schema);
    // Same parse + validate path as the real clients, so features see identical behaviour.
    const data = parseJsonAnswer(JSON.stringify(value), request.validate);
    return { data, model: FAKE_MODEL };
  }

  async uploadFile(file: LocalFile): Promise<UploadedFile> {
    this.calls.push({ method: "uploadFile", input: file });
    const id = `files/fake-${this.#nextFileId++}`;
    const uploaded: UploadedFile = { id, uri: `fake://${id}`, mimeType: file.mimeType };
    this.#files.set(id, uploaded);
    return uploaded;
  }

  async deleteFile(file: UploadedFile): Promise<void> {
    this.calls.push({ method: "deleteFile", input: file });
    this.#files.delete(file.id);
  }

  async embed(texts: string[]): Promise<number[][]> {
    this.calls.push({ method: "embed", input: texts });
    return texts.map(letterFrequencies);
  }

  /** Files uploaded and not yet deleted (lets tests check that features clean up). */
  get openFiles(): UploadedFile[] {
    return [...this.#files.values()];
  }
}

/** Builds the simplest value that fits a JSON schema, so any JSON feature works offline. */
function sampleFromSchema(schema: JsonSchema): unknown {
  if (Array.isArray(schema.enum) && schema.enum.length > 0) return schema.enum[0];
  switch (schema.type) {
    case "string":
      return "[fake]";
    case "number":
    case "integer":
      return typeof schema.minimum === "number" ? schema.minimum : 0;
    case "boolean":
      return false;
    case "array":
      return [];
    case "object": {
      const properties = (schema.properties ?? {}) as Record<string, JsonSchema>;
      const result: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(properties)) result[key] = sampleFromSchema(child);
      return result;
    }
    default:
      return null;
  }
}

/** A 26-number vector of letter counts: crude, but similar texts get similar vectors. */
function letterFrequencies(text: string): number[] {
  const counts = new Array<number>(26).fill(0);
  for (const char of text.toLowerCase()) {
    const index = char.charCodeAt(0) - 97;
    if (index >= 0 && index < 26) counts[index]! += 1;
  }
  return counts;
}
