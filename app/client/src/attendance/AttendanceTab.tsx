import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { Camera, Check, Download, Send, Share2, X } from "lucide-react";
import { Link } from "react-router";
import { useSession, type Person } from "../accounts/session.tsx";
import { callServer, ServerError, uploadToServer } from "../lib/server.ts";
import { supabase } from "../lib/supabase.ts";
import { downloadSheet, loadSheet, RESULT_LABELS, type SheetRow } from "./AttendanceSheet.ts";
import { canvasToJpeg, ClassPhotoStore, type StoredRound } from "./ClassPhotoStore.ts";
import { faceEngine, photoToCanvas } from "./FaceEngine.ts";
import { countFaces, drawNumbers, numberUnknownFaces, type FaceCount, type FaceSpot } from "./numberedPhoto.ts";
import { useEndedCount, useTask, useTasks } from "../tasks/BackgroundTasks.tsx";
import { ICON, IconButton } from "../ui/Icon.tsx";

const MAX_PHOTOS = 3;
const ROWS = 15;
const SEATS = 20;
const RESULT_KINDS = ["present", "review", "not_found", "conflict", "no_response"];

type Round = { expiresAt: Date } | null | undefined;

/** Reloads when one of these tables changes for this lesson. */
function useLive(lessonId: string, tables: string[], onChange: () => void): void {
  const latest = useRef(onChange);
  latest.current = onChange;
  const joined = tables.join(",");

  useEffect(() => {
    let channel = supabase.channel(`attendance-${lessonId}-${joined}`);
    for (const table of joined.split(",")) {
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `lesson_id=eq.${lessonId}` }, () => latest.current());
    }
    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [lessonId, joined]);
}

function useRound(lessonId: string): [Round, () => void] {
  const [round, setRound] = useState<Round>(undefined);
  const load = useCallback(() => {
    void supabase
      .from("attendance_rounds")
      .select("expires_at")
      .eq("lesson_id", lessonId)
      .maybeSingle()
      .then(({ data }) => setRound(data ? { expiresAt: new Date(data.expires_at) } : null));
  }, [lessonId]);
  useEffect(load, [load]);
  useLive(lessonId, ["attendance_rounds"], load);
  return [round, load];
}

function ResultChip({ kind }: { kind: string }) {
  return <span className={`chip result-${kind}`}>{RESULT_LABELS[kind] ?? kind}</span>;
}

export function AttendanceTab({ lessonId }: { lessonId: string }) {
  const session = useSession();
  if (session.status !== "signed-in") return null;
  return session.person.role === "teacher" ? <TeacherAttendance lessonId={lessonId} /> : <StudentAttendance lessonId={lessonId} person={session.person} />;
}

// ------------------------------------------------------------------ teacher

interface PhotoFaces {
  faces: { box: number[]; print: number[] }[];
}

/** A processed photo: what the server gets, and the photo the phone keeps for the numbers. */
interface ProcessedPhoto extends PhotoFaces {
  jpeg: Blob;
  width: number;
  height: number;
}

function TeacherAttendance({ lessonId }: { lessonId: string }) {
  const [round, reload] = useRound(lessonId);
  // The photos are processed and sent in the background, so the tab reloads when that ends (NFR-13).
  const ended = useEndedCount(lessonId);
  useEffect(reload, [reload, ended]);
  if (round === undefined) return <p>טוען...</p>;
  return round ? <RoundView lessonId={lessonId} expiresAt={round.expiresAt} /> : <PhotoTaker lessonId={lessonId} />;
}

const SEND_ERRORS: Record<string, string> = {
  outside_lesson: "אפשר לצלם רק בזמן השיעור.",
  round_exists: "התמונות של השיעור הזה כבר נשלחו.",
  not_the_teacher: "רק המרצה של השיעור יכול לצלם.",
};

/** Finds the faces in one class photo and makes their face-prints, in the browser. */
async function facesIn(file: File): Promise<ProcessedPhoto> {
  const engine = faceEngine();
  await engine.load();
  const canvas = await photoToCanvas(file);
  const found = await engine.findFaces(canvas);
  const faces: PhotoFaces["faces"] = [];
  for (const face of found) {
    const print = await engine.makePrint(canvas, face);
    faces.push({ box: face.box.map(Math.round), print: Array.from(print) });
  }
  // The reduced photo, so the face boxes fit it exactly when numbers are drawn after the hour.
  return { faces, jpeg: await canvasToJpeg(canvas), width: canvas.width, height: canvas.height };
}

/** Kept only on this phone. A browser that cannot store it loses only the option to share the photo. */
async function keepOnPhone(lessonId: string, photos: ProcessedPhoto[]): Promise<void> {
  try {
    await ClassPhotoStore.save(
      lessonId,
      photos.map(({ jpeg, width, height, faces }) => ({ jpeg, width, height, boxes: faces.map((face) => face.box) })),
    );
  } catch {
    // Nothing to do: the round itself was sent.
  }
}

/** The photos are kept with the background actions, so leaving the tab does not lose them. */
function PhotoTaker({ lessonId }: { lessonId: string }) {
  const { tasks, start, clear } = useTasks();
  const sending = useTask("class-send", lessonId);
  const photoTasks = tasks.filter((task) => task.kind === "class-photo" && task.scope === lessonId);
  const photos = photoTasks.filter((task) => task.status === "done").map((task) => task.result as ProcessedPhoto);
  const link = `/lessons/${lessonId}/attendance`;

  let progress = "";
  if (photoTasks.some((task) => task.status === "running")) progress = "טוען את כלי הזיהוי ומחפש פנים...";
  if (sending?.status === "running") progress = "שולח...";
  let problem = "";
  if (photoTasks.at(-1)?.status === "failed") problem = "לא הצלחנו לעבד את התמונה. אפשר לנסות שוב.";
  if (sending?.status === "failed") {
    problem = SEND_ERRORS[sending.error instanceof ServerError ? sending.error.code : ""] ?? "השליחה נכשלה. אפשר לנסות שוב.";
  }

  function addPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    start(
      {
        kind: "class-photo",
        // A photo that failed is replaced by the next try in the same place.
        key: `${lessonId}-${photos.length + 1}`,
        scope: lessonId,
        label: "עיבוד תמונת הכיתה",
        doneText: "תמונת הכיתה עובדה. אפשר להוסיף תמונה או לשלוח.",
        failText: "עיבוד תמונת הכיתה נכשל.",
        link,
        stopsOnClose: true,
      },
      () => facesIn(file),
    );
  }

  function send() {
    start(
      {
        kind: "class-send",
        key: lessonId,
        scope: lessonId,
        label: "שליחת תמונות הכיתה",
        doneText: "התמונות נשלחו, והסטודנטים מקבלים את התוצאות.",
        failText: "שליחת תמונות הכיתה נכשלה.",
        link,
        stopsOnClose: true,
      },
      async () => {
        // Only the face boxes and face-prints leave the phone.
        await callServer("/attendance/class", { lessonId, photos: photos.map(({ faces }) => ({ faces })) });
        await keepOnPhone(lessonId, photos);
        clear("class-photo", lessonId);
      },
    );
  }

  return (
    <section className="stack">
      <h2 className="visually-hidden">נוכחות</h2>
      {photos.length < MAX_PHOTOS && (
        <label className="primary big">
          <Camera {...ICON} />
          <span>{photos.length === 0 ? "צילום הכיתה" : "הוספת תמונה"}</span>
          <input className="hidden-input" type="file" accept="image/*" capture="environment" onChange={addPhoto} disabled={Boolean(progress)} aria-label="צילום הכיתה" />
        </label>
      )}
      {photos.map((photo, index) => (
        <p key={index} className="card">
          תמונה {index + 1}: נמצאו {photo.faces.length} פנים
        </p>
      ))}
      {progress && <p role="status">{progress}</p>}
      {problem && (
        <p className="problem" role="alert">
          {problem}
        </p>
      )}
      {photos.length > 0 && (
        <button className="primary" onClick={send} disabled={Boolean(progress)}>
          <Send {...ICON} />
          סיום ושליחה
        </button>
      )}
    </section>
  );
}

interface SharedPhoto {
  photoNo: number;
  filePath: string;
  expiresAt: Date;
  removed: boolean;
}

async function loadSharedPhotos(lessonId: string): Promise<SharedPhoto[]> {
  const { data } = await supabase.from("shared_photos").select("photo_no, file_path, expires_at, file_removed").eq("lesson_id", lessonId).order("photo_no");
  return (data ?? []).map((row) => ({ photoNo: row.photo_no, filePath: row.file_path, expiresAt: new Date(row.expires_at), removed: row.file_removed }));
}

function timeOf(date: Date): string {
  return date.toLocaleString("he-IL", { weekday: "long", hour: "2-digit", minute: "2-digit" });
}

/** The shared class photos. A tap opens the full photo, so a face can be enlarged. */
function SharedPhotoList({ photos }: { photos: SharedPhoto[] }) {
  const [urls, setUrls] = useState<string[]>([]);
  const paths = photos.filter((photo) => !photo.removed).map((photo) => photo.filePath);
  const joined = paths.join(",");

  useEffect(() => {
    if (!joined) return;
    void supabase.storage
      .from("class-photos")
      .createSignedUrls(joined.split(","), 3_600)
      .then(({ data }) => setUrls((data ?? []).map((item) => item.signedUrl ?? "")));
  }, [joined]);

  return (
    <div className="class-photos">
      {urls.map((url, index) =>
        url ? (
          <a key={url} href={url} target="_blank" rel="noreferrer">
            <img src={url} alt={`תמונת הכיתה ${index + 1} עם מספרים`} />
          </a>
        ) : null,
      )}
    </div>
  );
}

const SHARE_ERRORS: Record<string, string> = {
  round_open: "אפשר לשתף רק אחרי השעה.",
  already_shared: "התמונה כבר שותפה.",
  identified_face: "התוצאות השתנו. אפשר לפתוח את הלשונית מחדש ולנסות שוב.",
  file_too_large: "התמונה גדולה מדי לשיתוף.",
};

function countText(count: FaceCount): string {
  const unknown = count.unknown === 1 ? "ופרצוף אחד לא זוהה" : `ו־${count.unknown} לא זוהו`;
  return `בתמונות נמצאו ${count.total} פרצופים. ${count.identified} שייכים לסטודנטים שזוהו, ${unknown}.`;
}

/**
 * After the hour the teacher sees how many faces belong to no present student, and may share the photo
 * with a number on each of them. The photo waits only on the phone that took it.
 */
function ClassPhotoShare({ lessonId, hourOver }: { lessonId: string; hourOver: boolean }) {
  const { start } = useTasks();
  const sharing = useTask("class-share", lessonId);
  const ended = useEndedCount(lessonId);
  const [stored, setStored] = useState<StoredRound | null | undefined>(undefined);
  const [identified, setIdentified] = useState<FaceSpot[] | null>(null);
  const [shared, setShared] = useState<SharedPhoto[] | null>(null);
  const [drawn, setDrawn] = useState<{ photoNo: number; jpeg: Blob; url: string }[]>([]);

  const load = useCallback(() => {
    void ClassPhotoStore.load(lessonId)
      .catch(() => null)
      .then(setStored);
    void supabase
      .from("identified_faces")
      .select("photo_no, face_no")
      .eq("lesson_id", lessonId)
      .then(({ data }) => setIdentified((data ?? []).map((row) => ({ photoNo: row.photo_no, faceNo: row.face_no }))));
    void loadSharedPhotos(lessonId).then(setShared);
  }, [lessonId]);
  useEffect(() => {
    if (hourOver) load();
  }, [hourOver, load, ended]);

  const numbers = stored && !stored.dismissed && identified ? numberUnknownFaces(stored.photos, identified) : [];
  const numbersKey = JSON.stringify(numbers);

  useEffect(() => {
    if (!stored || numbers.length === 0 || (shared && shared.length > 0)) return;
    let cancelled = false;
    let made: { photoNo: number; jpeg: Blob; url: string }[] = [];
    void (async () => {
      for (const [photoNo, photo] of stored.photos.entries()) {
        const onPhoto = numbers.filter((item) => item.photoNo === photoNo);
        if (onPhoto.length === 0) continue;
        const jpeg = await drawNumbers(photo, onPhoto);
        made.push({ photoNo, jpeg, url: URL.createObjectURL(jpeg) });
      }
      if (cancelled) made.forEach((item) => URL.revokeObjectURL(item.url));
      else setDrawn(made);
    })();
    return () => {
      cancelled = true;
      made.forEach((item) => URL.revokeObjectURL(item.url));
      made = [];
    };
    // The numbers are compared by value, through their key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stored, numbersKey, shared]);

  if (!hourOver || stored === undefined || identified === null || shared === null) return null;

  if (shared.length > 0) {
    const until = shared[0]!.expiresAt;
    return (
      <div className="stack">
        <h2>תמונת הכיתה עם המספרים</h2>
        <p>{until > new Date() ? `התמונה שותפה עם הסטודנטים שלא זוהו. אפשר לבחור מספר עד ${timeOf(until)}.` : "הזמן לבחירת מספר הסתיים, והתמונה נמחקה."}</p>
        {until > new Date() && <SharedPhotoList photos={shared} />}
      </div>
    );
  }
  if (!stored) return <p className="muted">את תמונת הכיתה עם המספרים אפשר לשתף רק מהמכשיר שצילם אותה.</p>;
  if (stored.dismissed) return <p className="muted">בחרת לא לשתף את תמונת הכיתה.</p>;

  const count = countFaces(stored.photos, numbers);
  if (count.unknown === 0) return <p>בתמונות נמצאו {count.total} פרצופים, וכולם שייכים לסטודנטים שזוהו.</p>;

  function share() {
    start(
      {
        kind: "class-share",
        key: lessonId,
        scope: lessonId,
        label: "שיתוף תמונת הכיתה",
        doneText: "תמונת הכיתה שותפה עם הסטודנטים שלא זוהו.",
        failText: "שיתוף תמונת הכיתה נכשל.",
        link: `/lessons/${lessonId}/attendance`,
        stopsOnClose: true,
      },
      async () => {
        const form = new FormData();
        form.set("lessonId", lessonId);
        form.set("photoNos", JSON.stringify(drawn.map((item) => item.photoNo)));
        form.set("numbers", JSON.stringify(numbers));
        for (const item of drawn) form.append("photos", item.jpeg, `${item.photoNo}.jpg`);
        await uploadToServer("/attendance/photos", form);
        await ClassPhotoStore.remove(lessonId).catch(() => undefined);
      },
    );
  }

  async function dismiss() {
    await ClassPhotoStore.dismiss(lessonId).catch(() => undefined);
    load();
  }

  const busy = sharing?.status === "running";
  const problem = sharing?.status === "failed" ? (SHARE_ERRORS[sharing.error instanceof ServerError ? sharing.error.code : ""] ?? "השיתוף נכשל. אפשר לנסות שוב.") : "";

  return (
    <div className="stack">
      <h2>פרצופים שלא זוהו</h2>
      <p>{countText(count)}</p>
      <p className="muted">אפשר לשתף את התמונה עם מספר על כל פרצוף שלא זוהה. סטודנט שלא זוהה יבחר את המספר שלו, ואת הבחירה מאשרים כאן.</p>
      <div className="class-photos">
        {drawn.map((item) => (
          <a key={item.url} href={item.url} target="_blank" rel="noreferrer">
            <img src={item.url} alt={`תמונה ${item.photoNo + 1} עם מספרים`} />
          </a>
        ))}
      </div>
      {busy && <p role="status">משתף...</p>}
      {problem && (
        <p className="problem" role="alert">
          {problem}
        </p>
      )}
      <div className="actions">
        <button className="primary" onClick={share} disabled={busy || drawn.length === 0}>
          <Share2 {...ICON} />
          שיתוף התמונה עם מספרים
        </button>
        <button onClick={() => void dismiss()} disabled={busy}>
          אין צורך
        </button>
      </div>
    </div>
  );
}

function minutesLeft(expiresAt: Date): number {
  return Math.ceil((expiresAt.getTime() - Date.now()) / 60_000);
}

function RoundView({ lessonId, expiresAt }: { lessonId: string; expiresAt: Date }) {
  const [rows, setRows] = useState<SheetRow[]>([]);
  const [left, setLeft] = useState(() => minutesLeft(expiresAt));

  const load = useCallback(() => {
    void loadSheet(lessonId).then(setRows);
  }, [lessonId]);
  useEffect(load, [load]);
  useLive(lessonId, ["attendance_results", "seat_requests"], load);

  useEffect(() => {
    const timer = setInterval(() => {
      setLeft(minutesLeft(expiresAt));
      load();
    }, 30_000);
    return () => clearInterval(timer);
  }, [expiresAt, load]);

  async function decide(idNumber: string, status: "approved" | "rejected") {
    await supabase.from("seat_requests").update({ status }).eq("lesson_id", lessonId).eq("student_id", idNumber);
    load();
  }

  const requests = rows.filter((row) => row.requestStatus === "pending");

  return (
    <section className="stack">
      <h2>{left > 0 ? `נשארו ${left} דקות לאיסוף תגובות` : "הזמן לאיסוף תגובות הסתיים"}</h2>

      <ul className="chips plain" aria-label="ספירה לפי תוצאה">
        {RESULT_KINDS.map((kind) => (
          <li key={kind} className={`chip result-${kind}`}>
            {RESULT_LABELS[kind]} {rows.filter((row) => row.attendance === kind).length}
          </li>
        ))}
      </ul>

      <ClassPhotoShare lessonId={lessonId} hourOver={left <= 0} />

      <FaceReplacements />

      {requests.length > 0 && (
        <>
          <h2>בקשות שורה ומושב</h2>
          <ul className="stack plain">
            {requests.map((row) => (
              <li key={row.idNumber} className="card request">
                <span>
                  {row.name}: שורה {row.rowNo}, מושב {row.seatNo}
                </span>
                <span className="actions">
                  <IconButton icon={Check} className="approve" label={`אישור הבקשה של ${row.name}`} onClick={() => void decide(row.idNumber, "approved")} />
                  <IconButton icon={X} className="danger" label={`דחיית הבקשה של ${row.name}`} onClick={() => void decide(row.idNumber, "rejected")} />
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="row-between">
        <h2>גיליון נוכחות</h2>
        <button className="primary small" onClick={() => void downloadSheet(rows, `attendance-${lessonId.slice(0, 8)}.xlsx`)}>
          <Download {...ICON} />
          הורדת הגיליון
        </button>
      </div>
      <div className="table-box">
        <table>
          <thead>
            <tr>
              <th>תעודת זהות</th>
              <th>שם</th>
              <th>נוכחות</th>
              <th>הערה</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.idNumber} data-student={row.idNumber}>
                <td dir="ltr">{row.idNumber}</td>
                <td>{row.name}</td>
                <td>{row.attendance ? <ResultChip kind={row.attendance} /> : "ממתין"}</td>
                <td>{row.flagged ? "מסומן" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FaceReplacements() {
  const [pending, setPending] = useState<{ id: string; name: string }[]>([]);

  const load = useCallback(() => {
    void supabase
      .from("face_replacements")
      .select("id, student_id, status, people!face_replacements_student_id_fkey(name)")
      .eq("status", "pending")
      .then(({ data }) => {
        setPending((data ?? []).map((row) => ({ id: row.id as string, name: (row.people as unknown as { name: string }).name })));
      });
  }, []);
  useEffect(load, [load]);

  async function decide(id: string, status: "approved" | "rejected") {
    await supabase.from("face_replacements").update({ status }).eq("id", id);
    load();
  }

  if (pending.length === 0) return null;
  return (
    <>
      <h2>בקשות להחלפת פנים</h2>
      <ul className="stack plain">
        {pending.map((item) => (
          <li key={item.id} className="card request">
            <span>{item.name}</span>
            <span className="actions">
              <IconButton icon={Check} className="approve" label={`אישור ההחלפה של ${item.name}`} onClick={() => void decide(item.id, "approved")} />
              <IconButton icon={X} className="danger" label={`דחיית ההחלפה של ${item.name}`} onClick={() => void decide(item.id, "rejected")} />
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

// ------------------------------------------------------------------ student

interface StudentState {
  result: string | null;
  request: { rowNo: number; seatNo: number; status: string } | null;
  registered: boolean;
  optedOut: boolean;
}

const REQUEST_LABELS: Record<string, string> = { pending: "ממתינה לאישור", approved: "אושרה", rejected: "נדחתה" };

function StudentAttendance({ lessonId, person }: { lessonId: string; person: Person }) {
  const [round] = useRound(lessonId);
  const [state, setState] = useState<StudentState | null>(null);

  const load = useCallback(async () => {
    const [result, request, status] = await Promise.all([
      supabase.from("attendance_results").select("result").eq("lesson_id", lessonId).eq("student_id", person.idNumber).maybeSingle(),
      supabase.from("seat_requests").select("row_no, seat_no, status").eq("lesson_id", lessonId).eq("student_id", person.idNumber).maybeSingle(),
      supabase.from("my_face_status").select("registered, opted_out").maybeSingle(),
    ]);
    setState({
      result: result.data?.result ?? null,
      request: request.data ? { rowNo: request.data.row_no, seatNo: request.data.seat_no, status: request.data.status } : null,
      registered: status.data?.registered ?? false,
      optedOut: status.data?.opted_out ?? false,
    });
  }, [lessonId, person.idNumber]);

  useEffect(() => {
    void load();
  }, [load]);
  useLive(lessonId, ["attendance_results", "seat_requests"], () => void load());

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
  const mayRequest = !state.request && state.result !== "present" && (hourOver || state.optedOut);

  return (
    <section className="stack">
      <h2 className="visually-hidden">נוכחות</h2>
      {state.result ? (
        <p>
          התוצאה שלך: <ResultChip kind={state.result} />
        </p>
      ) : hourOver ? (
        <p>
          התוצאה שלך: <ResultChip kind="no_response" />
        </p>
      ) : state.registered ? (
        <p>הנוכחות נאספת.</p>
      ) : (
        !state.optedOut && <Link to="/face">רישום פנים</Link>
      )}
      {state.request && (
        <p className="card">
          בקשה לשורה {state.request.rowNo}, מושב {state.request.seatNo}: {REQUEST_LABELS[state.request.status]}
        </p>
      )}
      {mayRequest && <SeatPicker lessonId={lessonId} idNumber={person.idNumber} onSent={() => void load()} />}
    </section>
  );
}

function SeatPicker({ lessonId, idNumber, onSent }: { lessonId: string; idNumber: string; onSent: () => void }) {
  const [seat, setSeat] = useState<{ row: number; seat: number } | null>(null);
  const [problem, setProblem] = useState("");

  async function send() {
    if (!seat) return;
    const { error } = await supabase.from("seat_requests").insert({ lesson_id: lessonId, student_id: idNumber, row_no: seat.row, seat_no: seat.seat });
    if (error) {
      setProblem("הבקשה לא נשלחה.");
      return;
    }
    onSent();
  }

  return (
    <>
      <h2>איפה ישבת?</h2>
      <p className="muted">שורה 1 היא הקרובה ללוח, ומושב 1 הוא הקרוב לחלון.</p>
      <div className="hall" role="group" aria-label="מפת האולם">
        <div className="board">לוח</div>
        {Array.from({ length: ROWS }, (_, rowIndex) => (
          <div className="hall-row" key={rowIndex}>
            <span className="hall-number">{rowIndex + 1}</span>
            {Array.from({ length: SEATS }, (_, seatIndex) => {
              const chosen = seat?.row === rowIndex + 1 && seat.seat === seatIndex + 1;
              return (
                <button
                  key={seatIndex}
                  className={chosen ? "seat chosen" : "seat"}
                  aria-label={`שורה ${rowIndex + 1}, מושב ${seatIndex + 1}`}
                  aria-pressed={chosen}
                  onClick={() => setSeat({ row: rowIndex + 1, seat: seatIndex + 1 })}
                >
                  {seatIndex + 1}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {problem && (
        <p className="problem" role="alert">
          {problem}
        </p>
      )}
      <button className="primary" disabled={!seat} onClick={() => void send()}>
        <Send {...ICON} />
        שליחת בקשה
      </button>
    </>
  );
}
