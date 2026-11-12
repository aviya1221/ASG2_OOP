import type { ClassFace, FaceMatch } from "./types.ts";

function cosine(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  const norm = Math.sqrt(normA * normB);
  return norm === 0 ? 0 : dot / norm;
}

export class FaceMatcher {
  /** The face most similar to this face-print, across all the photos of the round. */
  best(print: ArrayLike<number>, faces: ClassFace[]): FaceMatch | null {
    let best: FaceMatch | null = null;
    for (const face of faces) {
      const score = cosine(print, face.print);
      if (!best || score > best.score) best = { photoNo: face.photoNo, faceNo: face.faceNo, score };
    }
    return best;
  }

  /** The most similar face in each photo, so a student seen in two photos is known in both. */
  bestInEachPhoto(print: ArrayLike<number>, faces: ClassFace[]): FaceMatch[] {
    const byPhoto = new Map<number, FaceMatch>();
    for (const face of faces) {
      const score = cosine(print, face.print);
      const best = byPhoto.get(face.photoNo);
      if (!best || score > best.score) byPhoto.set(face.photoNo, { photoNo: face.photoNo, faceNo: face.faceNo, score });
    }
    return [...byPhoto.values()].sort((a, b) => a.photoNo - b.photoNo);
  }
}
