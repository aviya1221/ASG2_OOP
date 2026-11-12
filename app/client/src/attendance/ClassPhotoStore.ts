/**
 * The class photos of a lesson, kept only on the teacher's phone. After the hour the teacher may share
 * them with numbers on the faces nobody was matched to; until then they never leave the phone.
 * They are deleted when shared, when the teacher decides not to share, or a day after the hour.
 */

/** One photo as the face engine saw it, so the face boxes fit it exactly. */
export interface StoredPhoto {
  jpeg: Blob;
  width: number;
  height: number;
  boxes: number[][];
}

export interface StoredRound {
  lessonId: string;
  savedAt: number;
  /** The teacher decided not to share, so only this mark is left. */
  dismissed: boolean;
  photos: StoredPhoto[];
}

interface SavedPhoto {
  jpeg: ArrayBuffer;
  width: number;
  height: number;
  boxes: number[][];
}

interface SavedRound {
  lessonId: string;
  savedAt: number;
  dismissed: boolean;
  photos: SavedPhoto[];
}

const DB_NAME = "class-photos";
const STORE = "rounds";
/** The hour of the round, and the day in which students may pick a number. */
const KEEP_MS = 25 * 3_600_000;

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function openDb(): Promise<IDBDatabase> {
  const req = indexedDB.open(DB_NAME, 1);
  req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "lessonId" });
  return request(req);
}

async function withStore<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await request(work(db.transaction(STORE, mode).objectStore(STORE)));
  } finally {
    db.close();
  }
}

/** Blobs are kept as plain bytes, which every browser can store. */
async function toSaved(round: StoredRound): Promise<SavedRound> {
  const photos = await Promise.all(round.photos.map(async (photo) => ({ ...photo, jpeg: await photo.jpeg.arrayBuffer() })));
  return { ...round, photos };
}

function fromSaved(round: SavedRound): StoredRound {
  return { ...round, photos: round.photos.map((photo) => ({ ...photo, jpeg: new Blob([photo.jpeg], { type: "image/jpeg" }) })) };
}

export const ClassPhotoStore = {
  async save(lessonId: string, photos: StoredPhoto[]): Promise<void> {
    const saved = await toSaved({ lessonId, savedAt: Date.now(), dismissed: false, photos });
    await withStore("readwrite", (store) => store.put(saved));
  },

  /** The photos of this lesson on this phone, or null. Old rounds are deleted on the way. */
  async load(lessonId: string): Promise<StoredRound | null> {
    const all = await withStore<SavedRound[]>("readonly", (store) => store.getAll());
    const old = all.filter((round) => Date.now() - round.savedAt > KEEP_MS);
    for (const round of old) await ClassPhotoStore.remove(round.lessonId);
    const round = all.find((item) => item.lessonId === lessonId && !old.includes(item));
    return round ? fromSaved(round) : null;
  },

  /** Deletes the photos and remembers that the teacher chose not to share them. */
  async dismiss(lessonId: string): Promise<void> {
    await withStore("readwrite", (store) => store.put({ lessonId, savedAt: Date.now(), dismissed: true, photos: [] } satisfies SavedRound));
  },

  async remove(lessonId: string): Promise<void> {
    await withStore("readwrite", (store) => store.delete(lessonId));
  },
};

export function canvasToJpeg(canvas: HTMLCanvasElement, quality = 0.9): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("The photo could not be saved."))), "image/jpeg", quality);
  });
}
