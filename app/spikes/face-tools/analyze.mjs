// Turns the raw benchmark results into the numbers for the tools report.
// Usage: node analyze.mjs [--quick]
import { readFile, writeFile, access } from 'node:fs/promises';

const quick = process.argv.includes('--quick');
const TOOLS = ['opencv', 'human', 'human-tiled'];
const LABEL = { opencv: 'OpenCV (YuNet + SFace)', human: 'Human', 'human-tiled': 'Human + tiles' };
const BUCKETS = [[10, 20], [20, 30], [30, 50], [50, 80], [80, Infinity]];
const FAR_TARGET = 0.001;            // one false match in 1,000 comparisons of two different people
const CLASS = quick ? { present: 30, absent: 8, rounds: 200 } : { present: 40, absent: 8, rounds: 500 };
const HALLS = {
  'lecture hall, full-resolution photo (faces 28-80 px)': [80, 60, 45, 35, 28],
  'large hall or reduced photo (faces 16-45 px)': [45, 35, 28, 22, 16],
};

const exists = async (p) => access(p).then(() => true, () => false);
const wider = JSON.parse(await readFile('data/wider-subset.json', 'utf8'));
const gtById = Object.fromEntries(wider.map((w) => [w.id, w.faces]));

function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function sample(arr, n, rand) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, n); }
const pct = (x) => (100 * x).toFixed(1) + '%';
const bucketOf = (h) => BUCKETS.findIndex(([a, b]) => h >= a && h < b);

// ---------- detection on crowd photos ----------
function matchPhoto(gt, dets, thr) {
  const g = gt.map((f) => ({ cx: f[0] + f[2] / 2, cy: f[1] + f[3] / 2, s: Math.max(f[2], f[3]), size: Math.sqrt(f[2] * f[3]), h: f[3], hit: false }));
  let fp = 0;
  for (const d of dets.filter((x) => x[4] >= thr).sort((a, b) => b[4] - a[4])) {
    const cx = d[0] + d[2] / 2, cy = d[1] + d[3] / 2, size = Math.sqrt(d[2] * d[3]);
    let best = -1, bd = Infinity;
    g.forEach((t, i) => {
      if (t.hit) return;
      const dist = Math.hypot(cx - t.cx, cy - t.cy), ratio = size / t.size;
      if (dist <= 0.5 * t.s && ratio >= 0.5 && ratio <= 2.5 && dist < bd) { bd = dist; best = i; }
    });
    if (best >= 0) g[best].hit = true; else fp++;
  }
  return { g, fp };
}

function detectionStats(raw, thr) {
  const hit = BUCKETS.map(() => 0), tot = BUCKETS.map(() => 0);
  let fp = 0, tp = 0, photos = 0, ms = 0;
  for (const r of raw.detection) {
    const { g, fp: f } = matchPhoto(gtById[r.id], r.faces, thr);
    fp += f; photos++; ms += r.ms;
    for (const t of g) { const b = bucketOf(t.h); if (b < 0) continue; tot[b]++; if (t.hit) { hit[b]++; tp++; } }
  }
  const all = tot.reduce((a, b) => a + b, 0);
  return { thr, recall: tp / all, byBucket: hit.map((h, i) => h / (tot[i] || 1)), counts: tot, fpPerPhoto: fp / photos, precision: tp / (tp + fp || 1), msPerPhoto: ms / photos };
}

// ---------- recognition at distance ----------
// Both tools are scored with cosine similarity of length-1 face-prints. For Human this scored
// better than its own distance-based score (checked on the sample), so it gets its best chance.
const unit = (v) => { let s = 0; for (const x of v) s += x * x; s = Math.sqrt(s) || 1; return Float32Array.from(v, (x) => x / s); };
const sim = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };

function recognition(raw) {
  for (const n of Object.keys(raw.enroll)) if (raw.enroll[n]) raw.enroll[n] = unit(raw.enroll[n]);
  for (const S of raw.sizes) for (const n of Object.keys(raw.probes[S])) if (raw.probes[S][n]) raw.probes[S][n] = unit(raw.probes[S][n]);
  const people = Object.keys(raw.enroll).filter((n) => raw.enroll[n]);
  const E = raw.enroll;
  const ref = raw.probes[raw.sizes[0]];
  const imp = [];
  for (const x of people) for (const y of people) if (x !== y && ref[y]) imp.push(sim(E[x], ref[y]));
  imp.sort((a, b) => a - b);
  const tau = imp[Math.min(imp.length - 1, Math.floor((1 - FAR_TARGET) * imp.length))];

  const bySize = {};
  for (const S of raw.sizes) {
    const P = raw.probes[S];
    const found = people.filter((p) => P[p]).length;
    const accepted = people.filter((p) => P[p] && sim(E[p], P[p]) >= tau).length;
    let fa = 0, n = 0;
    for (const x of people) for (const y of people) if (x !== y && P[y]) { n++; if (sim(E[x], P[y]) >= tau) fa++; }
    bySize[S] = { found: found / people.length, tar: accepted / people.length, far: fa / (n || 1) };
  }

  // A whole class: some present (their faces are in the photo at the given sizes), some absent.
  function simulateClass(sizesForRows, seed) {
    const rand = rng(seed);
    const out = { correct: 0, review: 0, wrong: 0, present: 0, absentFalse: 0, absentReview: 0, absent: 0 };
    for (let r = 0; r < CLASS.rounds; r++) {
      const chosen = sample(people, CLASS.present + CLASS.absent, rand);
      const present = chosen.slice(0, CLASS.present), absent = chosen.slice(CLASS.present);
      const faces = [];
      for (const p of present) {
        const S = sizesForRows[Math.floor(rand() * sizesForRows.length)];
        if (raw.probes[S][p]) faces.push({ owner: p, emb: raw.probes[S][p] });
      }
      const claim = {};
      for (const s of chosen) {
        let best = -1, bs = -Infinity;
        faces.forEach((f, i) => { const v = sim(E[s], f.emb); if (v > bs) { bs = v; best = i; } });
        if (best >= 0 && bs >= tau) claim[s] = best;
      }
      const claimers = {};
      for (const [s, f] of Object.entries(claim)) (claimers[f] ||= []).push(s);
      for (const s of present) {
        out.present++;
        if (!(s in claim) || claimers[claim[s]].length > 1) out.review++;
        else if (faces[claim[s]].owner === s) out.correct++;
        else out.wrong++;
      }
      for (const s of absent) {
        out.absent++;
        if (!(s in claim)) continue;
        if (claimers[claim[s]].length > 1) out.absentReview++; else out.absentFalse++;
      }
    }
    return {
      presentCorrect: out.correct / out.present, presentReview: out.review / out.present, presentWrong: out.wrong / out.present,
      absentMarkedPresent: out.absentFalse / out.absent, absentToReview: out.absentReview / out.absent,
    };
  }

  const halls = {};
  let seed = 11;
  for (const [name, sizes] of Object.entries(HALLS)) halls[name] = simulateClass(sizes.filter((s) => raw.sizes.includes(s)), seed++);
  const perSize = {};
  for (const S of raw.sizes) perSize[S] = simulateClass([S], 100 + S);
  return { people: people.length, tau, bySize, halls, perSize };
}

// ---------- run ----------
const summary = {};
for (const tool of TOOLS) {
  const file = `results/raw-${tool}${quick ? '-quick' : ''}.json`;
  if (!(await exists(file))) { console.log(`(no results yet for ${tool})`); continue; }
  const raw = JSON.parse(await readFile(file, 'utf8'));
  const sweep = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9].map((t) => detectionStats(raw, t));
  const timing = raw.timing.map((t) => t.ms / Math.max(1, t.faces));
  const probePerFace = Object.fromEntries(raw.sizes.map((S) => [S, raw.probeMs[S] / Math.max(1, Object.values(raw.probes[S]).filter(Boolean).length)]));
  summary[tool] = {
    info: raw.info, sweep, recognition: recognition(raw),
    timing: {
      crowdPhotoFindMs: sweep[0].msPerPhoto,
      fullJobMsPerFace: timing.reduce((a, b) => a + b, 0) / (timing.length || 1),
      fullJobPhotos: raw.timing,
      probeMsPerFace: probePerFace,
    },
  };
}
await writeFile(`results/summary${quick ? '-quick' : ''}.json`, JSON.stringify(summary, null, 2));

// ---------- print ----------
const lines = [];
const p = (s = '') => { lines.push(s); console.log(s); };
p(`# Face tools benchmark${quick ? ' (quick sample)' : ''}`);
for (const [tool, s] of Object.entries(summary)) p(`- **${LABEL[tool]}**: ${s.info}`);
p();
p('## 1. Finding faces in crowd photos (classroom, meeting, audience)');
p(`${wider.length} photos, faces counted from 10 px up. Operating point per tool: the lowest confidence with precision >= 90% (or 0.9).`);
p();
p('| Tool | Confidence | Found 10-20 px | 20-30 | 30-50 | 50-80 | 80+ | All | False finds per photo | Time per photo |');
p('|---|---|---|---|---|---|---|---|---|---|');
for (const [tool, s] of Object.entries(summary)) {
  const op = s.sweep.find((x) => x.precision >= 0.9) || s.sweep[s.sweep.length - 1];
  s.operating = op;
  p(`| ${LABEL[tool]} | ${op.thr} | ${op.byBucket.map(pct).join(' | ')} | ${pct(op.recall)} | ${op.fpPerPhoto.toFixed(1)} | ${(op.msPerPhoto / 1000).toFixed(1)} s |`);
}
p();
p('## 2. Recognising the same person when the face gets smaller (distance)');
p(`Registration photo at full size; the second photo of the same person shrunk to the given face height inside a large picture. Threshold fixed per tool so that two different people match only ${FAR_TARGET * 100}% of the time at full size.`);
p();
const sizes = Object.values(summary)[0]?.recognition ? Object.keys(Object.values(summary)[0].recognition.bySize) : [];
p(`| Tool | ${sizes.map((s) => s + ' px').join(' | ')} |`);
p(`|---|${sizes.map(() => '---').join('|')}|`);
for (const [tool, s] of Object.entries(summary)) p(`| ${LABEL[tool]}: recognised | ${sizes.map((S) => pct(s.recognition.bySize[S].tar)).join(' | ')} |`);
for (const [tool, s] of Object.entries(summary)) p(`| ${LABEL[tool]}: face found | ${sizes.map((S) => pct(s.recognition.bySize[S].found)).join(' | ')} |`);
for (const [tool, s] of Object.entries(summary)) p(`| ${LABEL[tool]}: false match | ${sizes.map((S) => (100 * s.recognition.bySize[S].far).toFixed(2) + '%').join(' | ')} |`);
p();
p(`## 3. A whole class with our rules (${CLASS.present} present, ${CLASS.absent} absent, ${CLASS.rounds} simulated lessons)`);
p();
p('| Tool | Hall | Present: marked automatically | Present: to review | Present: matched to someone else | Absent: marked present by mistake |');
p('|---|---|---|---|---|---|');
for (const [tool, s] of Object.entries(summary)) {
  for (const [hall, h] of Object.entries(s.recognition.halls)) p(`| ${LABEL[tool]} | ${hall} | ${pct(h.presentCorrect)} | ${pct(h.presentReview)} | ${pct(h.presentWrong)} | ${pct(h.absentMarkedPresent)} |`);
}
p();
p('## 4. Speed on this laptop (Intel UHD graphics, 8 cores)');
p();
p('| Tool | Find faces in a crowd photo | Full job per face (find + face-print) |');
p('|---|---|---|');
for (const [tool, s] of Object.entries(summary)) p(`| ${LABEL[tool]} | ${(s.timing.crowdPhotoFindMs / 1000).toFixed(2)} s | ${Math.round(s.timing.fullJobMsPerFace)} ms |`);
await writeFile(`results/summary${quick ? '-quick' : ''}.md`, lines.join('\n') + '\n');
