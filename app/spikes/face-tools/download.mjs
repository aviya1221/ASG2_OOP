// Downloads the two face models and the two research datasets into models/ and data/ (not committed).
// Usage: node download.mjs        (about 600 MB; uses the system "tar", which also opens .zip files)
import { mkdir, writeFile, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const FILES = [
  ['models/face_detection_yunet_2023mar.onnx', 'https://huggingface.co/opencv/face_detection_yunet/resolve/main/face_detection_yunet_2023mar.onnx'],
  ['models/face_recognition_sface_2021dec.onnx', 'https://huggingface.co/opencv/face_recognition_sface/resolve/main/face_recognition_sface_2021dec.onnx'],
  // WIDER FACE (crowd photos with every face labelled), validation part. License: research, non-commercial.
  ['data/wider_face_split.zip', 'https://huggingface.co/datasets/CUHK-CSE/wider_face/resolve/main/data/wider_face_split.zip'],
  ['data/WIDER_val.zip', 'https://huggingface.co/datasets/CUHK-CSE/wider_face/resolve/main/data/WIDER_val.zip'],
  // Labeled Faces in the Wild (same mirror scikit-learn uses). Research use.
  ['data/lfw.tgz', 'https://ndownloader.figshare.com/files/5976018'],
  ['data/pairs.txt', 'https://ndownloader.figshare.com/files/5976006'],
];

const exists = (p) => access(p).then(() => true, () => false);
await mkdir('models', { recursive: true });
await mkdir('data', { recursive: true });
for (const [path, url] of FILES) {
  if (await exists(path)) { console.log('have', path); continue; }
  console.log('downloading', path);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  await writeFile(path, Buffer.from(await res.arrayBuffer()));
}
for (const archive of ['wider_face_split.zip', 'WIDER_val.zip', 'lfw.tgz']) {
  console.log('extracting', archive);
  execFileSync('tar', ['-xf', archive], { cwd: 'data', stdio: 'inherit' });
}
console.log('done. Next: node prepare-data.mjs');
