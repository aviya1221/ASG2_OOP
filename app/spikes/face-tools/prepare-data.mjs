// Builds the two test sets from the downloaded research datasets (see README):
//  - data/wider-subset.json: crowd photos close to a classroom or an auditorium, with every face labelled
//  - data/lfw-subset.json:   people with two different photos (one for "registration", one for "the class photo")
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const DATA = fileURLToPath(new URL('./data/', import.meta.url));

function rng(seed) { // mulberry32: same subset on every run
  return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function shuffle(arr, rand) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// --- Crowd photos (detection) ---
// Event classes that look most like a classroom or an auditorium with rows at different heights.
const CATEGORIES = ['29--Students_Schoolkids', '11--Meeting', '28--Sports_Fan', '9--Press_Conference', '16--Award_Ceremony', '12--Group'];
const PER_CATEGORY = 25;
const MIN_FACES = 8;

const gt = (await readFile(DATA + 'wider_face_split/wider_face_val_bbx_gt.txt', 'utf8')).split(/\r?\n/);
const images = [];
for (let i = 0; i < gt.length;) {
  const name = gt[i++]?.trim(); if (!name) continue;
  const n = parseInt(gt[i++], 10);
  const rows = [];
  for (let k = 0; k < Math.max(n, 1); k++) rows.push(gt[i++].trim().split(/\s+/).map(Number));
  // x1 y1 w h blur expression illumination invalid occlusion pose
  const faces = n === 0 ? [] : rows.filter((r) => r[7] === 0 && r[2] > 0 && r[3] > 0).map((r) => [r[0], r[1], r[2], r[3], r[8]]);
  images.push({ name, cat: name.split('/')[0], faces });
}
const rand = rng(20261106);
const wider = [];
for (const cat of CATEGORIES) {
  const pool = images.filter((im) => im.cat === cat && im.faces.length >= MIN_FACES);
  for (const im of shuffle(pool, rand).slice(0, PER_CATEGORY)) {
    wider.push({ id: im.name, cat, url: '/data/WIDER_val/images/' + im.name.split('/').map(encodeURIComponent).join('/'), faces: im.faces });
  }
}
await writeFile(DATA + 'wider-subset.json', JSON.stringify(wider));
console.log(`crowd photos: ${wider.length} images, ${wider.reduce((s, w) => s + w.faces.length, 0)} labelled faces`);

// --- Labelled faces (recognition at distance) ---
const PEOPLE = 500;
const names = (await readdir(DATA + 'lfw')).sort();
const withTwo = [];
for (const name of names) {
  const files = (await readdir(DATA + 'lfw/' + name)).filter((f) => f.endsWith('.jpg')).sort();
  if (files.length >= 2) withTwo.push({ name, files });
}
const chosen = shuffle(withTwo, rng(7)).slice(0, PEOPLE).map((p) => ({
  name: p.name,
  enroll: `/data/lfw/${encodeURIComponent(p.name)}/${encodeURIComponent(p.files[0])}`,
  probe: `/data/lfw/${encodeURIComponent(p.name)}/${encodeURIComponent(p.files[1])}`,
}));
await writeFile(DATA + 'lfw-subset.json', JSON.stringify(chosen));
console.log(`labelled faces: ${chosen.length} people (of ${withTwo.length} with two or more photos)`);
