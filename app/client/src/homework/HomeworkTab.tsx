import { FileText, Send, Upload } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useSession } from "../accounts/session.tsx";
import { ServerError, uploadToServer } from "../lib/server.ts";
import { supabase } from "../lib/supabase.ts";
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

  useEffect(() => {
    void load();
  }, [load]);

  if (items === null) return <p>טוען...</p>;

  return (
    <div className="stack homework-tab">
      <h2>מטלות</h2>
      {role === "teacher" && <PublishForm lessonId={lessonId} onPublished={load} />}
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
          {role === "student" && <CheckForm homeworkId={item.id} used={item.checksUsed} onChecked={load} />}
          {item.latest && <ReportView check={item.latest} />}
          {item.chart.length > 0 && <ClassChart rows={item.chart} />}
        </section>
      ))}
    </div>
  );
}

function PublishForm({ lessonId, onPublished }: { lessonId: string; onPublished: () => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [round, setRound] = useState(0);

  async function publish(event: FormEvent) {
    event.preventDefault();
    if (!file || !title.trim()) return;
    setBusy(true);
    setProblem("");
    const form = new FormData();
    form.append("lessonId", lessonId);
    form.append("title", title.trim());
    form.append("file", file);
    try {
      await uploadToServer("/homework", form);
      setTitle("");
      setFile(null);
      setRound(round + 1);
      await onPublished();
    } catch (error) {
      setProblem(messageOf(PUBLISH_ERRORS, error));
    } finally {
      setBusy(false);
    }
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
          מכין את הנחיות הבדיקה מהמטלה. זה יכול לקחת עד שתי דקות.
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

function CheckForm({ homeworkId, used, onChecked }: { homeworkId: string; used: number; onChecked: () => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [round, setRound] = useState(0);
  const left = MAX_CHECKS - used;

  if (left <= 0) return <p className="muted">שלוש הבדיקות נוצלו, והאחרונה היא הסופית.</p>;

  async function check() {
    if (!file) return;
    setBusy(true);
    setProblem("");
    const form = new FormData();
    form.append("solution", file);
    try {
      await uploadToServer(`/homework/${homeworkId}/checks`, form);
      setFile(null);
      setRound(round + 1);
      await onChecked();
    } catch (error) {
      setProblem(messageOf(CHECK_ERRORS, error));
    } finally {
      setBusy(false);
    }
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
      <button className="primary" disabled={!file || busy} onClick={() => void check()}>
        <Upload {...ICON} />
        {busy ? "בודק את הפתרון..." : "בדיקת הפתרון"}
      </button>
    </div>
  );
}
