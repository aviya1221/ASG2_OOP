import { rm } from "node:fs/promises";
import { LlmError, type JsonSchema, type LlmClient, type UploadedFile } from "../llm/index.ts";
import type { SoundExtractor } from "./SoundExtractor.ts";
import { MAX_OVERVIEW_WORDS, type GeneratedSummary, type Recording, type SummaryParts } from "./types.ts";

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
- overview: a summary of the lesson of up to ${MAX_OVERVIEW_WORDS} words.
- topics: the topics in order, each with the time it started (mm:ss).
- questions: each question a student asked, with the time and the teacher's answer.
- board: the formulas and other content from the board, with times.
- lesson_topic: the topic of the lesson, in a few words.`;

const REVIEW = `You get a summary of a lesson, its transcript and the list of what was on the board.
Correct only spelling mistakes and garbled copying in the summary, by comparing it with the transcript and the board list.
Correct only what the sources support. Add no new content and remove nothing. Return the summary in the same structure.`;

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

const PARTS_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    overview: { type: "string" },
    topics: { type: "array", items: { type: "object", properties: { title: { type: "string" }, start: { type: "string" } }, required: ["title", "start"] } },
    questions: {
      type: "array",
      items: { type: "object", properties: { time: { type: "string" }, question: { type: "string" }, answer: { type: "string" } }, required: ["time", "question", "answer"] },
    },
    board: { type: "array", items: timed("content") },
    lesson_topic: { type: "string" },
  },
  required: ["overview", "topics", "questions", "board", "lesson_topic"],
};

type PartsAnswer = SummaryParts & { lesson_topic: string };

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Refuses an answer of the wrong shape or an overview above the limit (REQ-45). */
export function checkParts(value: unknown): PartsAnswer {
  const parts = value as PartsAnswer;
  if (typeof parts?.overview !== "string" || !Array.isArray(parts.topics) || !Array.isArray(parts.questions) || !Array.isArray(parts.board)) {
    throw new Error("the summary is missing a part");
  }
  if (wordCount(parts.overview) > MAX_OVERVIEW_WORDS) throw new Error(`the overview has more than ${MAX_OVERVIEW_WORDS} words`);
  return parts;
}

/** Sound alone is used when the file is over the limit of the AI service or a usage limit is reached (REQ-44). */
function needsSoundOnly(error: unknown): boolean {
  return error instanceof LlmError && (error.kind === "rate-limit" || error.kind === "invalid-request");
}

/** Makes the four parts of a summary with three requests (docs/07-EDD/lesson-summary.md, ADR-2). */
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

    const written = await this.#json<PartsAnswer>(`${WRITE}\n\n${sources}`, PARTS_SCHEMA, checkParts);
    const reviewed = await this.#json<PartsAnswer>(`${REVIEW}\n\nSummary:\n${JSON.stringify(written)}\n\n${sources}`, PARTS_SCHEMA, checkParts);

    const { lesson_topic, ...parts } = reviewed;
    return { parts: { overview: parts.overview, topics: parts.topics, questions: parts.questions, board: parts.board }, lessonTopic: lesson_topic || written.lesson_topic };
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
