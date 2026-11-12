import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ChartColumn, ClipboardList, FileText, List, Maximize2, Plus, Reply, Save, Send, Trash2, X } from "lucide-react";
import { Link } from "react-router";
import { useSession } from "../accounts/session.tsx";
import { supabase } from "../lib/supabase.ts";
import { FormBuilder } from "../surveys/FormBuilder.tsx";
import { FormWindow } from "../surveys/FormWindow.tsx";
import { PollCard } from "../surveys/PollCard.tsx";
import { SurveyApi, type AnswerRow, type Survey } from "../surveys/SurveyApi.ts";
import type { Answers, Question } from "../surveys/questions.ts";
import { ForumApi, type ForumTitle, type Message } from "./ForumApi.ts";
import { splitLinks } from "./MessageLinks.ts";
import { ICON, IconButton } from "../ui/Icon.tsx";

interface ForumData {
  messages: Message[];
  writers: Map<string, string>;
  surveys: Survey[];
  totals: Map<string, number[]>;
  mine: Map<string, Answers>;
  answers: Map<string, AnswerRow[]>;
}

const EMPTY: ForumData = { messages: [], writers: new Map(), surveys: [], totals: new Map(), mine: new Map(), answers: new Map() };

type Item = { kind: "message"; at: Date; message: Message } | { kind: "survey"; at: Date; survey: Survey };

function MessageText({ text }: { text: string }) {
  return (
    <p className="message-text">
      {splitLinks(text).map((part, index) =>
        part.kind === "link" ? (
          <a key={index} href={part.value} target="_blank" rel="noopener noreferrer">
            {part.value}
          </a>
        ) : (
          <span key={index}>{part.value}</span>
        ),
      )}
    </p>
  );
}

/** The forum of one lesson date: messages, replies, polls and forms (docs/07-EDD/forum.md). */
export function ForumTab({ lessonId, courseId, courseName }: { lessonId: string; courseId: string; courseName: string }) {
  const session = useSession();
  const person = session.status === "signed-in" ? session.person : null;
  const isTeacher = person?.role === "teacher";
  const [data, setData] = useState<ForumData>(EMPTY);
  const [expanded, setExpanded] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [forums, setForums] = useState<ForumTitle[]>([]);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [builder, setBuilder] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [formFor, setFormFor] = useState<Survey | null>(null);

  const load = useCallback(async () => {
    if (!person) return;
    const [messages, surveys] = await Promise.all([ForumApi.loadMessages(lessonId), SurveyApi.loadSurveys(lessonId)]);
    const ids = surveys.map((survey) => survey.id);
    const [writers, totals, mine] = await Promise.all([
      isTeacher ? ForumApi.loadWriters(lessonId) : Promise.resolve(new Map<string, string>()),
      SurveyApi.totals(surveys.filter((s) => s.kind === "poll").map((s) => s.id)),
      isTeacher ? Promise.resolve(new Map<string, Answers>()) : SurveyApi.myAnswers(ids, person.idNumber),
    ]);
    const answers = new Map<string, AnswerRow[]>();
    if (isTeacher) {
      for (const survey of surveys.filter((s) => s.status !== "draft")) answers.set(survey.id, await SurveyApi.loadAnswers(survey.id));
    }
    setData({ messages, writers, surveys, totals, mine, answers });
  }, [lessonId, person, isTeacher]);

  useEffect(() => {
    const stopMessages = ForumApi.watch(lessonId, () => void load());
    const stopSurveys = SurveyApi.watch(lessonId, () => void load());
    return () => {
      stopMessages();
      stopSurveys();
    };
  }, [lessonId, load]);

  useEffect(() => {
    if (listOpen) void ForumApi.listForums(courseId).then(setForums);
  }, [listOpen, courseId]);

  if (!person) return null;

  const topLevel = data.messages.filter((message) => !message.replyTo);
  const repliesOf = (id: string) => data.messages.filter((message) => message.replyTo === id);
  const items: Item[] = [
    ...topLevel.map((message) => ({ kind: "message" as const, at: message.createdAt, message })),
    ...data.surveys.filter((survey) => survey.status !== "draft").map((survey) => ({ kind: "survey" as const, at: survey.shownAt, survey })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());
  const drafts = data.surveys.filter((survey) => survey.status === "draft");

  function writerOf(message: Message): string {
    if (message.deleted) return "";
    const hiddenName = isTeacher ? data.writers.get(message.id) : undefined;
    if (message.writerName) return message.writerIsTeacher ? `${message.writerName} · מרצה` : message.writerName;
    return hiddenName ? `${hiddenName} (השם מוסתר מהכיתה)` : "שם מוסתר";
  }

  function renderMessage(message: Message, reply = false) {
    return (
      <article key={message.id} className={reply ? "card reply" : "card"} data-message={message.id}>
        <div className="row-between">
          <b>{writerOf(message)}</b>
          <span className="muted">{message.createdAt.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}</span>
        </div>
        {message.deleted ? <p className="muted">ההודעה נמחקה על ידי המרצה.</p> : <MessageText text={message.text} />}
        {!message.deleted && (
          <div className="actions">
            {!reply && <IconButton icon={Reply} label="תגובה" onClick={() => setReplyTo(message)} />}
            {isTeacher && <IconButton icon={Trash2} className="danger" label="מחיקת ההודעה" onClick={() => void ForumApi.remove(message.id).then(load)} />}
          </div>
        )}
      </article>
    );
  }

  function renderSurvey(survey: Survey, compact: boolean) {
    if (survey.kind === "poll") {
      return (
        <PollCard
          key={survey.id}
          survey={survey}
          counts={data.totals.get(survey.id) ?? []}
          myAnswer={data.mine.get(survey.id)}
          isTeacher={isTeacher}
          whoAnswered={data.answers.get(survey.id) ?? []}
          compact={compact}
          onChoose={async (option) => {
            await SurveyApi.answer(survey, person!.idNumber, { q1: option }, data.mine.has(survey.id));
            await load();
          }}
          onClose={async () => {
            await SurveyApi.close(survey.id);
            await load();
          }}
        />
      );
    }
    const answered = data.mine.has(survey.id);
    const answers = data.answers.get(survey.id) ?? [];
    return (
      <article key={survey.id} className="card framed stack" data-survey={survey.id} aria-label="טופס">
        <b>טופס: {survey.questions.length} שאלות</b>
        {survey.status === "closed" && <span className="muted">הטופס סגור</span>}
        {!isTeacher && answered && <span className="muted">התשובות שלך נשלחו.</span>}
        {!isTeacher && survey.status === "open" && (!answered || survey.allowChange) && (
          <button className="primary small" onClick={() => setFormFor(survey)}>
            <ClipboardList {...ICON} />
            {answered ? "שינוי התשובות" : "מילוי הטופס"}
          </button>
        )}
        {isTeacher && <FormAnswers survey={survey} answers={answers} />}
        {isTeacher && survey.status === "open" && (
          <button className="secondary small" onClick={() => void SurveyApi.close(survey.id).then(load)}>
            סגירת הטופס
          </button>
        )}
      </article>
    );
  }

  const timeline = (compact: boolean) => (
    <div className="stack" aria-label="השיחה">
      {items.length === 0 && <p className="muted">אין עדיין הודעות.</p>}
      {items.map((item) =>
        item.kind === "message" ? (
          <div key={item.message.id} className="stack">
            {renderMessage(item.message)}
            {repliesOf(item.message.id).map((reply) => renderMessage(reply, true))}
          </div>
        ) : (
          renderSurvey(item.survey, compact)
        ),
      )}
    </div>
  );

  const composer = (
    <Composer
      key={replyTo?.id ?? "new"}
      isStudent={person.role === "student"}
      replyTo={replyTo}
      onCancelReply={() => setReplyTo(null)}
      onSend={async (text, showName) => {
        await ForumApi.post(lessonId, text, showName, replyTo?.id ?? null);
        setReplyTo(null);
        await load();
      }}
    />
  );

  return (
    <section className="stack">
      <div className="row-between tab-head">
        <h2 className="visually-hidden">פורום</h2>
        <span className="actions">
          <Link className="link-button small" to={`/lessons/${lessonId}/summary`}>
            <FileText {...ICON} />
            סיכום השיעור
          </Link>
          <IconButton icon={List} label="כל ההרצאות" aria-expanded={listOpen} onClick={() => setListOpen(!listOpen)} />
          <IconButton icon={Maximize2} label="הרחבה" onClick={() => setExpanded(true)} />
        </span>
      </div>

      {listOpen && (
        <nav aria-label="כל הפורומים של הקורס">
          <ul className="stack plain">
            {forums.map((forum) => (
              <li key={forum.lessonId}>
                <Link className="card lesson-link" to={`/lessons/${forum.lessonId}/forum`} onClick={() => setListOpen(false)}>
                  {[courseName, `הרצאה ${forum.lectureNumber}`, forum.topic].filter(Boolean).join(" · ")}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {isTeacher && <TeacherTools lessonId={lessonId} onPoll={() => setPollOpen(!pollOpen)} onForm={() => setBuilder(true)} />}
      {isTeacher && pollOpen && (
        <PollComposer
          onPublish={async (question, allowChange) => {
            await SurveyApi.publishPoll(lessonId, question, allowChange);
            setPollOpen(false);
            await load();
          }}
        />
      )}
      {isTeacher && drafts.length > 0 && (
        <div className="stack">
          <h3>טיוטות</h3>
          {drafts.map((draft) => (
            <p key={draft.id} className="card request">
              <span>טופס: {draft.questions.length} שאלות</span>
              <button className="primary small" onClick={() => void SurveyApi.publishForm(draft.id).then(load)}>
                <Send {...ICON} />
                פרסום
              </button>
            </p>
          ))}
        </div>
      )}

      {timeline(false)}
      {composer}

      {expanded && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="השיחה המורחבת">
          <div className="overlay-body stack">
            <div className="row-between">
              <h2>השיחה בשיעור</h2>
              <IconButton icon={X} label="סגירה" onClick={() => setExpanded(false)} />
            </div>
            {timeline(true)}
            {composer}
          </div>
        </div>
      )}

      {builder && (
        <FormBuilder
          onClose={() => setBuilder(false)}
          onSave={async (questions, allowChange, publish) => {
            await SurveyApi.saveForm(lessonId, questions, allowChange, publish);
            setBuilder(false);
            await load();
          }}
        />
      )}

      {formFor && (
        <FormWindow
          questions={formFor.questions}
          initialAnswers={data.mine.get(formFor.id)}
          onClose={() => setFormFor(null)}
          onSubmit={async (answers) => {
            await SurveyApi.answer(formFor, person.idNumber, answers, data.mine.has(formFor.id));
            setFormFor(null);
            await load();
          }}
        />
      )}
    </section>
  );
}

function Composer({
  isStudent,
  replyTo,
  onCancelReply,
  onSend,
}: {
  isStudent: boolean;
  replyTo: Message | null;
  onCancelReply: () => void;
  onSend: (text: string, showName: boolean) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [hideName, setHideName] = useState(false);
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setProblem("");
    try {
      await onSend(text, !hideName);
      setText("");
    } catch {
      // The text stays in the box, so the user can try again (UC-02, 3a).
      setProblem("ההודעה לא נשלחה. אפשר לנסות שוב.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack composer" onSubmit={submit}>
      {replyTo && (
        <p className="muted row-between">
          <span>תגובה ל: {replyTo.text.slice(0, 40)}</span>
          <IconButton icon={X} label="ביטול התגובה" onClick={onCancelReply} />
        </p>
      )}
      <label className="field">
        <span>{replyTo ? "תגובה" : "הודעה חדשה"}</span>
        <textarea rows={2} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      {isStudent && (
        <label className="check">
          <input type="checkbox" checked={hideName} onChange={(e) => setHideName(e.target.checked)} />
          להסתיר את השם שלי מהכיתה
        </label>
      )}
      {problem && (
        <p className="problem" role="alert">
          {problem}
        </p>
      )}
      <button className="primary" type="submit" disabled={busy || !text.trim()}>
        <Send {...ICON} />
        שליחה
      </button>
    </form>
  );
}

function TeacherTools({ lessonId, onPoll, onForm }: { lessonId: string; onPoll: () => void; onForm: () => void }) {
  const [topic, setTopic] = useState("");
  const [saved, setSaved] = useState("");

  useEffect(() => {
    void supabase
      .from("lessons")
      .select("topic")
      .eq("id", lessonId)
      .single()
      .then(({ data }) => setTopic(data?.topic ?? ""));
  }, [lessonId]);

  return (
    <div className="stack card">
      <form
        className="topic"
        onSubmit={(event) => {
          event.preventDefault();
          void ForumApi.setTopic(lessonId, topic).then(() => setSaved("הנושא נשמר."));
        }}
      >
        <label className="field">
          <span>נושא ההרצאה</span>
          <input value={topic} onChange={(e) => setTopic(e.target.value)} />
        </label>
        <button className="secondary small" type="submit">
          <Save {...ICON} />
          שמירת הנושא
        </button>
        {saved && <span role="status">{saved}</span>}
      </form>
      <div className="actions">
        <button className="primary small" onClick={onPoll}>
          <ChartColumn {...ICON} />
          סקר חדש
        </button>
        <button className="primary small" onClick={onForm}>
          <ClipboardList {...ICON} />
          טופס חדש
        </button>
      </div>
    </div>
  );
}

function PollComposer({ onPublish }: { onPublish: (question: Question, allowChange: boolean) => Promise<void> }) {
  const [text, setText] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [allowChange, setAllowChange] = useState(false);
  const [problem, setProblem] = useState("");

  async function publish() {
    const real = options.map((option) => option.trim()).filter(Boolean);
    if (!text.trim() || real.length < 2) {
      setProblem("צריך שאלה ולפחות 2 אפשרויות.");
      return;
    }
    try {
      await onPublish({ id: "q1", type: "single", text: text.trim(), options: real }, allowChange);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "הפרסום נכשל.");
    }
  }

  return (
    <div className="card framed stack" aria-label="סקר חדש">
      <label className="field">
        <span>שאלת הסקר</span>
        <input value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      {options.map((option, index) => (
        <label key={index} className="field">
          <span>אפשרות {index + 1}</span>
          <input value={option} onChange={(e) => setOptions(options.map((o, i) => (i === index ? e.target.value : o)))} />
        </label>
      ))}
      <button className="link" onClick={() => setOptions([...options, ""])}>
        <Plus {...ICON} />
        הוספת אפשרות
      </button>
      <label className="check">
        <input type="checkbox" checked={allowChange} onChange={(e) => setAllowChange(e.target.checked)} />
        לאפשר לשנות תשובה
      </label>
      {problem && (
        <p className="problem" role="alert">
          {problem}
        </p>
      )}
      <button className="primary" onClick={() => void publish()}>
        <Send {...ICON} />
        פרסום הסקר
      </button>
    </div>
  );
}

function FormAnswers({ survey, answers }: { survey: Survey; answers: AnswerRow[] }) {
  const show = (questionId: string, value: unknown): string => {
    const question = survey.questions.find((q) => q.id === questionId);
    if (!question) return "";
    if (question.type === "single") return question.options?.[value as number] ?? "";
    if (question.type === "multiple") return (value as number[]).map((i) => question.options?.[i]).join(", ");
    return String(value);
  };
  return (
    <details>
      <summary>תשובות ({answers.length})</summary>
      <div className="table-box">
        <table>
          <thead>
            <tr>
              <th>שם</th>
              {survey.questions.map((question) => (
                <th key={question.id}>{question.text}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {answers.map((row) => (
              <tr key={row.studentId}>
                <td>{row.name}</td>
                {survey.questions.map((question) => (
                  <td key={question.id}>{show(question.id, row.value[question.id])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
