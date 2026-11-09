# Step 9: Demo Web App

<!--
LECTURER GUIDELINES: IMPLEMENTATION
(Hidden on GitHub, visible when editing.)

Assignment step 9: "Implement (vibe code vs find and compose) a demo (KISS)
web application." The assignment prefers reusing existing code, and only
designing what can be implemented. Students use a simple smartphone web app.

Docs as code (lecture 02a, slide 21):
- Definition of done: a feature is not done until its docs and tests are updated.
- A change to behaviour updates the doc in the same commit / PR.
- Generate what you can (API reference, test reports).

README (lecture 02a, slide 20): when the app exists, the main README needs
sections 2-5: quick start (install and run), usage example, configuration and
environment, how to run the tests.

Demo-day checklist (lecture 03a, slide 16): "Freeze a tagged release days
before" the demo, and avoid last-minute merges.

CDR (lecture 03a, slide 8): build "a working vertical slice" first, meaning
one feature end to end (UI, logic, storage). For us: attendance.

FOR OUR PROJECT
Each feature is a few small commits (UI, logic, tests). Record the sources and
licenses of any code we reuse below.
-->

## Tech stack

- **Server:** Node.js 22 + TypeScript, run directly with `tsx` (no build step).
- **Tests:** Node's built-in test runner (`node:test`).
- **LLM:** Google Gemini through Google's official SDK, `@google/genai`.
- **Web client:** React 19 and Vite 8, in TypeScript, with plain CSS ([ADR-4](../docs/02-tools-report.md#adr-4-web-client), [screens and look](../docs/features/UI-strategy.md)). The client is not built yet; the chosen tools were checked on a [test page](spikes/client-react/).
- **Database, sign-in, files and live updates:** Supabase ([ADR-3](../docs/02-tools-report.md#adr-3-database-sign-in-files-and-live-updates)).
- **Hosting:** _TODO (steps 2 and 9)._

## Run locally

```bash
cd app/server
npm install
cp .env.example .env     # then put your Gemini API key in .env
npm test                 # unit tests: no key, no network
npm run typecheck
npm run smoke:gemini     # a few real calls to Gemini with your key
```

Get a Gemini API key at <https://aistudio.google.com/apikey>.
Public URL: _TODO (step 9)._

## Server structure

```text
app/server/
  src/
    config/env.ts           settings from environment variables, checked at start-up
    container.ts            builds the shared services once (composition root)
    llm/                    LLM layer, provider-neutral: the only thing features import
      LlmClient.ts          the interface: text, JSON by schema, file upload, embeddings
      types.ts              request and result types
      LlmError.ts           one error type, with a "kind" the UI can act on
      FakeLlmClient.ts      canned answers for tests and the offline demo
      parseJsonAnswer.ts    shared parse + validate step for JSON answers
      similarity.ts         cosine similarity, to compare homework
    integrations/
      gemini/               the only folder that imports @google/genai
        GeminiLlmClient.ts  implements LlmClient (Interactions API, Files API, embeddings)
        GeminiConfig.ts     settings and default models
        toLlmError.ts       SDK errors -> LlmError
  scripts/gemini-smoke.ts   real end-to-end call (evidence for the step 2 spike)
  test/                     same folders as src/
```

**Dependency rule:** features depend on the `LlmClient` interface only. `container.ts` is the one place that picks the implementation, and `integrations/gemini/` is the one place that knows Google's SDK. This is the mitigation the lecturer gives for an external-API risk (lecture 03a, R4: "mock the API; integrate behind an interface"), and it lets the demo switch to `FakeLlmClient` (plan B) by changing one setting.

## LLM layer

### How a feature uses it

A feature receives an `LlmClient` in its constructor and never creates one itself:

```ts
import type { LlmClient, JsonSchema } from "../llm/index.ts";

const REVIEW_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    score: { type: "integer", minimum: 0, maximum: 100 },
    strengths: { type: "array", items: { type: "string" } },
    toImprove: { type: "array", items: { type: "string" } },
  },
  required: ["score", "strengths", "toImprove"],
};

export class HomeworkReviewService {
  readonly #llm: LlmClient;

  constructor(llm: LlmClient) {
    this.#llm = llm;
  }

  async review(homeworkPdf: Uint8Array, rubric: string) {
    const { data } = await this.#llm.generateJson<{ score: number; strengths: string[]; toImprove: string[] }>({
      instructions: "You are a fair teaching assistant. Review only against the rubric.",
      prompt: `Review the attached homework against this rubric:\n${rubric}`,
      attachments: [{ mimeType: "application/pdf", data: homeworkPdf }],
      schema: REVIEW_SCHEMA,
    });
    return data;
  }
}
```

In unit tests the same class gets `new FakeLlmClient()`, so it is tested without a key.

### Which Gemini features we use

| Our need | Gemini feature | Google's guide |
|----------|----------------|----------------|
| Review text, summaries | Interactions API with a system instruction | [Text generation](https://aistudio.google.com/docs/text-generation) |
| Rubric scores the app can store | Structured output: `response_format` with a JSON schema | [Structured output](https://aistudio.google.com/docs/structured-output) |
| A homework PDF or photo | File sent inline with the prompt | [Interactions](https://aistudio.google.com/docs/interactions) |
| A recorded class video | Files API (up to 2 GB per file, deleted after 48 hours) | [Files API](https://aistudio.google.com/docs/files) |
| Comparing homework between students | `gemini-embedding-2` vectors + cosine similarity | [Embeddings](https://aistudio.google.com/docs/embeddings) |

### Decisions

- **Interactions API, not `generateContent`.** Google calls `generateContent` legacy (still supported) and recommends the Interactions API for all new projects; new models launch there.
- **`store: false`.** Otherwise Google keeps every interaction (1 day on the free tier, 55 days on paid). We send student work and never continue a conversation on Google's side.
- **Default model `gemini-3.6-flash`**, the current stable Flash model. The `gemini-2.5-*` models are deprecated and re-routed on 2026-12-01. Change it with `GEMINI_TEXT_MODEL`, no code change.
- **SDK pinned to the 2.x line.** Version 3.0.0 came out on 2026-11-06 and switches the default API version to `v1`; upgrade once we have checked it.
- **No retry code of our own.** The SDK already retries 408, 429 and 5xx with back-off, so an error that reaches us is final; `LlmError.retryable` tells the UI whether to offer "try again later".
- **The API key stays on the server.** The phone never calls Gemini directly.

### Limits to keep in mind

- Free-tier request limits are per project; check them in Google AI Studio before the demo.
- Files: 2 GB each, 20 GB per project, deleted after 48 hours. Requests over 100 MB (PDFs over 50 MB) must use the Files API.
- Embeddings: up to 8,192 tokens per text, so a very long submission must be split.
- Gemini does not enforce every schema rule (e.g. `minLength`); features that rely on one pass a `validate` function.

## Settings (environment variables)

Copy [server/.env.example](server/.env.example) to `server/.env`. The `.env` file is ignored by git.

| Variable | Required | Default | Meaning |
|----------|----------|---------|---------|
| `LLM_PROVIDER` | no | `gemini` | `gemini` for real calls, `fake` for canned answers (tests, offline demo) |
| `GEMINI_API_KEY` | with `gemini` | | Key from Google AI Studio |
| `GEMINI_TEXT_MODEL` | no | `gemini-3.6-flash` | Model for text and JSON answers |
| `GEMINI_EMBEDDING_MODEL` | no | `gemini-embedding-2` | Model for comparing texts |
| `GEMINI_STORE_INTERACTIONS` | no | `false` | Let Google keep interactions |

## Reused code and licenses

| Source | What we used | License |
|--------|--------------|---------|
| [@google/genai](https://github.com/googleapis/js-genai) | Google's official Gemini SDK | Apache-2.0 |
| [tsx](https://github.com/privatenumber/tsx) | Runs TypeScript directly (dev tool) | MIT |
| [TypeScript](https://github.com/microsoft/TypeScript) | Type checker (dev tool) | Apache-2.0 |
| [@types/node](https://github.com/DefinitelyTyped/DefinitelyTyped) | Node.js type definitions (dev tool) | MIT |
| [React](https://github.com/react/react) | Web client screens | MIT |
| [Vite](https://github.com/vitejs/vite) and [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react) | Builds the web client (dev tool) | MIT |
| [@types/react](https://github.com/DefinitelyTyped/DefinitelyTyped) | React type definitions (dev tool) | MIT |
| [@supabase/supabase-js](https://github.com/supabase/supabase-js) | Supabase client library | MIT |
| [Playwright](https://github.com/microsoft/playwright) | Measures the client test page (test page only) | Apache-2.0 |
