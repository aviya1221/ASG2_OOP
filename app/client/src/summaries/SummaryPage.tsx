import { Pencil, Save, Upload, X } from "lucide-react";
import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { useParams } from "react-router";
import { useSession } from "../accounts/session.tsx";
import { lectureTitle } from "../lessons/lessons.ts";
import { ServerError, uploadToServer } from "../lib/server.ts";
import { supabase } from "../lib/supabase.ts";
import { ICON, IconButton } from "../ui/Icon.tsx";
import { fromEditable, isStale, toEditable, type SummaryParts } from "./summaryText.ts";

interface Lesson {
  courseName: string;
  lectureNumber: number;
  topic: string | null;
  endsAt: Date;
}

interface Summary {
  status: "in_progress" | "ready" | "failed";
  startedAt: Date;
  parts: SummaryParts | null;
}

const UPLOAD_ERRORS: Record<string, string> = {
  lesson_not_ended: "אפשר להעלות הקלטה רק אחרי סוף השיעור.",
  summary_in_progress: "סיכום של השיעור הזה כבר בהכנה.",
  file_too_large: "ההקלטה גדולה מ־200 מגה.",
};

/** The summary page of a lesson (REQ-40 to REQ-49). */
export function SummaryPage() {
  const { lessonId = "" } = useParams();
  const session = useSession();
  const isTeacher = session.status === "signed-in" && session.person.role === "teacher";
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [summary, setSummary] = useState<Summary | null | undefined>(undefined);

  const load = useCallback(async () => {
    const [lessonRow, summaryRow] = await Promise.all([
      supabase.from("lessons").select("lecture_number, topic, ends_at, courses(name)").eq("id", lessonId).maybeSingle(),
      supabase.from("lesson_summaries").select("*").eq("lesson_id", lessonId).maybeSingle(),
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
    setSummary(
      row
        ? {
            status: row.status,
            startedAt: new Date(row.started_at),
            parts: row.overview === null ? null : { overview: row.overview, topics: row.topics ?? [], questions: row.questions ?? [], board: row.board ?? [] },
          }
        : null,
    );
  }, [lessonId]);

  useEffect(() => {
    void load();
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
      <header className="band">
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
        {!summary && <p>אין עדיין סיכום לשיעור הזה. הוא ייפתח אחרי השיעור, כשהמרצה יעלה הקלטה.</p>}
        {inProgress && <p role="status">הסיכום בהכנה. הוא יופיע כאן כשיהיה מוכן.</p>}
        {failed && (
          <p className="problem" role="alert">
            יצירת הסיכום נכשלה.{isTeacher ? " אפשר להעלות את ההקלטה שוב." : ""}
          </p>
        )}
        {summary?.parts && <SummaryView lessonId={lessonId} parts={summary.parts} editable={isTeacher && summary.status === "ready"} onSaved={load} />}
        {isTeacher && !inProgress && (lessonEnded ? <RecordingUpload lessonId={lessonId} again={Boolean(summary)} onStarted={load} /> : <p className="muted">אפשר להעלות הקלטה אחרי סוף השיעור.</p>)}
      </main>
    </>
  );
}

function SummaryView({ lessonId, parts, editable, onSaved }: { lessonId: string; parts: SummaryParts; editable: boolean; onSaved: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(() => toEditable(parts));
  const [problem, setProblem] = useState("");

  async function save() {
    const { error } = await supabase.from("lesson_summaries").update(fromEditable(text)).eq("lesson_id", lessonId);
    if (error) {
      setProblem("השמירה נכשלה.");
      return;
    }
    setEditing(false);
    await onSaved();
  }

  if (editing) {
    const field = (key: keyof typeof text, label: string, hint: string, rows: number) => (
      <div className="field">
        <label htmlFor={`summary-${key}`}>{label}</label>
        <textarea
          id={`summary-${key}`}
          rows={rows}
          aria-describedby={`summary-${key}-hint`}
          value={text[key]}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setText({ ...text, [key]: e.target.value })}
        />
        <span id={`summary-${key}-hint`} className="muted">
          {hint}
        </span>
      </div>
    );
    return (
      <section className="stack" aria-label="עריכת הסיכום">
        {field("overview", "סיכום", "עד 300 מילים", 8)}
        {field("topics", "נושאים", "בכל שורה: זמן ונושא, למשל 02:15 הגדרות", 5)}
        {field("questions", "שאלות ותשובות", "בכל שורה: זמן | שאלה | תשובה", 5)}
        {field("board", "מהלוח", "בכל שורה: זמן ותוכן", 5)}
        {problem && (
          <p className="problem" role="alert">
            {problem}
          </p>
        )}
        <div className="actions">
          <button className="primary small" onClick={() => void save()}>
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
    <article className="stack" aria-label="הסיכום">
      <section className="card stack">
        <h2>סיכום</h2>
        <p className="message-text">{parts.overview}</p>
      </section>
      <section className="card stack">
        <h2>נושאים</h2>
        <ol className="stack">
          {parts.topics.map((topic, index) => (
            <li key={index}>
              <span className="muted">{topic.start}</span> {topic.title}
            </li>
          ))}
        </ol>
      </section>
      <section className="card stack">
        <h2>שאלות ותשובות</h2>
        {parts.questions.length === 0 && <p className="muted">לא היו שאלות.</p>}
        {parts.questions.map((item, index) => (
          <div key={index} className="stack">
            <b>
              <span className="muted">{item.time}</span> {item.question}
            </b>
            <p>{item.answer}</p>
          </div>
        ))}
      </section>
      <section className="card stack">
        <h2>מהלוח</h2>
        {parts.board.length === 0 && <p className="muted">לא נמצא תוכן מהלוח.</p>}
        <ul className="stack">
          {parts.board.map((item, index) => (
            <li key={index}>
              <span className="muted">{item.time}</span> <span dir="auto">{item.content}</span>
            </li>
          ))}
        </ul>
      </section>
      {editable && <IconButton icon={Pencil} label="עריכת הסיכום" onClick={() => setEditing(true)} />}
    </article>
  );
}

function RecordingUpload({ lessonId, again, onStarted }: { lessonId: string; again: boolean; onStarted: () => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  async function upload() {
    if (!file) return;
    setBusy(true);
    setProblem("");
    const form = new FormData();
    form.append("lessonId", lessonId);
    form.append("recording", file);
    try {
      await uploadToServer("/summaries", form);
      await onStarted();
    } catch (error) {
      setProblem(UPLOAD_ERRORS[error instanceof ServerError ? error.code : ""] ?? "ההעלאה נכשלה. אפשר לנסות שוב.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card stack">
      <h2>{again ? "הקלטה חדשה" : "העלאת הקלטה"}</h2>
      <label className="field">
        <span>הקלטת השיעור</span>
        <input type="file" accept="video/*,audio/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      {problem && (
        <p className="problem" role="alert">
          {problem}
        </p>
      )}
      <button className="primary" disabled={!file || busy} onClick={() => void upload()}>
        <Upload {...ICON} />
        {busy ? "מעלה..." : "העלאה ויצירת סיכום"}
      </button>
    </section>
  );
}
