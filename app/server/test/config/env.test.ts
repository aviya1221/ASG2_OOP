import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadConfig, loadServerConfig } from "../../src/config/env.ts";
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
      GEMINI_REVIEW_MODEL: "gemini-3.8-flash-lite",
      GEMINI_EMBEDDING_MODEL: "gemini-embedding-001",
      GEMINI_STORE_INTERACTIONS: "TRUE",
    });
    assert.equal(config.llm.provider, "gemini");
    if (config.llm.provider !== "gemini") return;
    assert.equal(config.llm.gemini.textModel, "gemini-3.8-flash");
    assert.equal(config.llm.gemini.reviewModel, "gemini-3.8-flash-lite");
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

describe("loadServerConfig", () => {
  const VALID = { WEB_ORIGIN: "https://a.example, https://b.example", SUPABASE_URL: "https://x.supabase.co", SUPABASE_SECRET_KEY: "secret" };

  it("reads the settings, and splits the web addresses", () => {
    assert.deepEqual(loadServerConfig({ ...VALID, PORT: "9000" }), {
      port: 9000,
      webOrigins: ["https://a.example", "https://b.example"],
      supabaseUrl: "https://x.supabase.co",
      supabaseSecretKey: "secret",
    });
  });

  it("uses the default port when none is set", () => {
    assert.equal(loadServerConfig(VALID).port, 8787);
  });

  it("stops with a clear message when a setting is missing or wrong", () => {
    assert.throws(() => loadServerConfig({ ...VALID, SUPABASE_SECRET_KEY: "" }), { name: "ConfigError", message: /SUPABASE_SECRET_KEY/ });
    assert.throws(() => loadServerConfig({ ...VALID, WEB_ORIGIN: undefined }), { name: "ConfigError", message: /WEB_ORIGIN/ });
    assert.throws(() => loadServerConfig({ ...VALID, PORT: "many" }), { name: "ConfigError", message: /PORT/ });
  });
});
