import { useEffect, useState } from "react";
import { Link, NavLink, useParams } from "react-router";
import { AttendanceTab } from "../attendance/AttendanceTab.tsx";
import { supabase } from "../lib/supabase.ts";
import { lectureTitle } from "./lessons.ts";

const TABS = [
  { id: "attendance", label: "נוכחות" },
  { id: "forum", label: "פורום" },
  { id: "homework", label: "מטלות" },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface LessonHeader {
  courseName: string;
  lectureNumber: number;
  topic: string | null;
}

/** One page for a lesson, with its three tabs (REQ-06). */
export function LessonPage() {
  const { lessonId = "", tab } = useParams();
  const [lesson, setLesson] = useState<LessonHeader | null>(null);
  const [missing, setMissing] = useState(false);
  const openTab: TabId = TABS.find((item) => item.id === tab)?.id ?? "attendance";

  useEffect(() => {
    setLesson(null);
    setMissing(false);
    void supabase
      .from("lessons")
      .select("lecture_number, topic, courses(name)")
      .eq("id", lessonId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) {
          setMissing(true);
          return;
        }
        setLesson({
          courseName: (data.courses as unknown as { name: string }).name,
          lectureNumber: data.lecture_number,
          topic: data.topic,
        });
      });
  }, [lessonId]);

  if (missing) {
    return (
      <main className="content stack">
        <p className="problem">השיעור הזה לא נמצא.</p>
        <Link to="/">חזרה לשיעורים</Link>
      </main>
    );
  }
  if (!lesson) return <p className="content">טוען...</p>;

  return (
    <>
      <header className="band">
        <div className="band-inner">
          <Link className="band-back" to="/">
            כל השיעורים
          </Link>
          <h1>{lesson.courseName}</h1>
          <p className="band-note">{lectureTitle(lesson)}</p>
          <nav className="tabs" aria-label="לשוניות השיעור">
            {TABS.map((item) => (
              <NavLink key={item.id} to={`/lessons/${lessonId}/${item.id}`} aria-current={item.id === openTab ? "page" : undefined}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="content">
        {openTab === "attendance" ? (
          <AttendanceTab lessonId={lessonId} />
        ) : (
          <>
            <h2>{TABS.find((item) => item.id === openTab)?.label}</h2>
            <p className="muted">הלשונית הזאת עדיין בבנייה.</p>
          </>
        )}
      </main>
    </>
  );
}
