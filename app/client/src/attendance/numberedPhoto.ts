import { canvasToJpeg, type StoredPhoto } from "./ClassPhotoStore.ts";

/** A number drawn on a face of the class photo. */
export interface PhotoNumber {
  photoNo: number;
  faceNo: number;
  number: number;
  box: number[];
}

/** A number on every face of the class photo, from left to right, so "number 32" names one face. */
export function numberFaces(boxes: number[][]): PhotoNumber[] {
  return boxes
    .map((box, faceNo) => ({ photoNo: 0, faceNo, box }))
    .sort((a, b) => a.box[0]! + a.box[2]! / 2 - (b.box[0]! + b.box[2]! / 2))
    .map((face, index) => ({ ...face, number: index + 1 }));
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

  const shortSide = Math.min(canvas.width, canvas.height);
  const line = Math.max(2, Math.round(shortSide / 500));
  // Half the face, but never larger than a twentieth of the photo, so labels of neighbours do not cover each other.
  const largestFont = Math.max(16, Math.round(shortSide / 20));
  context.textAlign = "center";
  context.textBaseline = "middle";
  for (const item of numbers) {
    const [x = 0, y = 0, width = 0, height = 0] = item.box;
    context.lineWidth = line;
    context.strokeStyle = FRAME;
    context.strokeRect(x, y, width, height);

    const fontSize = Math.min(largestFont, Math.max(16, Math.round(height * 0.5)));
    context.font = `bold ${fontSize}px sans-serif`;
    const label = String(item.number);
    const labelWidth = context.measureText(label).width + fontSize * 0.5;
    const labelHeight = fontSize * 1.2;
    const left = Math.min(Math.max(0, x + width / 2 - labelWidth / 2), canvas.width - labelWidth);
    // Above the face; below it when the face is at the top edge; inside the frame when neither fits.
    let top = y - labelHeight - line;
    if (top < 0) top = y + height + line;
    if (top + labelHeight > canvas.height) top = Math.max(0, y + line);
    context.fillStyle = LABEL_BACKGROUND;
    context.fillRect(left, top, labelWidth, labelHeight);
    context.fillStyle = FRAME;
    context.fillText(label, left + labelWidth / 2, top + labelHeight / 2);
  }
  return canvasToJpeg(canvas, 0.85);
}
