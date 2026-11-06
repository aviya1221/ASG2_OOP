// One complete example of the attendance flow, end to end, with option 1 (OpenCV YuNet + SFace):
//  - a simulated lecture hall photo: tiered rows, far rows smaller, 25 registered students, 3 guests, empty seats
//  - a registration set: 30 photos (the 25 present students + 5 who are absent)
//  - the matching with our rules, drawn on the photo, and the class list with a result per student
// People are taken from labelled faces that the benchmark did not use (subset entries 300-499).
// Output (dataset images, not committed): results/demo-class/
// Usage: node make-demo-set.mjs   (after run-bench.mjs and analyze.mjs)
import { chromium } from 'playwright-core';
import { readFile, writeFile, mkdir, copyFile, rm } from 'node:fs/promises';
import { startServer } from './serve.mjs';

const OUT = 'results/demo-class/';
const all = JSON.parse(await readFile('data/lfw-subset.json', 'utf8'));
const summary = JSON.parse(await readFile('results/summary.json', 'utf8'));
const TAU = summary.opencv.recognition.tau;
const MIN_SCORE = 0.5; // face-finder confidence chosen in the benchmark

function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rand = rng(2026);
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const fresh = shuffle(all.slice(300));
const present = fresh.slice(0, 25), absent = fresh.slice(25, 30), guests = fresh.slice(30, 33);
const nice = (n) => n.replace(/_/g, ' ');

// Hall: rows from the back (top, small faces) to the front (bottom, big faces).
const W = 3200, H = 2000;
const ROWS = [
  { y: 560, face: 26, seats: 8, span: 1500 },
  { y: 770, face: 32, seats: 7, span: 1750 },
  { y: 1010, face: 40, seats: 7, span: 2000 },
  { y: 1280, face: 50, seats: 6, span: 2300 },
  { y: 1580, face: 64, seats: 5, span: 2600 },
  { y: 1900, face: 84, seats: 4, span: 2900 },
];
const seats = [];
ROWS.forEach((r, ri) => { for (let i = 0; i < r.seats; i++) seats.push({ row: ROWS.length - ri, seat: i + 1, x: W / 2 - r.span / 2 + (r.span * (i + 0.5)) / r.seats, y: r.y, face: r.face }); });
const occupants = shuffle([...present.map((p) => ({ ...p, kind: 'student' })), ...guests.map((p) => ({ ...p, kind: 'guest' }))]);
const seatOrder = shuffle(seats.map((_, i) => i)).slice(0, occupants.length).sort((a, b) => a - b);
seatOrder.forEach((si, k) => { seats[si].who = occupants[k]; });

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT + 'registration', { recursive: true });
for (const p of [...present, ...absent]) await copyFile('data' + decodeURIComponent(p.enroll).slice('/data'.length), `${OUT}registration/${p.name}.jpg`);

const server = await startServer({ port: 8791 });
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: 2000, height: 1400 } });
await page.goto('http://127.0.0.1:8791/bench.html');

const result = await page.evaluate(async ({ W, H, ROWS, seats, registry, TAU, MIN_SCORE }) => {
  const { createOpenCV, loadImage, toCanvas, drawShrunk } = await import('/lab.js');
  const R = (() => { let s = 7; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();

  // ---- 1. draw the hall ----
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const wall = ctx.createLinearGradient(0, 0, 0, H); wall.addColorStop(0, '#CFC6B4'); wall.addColorStop(1, '#8E8574');
  ctx.fillStyle = wall; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#2F3A33'; ctx.fillRect(W / 2 - 520, 90, 1040, 300); // a board on the back wall
  ctx.fillStyle = '#E8E1D0'; ctx.fillRect(W * 0.08, 140, 260, 180); ctx.fillRect(W * 0.84, 140, 260, 180); // windows
  const shirts = ['#3E5C8A', '#8A3E3E', '#3E7A55', '#6B5A8A', '#B07A2E', '#2E2E2E', '#7A7A7A', '#C9C2B0', '#284B63', '#9C4F6B'];
  for (const r of ROWS) { // tier platform
    const top = r.y + r.face * 1.2, h = r.face * 2.2;
    ctx.fillStyle = 'rgba(60,48,36,.35)'; ctx.fillRect(W / 2 - r.span / 2 - r.face * 2, top, r.span + r.face * 4, h);
  }
  for (const r of ROWS) {
    for (const s of seats.filter((q) => q.y === r.y)) {
      const F = r.face, k = F / 114;
      if (s.who) {
        ctx.fillStyle = shirts[Math.floor(R() * shirts.length)];
        ctx.beginPath(); ctx.ellipse(s.x, s.y + F * 1.35, F * 1.15, F * 0.8, 0, 0, Math.PI * 2); ctx.fill();
        const img = await loadImage(s.who.probe);
        const dw = Math.round(140 * k), dh = Math.round(170 * k);
        const t = document.createElement('canvas'); t.width = dw; t.height = dh;
        drawShrunk(t.getContext('2d'), img, 55, 35, 140, 170, 0, 0, dw, dh);
        ctx.save(); ctx.beginPath(); ctx.ellipse(s.x, s.y - 4 * k, 62 * k, 82 * k, 0, 0, Math.PI * 2); ctx.clip();
        ctx.drawImage(t, s.x - 70 * k, s.y - 85 * k); ctx.restore();
      }
      ctx.fillStyle = '#7A5A3A'; ctx.fillRect(s.x - F * 1.5, s.y + F * 1.55, F * 3, F * 0.55); // desk
      ctx.fillStyle = '#5E4329'; ctx.fillRect(s.x - F * 1.5, s.y + F * 2.1, F * 3, F * 0.12);
    }
  }
  const photoUrl = c.toDataURL('image/jpeg', 0.92);

  // ---- 2. the teacher's phone: find faces + face-prints ----
  const tool = await createOpenCV();
  const unit = (v) => { let s = 0; for (const x of v) s += x * x; s = Math.sqrt(s) || 1; return Float32Array.from(v, (x) => x / s); };
  const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
  const t0 = performance.now();
  const faces = (await tool.detect(c, { embed: true })).filter((f) => f.score >= MIN_SCORE).map((f) => ({ ...f, emb: unit(f.emb) }));
  const photoMs = Math.round(performance.now() - t0);
  // which seat each found face belongs to (only to grade the result; the app never knows this)
  for (const f of faces) {
    const cx = f.x + f.w / 2, cy = f.y + f.h / 2;
    let best = null, bd = Infinity;
    for (const s of seats) { const d = Math.hypot(cx - s.x, cy - s.y); if (s.who && d < s.face * 0.8 && d < bd) { bd = d; best = s; } }
    f.seat = best;
  }

  // ---- 3. registration prints (the students' phones) ----
  const reg = [];
  for (const p of registry) {
    const rc = toCanvas(await loadImage(p.enroll));
    const fs = await tool.detectPlain(rc, { embed: true });
    let best = null, bd = Infinity;
    for (const f of fs) { const d = Math.hypot(f.x + f.w / 2 - rc.width / 2, f.y + f.h / 2 - rc.height / 2); if (d < bd) { bd = d; best = f; } }
    reg.push({ ...p, emb: best ? unit(best.emb) : null, thumb: rc.toDataURL('image/jpeg', 0.85) });
  }

  // ---- 4. the server: best face per student, one student per face, conflicts to review ----
  const claims = {};
  for (const s of reg) {
    s.best = -1; s.score = -1;
    if (!s.emb) continue;
    faces.forEach((f, i) => { const v = dot(s.emb, f.emb); if (v > s.score) { s.score = v; s.best = i; } });
    if (s.score >= TAU) (claims[s.best] ||= []).push(s.name);
  }
  for (const s of reg) {
    const claimed = s.score >= TAU, conflict = claimed && claims[s.best].length > 1;
    const own = claimed && faces[s.best].seat?.who?.name === s.name;
    if (s.present) s.result = !claimed ? 'review-none' : conflict ? 'review-conflict' : own ? 'present' : 'wrong';
    else s.result = !claimed ? 'absent' : conflict ? 'review-conflict' : 'false-present';
    if (claimed) {
      const f = faces[s.best], side = Math.max(f.w, f.h) * 1.8, t = document.createElement('canvas'); t.width = 120; t.height = 120;
      t.getContext('2d').drawImage(c, f.x + f.w / 2 - side / 2, f.y + f.h / 2 - side / 2, side, side, 0, 0, 120, 120);
      s.crop = t.toDataURL('image/jpeg', 0.85);
    }
  }
  const faceInfo = faces.map((f, i) => ({ x: f.x, y: f.y, w: f.w, h: f.h, who: f.seat?.who ? { name: f.seat.who.name, kind: f.seat.who.kind } : null, seat: f.seat ? { row: f.seat.row, seat: f.seat.seat } : null, claimedBy: claims[i] || [] }));
  return { photoUrl, photoMs, faces: faceInfo, students: reg.map(({ emb, ...s }) => s), found: faces.length };
}, { W, H, ROWS, seats, TAU, MIN_SCORE, registry: [...present.map((p) => ({ ...p, present: true })), ...absent.map((p) => ({ ...p, present: false }))].sort((a, b) => a.name.localeCompare(b.name)) });

await writeFile(OUT + 'class-photo.jpg', Buffer.from(result.photoUrl.split(',')[1], 'base64'));

// ---- 5. pictures for people: the marked photo and the class list (built as right-to-left pages) ----
const LABEL = {
  present: ['נוכח, זוהה אוטומטית', '#1F7A49'], 'review-none': ['לבירור: לא נמצאה התאמה', '#985F00'], 'review-conflict': ['לבירור: קונפליקט', '#985F00'],
  wrong: ['שויך לפרצוף של מישהו אחר', '#BC3328'], absent: ['חסר', '#56606F'], 'false-present': ['נעדר אבל סומן נוכח', '#BC3328'],
};
const count = (k) => result.students.filter((s) => s.result === k).length;
const guestsFound = result.faces.filter((f) => f.who?.kind === 'guest');
const guestsClaimed = guestsFound.filter((f) => f.claimedBy.length).length;
const headline = `25 נוכחים: ${count('present')} זוהו אוטומטית, ${count('review-none') + result.students.filter((s) => s.present && s.result === 'review-conflict').length} לבירור, ${count('wrong')} שויכו לא נכון · 5 נעדרים: ${count('absent')} סומנו חסרים, ${count('false-present')} סומנו נוכחים בטעות · 3 אורחים: ${guestsClaimed} שויכו בטעות למישהו`;
const scale = 0.6;
const boxes = result.faces.map((f) => {
  let color = '#9AA3B0', text = 'פרצוף בלי שם', dash = 'dashed';
  if (f.claimedBy.length > 1) { color = '#E6A23C'; text = 'קונפליקט: ' + f.claimedBy.map(nice).join(' / '); dash = 'solid'; }
  else if (f.claimedBy.length === 1) { const ok = f.who?.name === f.claimedBy[0]; color = ok ? '#22C55E' : '#EF4444'; text = nice(f.claimedBy[0]) + (ok ? '' : ' (טעות)'); dash = 'solid'; }
  else if (f.who?.kind === 'guest') text = 'אורח, לא במאגר';
  else if (!f.who) { color = '#A855F7'; text = 'לא פרצוף'; }
  const big = f.h >= 45;
  return `<div class="b" style="left:${f.x * scale}px;top:${f.y * scale}px;width:${f.w * scale}px;height:${f.h * scale}px;border:2px ${dash} ${color}"><span style="background:${color};font-size:${big ? 13 : 11}px">${text}</span></div>`;
}).join('');
await page.evaluate(({ headline, photoUrl, boxes, W, H, scale }) => {
  document.body.innerHTML = `<style>body{margin:0;background:#1C2637;font-family:system-ui,"Segoe UI",Arial,sans-serif}
    #photo{display:inline-block;direction:rtl;color:#fff;padding:12px}
    #photo h1{font-size:20px;margin:0 0 4px}#photo p{margin:0 0 10px;font-size:15px;color:#D4DBE0}
    .wrap{position:relative;width:${W * scale}px;height:${H * scale}px}
    .wrap img{width:100%;height:100%;display:block}
    .b{position:absolute;box-sizing:border-box}
    .b span{position:absolute;bottom:100%;right:-2px;white-space:nowrap;color:#111;font-weight:600;padding:0 4px;border-radius:3px;direction:ltr}
    .legend{display:flex;gap:18px;font-size:14px;margin:0 0 8px}.legend i{display:inline-block;width:12px;height:12px;margin-left:6px;border-radius:2px}
  </style><div id="photo"><h1>הדמיה: מה המורה רואה אחרי ההתאמה</h1><p>${headline}</p>
  <div class="legend"><span><i style="background:#22C55E"></i>זוהה נכון</span><span><i style="background:#EF4444"></i>שויך לא נכון</span><span><i style="background:#E6A23C"></i>קונפליקט, לבירור</span><span><i style="background:#9AA3B0"></i>פרצוף שאף אחד לא טען לו</span><span><i style="background:#A855F7"></i>לא פרצוף</span></div>
  <div class="wrap"><img src="${photoUrl}">${boxes}</div></div>`;
}, { headline, photoUrl: result.photoUrl, boxes, W, H, scale });
await page.waitForFunction(() => [...document.images].every((i) => i.complete));
await page.locator('#photo').screenshot({ path: OUT + 'matched-photo.png' });

const rows = result.students.map((s) => `<tr><td class="n">${nice(s.name)}</td><td>${s.present ? 'נוכח בשיעור' : 'נעדר'}</td><td><img src="${s.thumb}"></td><td>${s.crop ? `<img src="${s.crop}">` : '—'}</td><td>${s.score >= 0 ? s.score.toFixed(2) : '—'}</td><td><b style="color:${LABEL[s.result][1]}">${LABEL[s.result][0]}</b></td></tr>`).join('');
await page.evaluate(({ rows, headline, tau }) => {
  document.body.innerHTML = `<style>body{margin:0;background:#F4F6F5;font-family:system-ui,"Segoe UI",Arial,sans-serif;color:#1C2637}
    #list{display:inline-block;direction:rtl;padding:16px}h1{font-size:20px;margin:0 0 4px}p{margin:0 0 12px;color:#56606F}
    table{border-collapse:collapse;background:#fff}th,td{padding:5px 10px;border-bottom:1px solid #D4DBE0;text-align:right;vertical-align:middle;font-size:14px}
    th{background:#EEF1F3;font-weight:600}td img{width:64px;height:64px;object-fit:cover;border-radius:4px;display:block}.n{direction:ltr;text-align:right}
  </style><div id="list"><h1>רשימת הכיתה אחרי ההתאמה</h1><p>${headline}<br>סף התאמה ${tau.toFixed(3)} (נקבע בבדיקה כך ששני אנשים שונים מתבלבלים פעם ב-1,000 השוואות)</p>
  <table><tr><th>שם</th><th>מה קרה באמת</th><th>תמונת ההרשמה</th><th>הפרצוף שנבחר בתמונת הכיתה</th><th>ציון</th><th>החלטת המערכת</th></tr>${rows}</table></div>`;
}, { rows, headline, tau: TAU });
await page.waitForFunction(() => [...document.images].every((i) => i.complete));
await page.locator('#list').screenshot({ path: OUT + 'class-list.png' });

await writeFile(OUT + 'result.json', JSON.stringify({ tau: TAU, minScore: MIN_SCORE, photoMs: result.photoMs, found: result.found, headline, students: result.students.map(({ thumb, crop, ...s }) => s), faces: result.faces }, null, 2));
console.log(headline);
console.log(`faces found: ${result.found}, time on the photo: ${result.photoMs} ms`);
await browser.close(); server.close();
