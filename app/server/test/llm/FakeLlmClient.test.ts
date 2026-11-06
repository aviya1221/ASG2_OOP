import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FakeLlmClient, cosineSimilarity } from "../../src/llm/index.ts";

describe("FakeLlmClient", () => {
  it("answers text from the prompt by default and records the call", async () => {
    const llm = new FakeLlmClient();
    const result = await llm.generateText({ prompt: "Summarise lesson 3" });

    assert.equal(result.text, "[fake answer] Summarise lesson 3");
    assert.deepEqual(llm.calls, [{ method: "generateText", input: { prompt: "Summarise lesson 3" } }]);
  });

  it("uses a custom answer when given one", async () => {
    const llm = new FakeLlmClient({ text: (request) => `echo: ${request.prompt}` });
    assert.equal((await llm.generateText({ prompt: "hi" })).text, "echo: hi");
  });

  it("builds a placeholder JSON answer that fits the schema", async () => {
    const llm = new FakeLlmClient();
    const result = await llm.generateJson({
      prompt: "grade",
      schema: {
        type: "object",
        properties: {
          score: { type: "integer", minimum: 1 },
          verdict: { type: "string", enum: ["pass", "fail"] },
          comments: { type: "array", items: { type: "string" } },
          late: { type: "boolean" },
        },
      },
    });

    assert.deepEqual(result.data, { score: 1, verdict: "pass", comments: [], late: false });
  });

  it("runs the feature's check exactly like the real client", async () => {
    const llm = new FakeLlmClient({ json: () => ({ score: 140 }) });
    const validate = () => {
      throw new Error("score above 100");
    };
    await assert.rejects(llm.generateJson({ prompt: "x", schema: { type: "object" }, validate }), {
      name: "LlmError",
      kind: "bad-output",
    });
  });

  it("tracks uploaded files until they are deleted", async () => {
    const llm = new FakeLlmClient();
    const file = await llm.uploadFile({ path: "lesson.mp4", mimeType: "video/mp4" });
    assert.deepEqual(llm.openFiles, [file]);

    await llm.deleteFile(file);
    assert.deepEqual(llm.openFiles, []);
  });

  it("gives similar texts more similar vectors than unrelated ones", async () => {
    const llm = new FakeLlmClient();
    const [a, b, c] = await llm.embed(["the cat sat on the mat", "the cat sat on a mat", "zzz qqq xxx"]);

    assert.ok(cosineSimilarity(a!, b!) > cosineSimilarity(a!, c!));
  });
});
