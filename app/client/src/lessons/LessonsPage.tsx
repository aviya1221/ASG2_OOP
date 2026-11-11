import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import { Link } from "react-router";
import { supabase } from "../lib/supabase.ts";
import { DAYS } from "../timetable/courseForm.ts";
import { IconButton } from "../ui/Icon.tsx";
import { addDays, formatTime, formatWhen, isCurrent, lectureTitle, lessonsOfWeek, localDay, nowOrNext, shortDate, weekStartOf, type Lesson } from "./lessons.ts";

/** The Hebrew letters of the days, as on a printed timetable: א׳ is Sunday. */
const DAY_LETTERS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

/** The first screen of a teacher or a student: a weekly timetable of their own lessons (REQ-04, REQ-72). */
export function LessonsPage() {
  const [lessons, setLessons] = useState<Lesson[] | null>(null);
  const [failed, setFailed] = useState(false);
  const now = new Date();
  const today = localDay(now);
  const thisWeek = weekStartOf(now);
  const [week, setWeek] = useState(thisWeek);
  // On a phone one day shows at a time, and it opens on today (Sunday on a Saturday).
  const [day, setDay] = useState(today.weekday === 6 ? 0 : today.weekday);

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

  const days = lessonsOfWeek(lessons ?? [], week);
  // Sunday to Friday, and Saturday only in a week that has a lesson on it.
  const shown = days[6]!.length > 0 ? 7 : 6;
  const first = nowOrNext(lessons ?? [], now);

  return (
    <>
      <header className="band">
        <div className="band-inner">
          <h1>השיעורים שלי</h1>
        </div>
      </header>
      <main className="content stack">
        {failed && <p className="problem">לא הצלחנו לטעון את השיעורים. כדאי לנסות שוב.</p>}
        {lessons === null && !failed && <p>טוען...</p>}
        {lessons?.length === 0 && <p>אין שיעורים להצגה.</p>}

        {first && (
          <Link className={`card lesson-link next-lesson${first.current ? " framed" : ""}`} to={`/lessons/${first.lesson.id}`}>
            <span className="muted">{first.current ? "עכשיו" : "השיעור הבא"}</span>
            <b>{first.lesson.courseName}</b>
            <span>{lectureTitle(first.lesson)}</span>
            <span className="muted">
              {first.current ? `${formatTime(first.lesson.startsAt)}–${formatTime(first.lesson.endsAt)}` : formatWhen(first.lesson.startsAt)}
            </span>
          </Link>
        )}

        {lessons && lessons.length > 0 && (
          <section className="stack timetable" aria-label="מערכת השעות">
            <div className="week-head">
              <IconButton icon={ChevronRight} label="השבוע הקודם" onClick={() => setWeek(addDays(week, -7))} />
              <h2>
                שבוע {shortDate(week)}–{shortDate(addDays(week, shown - 1))}
              </h2>
              <IconButton icon={ChevronLeft} label="השבוע הבא" onClick={() => setWeek(addDays(week, 7))} />
              {week !== thisWeek && (
                <button className="secondary small" onClick={() => setWeek(thisWeek)}>
                  השבוע
                </button>
              )}
            </div>

            <div className="day-strip" role="group" aria-label="ימי השבוע">
              {days.slice(0, shown).map((_, index) => (
                <button
                  key={index}
                  className={index === day ? "day-pick chosen" : "day-pick"}
                  aria-label={`יום ${DAYS[index]} ${shortDate(addDays(week, index))}`}
                  aria-pressed={index === day}
                  onClick={() => setDay(index)}
                >
                  <b>{DAY_LETTERS[index]}</b>
                  <span>{shortDate(addDays(week, index))}</span>
                </button>
              ))}
            </div>

            <div className="week-grid" style={{ "--days": shown } as CSSProperties}>
              {days.slice(0, shown).map((dayLessons, index) => {
                const date = addDays(week, index);
                return (
                  <section
                    key={date}
                    className={`day-column${index === day ? " chosen" : ""}${date === today.key ? " today" : ""}`}
                    aria-label={`יום ${DAYS[index]} ${shortDate(date)}`}
                  >
                    <h3>
                      {DAYS[index]} <span className="muted">{shortDate(date)}</span>
                    </h3>
                    {dayLessons.length === 0 && <p className="muted">אין שיעורים</p>}
                    {dayLessons.map((lesson) => (
                      <Link key={lesson.id} className={`card lesson-link${isCurrent(lesson, now) ? " framed" : ""}`} to={`/lessons/${lesson.id}`}>
                        <span className="muted">
                          {formatTime(lesson.startsAt)}–{formatTime(lesson.endsAt)}
                          {isCurrent(lesson, now) && " · עכשיו"}
                        </span>
                        <b>{lesson.courseName}</b>
                        <span>{lectureTitle(lesson)}</span>
                      </Link>
                    ))}
                  </section>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
