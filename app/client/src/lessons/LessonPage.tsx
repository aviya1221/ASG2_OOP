import { useEffect, useState } from "react";
import { Link, NavLink, useParams } from "react-router";
import { AttendanceTab } from "../attendance/AttendanceTab.tsx";
import { ForumTab } from "../forum/ForumTab.tsx";
import { HomeworkTab } from "../homework/HomeworkTab.tsx";
import { supabase } from "../lib/supabase.ts";
import { lectureTitle } from "./lessons.ts";

const TABS = [
  { id: "attendance", label: "נוכחות" },
  { id: "forum", label: "פורום" },
  { id: "homework", label: "מטלות" },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface LessonHeader {
  courseId: string;
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
      .select("course_id, lecture_number, topic, courses(name)")
      .eq("id", lessonId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) {
          setMissing(true);
          return;
        }
        setLesson({
          courseId: data.course_id,
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
          <div className="band-title">
            <h1>{lesson.courseName}</h1>
            <p className="band-note">{lectureTitle(lesson)}</p>
          </div>
          <nav className="tabs" aria-label="לשוניות השיעור">
            {TABS.map((item) => (
              // Switching tabs replaces the address, so the back arrow leaves the lesson.
              <NavLink key={item.id} replace to={`/lessons/${lessonId}/${item.id}`} aria-current={item.id === openTab ? "page" : undefined}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="content">
        {openTab === "attendance" ? (
          <AttendanceTab lessonId={lessonId} />
        ) : openTab === "forum" ? (
          <ForumTab lessonId={lessonId} courseId={lesson.courseId} courseName={lesson.courseName} />
        ) : (
          <HomeworkTab lessonId={lessonId} courseId={lesson.courseId} />
        )}
      </main>
    </>
  );
}
