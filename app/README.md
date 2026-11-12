# Web App

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

- **Server:** Node.js 22 + TypeScript, run directly with `tsx` (no build step), with Express for the routes.
- **Tests:** `node:test` on the server, Vitest in the client and Playwright in real browser engines ([test plan](../docs/08-STP-STD.md)).
- **LLM:** Google Gemini through Google's official SDK, `@google/genai`.
- **Web client:** React 19 and Vite 8, in TypeScript, with plain CSS ([ADR-4](../docs/02-tools-report.md#adr-4-web-client), [screens and look](../docs/features/UI-strategy.md)). The chosen tools were checked on a [test page](spikes/client-react/).
- **Database, sign-in, files and live updates:** Supabase ([ADR-3](../docs/02-tools-report.md#adr-3-database-sign-in-files-and-live-updates)).
- **Hosting:** the web client on Netlify and the server on Render ([ADR-4](../docs/02-tools-report.md#adr-4-web-client), [ADR-5](../docs/02-tools-report.md#adr-5-hosting-the-server)).

## Run locally

You need Node.js 22 and Docker.

```bash
cd app
npm install
npm --prefix server install
npm --prefix client install
npm run db:start                          # the database, in Docker
npm run db:users                          # made-up accounts, with the password local-test-password
cp client/.env.example client/.env.local  # then add the public key from: npx supabase status
npm --prefix client run dev
```

Sign in with the ID number `100000001` (admin), `200000001` (teacher) or `300000001` (student). The made-up data is in [supabase/seed.sql](supabase/seed.sql).

To call Gemini, copy `server/.env.example` to `server/.env`, add a key from <https://aistudio.google.com/apikey> and run `npm --prefix server run smoke:gemini`.

Attendance also needs the server: copy `server/.env.example` to `server/.env`, add the values from `npx supabase status`, and run `npm --prefix server run dev`.

The product is not deployed yet.

## Tests

| Command, in `app/` | What runs | What it needs |
|--------------------|-----------|---------------|
| `npm --prefix server test` | Unit tests of the server | Nothing |
| `npm --prefix client test` | Unit tests of the client | Nothing |
| `npm run test:integration` | Access rules, database functions and server calls | The local database |
| `npm run test:browser` | Whole flows, in a phone profile and an iPhone profile | The local database, and once: `npx playwright install chromium webkit` |
| `npm run matrix` | Writes the results into the traceability matrix | The reports of the runs above |

Every push runs them all through [GitHub Actions](../.github/workflows/tests.yml). `npm run db:reset` starts again from clean data.

## Folders

| Folder | What is in it |
|--------|---------------|
| `client/` | The web client |
| `server/` | Our server |
| `supabase/` | The database: tables, access rules and made-up data |
| `e2e/` | Browser tests |
| `scripts/` | Test accounts and the traceability matrix |
| `spikes/` | Hands-on tool checks, reported in the [tools report](../docs/02-tools-report.md) |

## Server structure

```text
app/server/
  src/
    index.ts                starts the web server
    config/env.ts           settings from environment variables, checked at start-up
    container.ts            builds the shared services once (composition root)
    http/                   the web server: routes, sign-in check and the error format
    llm/                    LLM layer, provider-neutral: the only thing features import
      LlmClient.ts          the interface: text, JSON by schema, file upload, embeddings
      types.ts              request and result types
      LlmError.ts           one error type, with a "kind" the UI can act on
      FakeLlmClient.ts      canned answers for tests and the offline demo
      parseJsonAnswer.ts    shared parse + validate step for JSON answers
      similarity.ts         cosine similarity, to compare homework
    integrations/
      supabase/             checks sign-in tokens with Supabase
      gemini/               the only folder that imports @google/genai
        GeminiLlmClient.ts  implements LlmClient (generateContent, Files API, embeddings)
        GeminiConfig.ts     settings and default models
        toLlmError.ts       SDK errors -> LlmError
  scripts/gemini-smoke.ts   real end-to-end call (evidence for the step 2 spike)
  test/                     same folders as src/
  test-integration/         against the real local database
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
| Review text, summaries | `generateContent` with a system instruction | [Text generation](https://aistudio.google.com/docs/text-generation) |
| Rubric scores the app can store | Structured output: `responseMimeType` with a JSON schema (`responseJsonSchema`) | [Structured output](https://aistudio.google.com/docs/structured-output) |
| A homework PDF or photo | File sent inline with the prompt | [Text generation](https://aistudio.google.com/docs/text-generation) |
| A recorded class video | Files API (up to 2 GB per file, deleted after 48 hours) | [Files API](https://aistudio.google.com/docs/files) |
| Comparing homework between students | `gemini-embedding-2` vectors + cosine similarity | [Embeddings](https://aistudio.google.com/docs/embeddings) |

### Decisions

- **`generateContent`, not the Interactions API (changed on 2026-11-12).** Google recommends the Interactions API for new projects, and we started there. From 2026-11-11 it answered "high demand" (503) for `gemini-3.6-flash` on every request, while `generateContent` on the same model answered at once, and the SDK's own retry of an interaction broke with "TypeError: unusable". `generateContent` is still supported, and nothing outside the adapter changed.
- **No conversation on Google's side.** Each request stands alone; we never continue a conversation there.
- **Default model `gemini-3.6-flash`**, the current stable Flash model. The `gemini-2.5-*` models are deprecated and re-routed on 2026-12-01. Change it with `GEMINI_TEXT_MODEL`, no code change.
- **SDK pinned to the 2.x line.** Version 3.0.0 came out on 2026-11-06 and switches the default API version to `v1`; upgrade once we have checked it.
- **One retry of our own.** The SDK does not retry `generateContent`. After a busy answer (5xx or no connection) the adapter waits 5 s and sends the request once more. Any other error, or a second busy answer, reaches the feature, and `LlmError.retryable` tells the UI whether to offer "try again later".
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
| `GEMINI_TEXT_MODEL` | no | `gemini-3.6-flash` | Model for text and JSON answers, and for the review guides of homework |
| `GEMINI_REVIEW_MODEL` | no | `gemini-3.5-flash-lite` | Model that reviews homework solutions (ADR-9) |
| `GEMINI_EMBEDDING_MODEL` | no | `gemini-embedding-2` | Model for comparing texts |
| `PORT` | no | `8787` | The port of the web server |
| `WEB_ORIGIN` | to run the server | | The addresses of the web client, separated by commas |
| `SUPABASE_URL` | to run the server | | The address of the Supabase project |
| `SUPABASE_SECRET_KEY` | to run the server | | The secret key of the Supabase project, kept on the server only |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | no | | Keys for phone notifications. Without them the server sends none |

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
| [Playwright](https://github.com/microsoft/playwright) | Browser tests | Apache-2.0 |
| [Express](https://github.com/expressjs/express) and [cors](https://github.com/expressjs/cors) | Routes of the server | MIT |
| [React Router](https://github.com/remix-run/react-router) | Addresses of the web client | MIT |
| [Supabase CLI](https://github.com/supabase/cli) | Local database (dev tool) | MIT |
| [Vitest](https://github.com/vitest-dev/vitest), [Testing Library](https://github.com/testing-library) and [jsdom](https://github.com/jsdom/jsdom) | Unit tests of the client (dev tools) | MIT |
| [OpenCV.js](https://github.com/TechStark/opencv-js), [YuNet and SFace](https://github.com/opencv/opencv_zoo) | Finds faces and makes face-prints in the browser | Apache-2.0 / MIT |
| [ONNX Runtime Web](https://github.com/microsoft/onnxruntime) | Runs the face-print model in the browser | MIT |
| [write-excel-file](https://gitlab.com/catamphetamine/write-excel-file) | Writes the attendance sheet | MIT |
| [web-push](https://github.com/web-push-libs/web-push) | Sends phone notifications | MPL-2.0 |
| [multer](https://github.com/expressjs/multer) | Receives the recording of a lesson | MIT |
| [ffmpeg-static](https://github.com/eugeneware/ffmpeg-static) | Copies the sound track of a recording. It runs as a separate program | GPL-3.0-or-later |
| [ExcelJS](https://github.com/exceljs/exceljs) | Reads the attendance sheet in a browser test (dev tool) | MIT |
| [Lucide](https://github.com/lucide-icons/lucide) (lucide-react) | Thin-line icons on the buttons | ISC |
| [react-markdown](https://github.com/remarkjs/react-markdown) | Shows the one-page lesson summary with its headings and bold text, without running any HTML in it | MIT |
| [Test photos](e2e/photos/README.md) | Generated pictures of people who do not exist | Public domain |
