/**
 * Puts the face tools where the web page can load them: OpenCV.js and ONNX Runtime from
 * node_modules, and the two models from their public source. The files are not committed.
 */
import { createWriteStream, existsSync, statSync } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const client = dirname(dirname(fileURLToPath(import.meta.url)));
const modules = join(client, "node_modules");
const vendor = join(client, "public", "vendor");
const models = join(client, "public", "models");

const COPIES = [
  [join(modules, "@techstark/opencv-js/dist/opencv.js"), join(vendor, "opencv.js")],
  [join(modules, "onnxruntime-web/dist/ort.wasm.min.mjs"), join(vendor, "ort", "ort.wasm.min.mjs")],
  [join(modules, "onnxruntime-web/dist/ort-wasm-simd-threaded.mjs"), join(vendor, "ort", "ort-wasm-simd-threaded.mjs")],
  [join(modules, "onnxruntime-web/dist/ort-wasm-simd-threaded.wasm"), join(vendor, "ort", "ort-wasm-simd-threaded.wasm")],
];

const MODELS = [
  { name: "face_detection_yunet_2023mar.onnx", size: 232_589, url: "https://huggingface.co/opencv/face_detection_yunet/resolve/main/face_detection_yunet_2023mar.onnx" },
  { name: "face_recognition_sface_2021dec.onnx", size: 38_696_353, url: "https://huggingface.co/opencv/face_recognition_sface/resolve/main/face_recognition_sface_2021dec.onnx" },
];

await mkdir(join(vendor, "ort"), { recursive: true });
await mkdir(models, { recursive: true });

for (const [from, to] of COPIES) await copyFile(from, to);

for (const model of MODELS) {
  const target = join(models, model.name);
  if (existsSync(target) && statSync(target).size === model.size) continue;

  const local = join(client, "..", "spikes", "face-tools", "models", model.name);
  if (existsSync(local) && statSync(local).size === model.size) {
    await copyFile(local, target);
    continue;
  }

  console.log(`Downloading ${model.name}`);
  const response = await fetch(model.url);
  if (!response.ok) throw new Error(`Could not download ${model.name}: ${response.status}`);
  await pipeline(Readable.fromWeb(response.body), createWriteStream(target));
  if (statSync(target).size !== model.size) throw new Error(`${model.name} has the wrong size`);
}
