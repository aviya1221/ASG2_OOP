import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toLlmError } from "../../../src/integrations/gemini/index.ts";
import { LlmError } from "../../../src/llm/index.ts";

/** Mimics the SDK's error classes, which keep the HTTP status in `status` or in `statusCode`. */
function withStatus(field: "status" | "statusCode", value: number): Error {
  return Object.assign(new Error("boom"), { [field]: value });
}

function named(name: string): Error {
  const error = new Error("boom");
  error.name = name;
  return error;
}

describe("toLlmError", () => {
  const cases: Array<[string, unknown, string]> = [
    ["401 bad key", withStatus("status", 401), "auth"],
    ["403 no permission", withStatus("statusCode", 403), "auth"],
    ["400 bad request", withStatus("status", 400), "invalid-request"],
    ["408 request timeout", withStatus("status", 408), "timeout"],
    ["429 quota", withStatus("statusCode", 429), "rate-limit"],
    ["503 overloaded", withStatus("status", 503), "unavailable"],
    ["connection error", named("APIConnectionError"), "unavailable"],
    ["connection timeout", named("APIConnectionTimeoutError"), "timeout"],
    ["aborted", named("AbortError"), "timeout"],
    ["anything else", new Error("strange"), "unknown"],
    ["not an Error at all", "just a string", "unknown"],
  ];

  for (const [label, input, kind] of cases) {
    it(`maps ${label} to "${kind}"`, () => {
      const error = toLlmError(input);
      assert.ok(error instanceof LlmError);
      assert.equal(error.kind, kind);
      assert.equal(error.cause, input);
    });
  }

  it("keeps the HTTP status", () => {
    assert.equal(toLlmError(withStatus("statusCode", 503)).status, 503);
  });

  it("returns an LlmError unchanged", () => {
    const original = new LlmError("bad-output", "empty");
    assert.equal(toLlmError(original), original);
  });
});
