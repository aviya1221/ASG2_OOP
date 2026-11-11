import { useEffect, useState, type ChangeEvent } from "react";
import { Ban, Bell, Camera } from "lucide-react";
import { Link } from "react-router";
import type { Person } from "../accounts/session.tsx";
import { callServer } from "../lib/server.ts";
import { supabase } from "../lib/supabase.ts";
import { faceEngine, photoToCanvas } from "./FaceEngine.ts";
import { FaceStore, hashOfPrint } from "./FaceStore.ts";
import { notificationsSupported, subscribeToNotifications } from "./notifications.ts";
import { ICON } from "../ui/Icon.tsx";

type Status = { registered: boolean; optedOut: boolean } | null;

/** Registering a face, opting out and turning on notifications (UC-06). */
export function FacePage({ person }: { person: Person }) {
  const [status, setStatus] = useState<Status>(null);
  const [progress, setProgress] = useState("");
  const [problem, setProblem] = useState("");
  const [done, setDone] = useState("");

  useEffect(() => {
    void supabase
      .from("my_face_status")
      .select("registered, opted_out")
      .maybeSingle()
      .then(({ data }) => setStatus({ registered: data?.registered ?? false, optedOut: data?.opted_out ?? false }));
  }, []);

  async function register(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setProblem("");
    setDone("");
    try {
      setProgress("טוען את כלי הזיהוי ומחפש פנים...");
      const engine = faceEngine();
      await engine.load();
      const canvas = await photoToCanvas(file);
      const faces = await engine.findFaces(canvas);
      if (faces.length === 0) {
        setProblem("לא נמצאו פנים בתמונה. אפשר לצלם תמונה אחרת.");
        return;
      }
      const largest = faces.reduce((a, b) => (a.box[2] * a.box[3] >= b.box[2] * b.box[3] ? a : b));
      const print = await engine.makePrint(canvas, largest);
      const hash = await hashOfPrint(print);
      const answer = await callServer<{ status: string }>("/faces/register", { hash });
      FaceStore.save(person.idNumber, print, hash);
      setStatus({ registered: true, optedOut: false });
      setDone(answer.status === "waiting_for_teacher" ? "הבקשה להחלפת הפנים נשלחה למרצה לאישור." : "הפנים נרשמו.");
    } catch {
      setProblem("הרישום נכשל. אפשר לנסות שוב.");
    } finally {
      setProgress("");
    }
  }

  async function optOut() {
    setProblem("");
    try {
      await callServer("/faces/register", { optOut: true });
      setStatus({ registered: false, optedOut: true });
      setDone("בחרת לא להשתתף בזיהוי פנים. הנוכחות תהיה לפי שורה ומושב.");
    } catch {
      setProblem("הבחירה לא נשמרה. אפשר לנסות שוב.");
    }
  }

  async function enableNotifications() {
    setProblem("");
    try {
      await subscribeToNotifications();
      setDone("התראות הופעלו.");
    } catch {
      setProblem("לא הצלחנו להפעיל התראות בדפדפן הזה.");
    }
  }

  return (
    <>
      <header className="band">
        <div className="band-inner">
          <Link className="band-back" to="/">
            כל השיעורים
          </Link>
          <h1>רישום פנים</h1>
        </div>
      </header>
      <main className="content narrow stack">
        <p>התמונה וטביעת הפנים נשארות בטלפון הזה. השרת מקבל רק חותמת.</p>
        {status?.registered && <p className="muted">הפנים שלך רשומות. רישום חדש יחכה לאישור של מרצה.</p>}
        <label className="primary big">
          <Camera {...ICON} />
          <span>צילום תמונה</span>
          <input className="hidden-input" type="file" accept="image/*" capture="user" onChange={register} disabled={Boolean(progress)} aria-label="צילום תמונה" />
        </label>
        {progress && <p role="status">{progress}</p>}
        {done && (
          <p className="saved" role="status">
            {done}
          </p>
        )}
        {problem && (
          <p className="problem" role="alert">
            {problem}
          </p>
        )}
        {!status?.optedOut && (
          <button className="link" onClick={() => void optOut()}>
            <Ban {...ICON} />
            לא להשתתף בזיהוי פנים
          </button>
        )}
        {notificationsSupported() && (
          <button className="link" onClick={() => void enableNotifications()}>
            <Bell {...ICON} />
            הפעלת התראות
          </button>
        )}
      </main>
    </>
  );
}
