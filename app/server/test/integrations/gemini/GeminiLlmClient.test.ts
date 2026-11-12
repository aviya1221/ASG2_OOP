import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FileState } from "@google/genai";
import {
  GEMINI_DEFAULTS,
  GeminiLlmClient,
  type GeminiConfig,
  type GeminiSdk,
} from "../../../src/integrations/gemini/index.ts";
import { LlmError, type UploadedFile } from "../../../src/llm/index.ts";

const CONFIG: GeminiConfig = { ...GEMINI_DEFAULTS, apiKey: "test-key" };

/** What a finished answer looks like (only the fields the adapter reads). */
function completed(text: string) {
  return {
    text,
    candidates: [{ finishReason: "STOP" }],
    modelVersion: "gemini-3.6-flash",
    usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 3, thoughtsTokenCount: 2, totalTokenCount: 17 },
  };
}

type Handlers = {
  generateContent?: (params: any) => unknown;
  upload?: (params: any) => unknown;
  get?: (params: any) => unknown;
  delete?: (params: any) => unknown;
  embedContent?: (params: any) => unknown;
};

/** A stand-in for the Google SDK that records every call and never touches the network. */
function fakeSdk(handlers: Handlers = {}) {
  const calls: Record<keyof Handlers, any[]> = { generateContent: [], upload: [], get: [], delete: [], embedContent: [] };
  const call = (name: keyof Handlers, fallback: (params: any) => unknown) => async (params: any) => {
    calls[name].push(params);
    return (handlers[name] ?? fallback)(params);
  };
  const sdk = {
    files: {
      upload: call("upload", () => ({ name: "files/1", uri: "https://files/1", mimeType: "video/mp4", state: FileState.ACTIVE })),
      get: call("get", () => ({ name: "files/1", uri: "https://files/1", state: FileState.ACTIVE })),
      delete: call("delete", () => ({})),
    },
    models: {
      generateContent: call("generateContent", () => completed("hello")),
      embedContent: call("embedContent", (params) => ({
        embeddings: params.contents.map((_: unknown, i: number) => ({ values: [i + 1, 0] })),
      })),
    },
  };
  return { sdk: sdk as unknown as GeminiSdk, calls };
}

function apiError(status: number): Error {
  return Object.assign(new Error(`HTTP ${status}`), { status });
}

const noWait = async () => {};

describe("GeminiLlmClient.generateText", () => {
  it("sends the prompt to the configured model as one turn of the user, and maps the answer", async () => {
    const { sdk, calls } = fakeSdk();
    const result = await new GeminiLlmClient(CONFIG, { sdk }).generateText({ prompt: "Summarise the lesson" });

    assert.deepEqual(calls.generateContent[0], {
      model: "gemini-3.6-flash",
      contents: [{ role: "user", parts: [{ text: "Summarise the lesson" }] }],
      config: {},
    });
    // The thinking tokens count as output.
    assert.deepEqual(result, {
      text: "hello",
      model: "gemini-3.6-flash",
      usage: { inputTokens: 12, outputTokens: 5, totalTokens: 17 },
    });
  });

  it("passes instructions, effort and length limit, and puts files before the prompt", async () => {
    const { sdk, calls } = fakeSdk();
    const video: UploadedFile = { id: "files/9", uri: "https://files/9", mimeType: "video/mp4" };

    await new GeminiLlmClient(CONFIG, { sdk }).generateText({
      prompt: "Review this",
      instructions: "You are a fair teaching assistant",
      effort: "low",
      maxOutputTokens: 400,
      attachments: [{ mimeType: "application/pdf", data: new Uint8Array([1, 2, 3]) }, { file: video }],
    });

    const params = calls.generateContent[0];
    assert.deepEqual(params.config, {
      systemInstruction: "You are a fair teaching assistant",
      maxOutputTokens: 400,
      thinkingConfig: { thinkingLevel: "LOW" },
    });
    assert.deepEqual(params.contents[0].parts, [
      { inlineData: { data: "AQID", mimeType: "application/pdf" } },
      { fileData: { fileUri: "https://files/9", mimeType: "video/mp4" } },
      { text: "Review this" },
    ]);
  });

  it("passes the seed with the generation settings, and leaves it out when there is none", async () => {
    const { sdk, calls } = fakeSdk();
    const client = new GeminiLlmClient(CONFIG, { sdk });
    await client.generateText({ prompt: "Review this", seed: 20261109 });
    await client.generateText({ prompt: "Review this" });

    assert.deepEqual(calls.generateContent[0].config, { seed: 20261109 });
    assert.deepEqual(calls.generateContent[1].config, {});
  });

  it("throws 'incomplete' when the model stopped early", async () => {
    const { sdk } = fakeSdk({
      generateContent: () => ({ ...completed("half an ans"), candidates: [{ finishReason: "MAX_TOKENS" }] }),
    });
    await assert.rejects(new GeminiLlmClient(CONFIG, { sdk }).generateText({ prompt: "x" }), {
      name: "LlmError",
      kind: "incomplete",
      message: /MAX_TOKENS/,
    });
  });

  it("throws 'incomplete' when Google blocked the request and gave no answer", async () => {
    const { sdk } = fakeSdk({ generateContent: () => ({ promptFeedback: { blockReason: "SAFETY" } }) });
    await assert.rejects(new GeminiLlmClient(CONFIG, { sdk }).generateText({ prompt: "x" }), {
      kind: "incomplete",
      message: /blocked: SAFETY/,
    });
  });

  it("throws 'bad-output' on an empty answer", async () => {
    const { sdk } = fakeSdk({ generateContent: () => completed("   ") });
    await assert.rejects(new GeminiLlmClient(CONFIG, { sdk }).generateText({ prompt: "x" }), { kind: "bad-output" });
  });

  it("turns SDK errors into LlmError (429 = rate limit, worth retrying later) and does not send again at once", async () => {
    const { sdk, calls } = fakeSdk({
      generateContent: () => {
        throw apiError(429);
      },
    });
    await assert.rejects(new GeminiLlmClient(CONFIG, { sdk, sleep: noWait }).generateText({ prompt: "x" }), (error: unknown) => {
      assert.ok(error instanceof LlmError);
      assert.equal(error.kind, "rate-limit");
      assert.equal(error.status, 429);
      assert.equal(error.retryable, true);
      return true;
    });
    assert.equal(calls.generateContent.length, 1);
  });

  it("sends the request once more after a busy answer (503), after the configured wait", async () => {
    let attempts = 0;
    const waits: number[] = [];
    const { sdk, calls } = fakeSdk({
      generateContent: () => {
        attempts += 1;
        if (attempts === 1) throw apiError(503);
        return completed("second time");
      },
    });
    const sleep = async (ms: number) => {
      waits.push(ms);
    };
    const result = await new GeminiLlmClient(CONFIG, { sdk, sleep }).generateText({ prompt: "x" });

    assert.equal(result.text, "second time");
    assert.equal(calls.generateContent.length, 2);
    assert.deepEqual(waits, [GEMINI_DEFAULTS.busyRetryDelayMs]);
  });

  it("gives up after a second busy answer", async () => {
    const { sdk, calls } = fakeSdk({
      generateContent: () => {
        throw apiError(503);
      },
    });
    await assert.rejects(new GeminiLlmClient(CONFIG, { sdk, sleep: noWait }).generateText({ prompt: "x" }), {
      kind: "unavailable",
      status: 503,
    });
    assert.equal(calls.generateContent.length, 2);
  });
});

describe("GeminiLlmClient.generateJson", () => {
  const schema = { type: "object", properties: { score: { type: "integer" } }, required: ["score"] };

  it("asks for JSON that follows the schema and parses the answer", async () => {
    const { sdk, calls } = fakeSdk({ generateContent: () => completed('{"score": 87}') });
    const result = await new GeminiLlmClient(CONFIG, { sdk }).generateJson<{ score: number }>({
      prompt: "Grade it",
      schema,
    });

    assert.deepEqual(calls.generateContent[0].config, { responseMimeType: "application/json", responseJsonSchema: schema });
    assert.deepEqual(result.data, { score: 87 });
  });

  it("throws 'bad-output' when the answer is not JSON", async () => {
    const { sdk } = fakeSdk({ generateContent: () => completed("Sure! Here is the grade: 87") });
    await assert.rejects(new GeminiLlmClient(CONFIG, { sdk }).generateJson({ prompt: "x", schema }), {
      kind: "bad-output",
    });
  });

  it("runs the feature's own check and reports a failure as 'bad-output'", async () => {
    const { sdk } = fakeSdk({ generateContent: () => completed('{"score": 140}') });
    const validate = (value: unknown) => {
      const { score } = value as { score: number };
      if (score > 100) throw new Error("score above 100");
      return { score };
    };
    await assert.rejects(new GeminiLlmClient(CONFIG, { sdk }).generateJson({ prompt: "x", schema, validate }), {
      kind: "bad-output",
      message: /score above 100/,
    });
  });
});

describe("GeminiLlmClient.uploadFile", () => {
  it("waits while the file is processing and returns it once it is active", async () => {
    let checks = 0;
    const { sdk, calls } = fakeSdk({
      upload: () => ({ name: "files/7", uri: "https://files/7", mimeType: "video/mp4", state: FileState.PROCESSING }),
      get: () => ({
        name: "files/7",
        uri: "https://files/7",
        mimeType: "video/mp4",
        state: ++checks < 3 ? FileState.PROCESSING : FileState.ACTIVE,
        expirationTime: "2026-11-08T10:00:00Z",
      }),
    });

    const file = await new GeminiLlmClient(CONFIG, { sdk, sleep: noWait }).uploadFile({
      path: "lesson.mp4",
      mimeType: "video/mp4",
    });

    assert.equal(calls.get.length, 3);
    assert.deepEqual(calls.upload[0], { file: "lesson.mp4", config: { mimeType: "video/mp4", displayName: undefined } });
    assert.deepEqual(file, {
      id: "files/7",
      uri: "https://files/7",
      mimeType: "video/mp4",
      expiresAt: new Date("2026-11-08T10:00:00Z"),
    });
  });

  it("uploads bytes from memory as a Blob", async () => {
    const { sdk, calls } = fakeSdk();
    await new GeminiLlmClient(CONFIG, { sdk }).uploadFile({ data: new Uint8Array([1, 2]), mimeType: "application/pdf" });

    const sent = calls.upload[0].file;
    assert.ok(sent instanceof Blob);
    assert.equal(sent.size, 2);
    assert.equal(sent.type, "application/pdf");
  });

  it("throws 'file-failed' and deletes the file when Google cannot process it", async () => {
    const { sdk, calls } = fakeSdk({
      upload: () => ({ name: "files/8", uri: "https://files/8", state: FileState.FAILED, error: { message: "bad codec" } }),
    });
    await assert.rejects(
      new GeminiLlmClient(CONFIG, { sdk }).uploadFile({ path: "x.mp4", mimeType: "video/mp4" }),
      { kind: "file-failed", message: /bad codec/ },
    );
    assert.deepEqual(calls.delete, [{ name: "files/8" }]);
  });

  it("gives up after the timeout and deletes the file", async () => {
    let clock = 0;
    const { sdk, calls } = fakeSdk({
      upload: () => ({ name: "files/5", uri: "https://files/5", state: FileState.PROCESSING }),
      get: () => ({ name: "files/5", uri: "https://files/5", state: FileState.PROCESSING }),
    });
    const client = new GeminiLlmClient(
      { ...CONFIG, fileReadyTimeoutMs: 10_000, filePollIntervalMs: 2_000 },
      { sdk, now: () => clock, sleep: async (ms) => void (clock += ms) },
    );

    await assert.rejects(client.uploadFile({ path: "long.mp4", mimeType: "video/mp4" }), { kind: "timeout" });
    assert.equal(calls.get.length, 5);
    assert.deepEqual(calls.delete, [{ name: "files/5" }]);
  });
});

describe("GeminiLlmClient.deleteFile", () => {
  const file: UploadedFile = { id: "files/3", uri: "https://files/3", mimeType: "application/pdf" };

  it("treats a file that is already gone (404) as deleted", async () => {
    const { sdk } = fakeSdk({
      delete: () => {
        throw apiError(404);
      },
    });
    await new GeminiLlmClient(CONFIG, { sdk }).deleteFile(file);
  });

  it("reports other failures", async () => {
    const { sdk } = fakeSdk({
      delete: () => {
        throw apiError(403);
      },
    });
    await assert.rejects(new GeminiLlmClient(CONFIG, { sdk }).deleteFile(file), { kind: "auth" });
  });
});

describe("GeminiLlmClient.embed", () => {
  it("sends one Content per text with the similarity prefix, and returns one vector per text", async () => {
    const { sdk, calls } = fakeSdk();
    const vectors = await new GeminiLlmClient(CONFIG, { sdk }).embed(["first answer", "second answer"]);

    assert.deepEqual(calls.embedContent[0], {
      model: "gemini-embedding-2",
      contents: [
        { parts: [{ text: "task: sentence similarity | query: first answer" }] },
        { parts: [{ text: "task: sentence similarity | query: second answer" }] },
      ],
      config: { outputDimensionality: 768 },
    });
    assert.deepEqual(vectors, [
      [1, 0],
      [2, 0],
    ]);
  });

  it("splits a large class into batches of 100 texts and keeps the order", async () => {
    const { sdk, calls } = fakeSdk();
    const texts = Array.from({ length: 230 }, (_, i) => `answer ${i}`);
    const vectors = await new GeminiLlmClient(CONFIG, { sdk }).embed(texts);

    assert.deepEqual(
      calls.embedContent.map((params) => params.contents.length),
      [100, 100, 30],
    );
    assert.equal(vectors.length, 230);
  });

  it("uses the task type and normalises vectors for the legacy model", async () => {
    const { sdk, calls } = fakeSdk({ embedContent: () => ({ embeddings: [{ values: [3, 4] }] }) });
    const client = new GeminiLlmClient({ ...CONFIG, embeddingModel: "gemini-embedding-001" }, { sdk });

    const [vector] = await client.embed(["plain text"]);

    assert.deepEqual(calls.embedContent[0].contents, [{ parts: [{ text: "plain text" }] }]);
    assert.deepEqual(calls.embedContent[0].config, { outputDimensionality: 768, taskType: "SEMANTIC_SIMILARITY" });
    assert.deepEqual(vector, [0.6, 0.8]);
  });

  it("throws 'bad-output' when the number of vectors does not match", async () => {
    const { sdk } = fakeSdk({ embedContent: () => ({ embeddings: [{ values: [1] }] }) });
    await assert.rejects(new GeminiLlmClient(CONFIG, { sdk }).embed(["a", "b"]), { kind: "bad-output" });
  });

  it("does not call Google for an empty list", async () => {
    const { sdk, calls } = fakeSdk();
    assert.deepEqual(await new GeminiLlmClient(CONFIG, { sdk }).embed([]), []);
    assert.equal(calls.embedContent.length, 0);
  });
});

describe("GeminiLlmClient construction", () => {
  it("refuses to start without an API key", () => {
    assert.throws(() => new GeminiLlmClient({ ...CONFIG, apiKey: "" }), { name: "LlmError", kind: "config" });
  });
});
