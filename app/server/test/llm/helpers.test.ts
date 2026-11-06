import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cosineSimilarity, parseJsonAnswer } from "../../src/llm/index.ts";

describe("cosineSimilarity", () => {
  it("is 1 for vectors pointing the same way, whatever their length", () => {
    assert.equal(cosineSimilarity([1, 2, 3], [2, 4, 6]), 1);
  });

  it("is 0 for unrelated (perpendicular) vectors", () => {
    assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
  });

  it("is 0 when one vector is all zeros", () => {
    assert.equal(cosineSimilarity([0, 0], [1, 1]), 0);
  });

  it("rejects vectors of different lengths", () => {
    assert.throws(() => cosineSimilarity([1, 2], [1, 2, 3]), RangeError);
  });
});

describe("parseJsonAnswer", () => {
  it("parses valid JSON", () => {
    assert.deepEqual(parseJsonAnswer('{"ok": true}'), { ok: true });
  });

  it("returns what the check returns", () => {
    assert.equal(parseJsonAnswer("41", (value) => (value as number) + 1), 42);
  });

  it("throws 'bad-output' for text that is not JSON", () => {
    assert.throws(() => parseJsonAnswer("not json"), { name: "LlmError", kind: "bad-output" });
  });
});
