/* The face tools have no types, so this file reaches them through `any`. It is the only file that does. */
/* eslint-disable @typescript-eslint/no-explicit-any */

const CONFIDENCE = 0.5;
const MAX_PIXELS = 12_000_000;
const YUNET = "/models/face_detection_yunet_2023mar.onnx";
const OPENCV_SCRIPT = "/vendor/opencv.js";

export interface FoundFace {
  /** x, y, width and height, in pixels of the photo. */
  box: [number, number, number, number];
}

/** Finds the faces in a class photo. It only counts and places faces; it never tells whose face it is. */
export interface FaceEngine {
  load(): Promise<void>;
  findFaces(photo: HTMLCanvasElement): Promise<FoundFace[]>;
}

declare global {
  interface Window {
    cv?: any;
    /** Lets browser tests replace the models. It exists only in development. */
    __fakeFaceEngine?: FaceEngine;
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.appendChild(script);
  });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Returns a wrapper and not the module itself: the module has a then() method, and
// awaiting it would make the browser wait forever.
async function openCvReady(): Promise<{ cv: any }> {
  if (!window.cv) await loadScript(OPENCV_SCRIPT);
  for (let i = 0; i < 1200; i++) {
    const cv = window.cv;
    if (cv?.Mat && typeof cv.FaceDetectorYN === "function") return { cv };
    await sleep(50);
  }
  throw new Error("OpenCV did not start");
}

class OpenCvFaceEngine implements FaceEngine {
  #cv: any;
  #finder: any;
  #loading: Promise<void> | null = null;

  load(): Promise<void> {
    this.#loading ??= this.#load();
    return this.#loading;
  }

  async #load(): Promise<void> {
    const { cv } = await openCvReady();
    this.#cv = cv;

    const yunet = new Uint8Array(await (await fetch(YUNET)).arrayBuffer());
    try {
      cv.FS_unlink("/yunet.onnx");
    } catch {
      // Not there yet.
    }
    cv.FS_createDataFile("/", "yunet.onnx", yunet, true, false, false);
    this.#finder = new cv.FaceDetectorYN("yunet.onnx", "", new cv.Size(320, 320), CONFIDENCE, 0.3, 5000);
  }

  async findFaces(photo: HTMLCanvasElement): Promise<FoundFace[]> {
    await this.load();
    const cv = this.#cv;
    const rgba = cv.imread(photo);
    const bgr = new cv.Mat();
    cv.cvtColor(rgba, bgr, cv.COLOR_RGBA2BGR);
    rgba.delete();
    this.#finder.setInputSize(new cv.Size(bgr.cols, bgr.rows));
    const out = new cv.Mat();
    this.#finder.detect(bgr, out);
    bgr.delete();
    const faces: FoundFace[] = [];
    const data = out.data32F as Float32Array;
    for (let i = 0; i < out.rows; i++) {
      const row = data.subarray(i * 15, i * 15 + 4);
      faces.push({ box: [row[0]!, row[1]!, row[2]!, row[3]!] });
    }
    out.delete();
    return faces;
  }
}

let engine: FaceEngine | null = null;

export function faceEngine(): FaceEngine {
  if (import.meta.env.DEV && window.__fakeFaceEngine) return window.__fakeFaceEngine;
  engine ??= new OpenCvFaceEngine();
  return engine;
}

/** Draws a photo on a canvas, reduced if it is above 12 MP, because OpenCV.js fails above that size. */
export async function photoToCanvas(file: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, Math.sqrt(MAX_PIXELS / (bitmap.width * bitmap.height)));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}
