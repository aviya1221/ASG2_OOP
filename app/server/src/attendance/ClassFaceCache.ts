import type { ClassFace } from "./types.ts";

/** Keeps the faces of a round in memory, so a response does not read them from the database. */
export class ClassFaceCache {
  readonly #entries = new Map<string, { faces: ClassFace[]; expiresAt: number }>();
  readonly #now: () => number;

  constructor(now: () => number = Date.now) {
    this.#now = now;
  }

  get(lessonId: string): ClassFace[] | undefined {
    const entry = this.#entries.get(lessonId);
    if (!entry) return undefined;
    if (this.#now() >= entry.expiresAt) {
      this.#entries.delete(lessonId);
      return undefined;
    }
    return entry.faces;
  }

  put(lessonId: string, faces: ClassFace[], expiresAt: Date): void {
    for (const [id, entry] of this.#entries) {
      if (this.#now() >= entry.expiresAt) this.#entries.delete(id);
    }
    this.#entries.set(lessonId, { faces, expiresAt: expiresAt.getTime() });
  }
}
