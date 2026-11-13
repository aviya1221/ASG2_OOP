import { supabase } from "../lib/supabase.ts";

export interface Message {
  id: string;
  lessonId: string;
  replyTo: string | null;
  text: string;
  writerName: string | null;
  writerIsTeacher: boolean;
  createdAt: Date;
  deleted: boolean;
}

export interface ForumTitle {
  lessonId: string;
  lectureNumber: number;
  topic: string | null;
}

interface MessageRow {
  id: string;
  lesson_id: string;
  reply_to: string | null;
  text: string;
  writer_name: string | null;
  writer_is_teacher: boolean;
  created_at: string;
  deleted_at: string | null;
}

function toMessage(row: MessageRow): Message {
  return {
    id: row.id,
    lessonId: row.lesson_id,
    replyTo: row.reply_to,
    text: row.text,
    writerName: row.writer_name,
    writerIsTeacher: row.writer_is_teacher,
    createdAt: new Date(row.created_at),
    deleted: row.deleted_at !== null,
  };
}

/** The forum's calls to the database (docs/07-EDD/forum.md). */
export const ForumApi = {
  async listForums(courseId: string): Promise<ForumTitle[]> {
    const { data } = await supabase.from("lessons").select("id, lecture_number, topic").eq("course_id", courseId).order("lecture_number");
    return (data ?? []).map((row) => ({ lessonId: row.id, lectureNumber: row.lecture_number, topic: row.topic }));
  },

  async loadMessages(lessonId: string): Promise<Message[]> {
    const { data } = await supabase.from("forum_messages").select("*").eq("lesson_id", lessonId).order("created_at");
    return ((data ?? []) as MessageRow[]).map(toMessage);
  },

  /** For the teacher: who wrote each message, including messages with a hidden name. */
  async loadWriters(lessonId: string): Promise<Map<string, string>> {
    const { data } = await supabase
      .from("message_writers")
      .select("message_id, writer_id, people(name), forum_messages!inner(lesson_id)")
      .eq("forum_messages.lesson_id", lessonId);
    return new Map((data ?? []).map((row) => [row.message_id as string, (row.people as unknown as { name: string } | null)?.name ?? ""]));
  },

  async post(lessonId: string, text: string, showName: boolean, replyTo: string | null): Promise<Message> {
    const { data, error } = await supabase.rpc("post_message", { p_lesson: lessonId, p_text: text, p_reply_to: replyTo, p_show_name: showName });
    if (error) throw new Error(error.message);
    return toMessage(data as MessageRow);
  },

  async remove(messageId: string): Promise<void> {
    const { error } = await supabase.rpc("remove_message", { p_message: messageId });
    if (error) throw new Error(error.message);
  },

  async setTopic(lessonId: string, topic: string): Promise<void> {
    const { error } = await supabase.from("lessons").update({ topic: topic.trim() || null }).eq("id", lessonId);
    if (error) throw new Error(error.message);
  },

  /** Calls `onChange` on any change to the messages of this lesson. Returns a function that stops it. */
  watch(lessonId: string, onChange: () => void): () => void {
    const channel = supabase
      .channel(`forum-${lessonId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "forum_messages", filter: `lesson_id=eq.${lessonId}` }, onChange)
      .subscribe((status) => {
        // After a lost connection, changes sent meanwhile are lost, so everything is loaded again.
        if (status === "SUBSCRIBED") onChange();
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  },
};
