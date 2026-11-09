export interface StoredFace {
  print: number[];
  hash: string;
}

const key = (idNumber: string) => `face-print:${idNumber}`;

/** Keeps the student's face-print on this phone only. */
export const FaceStore = {
  save(idNumber: string, print: Float32Array, hash: string): void {
    localStorage.setItem(key(idNumber), JSON.stringify({ print: Array.from(print), hash }));
  },

  load(idNumber: string): StoredFace | null {
    try {
      const stored = localStorage.getItem(key(idNumber));
      return stored ? (JSON.parse(stored) as StoredFace) : null;
    } catch {
      return null;
    }
  },
};

/** SHA-256 over the bytes of the face-print, in hexadecimal. The server calculates the same. */
export async function hashOfPrint(print: Float32Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(print.buffer as ArrayBuffer, print.byteOffset, print.byteLength));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
