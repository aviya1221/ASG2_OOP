import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AttendanceRepository } from "../../attendance/AttendanceRepository.ts";
import { JPEG, type ClassFace, type FaceMatch, type FaceSpot, type LessonInfo, type PhotoFaces, type PhotoNumber, type Registration, type Result, type Round, type SharedPhotoFile } from "../../attendance/types.ts";
import { HttpError } from "../../http/errors.ts";

const UNIQUE_VIOLATION = "23505";
const MAX_FACES_READ = 1000;
const PHOTO_BUCKET = "class-photos";

function throwIf(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export class SupabaseAttendanceRepository implements AttendanceRepository {
  readonly #db: SupabaseClient;

  /** `db` must use the secret key, because face data is closed to the page. */
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

  async isStudentOf(courseId: string, studentId: string): Promise<boolean> {
    const { data, error } = await this.#db
      .from("course_students")
      .select("student_id_number")
      .eq("course_id", courseId)
      .eq("student_id_number", studentId)
      .maybeSingle();
    throwIf(error);
    return Boolean(data);
  }

  async saveRound(lessonId: string, photos: PhotoFaces[]): Promise<Round> {
    const faces = photos.flatMap((photo, photo_no) =>
      photo.faces.map((face, face_no) => ({ photo_no, face_no, box: face.box.map(Math.round), print: face.print })),
    );
    const { data, error } = await this.#db.rpc("start_attendance_round", { p_lesson: lessonId, p_faces: faces });
    if (error?.code === UNIQUE_VIOLATION) throw new HttpError(409, "round_exists", "The photos of this lesson were already sent.");
    throwIf(error);
    return { lessonId, expiresAt: new Date(data as string) };
  }

  async findRound(lessonId: string): Promise<Round | null> {
    const { data, error } = await this.#db.from("attendance_rounds").select("expires_at").eq("lesson_id", lessonId).maybeSingle();
    throwIf(error);
    return data ? { lessonId, expiresAt: new Date(data.expires_at) } : null;
  }

  async loadFaces(lessonId: string): Promise<ClassFace[]> {
    const { data, error } = await this.#db
      .from("class_faces")
      .select("photo_no, face_no, print")
      .eq("lesson_id", lessonId)
      .limit(MAX_FACES_READ);
    throwIf(error);
    return (data ?? []).map((row) => ({ photoNo: row.photo_no, faceNo: row.face_no, print: row.print as number[] }));
  }

  async findRegistration(studentId: string): Promise<Registration | null> {
    const { data, error } = await this.#db.from("face_registrations").select("hash, opted_out").eq("student_id", studentId).maybeSingle();
    throwIf(error);
    return data ? { hash: data.hash, optedOut: data.opted_out } : null;
  }

  async saveRegistration(studentId: string, hash: string | null, optedOut: boolean): Promise<void> {
    const { error } = await this.#db.from("face_registrations").upsert({ student_id: studentId, hash, opted_out: optedOut });
    throwIf(error);
  }

  async addReplacement(studentId: string, hash: string): Promise<void> {
    const cleared = await this.#db.from("face_replacements").delete().eq("student_id", studentId).eq("status", "pending");
    throwIf(cleared.error);
    const { error } = await this.#db.from("face_replacements").insert({ student_id: studentId, new_hash: hash });
    throwIf(error);
  }

  async findResult(lessonId: string, studentId: string): Promise<Result | null> {
    const { data, error } = await this.#db
      .from("attendance_results")
      .select("result")
      .eq("lesson_id", lessonId)
      .eq("student_id", studentId)
      .maybeSingle();
    throwIf(error);
    return data ? (data.result as Result) : null;
  }

  async saveResult(lessonId: string, studentId: string, result: Result): Promise<void> {
    const { error } = await this.#db
      .from("attendance_results")
      .upsert({ lesson_id: lessonId, student_id: studentId, result }, { ignoreDuplicates: true });
    throwIf(error);
  }

  async recordMatch(lessonId: string, studentId: string, match: FaceMatch): Promise<Result> {
    const { data, error } = await this.#db.rpc("record_attendance_match", {
      p_lesson: lessonId,
      p_student: studentId,
      p_photo: match.photoNo,
      p_face: match.faceNo,
      p_score: match.score,
    });
    throwIf(error);
    return data as Result;
  }

  async saveSightings(lessonId: string, studentId: string, faces: FaceMatch[]): Promise<void> {
    if (faces.length === 0) return;
    const rows = faces.map((face) => ({ lesson_id: lessonId, student_id: studentId, photo_no: face.photoNo, face_no: face.faceNo }));
    const { error } = await this.#db.from("face_sightings").upsert(rows);
    throwIf(error);
  }

  async identifiedFaces(lessonId: string): Promise<FaceSpot[]> {
    const results = await this.#db.from("attendance_results").select("student_id, photo_no, face_no").eq("lesson_id", lessonId).eq("result", "present");
    throwIf(results.error);
    const sightings = await this.#db.from("face_sightings").select("student_id, photo_no, face_no").eq("lesson_id", lessonId);
    throwIf(sightings.error);
    const present = new Set((results.data ?? []).map((row) => row.student_id as string));
    return [...(results.data ?? []).filter((row) => row.photo_no !== null), ...(sightings.data ?? []).filter((row) => present.has(row.student_id))].map((row) => ({
      photoNo: row.photo_no as number,
      faceNo: row.face_no as number,
    }));
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
      const numbered = await this.#db
        .from("photo_numbers")
        .insert(numbers.map((item) => ({ lesson_id: lessonId, number: item.number, photo_no: item.photoNo, face_no: item.faceNo, box: item.box })));
      throwIf(numbered.error);
    } catch (error) {
      // The numbers are deleted with their photo rows (on delete cascade).
      await this.#db.from("shared_photos").delete().in("file_path", paths);
      if (uploaded.length > 0) await this.#db.storage.from(PHOTO_BUCKET).remove(uploaded);
      throw error;
    }
  }

  async studentsWhoMayPick(lessonId: string): Promise<string[]> {
    const lesson = await this.#db.from("lessons").select("course_id").eq("id", lessonId).single();
    throwIf(lesson.error);
    const students = await this.#db.from("course_students").select("student_id_number").eq("course_id", lesson.data!.course_id);
    throwIf(students.error);
    const present = await this.#db.from("attendance_results").select("student_id").eq("lesson_id", lessonId).eq("result", "present");
    throwIf(present.error);
    const presentIds = new Set((present.data ?? []).map((row) => row.student_id as string));
    return (students.data ?? []).map((row) => row.student_id_number as string).filter((id) => !presentIds.has(id));
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
