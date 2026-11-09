import { useEffect } from "react";
import { callServer } from "../lib/server.ts";
import { supabase } from "../lib/supabase.ts";
import { FaceStore } from "./FaceStore.ts";

let running = false;

/** Sends the student's face-print to every open round that has no result yet (REQ-12). */
export async function respondToOpenRounds(idNumber: string): Promise<void> {
  const stored = FaceStore.load(idNumber);
  if (!stored || running) return;
  running = true;
  try {
    const { data: rounds } = await supabase.from("attendance_rounds").select("lesson_id").gt("expires_at", new Date().toISOString());
    const open = (rounds ?? []).map((round) => round.lesson_id as string);
    if (open.length === 0) return;

    const { data: results } = await supabase.from("attendance_results").select("lesson_id").eq("student_id", idNumber).in("lesson_id", open);
    const answered = new Set((results ?? []).map((result) => result.lesson_id as string));

    for (const lessonId of open.filter((id) => !answered.has(id))) {
      await callServer("/attendance/response", { lessonId, print: stored.print, hash: stored.hash }).catch(() => {
        // The page tries again the next time it opens within the hour.
      });
    }
  } finally {
    running = false;
  }
}

/** Responds when the site opens, when it returns to the screen and when a round starts. */
export function useAttendanceResponder(idNumber: string | null): void {
  useEffect(() => {
    if (!idNumber) return;
    const respond = () => void respondToOpenRounds(idNumber);
    const whenVisible = () => {
      if (document.visibilityState === "visible") respond();
    };

    respond();
    document.addEventListener("visibilitychange", whenVisible);
    const channel = supabase
      .channel("attendance-rounds")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "attendance_rounds" }, respond)
      .subscribe();

    return () => {
      document.removeEventListener("visibilitychange", whenVisible);
      void supabase.removeChannel(channel);
    };
  }, [idNumber]);
}
