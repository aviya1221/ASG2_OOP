import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { HomeworkRepository } from "../../homework/HomeworkRepository.ts";
import { PDF, type Homework, type HomeworkCheck, type HomeworkLesson, type ReviewGuide } from "../../homework/types.ts";

const BUCKET = "homework";
const NOT_A_UUID = "22P02";
const UNIQUE_VIOLATION = "23505";

function throwIf(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export class SupabaseHomeworkRepository implements HomeworkRepository {
  readonly #db: SupabaseClient;

  /** `db` must use the secret key, because only the server writes homework, guides and checks. */
  constructor(db: SupabaseClient) {
    this.#db = db;
  }

  async findLesson(lessonId: string): Promise<HomeworkLesson | null> {
    const { data, error } = await this.#db.from("lessons").select("courses(teacher_id_number)").eq("id", lessonId).maybeSingle();
    if (error?.code === NOT_A_UUID) return null;
    throwIf(error);
    return data ? { teacherId: (data.courses as unknown as { teacher_id_number: string }).teacher_id_number } : null;
  }

  async saveHomework(lessonId: string, title: string, pdf: Uint8Array, guide: ReviewGuide): Promise<Homework> {
    const id = randomUUID();
    const filePath = `${lessonId}/${id}.pdf`;
    throwIf((await this.#db.storage.from(BUCKET).upload(filePath, pdf, { contentType: PDF })).error);
    try {
      throwIf((await this.#db.from("homework").insert({ id, lesson_id: lessonId, title, file_path: filePath })).error);
      throwIf((await this.#db.from("review_guides").insert({ homework_id: id, questions: guide.questions, system_prompt: guide.system_prompt })).error);
    } catch (error) {
      await this.#db.from("homework").delete().eq("id", id);
      await this.#db.storage.from(BUCKET).remove([filePath]);
      throw error;
    }
    return { id, lessonId, title, filePath };
  }

  async findHomework(homeworkId: string): Promise<Homework | null> {
    const { data, error } = await this.#db.from("homework").select("id, lesson_id, title, file_path").eq("id", homeworkId).maybeSingle();
    if (error?.code === NOT_A_UUID) return null;
    throwIf(error);
    return data ? { id: data.id, lessonId: data.lesson_id, title: data.title, filePath: data.file_path } : null;
  }

  async studiesLesson(lessonId: string, studentId: string): Promise<boolean> {
    const lesson = await this.#db.from("lessons").select("course_id").eq("id", lessonId).maybeSingle();
    throwIf(lesson.error);
    if (!lesson.data) return false;
    const { count, error } = await this.#db
      .from("course_students")
      .select("course_id", { count: "exact", head: true })
      .eq("course_id", lesson.data.course_id)
      .eq("student_id_number", studentId);
    throwIf(error);
    return (count ?? 0) > 0;
  }

  async findGuide(homeworkId: string): Promise<ReviewGuide | null> {
    const { data, error } = await this.#db.from("review_guides").select("questions, system_prompt").eq("homework_id", homeworkId).maybeSingle();
    throwIf(error);
    return data ? { questions: data.questions, system_prompt: data.system_prompt } : null;
  }

  async countChecks(homeworkId: string, studentId: string): Promise<number> {
    const { count, error } = await this.#db
      .from("homework_checks")
      .select("check_number", { count: "exact", head: true })
      .eq("homework_id", homeworkId)
      .eq("student_id", studentId);
    throwIf(error);
    return count ?? 0;
  }

  async saveCheck(check: HomeworkCheck): Promise<boolean> {
    const { error } = await this.#db.from("homework_checks").insert({
      homework_id: check.homeworkId,
      student_id: check.studentId,
      check_number: check.checkNumber,
      section_scores: check.sectionScores,
      question_scores: check.questionScores,
      overall: check.overall,
      report: check.report,
    });
    if (error?.code === UNIQUE_VIOLATION) return false;
    throwIf(error);
    return true;
  }
}
