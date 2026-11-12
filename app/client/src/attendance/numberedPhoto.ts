import { canvasToJpeg, type StoredPhoto } from "./ClassPhotoStore.ts";

/** One face in one photo of the round. */
export interface FaceSpot {
  photoNo: number;
  faceNo: number;
}

/** A number drawn on a face that belongs to no present student. */
export interface PhotoNumber extends FaceSpot {
  number: number;
  box: number[];
}

export interface FaceCount {
  total: number;
  identified: number;
  unknown: number;
}

const key = (spot: FaceSpot) => `${spot.photoNo}:${spot.faceNo}`;

/**
 * Gives a number to every face that belongs to no present student. The numbers run across all the photos,
 * and inside a photo from left to right, so "number 32" names one face in the whole lesson.
 */
export function numberUnknownFaces(photos: { boxes: number[][] }[], identified: FaceSpot[]): PhotoNumber[] {
  const known = new Set(identified.map(key));
  const numbers: PhotoNumber[] = [];
  photos.forEach((photo, photoNo) => {
    const unknown = photo.boxes
      .map((box, faceNo) => ({ photoNo, faceNo, box }))
      .filter((face) => !known.has(key(face)))
      .sort((a, b) => a.box[0]! + a.box[2]! / 2 - (b.box[0]! + b.box[2]! / 2));
    for (const face of unknown) numbers.push({ ...face, number: numbers.length + 1 });
  });
  return numbers;
}

export function countFaces(photos: { boxes: number[][] }[], numbers: PhotoNumber[]): FaceCount {
  const total = photos.reduce((sum, photo) => sum + photo.boxes.length, 0);
  return { total, identified: total - numbers.length, unknown: numbers.length };
}

const FRAME = "#ffd400";
const LABEL_BACKGROUND = "#111111";

async function imageOf(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** The photo with a frame and a number on each of these faces. It is drawn on the teacher's phone. */
export async function drawNumbers(photo: StoredPhoto, numbers: PhotoNumber[]): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = photo.width;
  canvas.height = photo.height;
  const context = canvas.getContext("2d")!;
  context.drawImage(await imageOf(photo.jpeg), 0, 0, canvas.width, canvas.height);

  const line = Math.max(2, Math.round(Math.min(canvas.width, canvas.height) / 500));
  context.textAlign = "center";
  context.textBaseline = "middle";
  for (const item of numbers) {
    const [x = 0, y = 0, width = 0, height = 0] = item.box;
    context.lineWidth = line;
    context.strokeStyle = FRAME;
    context.strokeRect(x, y, width, height);

    const fontSize = Math.max(16, Math.round(height * 0.7));
    context.font = `bold ${fontSize}px sans-serif`;
    const label = String(item.number);
    const labelWidth = context.measureText(label).width + fontSize * 0.5;
    const labelHeight = fontSize * 1.2;
    const left = Math.min(Math.max(0, x + width / 2 - labelWidth / 2), canvas.width - labelWidth);
    // Above the face, or below it when the face is at the top edge of the photo.
    const top = y - labelHeight - line >= 0 ? y - labelHeight - line : y + height + line;
    context.fillStyle = LABEL_BACKGROUND;
    context.fillRect(left, top, labelWidth, labelHeight);
    context.fillStyle = FRAME;
    context.fillText(label, left + labelWidth / 2, top + labelHeight / 2);
  }
  return canvasToJpeg(canvas, 0.85);
}
