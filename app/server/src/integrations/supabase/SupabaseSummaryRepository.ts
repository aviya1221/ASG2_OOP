import type { SupabaseClient } from "@supabase/supabase-js";
import type { SummaryRepository } from "../../summaries/SummaryRepository.ts";
import type { SummaryLesson, SummaryParts, SummaryState } from "../../summaries/types.ts";

function throwIf(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export class SupabaseSummaryRepository implements SummaryRepository {
  readonly #db: SupabaseClient;

  /** `db` must use the secret key, because only the server writes the status of a summary. */
  constructor(db: SupabaseClient) {
    this.#db = db;
  }

  async findLesson(lessonId: string): Promise<SummaryLesson | null> {
    const { data, error } = await this.#db.from("lessons").select("ends_at, courses(teacher_id_number)").eq("id", lessonId).maybeSingle();
    if (error?.code === "22P02") return null;
    throwIf(error);
    if (!data) return null;
    return { endsAt: new Date(data.ends_at), teacherId: (data.courses as unknown as { teacher_id_number: string }).teacher_id_number };
  }

  async findState(lessonId: string): Promise<SummaryState | null> {
    const { data, error } = await this.#db.from("lesson_summaries").select("status, started_at").eq("lesson_id", lessonId).maybeSingle();
    throwIf(error);
    return data ? { status: data.status, startedAt: new Date(data.started_at) } : null;
  }

  async markStarted(lessonId: string): Promise<void> {
    const { error } = await this.#db
      .from("lesson_summaries")
      .upsert({ lesson_id: lessonId, status: "in_progress", started_at: new Date().toISOString(), finished_at: null });
    throwIf(error);
  }

  async saveReady(lessonId: string, parts: SummaryParts): Promise<void> {
    const { error } = await this.#db
      .from("lesson_summaries")
      .update({ status: "ready", finished_at: new Date().toISOString(), ...parts })
      .eq("lesson_id", lessonId);
    throwIf(error);
  }

  async markFailed(lessonId: string): Promise<void> {
    const { error } = await this.#db.from("lesson_summaries").update({ status: "failed", finished_at: new Date().toISOString() }).eq("lesson_id", lessonId);
    throwIf(error);
  }

  async setTopicIfEmpty(lessonId: string, topic: string): Promise<void> {
    const { error } = await this.#db.from("lessons").update({ topic }).eq("id", lessonId).is("topic", null);
    throwIf(error);
  }
}
