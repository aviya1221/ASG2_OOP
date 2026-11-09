import type { SupabaseClient } from "@supabase/supabase-js";
import type { NotificationRepository, PushSubscriptionData } from "../../notifications/NotificationService.ts";

export class SupabaseNotificationRepository implements NotificationRepository {
  readonly #db: SupabaseClient;

  /** `db` must use the secret key, because subscriptions are closed to the page. */
  constructor(db: SupabaseClient) {
    this.#db = db;
  }

  async saveSubscription(studentId: string, subscription: PushSubscriptionData): Promise<void> {
    const { error } = await this.#db.from("push_subscriptions").upsert({ student_id: studentId, ...subscription });
    if (error) throw new Error(error.message);
  }

  async subscriptionsOfLesson(lessonId: string): Promise<PushSubscriptionData[]> {
    const lesson = await this.#db.from("lessons").select("course_id").eq("id", lessonId).single();
    if (lesson.error) throw new Error(lesson.error.message);
    const students = await this.#db.from("course_students").select("student_id_number").eq("course_id", lesson.data.course_id);
    if (students.error) throw new Error(students.error.message);
    const { data, error } = await this.#db
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .in("student_id", (students.data ?? []).map((row) => row.student_id_number));
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async deleteSubscription(endpoint: string): Promise<void> {
    const { error } = await this.#db.from("push_subscriptions").delete().eq("endpoint", endpoint);
    if (error) throw new Error(error.message);
  }
}
