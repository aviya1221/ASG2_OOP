import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Bell, Check, Send } from "lucide-react";
import type { Person } from "../accounts/session.tsx";
import { supabase } from "../lib/supabase.ts";
import { ICON } from "../ui/Icon.tsx";
import { claimText, claimTitle, type Claim } from "./attendanceText.ts";
import { timeLeft, useClock, useLive, useRound } from "./live.ts";
import { notificationsSupported, subscribeToNotifications } from "./notifications.ts";
import { ResultChip } from "./ResultChip.tsx";
import { loadSharedPhotos, SharedPhotoList, type SharedPhoto } from "./SharedPhotos.tsx";

/** Results a student sees as their own. "confirmed" and "waiting" only last while the minutes run. */
const FINAL_RESULTS = ["present", "absent", "pending"];

interface StudentState {
  attendance: string | null;
  confirmed: boolean;
  claim: Claim | null;
  photos: SharedPhoto[];
  numbers: number[];
}

/**
 * While a pick or a share waits, changes made by others (a second pick of the same number, the teacher's
 * decision) are not sent to this page, so it asks again.
 */
const POLL_MS = 30_000;

/** The attendance tab of a student (docs/features/F1-attendance-strategy.md). */
export function StudentAttendance({ lessonId, person }: { lessonId: string; person: Person }) {
  const [round, reloadRound] = useRound(lessonId);
  const [state, setState] = useState<StudentState | null>(null);
  const [problem, setProblem] = useState("");

  const load = useCallback(async () => {
    const [mine, claim, photos, numbers] = await Promise.all([
      supabase.from("my_attendance").select("attendance, confirmed").eq("lesson_id", lessonId).maybeSingle(),
      supabase.from("my_number_claim").select("number, status, contested").eq("lesson_id", lessonId).maybeSingle(),
      loadSharedPhotos(lessonId),
      supabase.from("photo_numbers").select("number").eq("lesson_id", lessonId).order("number"),
    ]);
    setState({
      attendance: mine.data?.attendance ?? null,
      confirmed: mine.data?.confirmed ?? false,
      claim: claim.data ? { number: claim.data.number, status: claim.data.status, contested: claim.data.contested } : null,
      photos,
      numbers: (numbers.data ?? []).map((row) => row.number as number),
    });
  }, [lessonId]);

  useLive(lessonId, ["attendance_rounds", "attendance_confirmations", "number_claims", "shared_photos"], () => void load());

  const now = useClock(round?.expiresAt);
  const open = Boolean(round && round.expiresAt.getTime() > now);
  const stage = !round ? "no_photo" : open ? "open" : "closed";
  // The result changes when the photo is taken and when the 4 minutes end.
  useEffect(() => {
    void load();
  }, [load, stage]);

  const waiting = state?.attendance === "pending";
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => {
      void load();
      reloadRound();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [waiting, load, reloadRound]);

  async function confirm() {
    setProblem("");
    const { error } = await supabase.from("attendance_confirmations").insert({ lesson_id: lessonId, student_id: person.idNumber });
    if (error) setProblem("האישור לא נשלח. ייתכן שהזמן לאישור הסתיים.");
    await load();
  }

  if (round === undefined || !state) return <p>טוען...</p>;

  const result = state.attendance && FINAL_RESULTS.includes(state.attendance) ? state.attendance : null;
  let body: ReactNode = null;
  if (!round) {
    body = <p>המרצה עוד לא צילם את הכיתה. אחרי הצילום יהיו לך 4 דקות לאשר שאתה בשיעור.</p>;
  } else if (open) {
    body = state.confirmed ? (
      <p className="saved" role="status">
        אישרת שהיית בשיעור.
      </p>
    ) : (
      <>
        <button className="primary big" onClick={() => void confirm()}>
          <Check {...ICON} />
          הייתי בשיעור
        </button>
        <p className="muted">נשארו {timeLeft(round.expiresAt, now)} דקות לאישור.</p>
      </>
    );
  } else if (state.claim) {
    body = (
      <p className="card">
        {claimTitle(state.claim)}: {claimText(state.claim)}
      </p>
    );
  } else if (state.confirmed && state.attendance === "pending") {
    const photoUp = state.photos.length > 0 && state.photos[0]!.expiresAt > new Date();
    if (photoUp) body = <NumberPicker lessonId={lessonId} idNumber={person.idNumber} photos={state.photos} numbers={state.numbers} onSent={() => void load()} />;
    else if (state.photos.length > 0) body = <p className="muted">הזמן לבחירת מספר בתמונת הכיתה הסתיים.</p>;
    else body = <p className="muted">היו יותר אישורים מאנשים בתמונה. המרצה ישתף את תמונת הכיתה, ותבחר בה את המספר שלך.</p>;
  } else if (!state.confirmed && result === "absent") {
    body = <p className="muted">לא אישרת שהיית בשיעור בזמן.</p>;
  }

  return (
    <section className="stack">
      <h2 className="visually-hidden">נוכחות</h2>
      {result && (
        <p>
          התוצאה שלך: <ResultChip kind={result} />
        </p>
      )}
      {body}
      {problem && (
        <p className="problem" role="alert">
          {problem}
        </p>
      )}
      <NotificationsButton />
    </section>
  );
}

/** "I am number 32": the student finds their face in the shared photo and picks its number, or says they are not in it. */
function NumberPicker({ lessonId, idNumber, photos, numbers, onSent }: { lessonId: string; idNumber: string; photos: SharedPhoto[]; numbers: number[]; onSent: () => void }) {
  const [chosen, setChosen] = useState<number | null>(null);
  const [problem, setProblem] = useState("");

  async function send(value: number | null) {
    const { error } = await supabase.from("number_claims").insert({ lesson_id: lessonId, student_id: idNumber, number: value });
    if (error) {
      setProblem("הבחירה לא נשלחה.");
      return;
    }
    onSent();
  }

  return (
    <>
      <h2>מה המספר שלך בתמונה?</h2>
      <p className="muted">היו יותר אישורים מאנשים בתמונה, ולכן כל מי שאישר בוחר את המספר שעל הפנים שלו. נגיעה בתמונה פותחת אותה בגודל מלא.</p>
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
      <button className="primary" disabled={chosen === null} onClick={() => void send(chosen)}>
        <Send {...ICON} />
        {chosen === null ? "בחירת מספר" : `אני מספר ${chosen}`}
      </button>
      <button className="link" onClick={() => void send(null)}>
        אני לא מופיע בתמונה
      </button>
    </>
  );
}

/** The notifications tell the student when the class is photographed and when to pick a number (REQ-11). */
function NotificationsButton() {
  const [state, setState] = useState<"off" | "on" | "failed">(() => (notificationsSupported() && Notification.permission === "granted" ? "on" : "off"));
  if (!notificationsSupported() || state === "on") return null;

  async function enable() {
    try {
      await subscribeToNotifications();
      setState("on");
    } catch {
      setState("failed");
    }
  }

  return (
    <>
      <button className="link" onClick={() => void enable()}>
        <Bell {...ICON} />
        הפעלת התראות
      </button>
      {state === "failed" && (
        <p className="problem" role="alert">
          לא הצלחנו להפעיל התראות בדפדפן הזה.
        </p>
      )}
    </>
  );
}
