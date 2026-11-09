/* The face tools have no types, so this file reaches them through `any`. It is the only file that does. */
/* eslint-disable @typescript-eslint/no-explicit-any */

const CONFIDENCE = 0.5;
const MAX_PIXELS = 12_000_000;
const ALIGNED_SIZE = 112;
const YUNET = "/models/face_detection_yunet_2023mar.onnx";
const SFACE = "/models/face_recognition_sface_2021dec.onnx";
const OPENCV_SCRIPT = "/vendor/opencv.js";
const ORT_FOLDER = "/vendor/ort/";

// The standard 112 by 112 five-point template that SFace was trained with.
const TEMPLATE = [38.2946, 51.6963, 73.5318, 51.5014, 56.0252, 71.7366, 41.5493, 92.3655, 70.7299, 92.2041];

export interface FoundFace {
  /** x, y, width and height, in pixels of the photo. */
  box: [number, number, number, number];
  /** Five points, as x and y in turn. */
  landmarks: number[];
}

export interface FaceEngine {
  load(): Promise<void>;
  findFaces(photo: HTMLCanvasElement): Promise<FoundFace[]>;
  makePrint(photo: HTMLCanvasElement, face: FoundFace): Promise<Float32Array>;
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

/** The scale, rotation and shift that move the five face points onto the template. */
function similarityTransform(src: number[]): number[] {
  let meanSx = 0;
  let meanSy = 0;
  let meanDx = 0;
  let meanDy = 0;
  for (let i = 0; i < 5; i++) {
    meanSx += src[2 * i]!;
    meanSy += src[2 * i + 1]!;
    meanDx += TEMPLATE[2 * i]!;
    meanDy += TEMPLATE[2 * i + 1]!;
  }
  meanSx /= 5;
  meanSy /= 5;
  meanDx /= 5;
  meanDy /= 5;
  let na = 0;
  let nb = 0;
  let den = 0;
  for (let i = 0; i < 5; i++) {
    const sx = src[2 * i]! - meanSx;
    const sy = src[2 * i + 1]! - meanSy;
    const dx = TEMPLATE[2 * i]! - meanDx;
    const dy = TEMPLATE[2 * i + 1]! - meanDy;
    na += sx * dx + sy * dy;
    nb += sx * dy - sy * dx;
    den += sx * sx + sy * sy;
  }
  const a = na / den;
  const b = nb / den;
  return [a, -b, meanDx - (a * meanSx - b * meanSy), b, a, meanDy - (b * meanSx + a * meanSy)];
}

class OpenCvFaceEngine implements FaceEngine {
  #cv: any;
  #finder: any;
  #ort: any;
  #session: any;
  #loading: Promise<void> | null = null;
  #current: { photo: HTMLCanvasElement; bgr: any } | null = null;

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

    const ort = await import(/* @vite-ignore */ `${ORT_FOLDER}ort.wasm.min.mjs`);
    ort.env.wasm.wasmPaths = ORT_FOLDER;
    ort.env.logLevel = "error";
    this.#ort = ort;
    this.#session = await ort.InferenceSession.create(SFACE, { executionProviders: ["wasm"] });
  }

  #bgrOf(photo: HTMLCanvasElement): any {
    if (this.#current?.photo === photo) return this.#current.bgr;
    this.#current?.bgr.delete();
    const cv = this.#cv;
    const rgba = cv.imread(photo);
    const bgr = new cv.Mat();
    cv.cvtColor(rgba, bgr, cv.COLOR_RGBA2BGR);
    rgba.delete();
    this.#current = { photo, bgr };
    return bgr;
  }

  async findFaces(photo: HTMLCanvasElement): Promise<FoundFace[]> {
    await this.load();
    const cv = this.#cv;
    const bgr = this.#bgrOf(photo);
    this.#finder.setInputSize(new cv.Size(bgr.cols, bgr.rows));
    const out = new cv.Mat();
    this.#finder.detect(bgr, out);
    const faces: FoundFace[] = [];
    const data = out.data32F as Float32Array;
    for (let i = 0; i < out.rows; i++) {
      const row = data.subarray(i * 15, i * 15 + 15);
      faces.push({ box: [row[0]!, row[1]!, row[2]!, row[3]!], landmarks: Array.from(row.subarray(4, 14)) });
    }
    out.delete();
    return faces;
  }

  async makePrint(photo: HTMLCanvasElement, face: FoundFace): Promise<Float32Array> {
    await this.load();
    const cv = this.#cv;
    const matrix = cv.matFromArray(2, 3, cv.CV_64F, similarityTransform(face.landmarks));
    const aligned = new cv.Mat();
    cv.warpAffine(this.#bgrOf(photo), aligned, matrix, new cv.Size(ALIGNED_SIZE, ALIGNED_SIZE), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());

    const pixels = aligned.data as Uint8Array;
    const count = ALIGNED_SIZE * ALIGNED_SIZE;
    const tensor = new Float32Array(3 * count);
    for (let i = 0; i < count; i++) {
      tensor[i] = pixels[3 * i + 2]!;
      tensor[count + i] = pixels[3 * i + 1]!;
      tensor[2 * count + i] = pixels[3 * i]!;
    }
    matrix.delete();
    aligned.delete();

    const input = this.#session.inputNames[0];
    const result = await this.#session.run({ [input]: new this.#ort.Tensor("float32", tensor, [1, 3, ALIGNED_SIZE, ALIGNED_SIZE]) });
    const print = Float32Array.from(result[this.#session.outputNames[0]].data as Float32Array);
    let length = 0;
    for (const value of print) length += value * value;
    length = Math.sqrt(length) || 1;
    for (let i = 0; i < print.length; i++) print[i]! /= length;
    return print;
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
