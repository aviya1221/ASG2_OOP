import { rm } from "node:fs/promises";
import { HttpError } from "../http/errors.ts";
import type { SummaryGenerator } from "./SummaryGenerator.ts";
import type { SummaryRepository } from "./SummaryRepository.ts";
import { STALE_AFTER_MS, type Recording } from "./types.ts";

/** Starts a summary, answers at once and finishes it in the background (docs/07-EDD/lesson-summary.md). */
export class SummaryService {
  readonly #repository: SummaryRepository;
  readonly #generator: SummaryGenerator;
  readonly #now: () => Date;

  constructor(repository: SummaryRepository, generator: SummaryGenerator, now: () => Date = () => new Date()) {
    this.#repository = repository;
    this.#generator = generator;
    this.#now = now;
  }

  /** Returns as soon as the summary has started. `finished` lets tests wait for the background work. */
  async start(lessonId: string, teacherId: string, recording: Recording): Promise<{ finished: Promise<void> }> {
    try {
      await this.#check(lessonId, teacherId);
      await this.#repository.markStarted(lessonId);
    } catch (error) {
      await rm(recording.path, { force: true });
      throw error;
    }
    return { finished: this.#run(lessonId, recording) };
  }

  async #check(lessonId: string, teacherId: string): Promise<void> {
    const lesson = await this.#repository.findLesson(lessonId);
    if (!lesson) throw new HttpError(404, "not_found", "There is no such lesson.");
    if (lesson.teacherId !== teacherId) throw new HttpError(403, "not_the_teacher", "Only the teacher of the lesson can do this.");
    if (this.#now() < lesson.endsAt) throw new HttpError(409, "lesson_not_ended", "A summary can be made only after the lesson.");

    const state = await this.#repository.findState(lessonId);
    const fresh = state && this.#now().getTime() - state.startedAt.getTime() < STALE_AFTER_MS;
    if (state?.status === "in_progress" && fresh) throw new HttpError(409, "summary_in_progress", "A summary of this lesson is already being made.");
  }

  async #run(lessonId: string, recording: Recording): Promise<void> {
    try {
      const { body, lessonTopic } = await this.#generator.generate(recording);
      await this.#repository.saveReady(lessonId, body);
      if (lessonTopic.trim()) await this.#repository.setTopicIfEmpty(lessonId, lessonTopic.trim());
    } catch (error) {
      console.error(error instanceof Error ? error.message : "The summary failed");
      await this.#repository.markFailed(lessonId).catch(() => {});
    } finally {
      // The recording is deleted when the work ends, whether it succeeded or failed (REQ-48).
      await rm(recording.path, { force: true });
    }
  }
}
