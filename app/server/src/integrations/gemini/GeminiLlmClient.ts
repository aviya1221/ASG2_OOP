import { FileState, FinishReason, GoogleGenAI, ThinkingLevel, type Content, type GenerateContentParameters, type GenerateContentResponseUsageMetadata, type Part } from "@google/genai";
import {
  LlmError,
  parseJsonAnswer,
  type Attachment,
  type LlmClient,
  type LlmJsonRequest,
  type LlmJsonResult,
  type LlmRequest,
  type LlmTextResult,
  type LlmUsage,
  type LocalFile,
  type UploadedFile,
} from "../../llm/index.ts";
import type { GeminiConfig } from "./GeminiConfig.ts";
import { toLlmError } from "./toLlmError.ts";

/**
 * The parts of the Google Gen AI SDK this adapter uses. The real `GoogleGenAI`
 * object fits this type; unit tests pass a small fake with the same shape, so
 * they run with no network and no key.
 */
export type GeminiSdk = {
  files: Pick<GoogleGenAI["files"], "upload" | "get" | "delete">;
  models: Pick<GoogleGenAI["models"], "generateContent" | "embedContent">;
};

export interface GeminiLlmClientDeps {
  /** Defaults to `new GoogleGenAI({ apiKey })`. */
  sdk?: GeminiSdk;
  /** Waiting between file-status checks and before a retry; replaced in tests so they do not really wait. */
  sleep?: (ms: number) => Promise<void>;
  /** Clock for the file-ready timeout; replaced in tests. */
  now?: () => number;
}

/** Our effort levels in Google's words. */
const THINKING_LEVEL = {
  minimal: ThinkingLevel.MINIMAL,
  low: ThinkingLevel.LOW,
  medium: ThinkingLevel.MEDIUM,
  high: ThinkingLevel.HIGH,
} as const;

/** Older embedding model that takes a task type and needs manual normalising (Google's embeddings page). */
const LEGACY_EMBEDDING_MODEL = "gemini-embedding-001";
const LEGACY_FULL_DIMENSIONS = 3072;
/** How many texts we send in one embedding request. */
const EMBED_BATCH_SIZE = 100;

/**
 * `LlmClient` backed by Google Gemini, following Google's documentation
 * (https://aistudio.google.com/docs, checked 2026-11-06):
 * - text and JSON answers use `models.generateContent`; JSON uses
 *   `responseMimeType` with a JSON schema. We moved here from the Interactions API
 *   on 2026-11-12: for days it answered "high demand" (503) for gemini-3.6-flash
 *   while generateContent answered at once, and the SDK's own retry of an
 *   interaction broke with "TypeError: unusable" (docs/left-for-later.md, item 25);
 * - generateContent is not retried by the SDK, so we send it once more ourselves
 *   after a busy answer (`unavailable`), after `busyRetryDelayMs`;
 * - large files go through the Files API (`files.upload`), and we wait until
 *   the file is ACTIVE before using it;
 * - embeddings use `models.embedContent`, one Content object per text so we
 *   get one vector per text (several parts in one Content are merged into one).
 *
 * This folder is the only place in the server that imports `@google/genai`.
 */
export class GeminiLlmClient implements LlmClient {
  readonly #config: GeminiConfig;
  readonly #sdk: GeminiSdk;
  readonly #sleep: (ms: number) => Promise<void>;
  readonly #now: () => number;

  constructor(config: GeminiConfig, deps: GeminiLlmClientDeps = {}) {
    if (!config.apiKey && !deps.sdk) {
      throw new LlmError("config", "GEMINI_API_KEY is not set (see app/server/.env.example)");
    }
    this.#config = config;
    this.#sdk = deps.sdk ?? new GoogleGenAI({ apiKey: config.apiKey });
    this.#sleep = deps.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.#now = deps.now ?? Date.now;
  }

  async generateText(request: LlmRequest): Promise<LlmTextResult> {
    return this.#generate(request);
  }

  async generateJson<T = unknown>(request: LlmJsonRequest<T>): Promise<LlmJsonResult<T>> {
    const { text, model, usage } = await this.#generate(request, {
      responseMimeType: "application/json",
      responseJsonSchema: request.schema,
    });
    return { data: parseJsonAnswer(text, request.validate), model, usage };
  }

  async uploadFile(file: LocalFile): Promise<UploadedFile> {
    let name: string | undefined;
    try {
      const source = "path" in file ? file.path : new Blob([toArrayBuffer(file.data)], { type: file.mimeType });
      let current = await this.#sdk.files.upload({
        file: source,
        config: { mimeType: file.mimeType, displayName: file.displayName },
      });
      name = current.name;

      // Videos are processed for a while after the upload; PDFs and images are usually ready at once.
      const deadline = this.#now() + this.#config.fileReadyTimeoutMs;
      while (current.state === FileState.PROCESSING) {
        if (this.#now() >= deadline) {
          throw new LlmError("timeout", `Gemini did not finish processing "${name}" in time`);
        }
        await this.#sleep(this.#config.filePollIntervalMs);
        current = await this.#sdk.files.get({ name: name! });
      }

      if (current.state === FileState.FAILED) {
        throw new LlmError("file-failed", `Gemini could not process the file: ${current.error?.message ?? "no reason given"}`);
      }
      if (!current.name || !current.uri) {
        throw new LlmError("bad-output", "Gemini did not return the uploaded file's name and address");
      }
      return {
        id: current.name,
        uri: current.uri,
        mimeType: current.mimeType ?? file.mimeType,
        expiresAt: current.expirationTime ? new Date(current.expirationTime) : undefined,
      };
    } catch (error) {
      // Do not leave student files behind on Google's side when something went wrong.
      if (name) await this.#sdk.files.delete({ name }).catch(() => undefined);
      throw toLlmError(error);
    }
  }

  async deleteFile(file: UploadedFile): Promise<void> {
    try {
      await this.#sdk.files.delete({ name: file.id });
    } catch (error) {
      const llmError = toLlmError(error);
      if (llmError.status === 404) return; // already gone (Gemini deletes files after 48 hours)
      throw llmError;
    }
  }

  /** Each text may be up to 8,192 tokens (Gemini's input limit for embeddings). */
  async embed(texts: string[]): Promise<number[][]> {
    const vectors: number[][] = [];
    for (let start = 0; start < texts.length; start += EMBED_BATCH_SIZE) {
      vectors.push(...(await this.#embedBatch(texts.slice(start, start + EMBED_BATCH_SIZE))));
    }
    return vectors;
  }

  async #embedBatch(texts: string[]): Promise<number[][]> {
    const { embeddingModel: model, embeddingDimensions: dimensions } = this.#config;
    const legacy = model === LEGACY_EMBEDDING_MODEL;

    let response;
    try {
      response = await this.#sdk.models.embedContent({
        model,
        // Newer models take the task as a text prefix; the legacy model takes `taskType`.
        contents: texts.map((text) => ({
          parts: [{ text: legacy ? text : `task: sentence similarity | query: ${text}` }],
        })),
        config: {
          outputDimensionality: dimensions,
          ...(legacy ? { taskType: "SEMANTIC_SIMILARITY" } : {}),
        },
      });
    } catch (error) {
      throw toLlmError(error);
    }

    const vectors = (response.embeddings ?? []).map((embedding) => embedding.values ?? []);
    if (vectors.length !== texts.length || vectors.some((vector) => vector.length === 0)) {
      throw new LlmError("bad-output", `Gemini returned ${vectors.length} embeddings for ${texts.length} texts`);
    }
    // The legacy model only normalises full-size vectors; newer models normalise every size.
    return legacy && dimensions !== LEGACY_FULL_DIMENSIONS ? vectors.map(normalize) : vectors;
  }

  /** Sends one request, once more after a busy answer, and checks that it really finished with a text answer. */
  async #generate(request: LlmRequest, extra: GenerateContentParameters["config"] = {}): Promise<LlmTextResult> {
    const params: GenerateContentParameters = {
      model: this.#config.textModel,
      contents: toContents(request),
      config: {
        ...(request.instructions ? { systemInstruction: request.instructions } : {}),
        ...(request.maxOutputTokens !== undefined ? { maxOutputTokens: request.maxOutputTokens } : {}),
        ...(request.effort !== undefined ? { thinkingConfig: { thinkingLevel: THINKING_LEVEL[request.effort] } } : {}),
        ...(request.seed !== undefined ? { seed: request.seed } : {}),
        ...extra,
      },
    };

    let response;
    try {
      response = await this.#sdk.models.generateContent(params);
    } catch (error) {
      const first = toLlmError(error);
      if (first.kind !== "unavailable") throw first;
      await this.#sleep(this.#config.busyRetryDelayMs);
      try {
        response = await this.#sdk.models.generateContent(params);
      } catch (second) {
        throw toLlmError(second);
      }
    }

    const finish = response.candidates?.[0]?.finishReason;
    if (finish === undefined) {
      const blocked = response.promptFeedback?.blockReason;
      throw new LlmError("incomplete", `Gemini gave no answer${blocked ? ` (blocked: ${blocked})` : ""}`);
    }
    if (finish !== FinishReason.STOP) {
      throw new LlmError("incomplete", `Gemini stopped with reason "${finish}"`);
    }
    const text = response.text ?? "";
    if (text.trim() === "") {
      throw new LlmError("bad-output", "Gemini returned an empty answer");
    }
    return {
      text,
      model: response.modelVersion ?? this.#config.textModel,
      usage: toUsage(response.usageMetadata),
    };
  }
}

/** Files first, then the prompt: Google's tip for prompts that include media. */
function toContents(request: LlmRequest): Content[] {
  const files = (request.attachments ?? []).map(toPart);
  return [{ role: "user", parts: [...files, { text: request.prompt }] }];
}

function toPart(attachment: Attachment): Part {
  if ("file" in attachment) {
    const { uri, mimeType } = attachment.file;
    return { fileData: { fileUri: uri, mimeType } };
  }
  const data = Buffer.from(attachment.data.buffer, attachment.data.byteOffset, attachment.data.byteLength).toString("base64");
  return { inlineData: { data, mimeType: attachment.mimeType } };
}

/** The thinking tokens count as output, as they are billed. */
function toUsage(usage: GenerateContentResponseUsageMetadata | undefined): LlmUsage | undefined {
  if (!usage) return undefined;
  const inputTokens = usage.promptTokenCount ?? 0;
  const outputTokens = (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0);
  return { inputTokens, outputTokens, totalTokens: usage.totalTokenCount ?? inputTokens + outputTokens };
}

function normalize(vector: number[]): number[] {
  const length = Math.hypot(...vector);
  return length === 0 ? vector : vector.map((value) => value / length);
}

function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
}
