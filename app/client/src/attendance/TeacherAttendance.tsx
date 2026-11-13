import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { Camera, Check, Download, Send, Share2, X } from "lucide-react";
import { callServer, ServerError, uploadToServer } from "../lib/server.ts";
import { supabase } from "../lib/supabase.ts";
import { useEndedCount, useTask, useTasks } from "../tasks/BackgroundTasks.tsx";
import { ICON, IconButton } from "../ui/Icon.tsx";
import { downloadSheet, loadSheet, RESULT_LABELS, type SheetRow } from "./AttendanceSheet.ts";
import { countText, progressText } from "./attendanceText.ts";
import { canvasToJpeg, ClassPhotoStore, type StoredRound } from "./ClassPhotoStore.ts";
import { faceEngine, photoToCanvas } from "./FaceEngine.ts";
import { timeLeft, useClock, useLive, useRound, type Round } from "./live.ts";
import { drawNumbers, numberFaces } from "./numberedPhoto.ts";
import { ResultChip } from "./ResultChip.tsx";
import { loadSharedPhotos, SharedPhotoList, timeOf, type SharedPhoto } from "./SharedPhotos.tsx";

/** The order of the counts above the sheet. */
const RESULT_KINDS = ["present", "absent", "pending", "confirmed", "waiting"];

/** The attendance tab of the teacher (docs/features/F1-attendance-strategy.md). */
export function TeacherAttendance({ lessonId }: { lessonId: string }) {
  const [round, reloadRound] = useRound(lessonId);
  const [rows, setRows] = useState<SheetRow[]>([]);
  const loadRows = useCallback(() => {
    void loadSheet(lessonId).then(setRows);
  }, [lessonId]);
  // The photo is processed and sent in the background, so the tab reloads when that ends (NFR-13).
  const ended = useEndedCount(lessonId);
  useEffect(() => {
    reloadRound();
    loadRows();
  }, [reloadRound, loadRows, ended]);
  useLive(lessonId, ["attendance_confirmations", "number_claims", "attendance_overrides", "shared_photos"], loadRows);

  const now = useClock(round?.expiresAt);
  const open = Boolean(round && round.expiresAt.getTime() > now);
  // When the time to confirm ends, "confirmed" becomes "present" or "pending".
  useEffect(() => {
    if (round && !open) loadRows();
  }, [round, open, loadRows]);

  if (round === undefined) return <p>טוען...</p>;
  return (
    <section className="stack">
      <h2 className="visually-hidden">נוכחות</h2>
      {!round && <PhotoTaker lessonId={lessonId} />}
      {round && open && (
        <div className="stack">
          <h2>נשארו {timeLeft(round.expiresAt, now)} דקות לאישור נוכחות</h2>
          <p>{progressText(round.confirmations, round.faceCount)}</p>
        </div>
      )}
      {round && !open && <AfterConfirming lessonId={lessonId} round={round} />}
      <PicksToDecide lessonId={lessonId} rows={rows} onDecided={loadRows} />
      <AttendanceTable lessonId={lessonId} rows={rows} onChanged={loadRows} />
    </section>
  );
}

// ------------------------------------------------------------------ the photo

const SEND_ERRORS: Record<string, string> = {
  outside_lesson: "אפשר לצלם רק בזמן השיעור.",
  round_exists: "הכיתה של השיעור הזה כבר צולמה.",
  not_the_teacher: "רק המרצה של השיעור יכול לצלם.",
};

/** The class photo as the phone processed it: the face boxes, and the photo they fit. */
interface ProcessedPhoto {
  boxes: number[][];
  jpeg: Blob;
  width: number;
  height: number;
}

/** Finds the faces in the class photo, in the browser. */
async function facesIn(file: File): Promise<ProcessedPhoto> {
  const engine = faceEngine();
  await engine.load();
  const canvas = await photoToCanvas(file);
  const found = await engine.findFaces(canvas);
  // The reduced photo, so the face boxes fit it exactly when numbers are drawn.
  return { boxes: found.map((face) => face.box.map(Math.round)), jpeg: await canvasToJpeg(canvas), width: canvas.width, height: canvas.height };
}

/** Kept only on this phone. A browser that cannot store it loses only the option to share the photo. */
async function keepOnPhone(lessonId: string, photo: ProcessedPhoto): Promise<void> {
  try {
    await ClassPhotoStore.save(lessonId, [photo]);
  } catch {
    // Nothing to do: the face count itself was sent.
  }
}

/** One photo of the class. The work is kept with the background actions, so leaving the tab does not lose it. */
function PhotoTaker({ lessonId }: { lessonId: string }) {
  const { start, clear } = useTasks();
  const processing = useTask("class-photo", lessonId);
  const sending = useTask("class-send", lessonId);
  const photo = processing?.status === "done" ? (processing.result as ProcessedPhoto) : null;
  const link = `/lessons/${lessonId}/attendance`;

  let progress = "";
  if (processing?.status === "running") progress = "טוען את כלי הזיהוי ומחפש פנים...";
  if (sending?.status === "running") progress = "שולח...";
  let problem = "";
  if (processing?.status === "failed") problem = "לא הצלחנו לעבד את התמונה. אפשר לנסות שוב.";
  if (sending?.status === "failed") {
    problem = SEND_ERRORS[sending.error instanceof ServerError ? sending.error.code : ""] ?? "השליחה נכשלה. אפשר לנסות שוב.";
  }

  function takePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    start(
      {
        kind: "class-photo",
        // A photo taken again replaces the first one.
        key: lessonId,
        scope: lessonId,
        label: "עיבוד תמונת הכיתה",
        doneText: "תמונת הכיתה עובדה. אפשר לשלוח את מספר הפרצופים.",
        failText: "עיבוד תמונת הכיתה נכשל.",
        link,
        stopsOnClose: true,
      },
      () => facesIn(file),
    );
  }

  function send() {
    if (!photo) return;
    start(
      {
        kind: "class-send",
        key: lessonId,
        scope: lessonId,
        label: "שליחת מספר הפרצופים",
        doneText: "מספר הפרצופים נשלח. לסטודנטים יש 4 דקות לאשר נוכחות.",
        failText: "שליחת מספר הפרצופים נכשלה.",
        link,
        stopsOnClose: true,
      },
      async () => {
        // Only the number of faces leaves the phone.
        await callServer("/attendance/class", { lessonId, faceCount: photo.boxes.length });
        await keepOnPhone(lessonId, photo);
        clear("class-photo", lessonId);
      },
    );
  }

  return (
    <div className="stack">
      <label className="primary big">
        <Camera {...ICON} />
        <span>{photo ? "צילום מחדש" : "צילום הכיתה"}</span>
        <input className="hidden-input" type="file" accept="image/*" capture="environment" onChange={takePhoto} disabled={Boolean(progress)} aria-label="צילום הכיתה" />
      </label>
      {photo && <p className="card">בתמונה נמצאו {photo.boxes.length} פנים. רק המספר הזה נשלח, והתמונה נשארת בטלפון.</p>}
      {progress && <p role="status">{progress}</p>}
      {problem && (
        <p className="problem" role="alert">
          {problem}
        </p>
      )}
      {photo && (
        <button className="primary" onClick={send} disabled={Boolean(progress)}>
          <Send {...ICON} />
          שליחה ופתיחת האישורים
        </button>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ after the 4 minutes

function AfterConfirming({ lessonId, round }: { lessonId: string; round: Round }) {
  const needsNumbers = round.confirmations > round.faceCount;
  // With no need to share, the photo leaves this phone at once.
  useEffect(() => {
    if (!needsNumbers) void ClassPhotoStore.remove(lessonId).catch(() => undefined);
  }, [lessonId, needsNumbers]);

  return (
    <div className="stack">
      <h2>הזמן לאישור נוכחות הסתיים</h2>
      <p>{countText(round.confirmations, round.faceCount)}</p>
      {needsNumbers && <ClassPhotoShare lessonId={lessonId} />}
    </div>
  );
}

const SHARE_ERRORS: Record<string, string> = {
  round_open: "אפשר לשתף רק אחרי שהזמן לאישור נוכחות הסתיים.",
  already_shared: "התמונה כבר שותפה.",
  no_need: "אין צורך לשתף: לא היו יותר אישורים מפרצופים.",
  file_too_large: "התמונה גדולה מדי לשיתוף.",
};

/**
 * More students confirmed than there are faces, so the teacher shares the photo with a number on every face.
 * The photo waits only on the phone that took it.
 */
function ClassPhotoShare({ lessonId }: { lessonId: string }) {
  const { start } = useTasks();
  const sharing = useTask("class-share", lessonId);
  const ended = useEndedCount(lessonId);
  const [stored, setStored] = useState<StoredRound | null | undefined>(undefined);
  const [shared, setShared] = useState<SharedPhoto[] | null>(null);
  const [drawn, setDrawn] = useState<{ jpeg: Blob; url: string } | null>(null);

  const load = useCallback(() => {
    void ClassPhotoStore.load(lessonId)
      .catch(() => null)
      .then(setStored);
    void loadSharedPhotos(lessonId).then(setShared);
  }, [lessonId]);
  useEffect(load, [load, ended]);

  const photo = stored?.photos[0];
  const alreadyShared = Boolean(shared && shared.length > 0);

  useEffect(() => {
    if (!photo || alreadyShared) return;
    let cancelled = false;
    let url = "";
    void drawNumbers(photo, numberFaces(photo.boxes)).then((jpeg) => {
      if (cancelled) return;
      url = URL.createObjectURL(jpeg);
      setDrawn({ jpeg, url });
    });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [photo, alreadyShared]);

  if (stored === undefined || shared === null) return null;

  if (shared.length > 0) {
    const until = shared[0]!.expiresAt;
    return (
      <div className="stack">
        <h2>תמונת הכיתה עם המספרים</h2>
        <p>{until > new Date() ? `התמונה שותפה עם הסטודנטים שאישרו. אפשר לבחור מספר עד ${timeOf(until)}.` : "הזמן לבחירת מספר הסתיים, והתמונה נמחקה."}</p>
        {until > new Date() && <SharedPhotoList photos={shared} />}
      </div>
    );
  }
  if (!photo) return <p className="muted">את תמונת הכיתה עם המספרים אפשר לשתף רק מהמכשיר שצילם אותה.</p>;

  function share() {
    if (!photo || !drawn) return;
    const numbers = numberFaces(photo.boxes);
    start(
      {
        kind: "class-share",
        key: lessonId,
        scope: lessonId,
        label: "שיתוף תמונת הכיתה",
        doneText: "תמונת הכיתה שותפה עם הסטודנטים שאישרו.",
        failText: "שיתוף תמונת הכיתה נכשל.",
        link: `/lessons/${lessonId}/attendance`,
        stopsOnClose: true,
      },
      async () => {
        const form = new FormData();
        form.set("lessonId", lessonId);
        form.set("photoNos", JSON.stringify([0]));
        form.set("numbers", JSON.stringify(numbers));
        form.append("photos", drawn.jpeg, "0.jpg");
        await uploadToServer("/attendance/photos", form);
        await ClassPhotoStore.remove(lessonId).catch(() => undefined);
      },
    );
  }

  const busy = sharing?.status === "running";
  const problem = sharing?.status === "failed" ? (SHARE_ERRORS[sharing.error instanceof ServerError ? sharing.error.code : ""] ?? "השיתוף נכשל. אפשר לנסות שוב.") : "";

  return (
    <div className="stack">
      <p className="muted">צריך לשתף את התמונה עם מספר על כל פרצוף. כל מי שאישר יבחר את המספר שלו, ומספר ששני סטודנטים בחרו יגיע אליך להחלטה.</p>
      <div className="class-photos">
        {drawn && (
          <a href={drawn.url} target="_blank" rel="noreferrer">
            <img src={drawn.url} alt="תמונת הכיתה עם מספרים" />
          </a>
        )}
      </div>
      {busy && <p role="status">משתף...</p>}
      {problem && (
        <p className="problem" role="alert">
          {problem}
        </p>
      )}
      <button className="primary" onClick={share} disabled={busy || !drawn}>
        <Share2 {...ICON} />
        שיתוף התמונה עם מספרים
      </button>
    </div>
  );
}

// ------------------------------------------------------------------ the teacher decides

/** Two students on one number, and students who say they are not in the photo, wait for the teacher. */
function PicksToDecide({ lessonId, rows, onDecided }: { lessonId: string; rows: SheetRow[]; onDecided: () => void }) {
  const picks = rows.filter((row) => row.claimStatus === "pending" && (row.claimNumber === null || row.claimContested));
  const pickersOf = (number: number | null) => rows.filter((row) => row.claimNumber === number && row.claimStatus === "pending").length;

  async function decide(studentId: string, status: "approved" | "rejected") {
    await supabase.from("number_claims").update({ status }).eq("lesson_id", lessonId).eq("student_id", studentId);
    onDecided();
  }

  if (picks.length === 0) return null;
  return (
    <>
      <h2>בחירות מספר בתמונה</h2>
      <ul className="stack plain">
        {picks.map((row) => (
          <li key={row.studentId} className="card request">
            <span>
              {row.claimNumber === null ? (
                `${row.name}: לא מופיע בתמונה`
              ) : (
                <>
                  {row.name}: מספר {row.claimNumber}
                  <span className="chip contested">
                    {pickersOf(row.claimNumber)} סטודנטים בחרו את מספר {row.claimNumber}
                  </span>
                </>
              )}
            </span>
            <span className="actions">
              <IconButton icon={Check} className="approve" label={`אישור הבחירה של ${row.name}`} onClick={() => void decide(row.studentId, "approved")} />
              <IconButton icon={X} className="danger" label={`דחיית הבחירה של ${row.name}`} onClick={() => void decide(row.studentId, "rejected")} />
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

// ------------------------------------------------------------------ the sheet

/** The teacher's own decision wins over every rule, and "automatic" takes it back. */
const CHOICES = [
  { value: "auto", label: "אוטומטי" },
  { value: "present", label: "נוכח" },
  { value: "absent", label: "לא נוכח" },
];

function choiceOf(row: SheetRow): string {
  if (!row.changedByTeacher) return "auto";
  return row.attendance === "present" ? "present" : "absent";
}

async function changeAttendance(lessonId: string, studentId: string, choice: string): Promise<boolean> {
  const overrides = supabase.from("attendance_overrides");
  const { error } =
    choice === "auto"
      ? await overrides.delete().eq("lesson_id", lessonId).eq("student_id", studentId)
      : await overrides.upsert({ lesson_id: lessonId, student_id: studentId, present: choice === "present" });
  return !error;
}

function AttendanceTable({ lessonId, rows, onChanged }: { lessonId: string; rows: SheetRow[]; onChanged: () => void }) {
  const [problem, setProblem] = useState("");
  const kinds = RESULT_KINDS.filter((kind) => rows.some((row) => row.attendance === kind));

  async function change(row: SheetRow, choice: string) {
    setProblem("");
    if (!(await changeAttendance(lessonId, row.studentId, choice))) setProblem(`השינוי של ${row.name} לא נשמר. אפשר לנסות שוב.`);
    onChanged();
  }

  return (
    <>
      <div className="row-between">
        <h2>גיליון נוכחות</h2>
        <button className="primary small" onClick={() => void downloadSheet(rows, `attendance-${lessonId.slice(0, 8)}.xlsx`)}>
          <Download {...ICON} />
          הורדת הגיליון
        </button>
      </div>
      {kinds.length > 0 && (
        <ul className="chips plain" aria-label="ספירה לפי תוצאה">
          {kinds.map((kind) => (
            <li key={kind} className={`chip result-${kind}`}>
              {RESULT_LABELS[kind]} {rows.filter((row) => row.attendance === kind).length}
            </li>
          ))}
        </ul>
      )}
      {problem && (
        <p className="problem" role="alert">
          {problem}
        </p>
      )}
      <div className="table-box">
        <table className="attendance-table">
          <thead>
            <tr>
              <th>שם</th>
              <th>נוכחות</th>
              <th>שינוי</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.studentId} data-student={row.studentId}>
                <td>
                  {row.name}
                  <div className="email" dir="ltr">
                    {row.email}
                  </div>
                  {row.flagged && <div className="muted">מסומן</div>}
                </td>
                <td>
                  <ResultChip kind={row.attendance} />
                </td>
                <td>
                  <select aria-label={`שינוי הנוכחות של ${row.name}`} value={choiceOf(row)} onChange={(event) => void change(row, event.target.value)}>
                    {CHOICES.map((choice) => (
                      <option key={choice.value} value={choice.value}>
                        {choice.label}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
