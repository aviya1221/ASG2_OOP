import { Plus, Save } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase.ts";
import { ICON } from "../ui/Icon.tsx";
import { DAYS, DEFAULT_WEEKS, parseStudents, problemsIn, saveErrorMessage, type CourseForm, type Slot } from "./courseForm.ts";

interface CourseRow {
  id: string;
  number: string;
  name: string;
  weekly_hours: Slot[];
}

const EMPTY_FORM: CourseForm = {
  number: "",
  name: "",
  teacherId: "",
  teacherName: "",
  slots: [{ day: 0, start: "10:00", end: "12:00" }],
  firstDate: "",
  weeks: DEFAULT_WEEKS,
  students: "",
};

/** The admin's one screen: the weekly timetable and a form for a new course. */
export function AdminPage() {
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [form, setForm] = useState<CourseForm>(EMPTY_FORM);
  const [problems, setProblems] = useState<string[]>([]);
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("courses").select("id, number, name, weekly_hours").order("number");
    setCourses((data ?? []) as CourseRow[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function change<K extends keyof CourseForm>(key: K, value: CourseForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setSaved("");
  }

  function changeSlot(index: number, part: Partial<Slot>) {
    change("slots", form.slots.map((slot, i) => (i === index ? { ...slot, ...part } : slot)));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found = problemsIn(form);
    setProblems(found);
    setSaved("");
    if (found.length > 0) return;

    setBusy(true);
    const { error } = await supabase.rpc("create_course", {
      p_number: form.number,
      p_name: form.name,
      p_teacher: { id_number: form.teacherId, name: form.teacherName },
      p_weekly_hours: form.slots,
      p_first_date: form.firstDate,
      p_weeks: Number(form.weeks),
      p_students: parseStudents(form.students).students,
    });
    setBusy(false);

    if (error) {
      setProblems([saveErrorMessage(error.message)]);
      return;
    }
    setSaved(`הקורס ${form.number} נשמר.`);
    setForm(EMPTY_FORM);
    await load();
  }

  return (
    <>
      <header className="band">
        <div className="band-inner">
          <h1>מערכת שעות</h1>
        </div>
      </header>
      <main className="content admin">
        <section className="stack" aria-label="מערכת השעות השבועית">
          <h2>השבוע</h2>
          <div className="week">
            {DAYS.slice(0, 6).map((dayName, day) => (
              <div key={dayName} className="day">
                <b>{dayName}</b>
                {courses
                  .flatMap((course) => course.weekly_hours.filter((slot) => slot.day === day).map((slot) => ({ course, slot })))
                  .sort((a, b) => a.slot.start.localeCompare(b.slot.start))
                  .map(({ course, slot }) => (
                    <div key={`${course.id}-${slot.start}`} className="card framed">
                      <b>{course.name}</b>
                      <span className="muted">
                        {slot.start}–{slot.end} · {course.number}
                      </span>
                    </div>
                  ))}
              </div>
            ))}
          </div>
        </section>

        <form className="stack" onSubmit={submit} noValidate aria-label="קורס חדש">
          <h2>קורס חדש</h2>
          <label className="field">
            <span>מספר קורס</span>
            <input value={form.number} onChange={(e) => change("number", e.target.value)} dir="ltr" />
          </label>
          <label className="field">
            <span>שם הקורס</span>
            <input value={form.name} onChange={(e) => change("name", e.target.value)} />
          </label>
          <label className="field">
            <span>תעודת זהות של המרצה</span>
            <input value={form.teacherId} onChange={(e) => change("teacherId", e.target.value)} inputMode="numeric" dir="ltr" />
          </label>
          <label className="field">
            <span>שם המרצה</span>
            <input value={form.teacherName} onChange={(e) => change("teacherName", e.target.value)} />
          </label>

          <fieldset className="stack">
            <legend>שעות שבועיות</legend>
            {form.slots.map((slot, index) => (
              <div key={index} className="slot">
                <label className="field">
                  <span>יום</span>
                  <select value={slot.day} onChange={(e) => changeSlot(index, { day: Number(e.target.value) })}>
                    {DAYS.map((name, day) => (
                      <option key={name} value={day}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>התחלה</span>
                  <input type="time" value={slot.start} onChange={(e) => changeSlot(index, { start: e.target.value })} />
                </label>
                <label className="field">
                  <span>סיום</span>
                  <input type="time" value={slot.end} onChange={(e) => changeSlot(index, { end: e.target.value })} />
                </label>
              </div>
            ))}
            <button className="link" type="button" onClick={() => change("slots", [...form.slots, { day: 0, start: "10:00", end: "12:00" }])}>
              <Plus {...ICON} />
              הוספת שעה שבועית
            </button>
          </fieldset>

          <label className="field">
            <span>תאריך התחלה</span>
            <input type="date" value={form.firstDate} onChange={(e) => change("firstDate", e.target.value)} />
          </label>
          <label className="field">
            <span>מספר שבועות</span>
            <input value={form.weeks} onChange={(e) => change("weeks", e.target.value)} inputMode="numeric" dir="ltr" />
          </label>
          <label className="field">
            <span>סטודנטים: בכל שורה תעודת זהות ואחריה שם</span>
            <textarea rows={6} value={form.students} onChange={(e) => change("students", e.target.value)} />
          </label>

          {problems.length > 0 && (
            <ul className="problem plain" role="alert">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          )}
          {saved && (
            <p className="saved" role="status">
              {saved}
            </p>
          )}
          <button className="primary" type="submit" disabled={busy}>
            <Save {...ICON} />
            שמירת הקורס
          </button>
        </form>
      </main>
    </>
  );
}
