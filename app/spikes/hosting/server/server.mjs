/**
 * Test server for the hosting spike: how a free web service handles waking up,
 * a long wait, a large upload and a class of attendance responses.
 * It holds no keys and keeps nothing: an uploaded file is deleted before the reply.
 */
import { createHash, randomBytes } from "node:crypto";
import { createWriteStream } from "node:fs";
import { rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";

const PRINT_LENGTH = 128;
const CLASS_SIZE = 50;
const MATCH_THRESHOLD = 0.36;
const MAX_WAIT_S = 600;
const MAX_UPLOAD_BYTES = 250 * 1024 * 1024;
const MAX_JSON_CHARS = 64 * 1024;

const startedAt = new Date().toISOString();
const randomPrint = () => Array.from({ length: PRINT_LENGTH }, () => Math.random() * 2 - 1);
const classPrints = Array.from({ length: CLASS_SIZE }, randomPrint);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const memoryMb = () => Math.round(process.memoryUsage().rss / 1024 / 1024);

function send(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function cosine(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / Math.sqrt(normA * normB);
}

async function slow(url, res) {
  const seconds = Number(url.searchParams.get("seconds"));
  if (!(seconds > 0 && seconds <= MAX_WAIT_S)) throw new Error(`seconds must be above 0 and at most ${MAX_WAIT_S}`);
  await sleep(seconds * 1000);
  send(res, 200, { ok: true, waited_s: seconds });
}

async function upload(req, res) {
  const path = join(tmpdir(), `upload-${randomBytes(8).toString("hex")}`);
  const hash = createHash("sha256");
  const started = Date.now();
  let bytes = 0;
  async function* count(source) {
    for await (const chunk of source) {
      bytes += chunk.length;
      if (bytes > MAX_UPLOAD_BYTES) throw new Error("file too large");
      hash.update(chunk);
      yield chunk;
    }
  }
  try {
    await pipeline(req, count, createWriteStream(path));
    send(res, 200, { ok: true, bytes, sha256: hash.digest("hex"), server_ms: Date.now() - started, rss_mb: memoryMb() });
  } finally {
    await rm(path, { force: true });
  }
}

async function compare(req, res) {
  let text = "";
  for await (const chunk of req) {
    text += chunk;
    if (text.length > MAX_JSON_CHARS) throw new Error("body too large");
  }
  const { print } = JSON.parse(text);
  if (!Array.isArray(print) || print.length !== PRINT_LENGTH) throw new Error(`print must have ${PRINT_LENGTH} numbers`);
  let best = -1;
  for (const other of classPrints) best = Math.max(best, cosine(print, other));
  send(res, 200, { ok: true, matched: best >= MATCH_THRESHOLD, similarity: best });
}

async function handle(req, res) {
  const url = new URL(req.url, "http://localhost");
  const route = `${req.method} ${url.pathname}`;
  if (route === "GET /health") return send(res, 200, { ok: true, started_at: startedAt, rss_mb: memoryMb() });
  if (route === "GET /slow") return slow(url, res);
  if (route === "POST /upload") return upload(req, res);
  if (route === "POST /compare") return compare(req, res);
  return send(res, 404, { ok: false, error: "not found" });
}

const server = createServer((req, res) => {
  handle(req, res).catch((error) => {
    if (res.headersSent) res.destroy();
    else send(res, 400, { ok: false, error: error.message });
  });
});
server.requestTimeout = 15 * 60_000;
server.listen(Number(process.env.PORT ?? 10000), "0.0.0.0", () => console.log("listening"));
