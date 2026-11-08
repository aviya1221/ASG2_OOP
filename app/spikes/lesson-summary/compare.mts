/**
 * Spike F4: same 10-minute clip, audio only vs full video, through the app's own
 * Gemini client and default model. Two requests per way, a minute apart.
 * Usage: tsx compare.ts SERVER_DIR CLIP_DIR OUT_DIR
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const [serverDir, clipDir, outDir] = process.argv.slice(2) as [string, string, string];
const load = (p: string) => import(pathToFileURL(join(serverDir, p)).href);
const { loadConfig } = await load("src/config/env.ts");
const { GeminiLlmClient } = await load("src/integrations/gemini/index.ts");

const config = loadConfig();
const llm = new GeminiLlmClient(config.llm.gemini);
const MODEL: string = config.llm.gemini.textModel;
const PAUSE_MS = 60_000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (m: string) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);

const TRANSCRIBE = `Transcribe the attached recording of a university class in Hebrew, word for word, in Hebrew.
Return the COMPLETE transcript of the whole recording as a list of utterances, in order.
Rules:
- time: mm:ss from the start of this recording.
- speaker: "מרצה" for the person teaching, or "סטודנט" for anyone else.
- text: exactly what was said. Do not summarise, do not translate, do not fix grammar.
- Write [לא ברור] for parts you cannot understand. Skip silence and pure noise.`;

const ON_SCREEN = `

Also fill on_screen: each new thing written or shown on the board or the screen, in order.
- time: mm:ss when it appears.
- content: what is written or drawn, in the original language, with formulas as text.
Include only what you can really read. Do not invent content.`;

const ANALYSE = `You get an automatic transcript of a recorded university lecture in Hebrew.
Each line is "[mm:ss] text". The transcript has NO speaker labels and may contain
recognition errors. Mostly the lecturer speaks; sometimes a student asks a question
and the lecturer answers.

Tasks:
1. Separate the lecturer's explanations from student questions. Detect a student
   question by its content (a question addressed to the lecturer, followed by an
   answer). For each student question give its time, the question and the answer.
2. List the topics covered, in order, with start time and a short summary.
3. Give the main points the lecturer explained, with times.
4. Write a short summary of the whole segment.
5. List words or passages that look badly transcribed.

Write all text values in Hebrew. Do not invent content that is not in the transcript.

Transcript:
`;

const utterance = {
  type: "object",
  properties: { time: { type: "string" }, speaker: { type: "string" }, text: { type: "string" } },
  required: ["time", "speaker", "text"],
};
const screenItem = {
  type: "object",
  properties: { time: { type: "string" }, content: { type: "string" } },
  required: ["time", "content"],
};
const audioSchema = {
  type: "object",
  properties: { utterances: { type: "array", items: utterance } },
  required: ["utterances"],
};
const videoSchema = {
  type: "object",
  properties: { utterances: { type: "array", items: utterance }, on_screen: { type: "array", items: screenItem } },
  required: ["utterances", "on_screen"],
};
const timed = (field: string) => ({
  type: "object",
  properties: { time: { type: "string" }, [field]: { type: "string" } },
  required: ["time", field],
});
const analysisSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    topics: {
      type: "array",
      items: {
        type: "object",
        properties: { title: { type: "string" }, start: { type: "string" }, summary: { type: "string" } },
        required: ["title", "start", "summary"],
      },
    },
    lecturer_points: { type: "array", items: timed("point") },
    student_questions: {
      type: "array",
      items: {
        type: "object",
        properties: { time: { type: "string" }, question: { type: "string" }, answer: { type: "string" } },
        required: ["time", "question", "answer"],
      },
    },
    transcription_issues: { type: "array", items: { type: "string" } },
  },
  required: ["summary", "topics", "lecturer_points", "student_questions", "transcription_issues"],
};

type Transcript = { utterances: { time: string; speaker: string; text: string }[]; on_screen?: { time: string; content: string }[] };

async function retryOnce<T>(label: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    const e = error as { retryable?: boolean; kind?: string; status?: number; message: string };
    log(`${label} failed: ${e.kind ?? "?"} ${e.status ?? ""} ${e.message}`);
    if (!e.retryable) throw error;
    await sleep(PAUSE_MS);
    log(`${label} second try`);
    return run();
  }
}

async function runWay(name: "audio" | "video", path: string, mimeType: string) {
  const dir = join(outDir, name);
  mkdirSync(dir, { recursive: true });
  const isVideo = name === "video";
  const started = Date.now();

  log(`${name}: uploading`);
  const file = await llm.uploadFile({ path, mimeType });
  const uploadSeconds = (Date.now() - started) / 1000;
  log(`${name}: uploaded in ${uploadSeconds.toFixed(0)}s`);

  let transcript: Transcript;
  let tr: { model: string; usage?: unknown };
  const t1 = Date.now();
  try {
    const result = await retryOnce(`${name} transcribe`, () =>
      llm.generateJson({
        prompt: isVideo ? TRANSCRIBE + ON_SCREEN : TRANSCRIBE,
        attachments: [{ file }],
        schema: isVideo ? videoSchema : audioSchema,
        maxOutputTokens: 32768,
      }),
    ) as { data: Transcript; model: string; usage?: unknown };
    transcript = result.data;
    tr = result;
  } finally {
    await llm.deleteFile(file).catch((e: Error) => log(`delete failed: ${e.message}`));
  }
  const transcribeSeconds = (Date.now() - t1) / 1000;
  log(`${name}: transcribed in ${transcribeSeconds.toFixed(0)}s, usage ${JSON.stringify(tr.usage)}`);

  const lines = transcript.utterances.map((u) => `[${u.time}] ${u.speaker}: ${u.text}`);
  const screen = (transcript.on_screen ?? []).map((s) => `[${s.time}] ${s.content}`);
  writeFileSync(join(dir, "transcript.txt"), `${lines.join("\n")}\n`, "utf8");
  if (isVideo) writeFileSync(join(dir, "on_screen.txt"), `${screen.join("\n")}\n`, "utf8");

  log(`${name}: pausing before the analysis`);
  await sleep(PAUSE_MS);

  const t2 = Date.now();
  const board = isVideo
    ? `\n\nWhat was written or shown on the board or the screen, with times. Use it in the summary, the topics and the lecturer's points:\n${screen.join("\n")}`
    : "";
  const analysis = await retryOnce(`${name} analyse`, () =>
    llm.generateJson({ prompt: ANALYSE + lines.join("\n") + board, schema: analysisSchema, maxOutputTokens: 16384 }),
  ) as { data: unknown; model: string; usage?: unknown };
  const analyseSeconds = (Date.now() - t2) / 1000;
  log(`${name}: analysed in ${analyseSeconds.toFixed(0)}s, usage ${JSON.stringify(analysis.usage)}`);

  writeFileSync(join(dir, "result.json"), JSON.stringify(analysis.data, null, 2), "utf8");
  writeFileSync(
    join(dir, "metrics.json"),
    JSON.stringify(
      {
        requested_model: MODEL,
        transcribe_model: tr.model,
        analyse_model: analysis.model,
        upload_seconds: uploadSeconds,
        transcribe_seconds: transcribeSeconds,
        analyse_seconds: analyseSeconds,
        processing_seconds_without_pauses: uploadSeconds + transcribeSeconds + analyseSeconds,
        transcribe_usage: tr.usage,
        analyse_usage: analysis.usage,
        utterances: lines.length,
        student_lines: transcript.utterances.filter((u) => u.speaker.includes("סטודנט")).length,
        on_screen_items: screen.length,
      },
      null,
      2,
    ),
    "utf8",
  );
}

log(`model: ${MODEL}`);
try {
  await runWay("audio", join(clipDir, "clip.wav"), "audio/wav");
  log("pausing between the two ways");
  await sleep(PAUSE_MS);
  await runWay("video", join(clipDir, "clip.mp4"), "video/mp4");
  log("ALL DONE");
} catch (error) {
  const e = error as { kind?: string; status?: number; message: string };
  log(`STOPPED: ${e.kind ?? "error"} ${e.status ?? ""} ${e.message}`);
  process.exitCode = 1;
}
