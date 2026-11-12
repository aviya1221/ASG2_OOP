import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase.ts";

/** Reloads when one of these tables changes for this lesson. */
export function useLive(lessonId: string, tables: string[], onChange: () => void): void {
  const latest = useRef(onChange);
  latest.current = onChange;
  const joined = tables.join(",");

  useEffect(() => {
    let channel = supabase.channel(`attendance-${lessonId}-${joined}`);
    for (const table of joined.split(",")) {
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `lesson_id=eq.${lessonId}` }, () => latest.current());
    }
    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [lessonId, joined]);
}

/** The class photo of a lesson: the faces in it, how many students confirmed, and when the time to confirm ends. */
export interface Round {
  faceCount: number;
  confirmations: number;
  expiresAt: Date;
}

/** The round of the lesson, or null before the photo. */
export function useRound(lessonId: string): [Round | null | undefined, () => void] {
  const [round, setRound] = useState<Round | null | undefined>(undefined);
  const load = useCallback(() => {
    void supabase
      .from("attendance_counts")
      .select("face_count, confirmations, expires_at")
      .eq("lesson_id", lessonId)
      .maybeSingle()
      .then(({ data }) => setRound(data ? { faceCount: data.face_count, confirmations: data.confirmations, expiresAt: new Date(data.expires_at) } : null));
  }, [lessonId]);
  useEffect(load, [load]);
  useLive(lessonId, ["attendance_rounds", "attendance_confirmations"], load);
  return [round, load];
}

/** The time now, renewed every second until `until`, so a page counts down and notices the end. */
export function useClock(until: Date | null | undefined): number {
  const [now, setNow] = useState(() => Date.now());
  const end = until?.getTime() ?? 0;
  useEffect(() => {
    setNow(Date.now());
    if (end <= Date.now()) return;
    const timer = setInterval(() => {
      const time = Date.now();
      setNow(time);
      if (time >= end) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [end]);
  return now;
}

/** The time left, as minutes and seconds: "3:07". */
export function timeLeft(until: Date, now: number): string {
  const seconds = Math.max(0, Math.ceil((until.getTime() - now) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
