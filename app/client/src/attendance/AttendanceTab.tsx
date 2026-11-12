import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Send } from "lucide-react";
import { Link } from "react-router";
import { useSession, type Person } from "../accounts/session.tsx";
import { supabase } from "../lib/supabase.ts";
import { ICON } from "../ui/Icon.tsx";
import { useLive, useRound } from "./live.ts";
import { ResultChip } from "./ResultChip.tsx";
import { loadSharedPhotos, SharedPhotoList, type SharedPhoto } from "./SharedPhotos.tsx";
import { TeacherAttendance } from "./TeacherAttendance.tsx";

export function AttendanceTab({ lessonId }: { lessonId: string }) {
  const session = useSession();
  if (session.status !== "signed-in") return null;
  return session.person.role === "teacher" ? <TeacherAttendance lessonId={lessonId} /> : <StudentAttendance lessonId={lessonId} person={session.person} />;
}

// ------------------------------------------------------------------ student

interface StudentState {
  result: string | null;
  claim: { number: number; status: string; contested: boolean } | null;
  registered: boolean;
  optedOut: boolean;
  photos: SharedPhoto[];
  numbers: number[];
}

/** What a student sees about their pick. Two picks of one number wait for the teacher together. */
function claimText(claim: { status: string; contested: boolean }): string {
  if (claim.status === "pending") return claim.contested ? "הועבר למרצה להמשך טיפול" : "ממתין לאישור המרצה";
  return claim.status === "approved" ? "אושר" : "נדחה";
}

/** While a pick waits, another student's pick of the same number is not sent to this page, so it asks again. */
const CLAIM_POLL_MS = 30_000;

function StudentAttendance({ lessonId, person }: { lessonId: string; person: Person }) {
  const [round] = useRound(lessonId);
  const [state, setState] = useState<StudentState | null>(null);

  const load = useCallback(async () => {
    const [result, claim, status, photos, numbers] = await Promise.all([
      supabase.from("attendance_results").select("result").eq("lesson_id", lessonId).eq("student_id", person.idNumber).maybeSingle(),
      supabase.from("my_number_claim").select("number, status, contested").eq("lesson_id", lessonId).maybeSingle(),
      supabase.from("my_face_status").select("registered, opted_out").maybeSingle(),
      loadSharedPhotos(lessonId),
      supabase.from("photo_numbers").select("number").eq("lesson_id", lessonId).order("number"),
    ]);
    setState({
      result: result.data?.result ?? null,
      claim: claim.data ? { number: claim.data.number, status: claim.data.status, contested: claim.data.contested } : null,
      registered: status.data?.registered ?? false,
      optedOut: status.data?.opted_out ?? false,
      photos,
      numbers: (numbers.data ?? []).map((row) => row.number as number),
    });
  }, [lessonId, person.idNumber]);

  useEffect(() => {
    void load();
  }, [load]);
  useLive(lessonId, ["attendance_results", "number_claims", "shared_photos"], () => void load());

  const waiting = state?.claim?.status === "pending";
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => void load(), CLAIM_POLL_MS);
    return () => clearInterval(timer);
  }, [waiting, load]);

  if (round === undefined || !state) return <p>טוען...</p>;
  if (!round) {
    return (
      <section className="stack">
        <h2 className="visually-hidden">נוכחות</h2>
        <p>הכיתה עדיין לא צולמה.</p>
        {!state.registered && !state.optedOut && <Link to="/face">רישום פנים</Link>}
      </section>
    );
  }

  const hourOver = round.expiresAt.getTime() <= Date.now();
  const shown = state.claim?.status === "approved" ? "present" : (state.result ?? (hourOver ? "no_response" : null));
  const photoUp = state.photos.length > 0 && state.photos[0]!.expiresAt > new Date();

  let picking: ReactNode = null;
  if (state.claim) {
    picking = (
      <p className="card">
        בחרת את מספר {state.claim.number}: {claimText(state.claim)}
      </p>
    );
  } else if (state.result !== "present" && hourOver) {
    if (photoUp) picking = <NumberPicker lessonId={lessonId} idNumber={person.idNumber} photos={state.photos} numbers={state.numbers} onSent={() => void load()} />;
    else if (state.photos.length > 0) picking = <p className="muted">הזמן לבחירת מספר בתמונת הכיתה הסתיים.</p>;
    else picking = <p className="muted">המרצה עוד לא שיתף את תמונת הכיתה.</p>;
  } else if (!hourOver && state.optedOut) {
    picking = <p className="muted">אחרי השעה אפשר יהיה לבחור את המספר שלך בתמונת הכיתה, אם המרצה ישתף אותה.</p>;
  }

  return (
    <section className="stack">
      <h2 className="visually-hidden">נוכחות</h2>
      {shown ? (
        <p>
          התוצאה שלך: <ResultChip kind={shown} />
        </p>
      ) : state.registered ? (
        <p>הנוכחות נאספת.</p>
      ) : (
        !state.optedOut && <Link to="/face">רישום פנים</Link>
      )}
      {picking}
    </section>
  );
}

/** "I am number 32": the student finds their face in the shared photo and picks its number. */
function NumberPicker({ lessonId, idNumber, photos, numbers, onSent }: { lessonId: string; idNumber: string; photos: SharedPhoto[]; numbers: number[]; onSent: () => void }) {
  const [chosen, setChosen] = useState<number | null>(null);
  const [problem, setProblem] = useState("");

  async function send() {
    if (chosen === null) return;
    const { error } = await supabase.from("number_claims").insert({ lesson_id: lessonId, student_id: idNumber, number: chosen });
    if (error) {
      setProblem("הבחירה לא נשלחה.");
      return;
    }
    onSent();
  }

  return (
    <>
      <h2>מה המספר שלך בתמונה?</h2>
      <p className="muted">לא זיהינו אותך בתמונת הכיתה. צריך למצוא את עצמך בתמונה ולבחור את המספר שעל הפנים שלך. נגיעה בתמונה פותחת אותה בגודל מלא.</p>
      <SharedPhotoList photos={photos} />
      <div className="number-grid" role="group" aria-label="המספרים בתמונה">
        {numbers.map((number) => (
          <button key={number} className={chosen === number ? "number-choice chosen" : "number-choice"} aria-pressed={chosen === number} onClick={() => setChosen(number)}>
            {number}
          </button>
        ))}
      </div>
      {problem && (
        <p className="problem" role="alert">
          {problem}
        </p>
      )}
      <button className="primary" disabled={chosen === null} onClick={() => void send()}>
        <Send {...ICON} />
        {chosen === null ? "בחירת מספר" : `אני מספר ${chosen}`}
      </button>
    </>
  );
}
