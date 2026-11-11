import { useEffect, useState, type ChangeEvent } from "react";
import { Ban, Bell, Camera } from "lucide-react";
import type { Person } from "../accounts/session.tsx";
import { callServer } from "../lib/server.ts";
import { supabase } from "../lib/supabase.ts";
import { faceEngine, photoToCanvas } from "./FaceEngine.ts";
import { FaceStore, hashOfPrint } from "./FaceStore.ts";
import { notificationsSupported, subscribeToNotifications } from "./notifications.ts";
import { useTask, useTasks } from "../tasks/BackgroundTasks.tsx";
import { ICON } from "../ui/Icon.tsx";

type Status = { registered: boolean; optedOut: boolean } | null;

class NoFace extends Error {}

/** Finds the largest face in the photo, saves its face-print on this phone and sends only its hash (UC-06). */
async function registerFace(idNumber: string, file: File): Promise<string> {
  const engine = faceEngine();
  await engine.load();
  const canvas = await photoToCanvas(file);
  const faces = await engine.findFaces(canvas);
  if (faces.length === 0) throw new NoFace();
  const largest = faces.reduce((a, b) => (a.box[2] * a.box[3] >= b.box[2] * b.box[3] ? a : b));
  const print = await engine.makePrint(canvas, largest);
  const hash = await hashOfPrint(print);
  const answer = await callServer<{ status: string }>("/faces/register", { hash });
  FaceStore.save(idNumber, print, hash);
  return answer.status;
}

/** Registering a face, opting out and turning on notifications (UC-06). */
export function FacePage({ person }: { person: Person }) {
  const { start } = useTasks();
  const task = useTask("face-register", person.idNumber);
  const [status, setStatus] = useState<Status>(null);
  const [problem, setProblem] = useState("");
  const [done, setDone] = useState("");

  // Registering goes on in the background, so its result shows here even after leaving the page (NFR-13).
  const progress = task?.status === "running" ? "טוען את כלי הזיהוי ומחפש פנים..." : "";
  let registerProblem = "";
  let registerDone = "";
  if (task?.status === "failed") {
    registerProblem = task.error instanceof NoFace ? "לא נמצאו פנים בתמונה. אפשר לצלם תמונה אחרת." : "הרישום נכשל. אפשר לנסות שוב.";
  }
  if (task?.status === "done") registerDone = task.result === "waiting_for_teacher" ? "הבקשה להחלפת הפנים נשלחה למרצה לאישור." : "הפנים נרשמו.";
  const registered = Boolean(status?.registered) || task?.status === "done";

  useEffect(() => {
    void supabase
      .from("my_face_status")
      .select("registered, opted_out")
      .maybeSingle()
      .then(({ data }) => setStatus({ registered: data?.registered ?? false, optedOut: data?.opted_out ?? false }));
  }, []);

  function register(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setProblem("");
    setDone("");
    start(
      {
        kind: "face-register",
        key: person.idNumber,
        scope: "face",
        label: "רישום הפנים",
        doneText: "רישום הפנים הסתיים.",
        failText: "רישום הפנים נכשל.",
        link: "/face",
        stopsOnClose: true,
      },
      () => registerFace(person.idNumber, file),
    );
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
          <h1>רישום פנים</h1>
        </div>
      </header>
      <main className="content narrow stack">
        <p>התמונה וטביעת הפנים נשארות בטלפון הזה. השרת מקבל רק חותמת.</p>
        {registered && <p className="muted">הפנים שלך רשומות. רישום חדש יחכה לאישור של מרצה.</p>}
        <label className="primary big">
          <Camera {...ICON} />
          <span>צילום תמונה</span>
          <input className="hidden-input" type="file" accept="image/*" capture="user" onChange={register} disabled={Boolean(progress)} aria-label="צילום תמונה" />
        </label>
        {progress && <p role="status">{progress}</p>}
        {(done || registerDone) && (
          <p className="saved" role="status">
            {done || registerDone}
          </p>
        )}
        {(problem || registerProblem) && (
          <p className="problem" role="alert">
            {problem || registerProblem}
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
