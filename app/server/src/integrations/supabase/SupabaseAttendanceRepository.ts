import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AttendanceRepository } from "../../attendance/AttendanceRepository.ts";
import { JPEG, type LessonInfo, type PhotoNumber, type Round, type SharedPhotoFile } from "../../attendance/types.ts";
import { HttpError } from "../../http/errors.ts";

const UNIQUE_VIOLATION = "23505";
const PHOTO_BUCKET = "class-photos";

function throwIf(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export class SupabaseAttendanceRepository implements AttendanceRepository {
  readonly #db: SupabaseClient;

  /** `db` must use the secret key: the server starts rounds and saves shared photos, which the page may not. */
  constructor(db: SupabaseClient) {
    this.#db = db;
  }

  async findLesson(lessonId: string): Promise<LessonInfo | null> {
    const { data, error } = await this.#db
      .from("lessons")
      .select("id, course_id, starts_at, ends_at, courses(teacher_id_number)")
      .eq("id", lessonId)
      .maybeSingle();
    if (error?.code === "22P02") return null;
    throwIf(error);
    if (!data) return null;
    return {
      id: data.id,
      courseId: data.course_id,
      teacherId: (data.courses as unknown as { teacher_id_number: string }).teacher_id_number,
      startsAt: new Date(data.starts_at),
      endsAt: new Date(data.ends_at),
    };
  }

  async saveRound(lessonId: string, faceCount: number): Promise<Round> {
    const { data, error } = await this.#db.rpc("start_attendance_round", { p_lesson: lessonId, p_face_count: faceCount });
    if (error?.code === UNIQUE_VIOLATION) throw new HttpError(409, "round_exists", "The class of this lesson was already photographed.");
    throwIf(error);
    return { lessonId, faceCount, expiresAt: new Date(data as string) };
  }

  async findRound(lessonId: string): Promise<Round | null> {
    const { data, error } = await this.#db.from("attendance_rounds").select("expires_at, face_count").eq("lesson_id", lessonId).maybeSingle();
    throwIf(error);
    return data ? { lessonId, faceCount: data.face_count, expiresAt: new Date(data.expires_at) } : null;
  }

  async confirmationCount(lessonId: string): Promise<number> {
    const { count, error } = await this.#db.from("attendance_confirmations").select("student_id", { count: "exact", head: true }).eq("lesson_id", lessonId);
    throwIf(error);
    return count ?? 0;
  }

  async confirmedStudents(lessonId: string): Promise<string[]> {
    const { data, error } = await this.#db.from("attendance_confirmations").select("student_id").eq("lesson_id", lessonId);
    throwIf(error);
    return (data ?? []).map((row) => row.student_id as string);
  }

  async hasSharedPhotos(lessonId: string): Promise<boolean> {
    const { count, error } = await this.#db.from("shared_photos").select("photo_no", { count: "exact", head: true }).eq("lesson_id", lessonId);
    throwIf(error);
    return (count ?? 0) > 0;
  }

  async saveSharedPhotos(lessonId: string, files: SharedPhotoFile[], numbers: PhotoNumber[], expiresAt: Date): Promise<void> {
    const paths = files.map((file) => `${lessonId}/${file.photoNo}-${randomUUID()}.jpg`);
    const uploaded: string[] = [];
    try {
      for (const [index, file] of files.entries()) {
        throwIf((await this.#db.storage.from(PHOTO_BUCKET).upload(paths[index]!, file.jpeg, { contentType: JPEG })).error);
        uploaded.push(paths[index]!);
      }
      const shared = await this.#db
        .from("shared_photos")
        .insert(files.map((file, index) => ({ lesson_id: lessonId, photo_no: file.photoNo, file_path: paths[index], expires_at: expiresAt.toISOString() })));
      if (shared.error?.code === UNIQUE_VIOLATION) throw new HttpError(409, "already_shared", "The class photo of this lesson was already shared.");
      throwIf(shared.error);
      if (numbers.length > 0) {
        const numbered = await this.#db
          .from("photo_numbers")
          .insert(numbers.map((item) => ({ lesson_id: lessonId, number: item.number, photo_no: item.photoNo, face_no: item.faceNo, box: item.box })));
        throwIf(numbered.error);
      }
    } catch (error) {
      // The numbers are deleted with their photo rows (on delete cascade).
      await this.#db.from("shared_photos").delete().in("file_path", paths);
      if (uploaded.length > 0) await this.#db.storage.from(PHOTO_BUCKET).remove(uploaded);
      throw error;
    }
  }

  async expiredPhotoFiles(now: Date): Promise<string[]> {
    const { data, error } = await this.#db.from("shared_photos").select("file_path").eq("file_removed", false).lte("expires_at", now.toISOString());
    throwIf(error);
    return (data ?? []).map((row) => row.file_path as string);
  }

  async removePhotoFiles(paths: string[]): Promise<void> {
    if (paths.length === 0) return;
    throwIf((await this.#db.storage.from(PHOTO_BUCKET).remove(paths)).error);
    throwIf((await this.#db.from("shared_photos").update({ file_removed: true }).in("file_path", paths)).error);
  }
}
