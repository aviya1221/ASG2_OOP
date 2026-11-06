// Draws example pictures from the benchmark into results/examples/ (dataset images: not committed).
//  - crowd-*.jpg:  a crowd photo with the labelled faces (white), option 1 finds (green), option 2 finds (orange)
//  - distance.png: the same people at every tested face size, as the tool sees them, with recognised / not recognised
// Usage: node make-examples.mjs   (after run-bench.mjs and analyze.mjs)
import { chromium } from 'playwright-core';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { startServer } from './serve.mjs';

const wider = JSON.parse(await readFile('data/wider-subset.json', 'utf8'));
const people = JSON.parse(await readFile('data/lfw-subset.json', 'utf8'));
const ocv = JSON.parse(await readFile('results/raw-opencv.json', 'utf8'));
const hum = JSON.parse(await readFile('results/raw-human.json', 'utf8'));
const summary = JSON.parse(await readFile('results/summary.json', 'utf8'));
const THR = { opencv: summary.opencv.operating?.thr ?? 0.5, human: 0.3 };
const TAU = summary.opencv.recognition.tau;

function matched(gt, dets, thr) { // same rule as analyze.mjs
  const g = gt.map((f) => ({ cx: f[0] + f[2] / 2, cy: f[1] + f[3] / 2, s: Math.max(f[2], f[3]), size: Math.sqrt(f[2] * f[3]), hit: false }));
  let n = 0;
  for (const d of dets.filter((x) => x[4] >= thr).sort((a, b) => b[4] - a[4])) {
    const cx = d[0] + d[2] / 2, cy = d[1] + d[3] / 2, size = Math.sqrt(d[2] * d[3]);
    let best = -1, bd = Infinity;
    g.forEach((t, i) => { if (t.hit) return; const dist = Math.hypot(cx - t.cx, cy - t.cy), r = size / t.size; if (dist <= 0.5 * t.s && r >= 0.5 && r <= 2.5 && dist < bd) { bd = dist; best = i; } });
    if (best >= 0) { g[best].hit = true; n++; }
  }
  return n;
}

// One photo per class: the one with the most labelled faces between 15 and 60.
const picks = [];
for (const cat of [...new Set(wider.map((w) => w.cat))]) {
  const pool = wider.filter((w) => w.cat === cat && w.faces.length >= 15 && w.faces.length <= 60).sort((a, b) => b.faces.length - a.faces.length);
  if (pool[0]) picks.push(pool[0]);
}

const server = await startServer({ port: 8790 });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage();
await page.goto('http://127.0.0.1:8790/bench.html');
await mkdir('results/examples', { recursive: true });
const save = async (name, dataUrl) => writeFile('results/examples/' + name, Buffer.from(dataUrl.split(',')[1], 'base64'));

for (const [i, w] of picks.entries()) {
  const o = ocv.detection.find((d) => d.id === w.id).faces.filter((f) => f[4] >= THR.opencv);
  const h = hum.detection.find((d) => d.id === w.id).faces.filter((f) => f[4] >= THR.human);
  const legend = `במאגר ${w.faces.length} פנים (לבן) · אפשרות 1 מצאה ${matched(w.faces, o, 0)} (ירוק) · אפשרות 2 מצאה ${matched(w.faces, h, 0)} (כתום)`;
  const url = await page.evaluate(async ([src, gt, o, h, legend]) => {
    const img = await new Promise((r) => { const im = new Image(); im.onload = () => r(im); im.src = src; });
    const band = 44, c = document.createElement('canvas'); c.width = img.width; c.height = img.height + band;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#1C2637'; ctx.fillRect(0, 0, c.width, band); ctx.drawImage(img, 0, band);
    ctx.fillStyle = '#fff'; ctx.font = '600 20px system-ui, Arial'; ctx.direction = 'rtl'; ctx.textAlign = 'right'; ctx.fillText(legend, c.width - 12, 29);
    const box = (f, color, width, dash) => { ctx.setLineDash(dash); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.strokeRect(f[0], f[1] + band, f[2], f[3]); };
    gt.forEach((f) => box(f, 'rgba(255,255,255,.9)', 1.5, [4, 3]));
    h.forEach((f) => box(f, '#FF8A1F', 2.5, []));
    o.forEach((f) => box(f, '#22D36B', 2, []));
    return c.toDataURL('image/jpeg', 0.9);
  }, [w.url, w.faces, o, h, legend]);
  const name = `crowd-${i + 1}-${w.cat.split('--')[1]}.jpg`;
  await save(name, url);
  console.log('saved', name);
}

// Distance strip: 4 people x 8 sizes. Top: real size. Bottom: blown up, the way the tool "sees" it.
const sizes = ocv.sizes.slice().sort((a, b) => b - a);
const dot = (a, b) => { let s = 0; for (let k = 0; k < a.length; k++) s += a[k] * b[k]; return s; };
const four = people.filter((p) => ocv.enroll[p.name]).slice(0, 4).map((p) => ({
  url: p.probe, enroll: p.enroll, name: p.name.replace(/_/g, ' '),
  ok: sizes.map((S) => !!(ocv.probes[S][p.name] && dot(ocv.enroll[p.name], ocv.probes[S][p.name]) >= TAU)),
}));
// Built as a normal right-to-left page and photographed, so the Hebrew text renders correctly.
await page.evaluate(async ([rows, sizes]) => {
  const { drawShrunk } = await import('/lab.js');
  const load = (src) => new Promise((r) => { const im = new Image(); im.onload = () => r(im); im.src = src; });
  const cellImg = (img, S, blowUp) => {
    const patch = Math.max(8, Math.round((200 * S) / 114));
    const t = document.createElement('canvas'); t.width = patch; t.height = patch;
    drawShrunk(t.getContext('2d'), img, 25, 25, 200, 200, 0, 0, patch, patch);
    if (!blowUp) return t.toDataURL();
    const b = document.createElement('canvas'); b.width = 150; b.height = 150;
    const bc = b.getContext('2d'); bc.imageSmoothingEnabled = false; bc.drawImage(t, 0, 0, 150, 150);
    return b.toDataURL();
  };
  let html = `<style>
    body{margin:0;background:#F4F6F5;font:15px/1.4 system-ui,"Segoe UI",Arial,sans-serif;color:#1C2637}
    #strip{display:inline-block;padding:16px;direction:rtl}
    table{border-collapse:collapse}
    th{font-weight:600;padding:4px 6px 10px;white-space:nowrap}
    td{padding:6px;text-align:center;vertical-align:top;border-top:1px solid #D4DBE0}
    .real{width:206px;height:206px;display:grid;place-items:center}
    .who{color:#56606F;font-size:13px}
    .ok{color:#1F7A49;font-weight:600}.no{color:#BC3328;font-weight:600}
    p{margin:0 0 12px;font-size:16px}
  </style><div id="strip"><p>שורה עליונה בכל אדם: הפרצוף בגודל האמיתי בתמונה. שורה תחתונה: אותו פרצוף מוגדל, כדי לראות כמה פרטים נשארו.</p><table><tr><th>תמונת ההרשמה</th>`;
  html += sizes.map((S) => `<th>פרצוף ${S} פיקסלים</th>`).join('') + '</tr>';
  for (const row of rows) {
    const reg = await load(row.enroll), img = await load(row.url);
    const regUrl = cellImg(reg, 114, false);
    html += `<tr><td><div class="real"><img src="${regUrl}"></div><div class="who">${row.name}</div></td>`;
    html += sizes.map((S, i) => `<td><div class="real"><img src="${cellImg(img, S, false)}"></div><img src="${cellImg(img, S, true)}"><div class="${row.ok[i] ? 'ok' : 'no'}">${row.ok[i] ? 'זוהה' : 'לא זוהה'}</div></td>`).join('');
    html += '</tr>';
  }
  document.body.innerHTML = html + '</table></div>';
  await Promise.all([...document.images].map((im) => im.decode()));
}, [four, sizes]);
await page.locator('#strip').screenshot({ path: 'results/examples/distance.png' });
console.log('saved distance.png');
await browser.close(); server.close();
