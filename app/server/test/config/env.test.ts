import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadConfig } from "../../src/config/env.ts";
import { GEMINI_DEFAULTS } from "../../src/integrations/gemini/index.ts";

describe("loadConfig: LLM settings", () => {
  it("uses Gemini with the default models when only the key is set", () => {
    const config = loadConfig({ GEMINI_API_KEY: "  abc  " });
    assert.deepEqual(config.llm, { provider: "gemini", gemini: { ...GEMINI_DEFAULTS, apiKey: "abc" } });
  });

  it("reads the optional model names and the store flag", () => {
    const config = loadConfig({
      GEMINI_API_KEY: "abc",
      GEMINI_TEXT_MODEL: "gemini-3.8-flash",
      GEMINI_EMBEDDING_MODEL: "gemini-embedding-001",
      GEMINI_STORE_INTERACTIONS: "TRUE",
    });
    assert.equal(config.llm.provider, "gemini");
    if (config.llm.provider !== "gemini") return;
    assert.equal(config.llm.gemini.textModel, "gemini-3.8-flash");
    assert.equal(config.llm.gemini.embeddingModel, "gemini-embedding-001");
    assert.equal(config.llm.gemini.storeInteractions, true);
  });

  it("needs no key for the fake provider", () => {
    assert.deepEqual(loadConfig({ LLM_PROVIDER: "fake" }).llm, { provider: "fake" });
  });

  it("stops with a clear message when the key is missing or empty", () => {
    assert.throws(() => loadConfig({}), { name: "ConfigError", message: /GEMINI_API_KEY is missing/ });
    assert.throws(() => loadConfig({ GEMINI_API_KEY: "   " }), { name: "ConfigError" });
  });

  it("rejects an unknown provider", () => {
    assert.throws(() => loadConfig({ LLM_PROVIDER: "openai" }), { name: "ConfigError", message: /LLM_PROVIDER/ });
  });

  it("rejects a store flag that is not true or false", () => {
    assert.throws(() => loadConfig({ GEMINI_API_KEY: "abc", GEMINI_STORE_INTERACTIONS: "yes" }), {
      name: "ConfigError",
      message: /GEMINI_STORE_INTERACTIONS/,
    });
  });
});
