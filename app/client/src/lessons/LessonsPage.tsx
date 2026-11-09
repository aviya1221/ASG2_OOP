import { useEffect, useState } from "react";
import { Link } from "react-router";
import type { Person } from "../accounts/session.tsx";
import { supabase } from "../lib/supabase.ts";
import { formatWhen, isCurrent, lectureTitle, orderLessons, type Lesson } from "./lessons.ts";

/** The first screen of a teacher or a student: only the lessons of their own courses. */
export function LessonsPage({ person }: { person: Person }) {
  const [lessons, setLessons] = useState<Lesson[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void supabase
      .from("lessons")
      .select("id, lecture_number, topic, starts_at, ends_at, courses(name)")
      .then(({ data, error }) => {
        if (error || !data) {
          setFailed(true);
          return;
        }
        setLessons(
          data.map((row) => ({
            id: row.id,
            courseName: (row.courses as unknown as { name: string }).name,
            lectureNumber: row.lecture_number,
            topic: row.topic,
            startsAt: new Date(row.starts_at),
            endsAt: new Date(row.ends_at),
          })),
        );
      });
  }, []);

  const now = new Date();

  return (
    <>
      <header className="band">
        <div className="band-inner band-row">
          <div>
            <h1>השיעורים שלי</h1>
            <p className="band-note">{person.name}</p>
          </div>
          <button className="band-button" onClick={() => void supabase.auth.signOut()}>
            יציאה
          </button>
        </div>
      </header>
      <main className="content">
        {failed && <p className="problem">לא הצלחנו לטעון את השיעורים. כדאי לנסות שוב.</p>}
        {lessons === null && !failed && <p>טוען...</p>}
        {lessons?.length === 0 && <p>אין שיעורים להצגה.</p>}
        <ul className="stack plain">
          {orderLessons(lessons ?? [], now).map((lesson) => (
            <li key={lesson.id}>
              <Link className={`card lesson-link${isCurrent(lesson, now) ? " framed" : ""}`} to={`/lessons/${lesson.id}`}>
                <b>{lesson.courseName}</b>
                <span>{lectureTitle(lesson)}</span>
                <span className="muted">
                  {formatWhen(lesson.startsAt)}
                  {isCurrent(lesson, now) && " · עכשיו"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
