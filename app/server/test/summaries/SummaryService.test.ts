import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import type { SummaryGenerator } from "../../src/summaries/SummaryGenerator.ts";
import type { SummaryRepository } from "../../src/summaries/SummaryRepository.ts";
import { SummaryService } from "../../src/summaries/SummaryService.ts";
import type { GeneratedSummary, SummaryParts, SummaryState } from "../../src/summaries/types.ts";

const NOW = new Date("2026-12-01T12:00:00Z");
const ENDED = { teacherId: "T1", endsAt: new Date("2026-12-01T11:00:00Z") };
const RESULT: GeneratedSummary = { parts: { overview: "תקציר", topics: [], questions: [], board: [] }, lessonTopic: "נושא" };

class FakeRepository implements SummaryRepository {
  lesson = ENDED;
  state: SummaryState | null = null;
  history: string[] = [];
  saved: SummaryParts | null = null;
  topic: string | null = null;

  async findLesson() {
    return this.lesson;
  }
  async findState() {
    return this.state;
  }
  async markStarted() {
    this.history.push("in_progress");
    this.state = { status: "in_progress", startedAt: NOW };
  }
  async saveReady(_lesson: string, parts: SummaryParts) {
    this.history.push("ready");
    this.state = { status: "ready", startedAt: NOW };
    this.saved = parts;
  }
  async markFailed() {
    this.history.push("failed");
    this.state = { status: "failed", startedAt: NOW };
  }
  async setTopicIfEmpty(_lesson: string, topic: string) {
    this.topic = topic;
  }
}

function generatorOf(generate: () => Promise<GeneratedSummary>): SummaryGenerator {
  return { generate } as unknown as SummaryGenerator;
}

async function recording(): Promise<{ path: string; mimeType: string }> {
  const path = join(tmpdir(), `recording-${Math.random().toString(36).slice(2)}.mp4`);
  await writeFile(path, "video");
  return { path, mimeType: "video/mp4" };
}

describe("SummaryService", () => {
  it("TC-082 answers before the AI service does, with the status in progress", async () => {
    const repository = new FakeRepository();
    const service = new SummaryService(repository, generatorOf(() => new Promise(() => {})), () => NOW);
    await service.start("L1", "T1", await recording());
    assert.equal(repository.state?.status, "in_progress");
  });

  it("TC-088 deletes the recording when the summary succeeds and when it fails", async () => {
    for (const outcome of ["success", "failure"] as const) {
      const repository = new FakeRepository();
      const file = await recording();
      const generator = generatorOf(async () => {
        if (outcome === "failure") throw new Error("the AI service failed");
        return RESULT;
      });
      const { finished } = await new SummaryService(repository, generator, () => NOW).start("L1", "T1", file);
      await finished;
      assert.equal(existsSync(file.path), false, outcome);
    }
  });

  it("TC-102 every transition: in progress, then ready or failed, and a new upload after either", async () => {
    const repository = new FakeRepository();
    let fail = false;
    const service = new SummaryService(
      repository,
      generatorOf(async () => {
        if (fail) throw new Error("failed");
        return RESULT;
      }),
      () => NOW,
    );

    await (await service.start("L1", "T1", await recording())).finished;
    fail = true;
    await (await service.start("L1", "T1", await recording())).finished;
    fail = false;
    await (await service.start("L1", "T1", await recording())).finished;

    assert.deepEqual(repository.history, ["in_progress", "ready", "in_progress", "failed", "in_progress", "ready"]);
    assert.equal(repository.topic, "נושא");
  });

  it("TC-102 refuses a second upload during the first 15 minutes, and accepts it after them", async () => {
    const repository = new FakeRepository();
    repository.state = { status: "in_progress", startedAt: new Date(NOW.getTime() - 14 * 60_000) };
    const service = new SummaryService(repository, generatorOf(async () => RESULT), () => NOW);
    const file = await recording();
    await assert.rejects(service.start("L1", "T1", file), { status: 409, code: "summary_in_progress" });
    assert.equal(existsSync(file.path), false, "a refused upload is deleted at once");

    repository.state = { status: "in_progress", startedAt: new Date(NOW.getTime() - 16 * 60_000) };
    await (await service.start("L1", "T1", await recording())).finished;
    assert.equal(repository.state?.status, "ready");
  });

  it("TC-080 refuses a lesson that has not ended, and a teacher of another course", async () => {
    const repository = new FakeRepository();
    const service = new SummaryService(repository, generatorOf(async () => RESULT), () => NOW);
    repository.lesson = { ...ENDED, endsAt: new Date(NOW.getTime() + 60_000) };
    await assert.rejects(service.start("L1", "T1", await recording()), { status: 409, code: "lesson_not_ended" });
    repository.lesson = ENDED;
    await assert.rejects(service.start("L1", "T2", await recording()), { status: 403, code: "not_the_teacher" });
  });
});
