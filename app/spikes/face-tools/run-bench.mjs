// Runs the benchmark in a real browser (Microsoft Edge, no window) and saves the raw results.
// Usage: node run-bench.mjs [opencv,human,human-tiled] [--quick]
// Env:   HUMAN_BACKEND=webgl|wasm (default webgl)
import { chromium } from 'playwright-core';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { startServer } from './serve.mjs';

const tools = (process.argv.find((a, i) => i >= 2 && !a.startsWith('--')) || 'opencv,human,human-tiled').split(',');
const quick = process.argv.includes('--quick');
const SIZES = [114, 80, 60, 45, 35, 28, 22, 16];
const backend = process.env.HUMAN_BACKEND || 'webgl';

let wider = JSON.parse(await readFile('data/wider-subset.json', 'utf8'));
let people = JSON.parse(await readFile('data/lfw-subset.json', 'utf8'));
people = people.slice(0, Number(process.env.PEOPLE || 300));
if (quick) { wider = wider.slice(0, 3); people = people.slice(0, 40); }

const server = await startServer({ port: 8787 });
const browser = await chromium.launch({
  channel: 'msedge', headless: true,
  args: (process.env.EDGE_ARGS || '--ignore-gpu-blocklist --enable-gpu --use-angle=d3d11').split(' ').filter(Boolean),
});
await mkdir('results', { recursive: true });

for (const name of tools) {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('[page error]', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log('[page]', m.text()); });
  await page.goto('http://127.0.0.1:8787/bench.html');
  await page.waitForFunction(() => window.BenchReady === true);
  const init = await page.evaluate(([n, o]) => window.Bench.init(n, o), [name, { backend }]);
  console.log(`\n== ${name}: ${init.info} (ready in ${init.ms} ms)`);
  const res = { tool: name, info: init.info, sizes: SIZES, detection: [], timing: [], enroll: {}, probes: {}, probeMs: {} };

  // 1. Crowd photos: which labelled faces are found.
  for (const [i, im] of wider.entries()) {
    const r = await page.evaluate(([u]) => window.Bench.detectUrl(u, false), [im.url]);
    res.detection.push({ id: im.id, ...r });
    if (i % 20 === 0) console.log(`  crowd photo ${i + 1}/${wider.length}: ${r.faces.length} faces, ${r.ms} ms`);
  }

  // 2. Time for the full job on a crowd photo (find + face-print for every face).
  for (const im of wider.slice(0, quick ? 1 : 8)) {
    const r = await page.evaluate(([u]) => window.Bench.detectUrl(u, true).then((x) => ({ ms: x.ms, faces: x.faces.length, w: x.w, h: x.h })), [im.url]);
    res.timing.push({ id: im.id, ...r });
  }

  // 3. Registration photos.
  for (const p of people) res.enroll[p.name] = await page.evaluate(([u]) => window.Bench.enroll(u), [p.enroll]);
  console.log(`  registered: ${Object.values(res.enroll).filter(Boolean).length}/${people.length}`);

  // 4. "Class photos" with every face shrunk to S pixels.
  for (const S of SIZES) {
    const cap = await page.evaluate(([s]) => window.Bench.capacity(s), [S]);
    const got = {}; let ms = 0;
    for (let i = 0; i < people.length; i += cap.n) {
      const chunk = people.slice(i, i + cap.n);
      const r = await page.evaluate(([u, s]) => window.Bench.probe(u, s), [chunk.map((p) => p.probe), S]);
      r.out.forEach((emb, k) => { got[chunk[k].name] = emb; });
      ms += r.ms;
    }
    res.probes[S] = got; res.probeMs[S] = ms;
    console.log(`  face size ${S}px: found ${Object.values(got).filter(Boolean).length}/${people.length} (${ms} ms)`);
  }

  await writeFile(`results/raw-${name}${quick ? '-quick' : ''}.json`, JSON.stringify(res));
  await page.close();
}

await browser.close();
server.close();
