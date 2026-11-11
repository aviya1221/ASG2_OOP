import { Eye, EyeOff, Pencil, Printer, Save, Send, Upload, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import Markdown from "react-markdown";
import { useParams } from "react-router";
import { useSession } from "../accounts/session.tsx";
import { lectureTitle } from "../lessons/lessons.ts";
import { ServerError, uploadToServer } from "../lib/server.ts";
import { supabase } from "../lib/supabase.ts";
import { useEndedCount, useTask, useTasks } from "../tasks/BackgroundTasks.tsx";
import { ICON, IconButton } from "../ui/Icon.tsx";
import { isStale, MAX_SUMMARY_WORDS, summaryWords } from "./summaryText.ts";

interface Lesson {
  courseName: string;
  lectureNumber: number;
  topic: string | null;
  endsAt: Date;
}

interface Summary {
  status: "in_progress" | "ready" | "failed";
  startedAt: Date;
  body: string | null;
  published: boolean;
}

const UPLOAD_ERRORS: Record<string, string> = {
  lesson_not_ended: "אפשר להעלות הקלטה רק אחרי סוף השיעור.",
  summary_in_progress: "סיכום של השיעור הזה כבר בהכנה.",
  file_too_large: "ההקלטה גדולה מ־200 מגה.",
};

/** The summary page of a lesson (REQ-40 to REQ-49, REQ-73). */
export function SummaryPage() {
  const { lessonId = "" } = useParams();
  const session = useSession();
  const isTeacher = session.status === "signed-in" && session.person.role === "teacher";
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [summary, setSummary] = useState<Summary | null | undefined>(undefined);

  const load = useCallback(async () => {
    const [lessonRow, summaryRow] = await Promise.all([
      supabase.from("lessons").select("lecture_number, topic, ends_at, courses(name)").eq("id", lessonId).maybeSingle(),
      // A student reads the row only after the teacher publishes it (REQ-73).
      supabase.from("lesson_summaries").select("status, started_at, body, published").eq("lesson_id", lessonId).maybeSingle(),
    ]);
    if (lessonRow.data) {
      setLesson({
        courseName: (lessonRow.data.courses as unknown as { name: string }).name,
        lectureNumber: lessonRow.data.lecture_number,
        topic: lessonRow.data.topic,
        endsAt: new Date(lessonRow.data.ends_at),
      });
    }
    const row = summaryRow.data;
    setSummary(row ? { status: row.status, startedAt: new Date(row.started_at), body: row.body, published: row.published } : null);
  }, [lessonId]);

  // The upload goes on in the background, so the page reloads when it ends (NFR-13).
  const ended = useEndedCount(lessonId);
  useEffect(() => {
    void load();
  }, [load, ended]);

  useEffect(() => {
    const channel = supabase
      .channel(`summary-${lessonId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "lesson_summaries", filter: `lesson_id=eq.${lessonId}` }, () => void load())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [lessonId, load]);

  if (summary === undefined || !lesson) return <p className="content">טוען...</p>;

  const now = new Date();
  const lessonEnded = now >= lesson.endsAt;
  const failed = summary?.status === "failed" || (summary?.status === "in_progress" && isStale(summary.startedAt, now));
  const inProgress = summary?.status === "in_progress" && !failed;

  return (
    <>
      <header className="band no-print">
        <div className="band-inner">
          <div className="band-title">
            <h1>סיכום השיעור</h1>
            <p className="band-note">
              {lesson.courseName} · {lectureTitle(lesson)}
            </p>
          </div>
        </div>
      </header>
      <main className="content stack">
        {!summary &&
          (isTeacher ? (
            <p>אין עדיין סיכום לשיעור הזה. הוא ייווצר אחרי שתעלה את ההקלטה, ויהיה גלוי רק לך עד שתפרסם אותו.</p>
          ) : (
            <p>אין עדיין סיכום לשיעור הזה. הוא יופיע כאן אחרי שהמרצה יפרסם אותו.</p>
          ))}
        {inProgress && <p role="status">הסיכום בהכנה. הוא יופיע כאן כשיהיה מוכן.</p>}
        {failed && (
          <p className="problem" role="alert">
            יצירת הסיכום נכשלה.{isTeacher ? " אפשר להעלות את ההקלטה שוב." : ""}
          </p>
        )}
        {summary?.body && (
          <SummaryView
            key={summary.body}
            lessonId={lessonId}
            body={summary.body}
            published={summary.published}
            isTeacher={isTeacher}
            editable={isTeacher && summary.status === "ready"}
            onSaved={load}
          />
        )}
        {isTeacher &&
          !inProgress &&
          (lessonEnded ? <RecordingUpload lessonId={lessonId} again={Boolean(summary)} /> : <p className="muted no-print">אפשר להעלות הקלטה אחרי סוף השיעור.</p>)}
      </main>
    </>
  );
}

export function SummaryView({
  lessonId,
  body,
  published,
  isTeacher,
  editable,
  onSaved,
}: {
  lessonId: string;
  body: string;
  published: boolean;
  isTeacher: boolean;
  editable: boolean;
  onSaved: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(body);
  const [problem, setProblem] = useState("");
  const words = summaryWords(text);

  async function change(values: { body?: string; published?: boolean }): Promise<boolean> {
    setProblem("");
    const { error } = await supabase.from("lesson_summaries").update(values).eq("lesson_id", lessonId);
    if (error) {
      setProblem("השמירה נכשלה.");
      return false;
    }
    await onSaved();
    return true;
  }

  async function save() {
    if (await change({ body: text.trim() })) setEditing(false);
  }

  if (editing) {
    return (
      <section className="stack" aria-label="עריכת הסיכום">
        <div className="field">
          <label htmlFor="summary-body">הסיכום</label>
          <textarea id="summary-body" rows={22} dir="auto" aria-describedby="summary-body-hint" value={text} onChange={(e) => setText(e.target.value)} />
          <span id="summary-body-hint" className={words > MAX_SUMMARY_WORDS ? "problem" : "muted"}>
            {words} מילים מתוך {MAX_SUMMARY_WORDS} לכל היותר. # לכותרת, ## לכותרת משנה, - לנקודה ו־**מילה** להדגשה.
          </span>
        </div>
        {problem && (
          <p className="problem" role="alert">
            {problem}
          </p>
        )}
        <div className="actions">
          <button className="primary small" disabled={words > MAX_SUMMARY_WORDS || !text.trim()} onClick={() => void save()}>
            <Save {...ICON} />
            שמירה
          </button>
          <button className="secondary small" onClick={() => setEditing(false)}>
            <X {...ICON} />
            ביטול
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="stack">
      {isTeacher && (
        <div className="summary-tools no-print">
          <span className={published ? "chip shown" : "chip private"}>
            {published ? <Eye {...ICON} size={16} /> : <EyeOff {...ICON} size={16} />}
            {published ? "פורסם לכיתה" : "גלוי רק לך"}
          </span>
          <span className="actions">
            {editable &&
              (published ? (
                <button className="secondary small" onClick={() => void change({ published: false })}>
                  <EyeOff {...ICON} />
                  הסתרה מהכיתה
                </button>
              ) : (
                <button className="primary small" onClick={() => void change({ published: true })}>
                  <Send {...ICON} />
                  פרסום לכיתה
                </button>
              ))}
            {editable && <IconButton icon={Pencil} label="עריכת הסיכום" onClick={() => setEditing(true)} />}
            <IconButton icon={Printer} label="הדפסה" onClick={() => window.print()} />
          </span>
        </div>
      )}
      {problem && (
        <p className="problem" role="alert">
          {problem}
        </p>
      )}
      <article className="doc" aria-label="הסיכום" dir="auto">
        <Markdown>{body}</Markdown>
      </article>
      {!isTeacher && (
        <button className="link no-print" onClick={() => window.print()}>
          <Printer {...ICON} />
          הדפסה
        </button>
      )}
    </div>
  );
}

function RecordingUpload({ lessonId, again }: { lessonId: string; again: boolean }) {
  const { start } = useTasks();
  const task = useTask("summary-upload", lessonId);
  const [file, setFile] = useState<File | null>(null);
  const busy = task?.status === "running";
  const problem = task?.status === "failed" ? (UPLOAD_ERRORS[task.error instanceof ServerError ? task.error.code : ""] ?? "ההעלאה נכשלה. אפשר לנסות שוב.") : "";

  function upload() {
    if (!file || busy) return;
    const form = new FormData();
    form.append("lessonId", lessonId);
    form.append("recording", file);
    start(
      {
        kind: "summary-upload",
        key: lessonId,
        scope: lessonId,
        label: "העלאת הקלטת השיעור",
        doneText: "ההקלטה הועלתה, והסיכום בהכנה.",
        failText: "העלאת ההקלטה נכשלה.",
        link: `/lessons/${lessonId}/summary`,
        stopsOnClose: true,
      },
      () => uploadToServer("/summaries", form),
    );
  }

  return (
    <section className="card stack no-print">
      <h2>{again ? "הקלטה חדשה" : "העלאת הקלטה"}</h2>
      {again && <p className="muted">סיכום חדש יחליף את הנוכחי, ויהיה גלוי רק לך עד שתפרסם אותו.</p>}
      <label className="field">
        <span>הקלטת השיעור</span>
        <input type="file" accept="video/*,audio/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      {problem && (
        <p className="problem" role="alert">
          {problem}
        </p>
      )}
      {busy && (
        <p className="muted" role="status">
          ההקלטה עולה. אפשר לעבור לעמוד אחר בינתיים, אבל לא לסגור את הדף.
        </p>
      )}
      <button className="primary" disabled={!file || busy} onClick={upload}>
        <Upload {...ICON} />
        {busy ? "מעלה..." : "העלאה ויצירת סיכום"}
      </button>
    </section>
  );
}
