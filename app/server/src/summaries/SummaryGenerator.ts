import { rm } from "node:fs/promises";
import { LlmError, type JsonSchema, type LlmClient, type UploadedFile } from "../llm/index.ts";
import type { SoundExtractor } from "./SoundExtractor.ts";
import { MAX_SUMMARY_WORDS, type GeneratedSummary, type Recording } from "./types.ts";

interface Transcript {
  utterances: { time: string; speaker: string; text: string }[];
  on_screen?: { time: string; content: string }[];
}

const TRANSCRIBE = `Transcribe the attached recording of a lesson in Hebrew, word for word, in Hebrew.
Return the complete transcript of the whole recording as a list of utterances, in order.
- time: mm:ss from the start of the recording.
- speaker: "מרצה" for the person teaching, or "סטודנט" for anyone else.
- text: exactly what was said. Do not summarise, translate or fix grammar.
- Write [לא ברור] for parts you cannot understand. Skip silence and noise.`;

const ON_SCREEN = `

Also fill on_screen: each new thing written or shown on the board or the screen, in order.
- time: mm:ss when it appears.
- content: what is written or drawn, in the original language, with formulas as text.
Include only what you can really read. Do not invent content.`;

const WRITE = `You get the transcript of a recorded lesson in Hebrew, with speaker labels, and the list of what was on the board.
Write in Hebrew, from them only, and invent nothing:
- document: a summary of the lesson for its students, in Markdown, that fits on one printed page: at most ${MAX_SUMMARY_WORDS} words in all. Build it like this:
  1. "# " and the topic of the lesson, then a short opening paragraph of two or three sentences.
  2. For each main topic, in the order it was taught: "## " and a short title, then a few short bullet points ("- "). Put the key terms in **bold**.
     Add content from the board inside the topic it belongs to, and only when it adds something new and important, such as a formula, a definition or a worked example. Write a formula in \`code\`.
  3. "## שאלות מהשיעור" with the main questions the students asked, each as "- **the question**" followed by the teacher's answer in one or two sentences. Leave out small or repeated questions, and leave out this part when no student asked anything.
  Write no times, no speaker names, nothing about the recording itself and no closing line.
- lesson_topic: the topic of the lesson, in a few words.`;

const REVIEW = `You get a summary of a lesson in Markdown, its transcript and the list of what was on the board.
Correct only spelling mistakes and garbled copying in the summary, by comparing it with the transcript and the board list.
Correct only what the sources support. Add no new content, remove nothing, and keep the headings, bullet points and bold text as they are. Return the summary in the same structure.`;

const timed = (field: string): JsonSchema => ({
  type: "object",
  properties: { time: { type: "string" }, [field]: { type: "string" } },
  required: ["time", field],
});

const TRANSCRIPT_SCHEMA = (withBoard: boolean): JsonSchema => ({
  type: "object",
  properties: {
    utterances: { type: "array", items: { type: "object", properties: { time: { type: "string" }, speaker: { type: "string" }, text: { type: "string" } }, required: ["time", "speaker", "text"] } },
    ...(withBoard ? { on_screen: { type: "array", items: timed("content") } } : {}),
  },
  required: withBoard ? ["utterances", "on_screen"] : ["utterances"],
});

const DOCUMENT_SCHEMA: JsonSchema = {
  type: "object",
  properties: { document: { type: "string" }, lesson_topic: { type: "string" } },
  required: ["document", "lesson_topic"],
};

interface DocumentAnswer {
  document: string;
  lesson_topic: string;
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Counts the words a reader sees: the marks of headings, points and bold text are not words. */
export function summaryWords(markdown: string): number {
  return wordCount(markdown.replace(/^\s*(#{1,6}|[-*+]|\d+\.)\s+/gm, "").replace(/[*_`]/g, ""));
}

/** Refuses an empty summary and one longer than a page (REQ-45). */
export function checkDocument(value: unknown): DocumentAnswer {
  const answer = value as DocumentAnswer;
  if (typeof answer?.document !== "string" || !answer.document.trim()) throw new Error("the summary is empty");
  if (summaryWords(answer.document) > MAX_SUMMARY_WORDS) throw new Error(`the summary has more than ${MAX_SUMMARY_WORDS} words`);
  return answer;
}

/** Sound alone is used when the file is over the limit of the AI service or a usage limit is reached (REQ-44). */
function needsSoundOnly(error: unknown): boolean {
  return error instanceof LlmError && (error.kind === "rate-limit" || error.kind === "invalid-request");
}

/** Makes the one-page summary with three requests (docs/07-EDD/lesson-summary.md, ADR-2). */
export class SummaryGenerator {
  readonly #llm: LlmClient;
  readonly #sound: SoundExtractor;

  constructor(llm: LlmClient, sound: SoundExtractor) {
    this.#llm = llm;
    this.#sound = sound;
  }

  async generate(recording: Recording): Promise<GeneratedSummary> {
    const isVideo = recording.mimeType.startsWith("video/");
    let transcript: Transcript;
    try {
      transcript = await this.#transcribe(recording, isVideo);
    } catch (error) {
      if (!isVideo || !needsSoundOnly(error)) throw error;
      const soundPath = await this.#sound.extract(recording.path);
      try {
        transcript = await this.#transcribe({ path: soundPath, mimeType: "audio/mp4" }, false);
      } finally {
        await rm(soundPath, { force: true });
      }
    }

    const lines = transcript.utterances.map((u) => `[${u.time}] ${u.speaker}: ${u.text}`).join("\n");
    const board = (transcript.on_screen ?? []).map((item) => `[${item.time}] ${item.content}`).join("\n");
    const sources = `Transcript:\n${lines}\n\nBoard:\n${board || "(none)"}`;

    const written = await this.#json<DocumentAnswer>(`${WRITE}\n\n${sources}`, DOCUMENT_SCHEMA, checkDocument);
    const reviewed = await this.#json<DocumentAnswer>(`${REVIEW}\n\nSummary:\n${JSON.stringify(written)}\n\n${sources}`, DOCUMENT_SCHEMA, checkDocument);

    return { body: reviewed.document.trim(), lessonTopic: reviewed.lesson_topic || written.lesson_topic };
  }

  async #transcribe(recording: Recording, withBoard: boolean): Promise<Transcript> {
    let file: UploadedFile | null = null;
    try {
      file = await this.#llm.uploadFile({ path: recording.path, mimeType: recording.mimeType });
      const uploaded = file;
      return await this.#retryOnce(async () => {
        const { data } = await this.#llm.generateJson<Transcript>({
          prompt: withBoard ? TRANSCRIBE + ON_SCREEN : TRANSCRIBE,
          attachments: [{ file: uploaded }],
          schema: TRANSCRIPT_SCHEMA(withBoard),
          maxOutputTokens: 32_768,
        });
        return data;
      });
    } finally {
      if (file) await this.#llm.deleteFile(file).catch(() => {});
    }
  }

  #json<T>(prompt: string, schema: JsonSchema, validate: (value: unknown) => T): Promise<T> {
    return this.#retryOnce(async () => (await this.#llm.generateJson<T>({ prompt, schema, validate, maxOutputTokens: 16_384 })).data);
  }

  /** An answer that does not fit the schema gets one more try. */
  async #retryOnce<T>(call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (error) {
      if (error instanceof LlmError && error.kind === "bad-output") return call();
      throw error;
    }
  }
}
