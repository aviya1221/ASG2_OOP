/**
 * Smoke test: a few real calls to Gemini with our key, to prove the
 * integration works end to end (evidence for the step 2 spike).
 *
 *   npm run smoke:gemini                  text, JSON and embeddings
 *   npm run smoke:gemini -- homework.pdf  also uploads a file and summarises it
 *
 * Needs GEMINI_API_KEY in app/server/.env (or in the environment).
 * Costs a few hundred tokens, well inside the free tier.
 */
import { extname } from "node:path";
import { ConfigError, loadConfig } from "../src/config/env.ts";
import { GeminiLlmClient } from "../src/integrations/gemini/index.ts";
import { LlmError, cosineSimilarity, type LlmClient } from "../src/llm/index.ts";

const MIME_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".mp4": "video/mp4",
  ".mp3": "audio/mpeg",
};

async function step(title: string, run: () => Promise<string>): Promise<void> {
  const started = performance.now();
  const outcome = await run();
  console.log(`\n✔ ${title} (${Math.round(performance.now() - started)} ms)\n${outcome}`);
}

async function smoke(llm: LlmClient, filePath: string | undefined): Promise<void> {
  await step("Text answer", async () => {
    const result = await llm.generateText({
      instructions: "You are a teaching assistant. Answer in one short sentence.",
      prompt: "Greet a class of second-year software engineering students.",
      effort: "low",
    });
    return `  ${result.text.trim()}\n  model: ${result.model}, tokens: ${result.usage?.totalTokens ?? "?"}`;
  });

  await step("JSON answer that follows a schema", async () => {
    const result = await llm.generateJson<{ topic: string; difficulty: number }>({
      prompt: "Suggest one quick poll question topic about object-oriented design and rate its difficulty from 1 to 5.",
      schema: {
        type: "object",
        properties: {
          topic: { type: "string" },
          difficulty: { type: "integer", minimum: 1, maximum: 5 },
        },
        required: ["topic", "difficulty"],
      },
      effort: "low",
    });
    return `  ${JSON.stringify(result.data)}`;
  });

  await step("Embeddings (comparing answers)", async () => {
    const answers = [
      "Encapsulation hides an object's internal state behind methods.",
      "An object keeps its data private and exposes it only through its methods.",
      "The lecture is on Tuesday in room 101.",
    ];
    const [a, b, c] = await llm.embed(answers);
    return [
      `  vector length: ${a!.length}`,
      `  same idea, different words: ${cosineSimilarity(a!, b!).toFixed(3)}`,
      `  unrelated sentence:         ${cosineSimilarity(a!, c!).toFixed(3)}`,
    ].join("\n");
  });

  if (!filePath) return;
  const mimeType = MIME_TYPES[extname(filePath).toLowerCase()];
  if (!mimeType) throw new Error(`Unknown file type: ${filePath}`);

  await step(`File upload and summary (${filePath})`, async () => {
    const file = await llm.uploadFile({ path: filePath, mimeType });
    try {
      const result = await llm.generateText({
        prompt: "Summarise this file in three short bullet points.",
        attachments: [{ file }],
      });
      return `  ${result.text.trim().replaceAll("\n", "\n  ")}`;
    } finally {
      await llm.deleteFile(file);
    }
  });
}

try {
  const config = loadConfig();
  if (config.llm.provider !== "gemini") throw new ConfigError("The smoke test needs LLM_PROVIDER=gemini");
  console.log(`Gemini smoke test: ${config.llm.gemini.textModel} + ${config.llm.gemini.embeddingModel}`);
  await smoke(new GeminiLlmClient(config.llm.gemini), process.argv[2]);
  console.log("\nAll checks passed.");
} catch (error) {
  const label = error instanceof LlmError ? `LlmError (${error.kind}${error.status ? `, HTTP ${error.status}` : ""})` : (error as Error).name;
  console.error(`\n✘ ${label}: ${(error as Error).message}`);
  process.exitCode = 1;
}
