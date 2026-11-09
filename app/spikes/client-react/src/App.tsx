import { useState } from "react";
import { useLiveMessages } from "./useLiveMessages.ts";

const TABS = [
  { id: "attendance", label: "נוכחות" },
  { id: "forum", label: "פורום" },
  { id: "homework", label: "שיעורי בית" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export function App() {
  const [tab, setTab] = useState<TabId>("forum");
  return (
    <>
      <LessonHeader tab={tab} onTab={setTab} />
      <main className="content">
        {tab === "attendance" && <Attendance />}
        {tab === "forum" && <Forum />}
        {tab === "homework" && <Homework />}
      </main>
    </>
  );
}

function LessonHeader({ tab, onTab }: { tab: TabId; onTab: (tab: TabId) => void }) {
  return (
    <header className="band">
      <div className="band-inner">
        <h1>מבוא להנדסת תוכנה</h1>
        <p>הרצאה 5 · כתיבת דרישות</p>
        <nav className="tabs" aria-label="לשוניות השיעור">
          {TABS.map((item) => (
            <button
              key={item.id}
              data-tab={item.id}
              aria-current={item.id === tab ? "page" : undefined}
              onClick={() => onTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}

const RESULTS = [
  ["נוכח", 38, "ok"],
  ["לבדיקה", 1, "review"],
  ["לא נמצא", 3, "missing"],
  ["התנגשות", 2, "conflict"],
  ["אין תגובה", 6, "none"],
] as const;

function Attendance() {
  return (
    <section className="stack">
      <h2>38 נוכחים מתוך 50</h2>
      <div className="tags">
        {RESULTS.map(([label, count, kind]) => (
          <button key={kind} className={`tag ${kind}`}>
            {label} {count}
          </button>
        ))}
      </div>
      <h2>איפה ישבת?</h2>
      <div className="hall">
        <div className="board">לוח</div>
        <div className="seats">
          {Array.from({ length: 30 }, (_, index) => (
            <button key={index} aria-label={`שורה ${Math.floor(index / 6) + 1}, כיסא ${(index % 6) + 1}`}>
              {(index % 6) + 1}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function Forum() {
  const { messages, connected } = useLiveMessages();
  return (
    <div className="forum" data-live={connected ? "connected" : "waiting"}>
      <section className="stack">
        <h2>השיחה בשיעור</h2>
        <article className="card">
          <b>ד״ר מיכל אביב · מורה</b>
          <p>השקפים נמצאים כאן: https://example.com/a-very-long-link-that-must-not-push-the-page-wider-than-the-screen-of-a-phone</p>
        </article>
        <div id="messages" className="stack">
          {messages.map((message) => (
            <article key={message.id} className="card" data-sent-at={message.sentAtMs}>
              <b>סטודנט בכיתה</b>
              <p>{message.body}</p>
            </article>
          ))}
        </div>
      </section>
      <aside className="card framed stack">
        <h2>איזו דרישה אפשר לבדוק?</h2>
        {[
          ["החיפוש יחזיר תוצאה תוך שנייה", 71],
          ["המערכת תהיה מהירה", 19],
          ["הממשק יהיה נוח", 10],
        ].map(([label, percent]) => (
          <button key={label} className="option">
            <span className="row">
              <span>{label}</span>
              <span>{percent}%</span>
            </span>
            <span className="track">
              <span className="bar" style={{ width: `${percent}%` }} />
            </span>
          </button>
        ))}
      </aside>
    </div>
  );
}

function Homework() {
  return (
    <section className="stack">
      <button className="primary">בדיקה לפני הגשה</button>
      <h2>גרף הכיתה</h2>
      {[
        ["1 · נועה ברק", 94],
        ["2 · אני", 88],
        ["3 · יואב מזרחי", 82],
      ].map(([name, score]) => (
        <div key={name} className="card">
          <span className="row">
            <span>{name}</span>
            <b>{score}</b>
          </span>
          <span className="track">
            <span className="bar" style={{ width: `${score}%` }} />
          </span>
        </div>
      ))}
    </section>
  );
}
