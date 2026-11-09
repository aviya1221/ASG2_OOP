/**
 * Spike: can Supabase's free plan carry a class of 50 students?
 * Measures realtime delivery (NFR-02: 2 s for 95% of cases) under several sending patterns,
 * then sign-in and file storage.
 * Everything it creates is removed at the end, except the table from setup.sql.
 */
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const { SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: publishable, SUPABASE_SECRET_KEY: secret } = process.env;
if (!url || !publishable || !secret) throw new Error("Fill in .env first (see .env.example)");

const CLIENTS = Number(process.argv[2] ?? 50);
const TARGET_MS = 2000;
const SETTLE_MS = 5000;
const REST_MS = 20_000;
const BUCKET = "spike-files";
const FILE_MB = 5;

/** Each pattern says when each message is sent and by which connected client. */
const PATTERNS = [
  { name: "one message every 2 s", plan: () => Array.from({ length: 30 }, (_, i) => ({ at: i * 2000, from: 0 })) },
  { name: "one message every second", plan: () => Array.from({ length: 20 }, (_, i) => ({ at: i * 1000, from: 0 })) },
  { name: "everyone sends within 10 s", plan: (n) => Array.from({ length: n }, (_, i) => ({ at: Math.random() * 10_000, from: i })) },
  { name: "everyone sends within 1 s", plan: (n) => Array.from({ length: n }, (_, i) => ({ at: Math.random() * 1000, from: i })) },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (m) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);
const newClient = (key) =>
  createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 100 } },
  });

function stats(values) {
  const a = [...values].sort((x, y) => x - y);
  const at = (p) => a[Math.min(a.length - 1, Math.ceil((p / 100) * a.length) - 1)];
  return a.length ? { samples: a.length, p50_ms: at(50), p95_ms: at(95), max_ms: a[a.length - 1] } : { samples: 0 };
}

function subscribe(channel, lost) {
  return new Promise((resolve, reject) => {
    let joined = false;
    const timer = setTimeout(() => reject(new Error("subscribe timed out")), 60_000);
    channel.subscribe((status, err) => {
      if (status === "SUBSCRIBED") {
        joined = true;
        clearTimeout(timer);
        resolve();
      } else if (joined) {
        lost.push(`${status}: ${err?.message ?? "no details"}`);
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        clearTimeout(timer);
        reject(err ?? new Error(status));
      }
    });
  });
}

function listen(mode, client, onDelivery, lost) {
  const channel = client
    .channel("spike-room", { config: { broadcast: { self: true } } })
    .on("system", {}, (p) => {
      if (p.status !== "ok") lost.push(JSON.stringify(p));
    });
  return mode === "database-changes"
    ? channel.on("postgres_changes", { event: "INSERT", schema: "public", table: "spike_messages" }, (p) =>
        onDelivery(Number(p.new.sent_at_ms)),
      )
    : channel.on("broadcast", { event: "message" }, (p) => onDelivery(p.payload.sent_at_ms));
}

async function send(mode, client, channel, failures) {
  const sent_at_ms = Date.now();
  if (mode === "database-changes") {
    const { error } = await client.from("spike_messages").insert({ sent_at_ms, body: "spike" });
    if (error) failures.push(error.message);
  } else {
    const status = await channel.send({ type: "broadcast", event: "message", payload: { sent_at_ms } });
    if (status !== "ok") failures.push(String(status));
  }
}

async function realtime(mode, pattern) {
  const label = `${mode}, ${pattern.name}`;
  log(`${label}: connecting ${CLIENTS} clients`);
  const latencies = [];
  const lost = [];
  const clients = Array.from({ length: CLIENTS }, () => newClient(publishable));
  const channels = clients.map((client) => listen(mode, client, (sentAt) => latencies.push(Date.now() - sentAt), lost));
  const started = Date.now();
  const joined = await Promise.allSettled(channels.map((channel) => subscribe(channel, lost)));
  const connectSeconds = (Date.now() - started) / 1000;
  const ready = joined.flatMap((r, i) => (r.status === "fulfilled" ? [i] : []));
  if (ready.length === 0) throw new Error(String(joined[0].reason?.message ?? joined[0].reason));
  await sleep(3000);

  const plan = pattern.plan(ready.length);
  const failures = [];
  await Promise.all(
    plan.map(async ({ at, from }) => {
      await sleep(at);
      await send(mode, clients[ready[from]], channels[ready[from]], failures);
    }),
  );
  await sleep(SETTLE_MS);

  const expected = plan.length * ready.length;
  const result = {
    pattern: pattern.name,
    mode,
    connected: ready.length,
    connect_seconds: connectSeconds,
    messages: plan.length,
    expected,
    delivered: latencies.length,
    within_target_pct: Number(((100 * latencies.filter((ms) => ms <= TARGET_MS).length) / expected).toFixed(1)),
    lost_connections: lost.length,
    first_lost: lost[0] ?? null,
    send_failures: failures.length,
    first_failure: failures[0] ?? null,
    ...stats(latencies),
  };
  log(`${label}: ${JSON.stringify(result)}`);
  await Promise.all(clients.map((client) => client.removeAllChannels()));
  return result;
}

async function signIn() {
  const admin = newClient(secret);
  const email = `spike-${Date.now()}@example.com`;
  const password = randomBytes(18).toString("base64url");
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  const times = [];
  try {
    for (let i = 0; i < 5; i++) {
      const client = newClient(publishable);
      const t0 = Date.now();
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      times.push(Date.now() - t0);
      await sleep(500);
    }
  } finally {
    await admin.auth.admin.deleteUser(created.data.user.id);
  }
  const result = { attempts: times.length, ...stats(times) };
  log(`sign-in: ${JSON.stringify(result)}`);
  return result;
}

async function storage() {
  const admin = newClient(secret);
  const created = await admin.storage.createBucket(BUCKET, { public: false });
  if (created.error && !/already exists/i.test(created.error.message)) throw created.error;
  const path = `spike-${Date.now()}.pdf`;
  const bytes = randomBytes(FILE_MB * 1024 * 1024);
  try {
    let t0 = Date.now();
    const up = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: "application/pdf" });
    if (up.error) throw up.error;
    const upload_ms = Date.now() - t0;
    t0 = Date.now();
    const down = await admin.storage.from(BUCKET).download(path);
    if (down.error) throw down.error;
    const copy = Buffer.from(await down.data.arrayBuffer());
    const result = { file_mb: FILE_MB, upload_ms, download_ms: Date.now() - t0, same_bytes: copy.equals(bytes) };
    log(`storage: ${JSON.stringify(result)}`);
    return result;
  } finally {
    await admin.storage.from(BUCKET).remove([path]);
    await admin.storage.deleteBucket(BUCKET);
  }
}

const results = { started: new Date().toISOString(), clients: CLIENTS, realtime: [] };
mkdirSync("results", { recursive: true });
const save = () => writeFileSync(`results/run-${CLIENTS}-clients.json`, `${JSON.stringify(results, null, 2)}\n`);

for (const mode of ["database-changes", "broadcast"]) {
  for (const pattern of PATTERNS) {
    results.realtime.push(await realtime(mode, pattern));
    save();
    await sleep(REST_MS);
  }
}
results.sign_in = await signIn();
results.storage = await storage();
save();
log("ALL DONE");
process.exit(0);
