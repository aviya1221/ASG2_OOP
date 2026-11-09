/**
 * Hosting spike: measures the deployed test server from outside.
 * Usage: node measure.mjs <service-url> now|wake
 *   now   attendance responses, large uploads and one long wait
 *   wake  lets the service fall asleep and times waking it, 3 times
 */
import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";

const [base, phase] = process.argv.slice(2);
if (!base || !["now", "wake"].includes(phase)) throw new Error("Usage: node measure.mjs <service-url> now|wake");

const TARGET_MS = 2000;
const CLASS_SIZE = 50;
const PRINT_LENGTH = 128;
const ATTENDANCE_WINDOWS_MS = [60_000, 1000];
const UPLOADS_MB = [40, 200];
const LONG_WAIT_S = 330;
const IDLE_MS = 16 * 60_000;
const WAKE_SAMPLES = 3;
const WAKE_LIMIT_MS = 5 * 60_000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (m) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const parse = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

function stats(values) {
  const a = [...values].sort((x, y) => x - y);
  const at = (p) => a[Math.min(a.length - 1, Math.ceil((p / 100) * a.length) - 1)];
  return a.length ? { samples: a.length, p50_ms: at(50), p95_ms: at(95), max_ms: a[a.length - 1] } : { samples: 0 };
}

/** A new connection per request, as each phone has its own. No client-side time limit. */
function request(method, path, { body, headers } = {}) {
  const url = new URL(path, base);
  const transport = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const req = transport.request(url, { method, headers, agent: false }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("error", reject);
      res.on("end", () =>
        resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString(), ms: Date.now() - started }),
      );
    });
    req.on("error", reject);
    req.end(body);
  });
}

/** Records a failure as a result, so that one failed test does not lose the others. */
async function attempt(name, test) {
  log(`${name}: running`);
  let result;
  try {
    result = await test();
  } catch (error) {
    result = { failed: true, error: String(error.code ?? error.message) };
  }
  log(`${name}: ${JSON.stringify(result)}`);
  return result;
}

async function attendance(windowMs) {
  const replies = await Promise.all(
    Array.from({ length: CLASS_SIZE }, async () => {
      await sleep(Math.random() * windowMs);
      const body = JSON.stringify({ print: Array.from({ length: PRINT_LENGTH }, () => Math.random() * 2 - 1) });
      const headers = { "content-type": "application/json", "content-length": Buffer.byteLength(body) };
      try {
        const reply = await request("POST", "/compare", { body, headers });
        return reply.status === 200 ? reply.ms : null;
      } catch {
        return null;
      }
    }),
  );
  const times = replies.filter((ms) => ms !== null);
  return {
    window_s: windowMs / 1000,
    responses: CLASS_SIZE,
    answered: times.length,
    within_target_pct: Number(((100 * times.filter((ms) => ms <= TARGET_MS).length) / CLASS_SIZE).toFixed(1)),
    ...stats(times),
  };
}

async function upload(mb) {
  const bytes = randomBytes(mb * 1024 * 1024);
  const headers = { "content-type": "application/octet-stream", "content-length": bytes.length };
  const reply = await request("POST", "/upload", { body: bytes, headers });
  const body = parse(reply.text);
  return {
    file_mb: mb,
    status: reply.status,
    total_s: Number((reply.ms / 1000).toFixed(1)),
    same_bytes: body?.sha256 === sha256(bytes),
    server_memory_mb: body?.rss_mb ?? null,
  };
}

async function longWait() {
  const reply = await request("GET", `/slow?seconds=${LONG_WAIT_S}`);
  return {
    asked_s: LONG_WAIT_S,
    status: reply.status,
    total_s: Number((reply.ms / 1000).toFixed(1)),
    answered: parse(reply.text)?.ok === true,
  };
}

async function wakeOnce(previousStart) {
  const started = Date.now();
  const statuses = [];
  while (Date.now() - started < WAKE_LIMIT_MS) {
    try {
      const reply = await request("GET", "/health", { headers: { accept: "*/*" } });
      statuses.push(reply.status);
      const body = parse(reply.text);
      if (reply.status === 200 && body?.ok === true) {
        const wake_s = Number(((Date.now() - started) / 1000).toFixed(1));
        const warm = await request("GET", "/health");
        return { wake_s, restarted: body.started_at !== previousStart, started_at: body.started_at, statuses, warm_ms: warm.ms };
      }
    } catch (error) {
      statuses.push(String(error.code ?? error.message));
    }
    await sleep(1000);
  }
  return { failed: true, wake_s: null, statuses };
}

const results = { started: new Date().toISOString(), phase };
const save = () => {
  mkdirSync("results", { recursive: true });
  writeFileSync(`results/${phase}.json`, `${JSON.stringify(results, null, 2)}\n`);
};

if (phase === "now") {
  results.attendance = [];
  for (const windowMs of ATTENDANCE_WINDOWS_MS) {
    results.attendance.push(await attempt(`attendance within ${windowMs / 1000} s`, () => attendance(windowMs)));
    save();
  }
  results.uploads = [];
  for (const mb of UPLOADS_MB) {
    results.uploads.push(await attempt(`upload ${mb} MB`, () => upload(mb)));
    save();
  }
  results.long_wait = await attempt(`wait ${LONG_WAIT_S} s`, longWait);
  save();
} else {
  const first = parse((await request("GET", "/health")).text);
  let previousStart = first?.started_at ?? null;
  results.wake = [];
  for (let i = 1; i <= WAKE_SAMPLES; i++) {
    log(`staying idle for ${IDLE_MS / 60_000} minutes before sample ${i}`);
    await sleep(IDLE_MS);
    const sample = await attempt(`wake ${i}`, () => wakeOnce(previousStart));
    results.wake.push(sample);
    previousStart = sample.started_at ?? previousStart;
    save();
  }
}
log("ALL DONE");
process.exit(0);
