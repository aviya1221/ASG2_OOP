import { FileText, Send, Upload } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useSession } from "../accounts/session.tsx";
import { ServerError, uploadToServer } from "../lib/server.ts";
import { supabase } from "../lib/supabase.ts";
import { useEndedCount, useTask, useTasks } from "../tasks/BackgroundTasks.tsx";
import { ICON, IconAnchor } from "../ui/Icon.tsx";
import { ClassChart } from "./ClassChart.tsx";
import { ReportView } from "./ReportView.tsx";
import { MAX_CHECKS, type ChartRow, type Check } from "./scores.ts";

interface HomeworkItem {
  id: string;
  title: string;
  url: string | null;
  checksUsed: number;
  latest: Check | null;
  chart: ChartRow[];
}

const FILE_ERRORS: Record<string, string> = {
  not_a_pdf: "הקובץ צריך להיות PDF.",
  file_too_large: "הקובץ גדול מ־20 מגה.",
};
const PUBLISH_ERRORS: Record<string, string> = {
  ...FILE_ERRORS,
  ai_unavailable: "שירות הבדיקה לא הכין הנחיות, והמטלה לא פורסמה. אפשר לנסות שוב.",
  not_the_teacher: "רק למרצה של השיעור מותר לפרסם בו מטלה.",
};
const CHECK_ERRORS: Record<string, string> = {
  ...FILE_ERRORS,
  ai_unavailable: "שירות הבדיקה לא ענה. אפשר לנסות שוב, והניסיון הזה לא נספר.",
  no_checks_left: "שלוש הבדיקות של המטלה הזאת כבר נוצלו.",
};

function messageOf(errors: Record<string, string>, error: unknown): string {
  return errors[error instanceof ServerError ? error.code : ""] ?? "הפעולה נכשלה. אפשר לנסות שוב.";
}

/** Homework of the lesson: the teacher publishes, students check solutions, and everyone sees the chart (UC-05). */
export function HomeworkTab({ lessonId }: { lessonId: string }) {
  const session = useSession();
  const role = session.status === "signed-in" ? session.person.role : null;
  const [items, setItems] = useState<HomeworkItem[] | null>(null);
  const [problem, setProblem] = useState("");

  const load = useCallback(async () => {
    const { data: rows, error } = await supabase.from("homework").select("id, title, file_path").eq("lesson_id", lessonId).order("created_at");
    if (error || !rows) {
      setProblem("טעינת המטלות נכשלה.");
      setItems([]);
      return;
    }
    if (rows.length === 0) {
      setItems([]);
      return;
    }
    const ids = rows.map((row) => row.id);
    const [urls, checks, chart] = await Promise.all([
      supabase.storage.from("homework").createSignedUrls(
        rows.map((row) => row.file_path),
        3600,
      ),
      supabase.from("homework_checks").select("homework_id, check_number, overall, question_scores, report").in("homework_id", ids).order("check_number"),
      supabase.from("homework_chart").select("homework_id, name, is_me, overall, question_scores, section_scores").in("homework_id", ids),
    ]);
    const urlOf = new Map((urls.data ?? []).filter((item) => !item.error).map((item) => [item.path, item.signedUrl]));
    setItems(
      rows.map((row) => {
        const mine = (checks.data ?? []).filter((check) => check.homework_id === row.id);
        const last = mine.at(-1);
        return {
          id: row.id,
          title: row.title,
          url: urlOf.get(row.file_path) ?? null,
          checksUsed: mine.length,
          latest: last ? { checkNumber: last.check_number, overall: last.overall, questionScores: last.question_scores, report: last.report } : null,
          chart: (chart.data ?? [])
            .filter((item) => item.homework_id === row.id)
            .map((item) => ({ name: item.name, isMe: item.is_me, overall: item.overall, questionScores: item.question_scores, sectionScores: item.section_scores })),
        };
      }),
    );
  }, [lessonId]);

  // Publishing and checking go on in the background, so the list reloads whenever one of them ends (NFR-13).
  const ended = useEndedCount(lessonId);
  useEffect(() => {
    void load();
  }, [load, ended]);

  if (items === null) return <p>טוען...</p>;

  return (
    <div className="stack homework-tab">
      <h2>מטלות</h2>
      {role === "teacher" && <PublishForm lessonId={lessonId} />}
      {problem && (
        <p className="problem" role="alert">
          {problem}
        </p>
      )}
      {items.length === 0 && <p className="muted">עדיין אין מטלות בשיעור הזה.</p>}
      {items.map((item) => (
        <section key={item.id} className="card stack homework" aria-label={item.title}>
          <div className="row-between">
            <h3>{item.title}</h3>
            {item.url && <IconAnchor icon={FileText} label="פתיחת המטלה" href={item.url} target="_blank" rel="noopener noreferrer" />}
          </div>
          {role === "student" && <CheckForm lessonId={lessonId} homeworkId={item.id} title={item.title} used={item.checksUsed} />}
          {item.latest && <ReportView check={item.latest} />}
          {item.chart.length > 0 && <ClassChart rows={item.chart} />}
        </section>
      ))}
    </div>
  );
}

function PublishForm({ lessonId }: { lessonId: string }) {
  const { start } = useTasks();
  const task = useTask("homework-publish", lessonId);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [round, setRound] = useState(0);
  const busy = task?.status === "running";
  const problem = task?.status === "failed" ? messageOf(PUBLISH_ERRORS, task.error) : "";

  // The form empties only after a success, so after a failure the teacher can send it again.
  const published = task?.status === "done" ? task.id : 0;
  useEffect(() => {
    if (!published) return;
    setTitle("");
    setFile(null);
    setRound((value) => value + 1);
  }, [published]);

  function publish(event: FormEvent) {
    event.preventDefault();
    if (!file || !title.trim() || busy) return;
    const name = title.trim();
    const form = new FormData();
    form.append("lessonId", lessonId);
    form.append("title", name);
    form.append("file", file);
    start(
      {
        kind: "homework-publish",
        key: lessonId,
        scope: lessonId,
        label: `פרסום המטלה "${name}"`,
        doneText: `המטלה "${name}" פורסמה.`,
        failText: `פרסום המטלה "${name}" נכשל.`,
        link: `/lessons/${lessonId}/homework`,
        stopsOnClose: true,
      },
      () => uploadToServer("/homework", form),
    );
  }

  return (
    <form className="card stack" onSubmit={(event) => void publish(event)} aria-label="פרסום מטלה">
      <h3>פרסום מטלה</h3>
      <label className="field">
        <span>שם המטלה</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="field">
        <span>קובץ המטלה (PDF)</span>
        <input key={round} type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      {busy && (
        <p className="muted" role="status">
          מכין את הנחיות הבדיקה מהמטלה. זה יכול לקחת עד שתי דקות, ואפשר לעבור לעמוד אחר בינתיים.
        </p>
      )}
      {problem && (
        <p className="problem" role="alert">
          {problem}
        </p>
      )}
      <button className="primary" disabled={!file || !title.trim() || busy}>
        <Send {...ICON} />
        {busy ? "מפרסם..." : "פרסום המטלה"}
      </button>
    </form>
  );
}

function CheckForm({ lessonId, homeworkId, title, used }: { lessonId: string; homeworkId: string; title: string; used: number }) {
  const { start } = useTasks();
  const task = useTask("homework-check", homeworkId);
  const [file, setFile] = useState<File | null>(null);
  const [round, setRound] = useState(0);
  const busy = task?.status === "running";
  const problem = task?.status === "failed" ? messageOf(CHECK_ERRORS, task.error) : "";
  const left = MAX_CHECKS - used;

  const checked = task?.status === "done" ? task.id : 0;
  useEffect(() => {
    if (!checked) return;
    setFile(null);
    setRound((value) => value + 1);
  }, [checked]);

  if (left <= 0) return <p className="muted">שלוש הבדיקות נוצלו, והאחרונה היא הסופית.</p>;

  function check() {
    if (!file || busy) return;
    const form = new FormData();
    form.append("solution", file);
    start(
      {
        kind: "homework-check",
        key: homeworkId,
        scope: lessonId,
        label: `בדיקת הפתרון של "${title}"`,
        doneText: `הדוח על הפתרון של "${title}" מוכן.`,
        failText: `בדיקת הפתרון של "${title}" נכשלה.`,
        link: `/lessons/${lessonId}/homework`,
        stopsOnClose: true,
      },
      () => uploadToServer(`/homework/${homeworkId}/checks`, form),
    );
  }

  return (
    <div className="stack">
      <label className="field">
        <span>פתרון לבדיקה (PDF)</span>
        <input key={round} type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      <p className="muted">{left === 1 ? "נשארה בדיקה אחת מתוך 3." : `נשארו ${left} בדיקות מתוך 3.`} הפתרון לא נשמר אצלנו.</p>
      {problem && (
        <p className="problem" role="alert">
          {problem}
        </p>
      )}
      <button className="primary" disabled={!file || busy} onClick={check}>
        <Upload {...ICON} />
        {busy ? "בודק את הפתרון..." : "בדיקת הפתרון"}
      </button>
    </div>
  );
}
