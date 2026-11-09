// Spike: measures the React client's page weight, screen sizes, loading and live updates.
// Runs in Edge on this computer, and writes results/summary.md.
import { createServer } from "node:http";
import { readFile, readdir, mkdir, writeFile, stat } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { createClient } from "@supabase/supabase-js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(HERE, "dist");
const RESULTS = path.join(HERE, "results");
const PORT = 4173;
const BASE = `http://localhost:${PORT}/`;
const CHANNEL = "client-spike";

const VIEWPORTS = [
  { name: "Small phone", width: 320, height: 568, mobile: true, shot: true },
  { name: "Phone", width: 360, height: 780, mobile: true },
  { name: "Phone", width: 390, height: 844, mobile: true, shot: true },
  { name: "Large phone", width: 430, height: 932, mobile: true },
  { name: "Phone on its side", width: 844, height: 390, mobile: true },
  { name: "Tablet", width: 768, height: 1024, mobile: true },
  { name: "Laptop", width: 1280, height: 800, mobile: false, shot: true },
  { name: "Large screen", width: 1920, height: 1080, mobile: false },
];
const TABS = ["attendance", "forum", "homework"];
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" };

const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
};
const median = (values) => percentile(values, 50);
const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const full = path.join(dir, entry.name);
      return entry.isDirectory() ? listFiles(full) : [full];
    }),
  );
  return files.flat();
}

async function pageWeight() {
  const files = await listFiles(DIST);
  const rows = await Promise.all(
    files.map(async (file) => {
      const data = await readFile(file);
      return { file: path.relative(DIST, file).replaceAll("\\", "/"), raw: data.length, gzip: gzipSync(data).length };
    }),
  );
  return rows.sort((a, b) => b.gzip - a.gzip);
}

// Serves the build compressed, the way a host does.
function serve() {
  const server = createServer(async (req, res) => {
    const name = decodeURIComponent(new URL(req.url, BASE).pathname).slice(1) || "index.html";
    const file = path.join(DIST, name);
    try {
      await stat(file);
      res.writeHead(200, {
        "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream",
        "Content-Encoding": "gzip",
        "Cache-Control": "no-store",
      });
      res.end(gzipSync(await readFile(file)));
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((resolve) => server.listen(PORT, () => resolve(server)));
}

// Runs inside the page. Elements inside a sideways-scrolling box are allowed to be wider than the screen.
function inspectPage(width) {
  const visible = (el) => {
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return rect.width > 1 && rect.height > 1 && style.visibility !== "hidden" && style.display !== "none";
  };
  const inScrollBox = (el) => {
    for (let parent = el.parentElement; parent; parent = parent.parentElement) {
      if (["auto", "scroll"].includes(getComputedStyle(parent).overflowX)) return true;
    }
    return false;
  };
  const describe = (el) => `${el.tagName.toLowerCase()}.${el.className}`;
  const overflowing = [...document.querySelectorAll("body *")]
    .filter((el) => visible(el) && !inScrollBox(el))
    .filter((el) => {
      const rect = el.getBoundingClientRect();
      return rect.right > width + 1 || rect.left < -1;
    })
    .map(describe);
  const small = [...document.querySelectorAll("button, a[href], input, select, textarea")]
    .filter((el) => visible(el) && el.type !== "checkbox")
    .filter((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width < 44 || rect.height < 44;
    })
    .map(describe);
  const tabs = [...document.querySelectorAll("[data-tab]")].map((el) => el.getBoundingClientRect().left);
  return {
    pageScrollWidth: document.documentElement.scrollWidth,
    overflowing,
    small,
    rightToLeft: tabs[0] > tabs[tabs.length - 1],
    contentWidth: Math.round(document.querySelector(".content").getBoundingClientRect().width),
  };
}

async function testScreens(browser) {
  const rows = [];
  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      isMobile: viewport.mobile,
      hasTouch: viewport.mobile,
      locale: "he-IL",
    });
    const page = await context.newPage();
    await page.goto(BASE);
    for (const tab of TABS) {
      await page.click(`[data-tab="${tab}"]`);
      const found = await page.evaluate(inspectPage, viewport.width);
      rows.push({ ...viewport, tab, ...found, sideways: found.pageScrollWidth > viewport.width });
      if (viewport.shot && tab === "forum") {
        await page.screenshot({ path: path.join(RESULTS, `forum-${viewport.width}.png`) });
      }
    }
    await context.close();
  }
  return rows;
}

// Plants a too-wide element and a too-small button, to prove the screen check can fail.
async function testTheCheck(browser) {
  const context = await browser.newContext({ viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto(BASE);
  await page.evaluate(() => {
    const wide = document.createElement("div");
    wide.className = "planted-wide";
    wide.style.cssText = "width: 500px; height: 20px";
    const small = document.createElement("button");
    small.className = "planted-small";
    small.style.cssText = "min-width: 0; min-height: 0; width: 20px; height: 20px";
    document.body.append(wide, small);
  });
  const found = await page.evaluate(inspectPage, 320);
  await context.close();
  return {
    sideways: found.pageScrollWidth > 320,
    wide: found.overflowing.some((name) => name.includes("planted-wide")),
    small: found.small.some((name) => name.includes("planted-small")),
  };
}

// Close to Lighthouse's phone profile: slow 4G and a CPU four times slower.
async function slowPhone(context, page) {
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
}

async function testLoading(browser) {
  const firstPaint = [];
  for (let run = 0; run < 5; run++) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await slowPhone(context, page);
    await page.goto(BASE);
    await page.waitForSelector("[data-tab]");
    firstPaint.push(
      await page.evaluate(
        () =>
          new Promise((resolve) => {
            const read = () => {
              const entry = performance.getEntriesByName("first-contentful-paint")[0];
              if (entry) resolve(Math.round(entry.startTime));
              else setTimeout(read, 50);
            };
            read();
          }),
      ),
    );
    await context.close();
  }
  return { runs: firstPaint, median: median(firstPaint) };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function makeSender(mode, supabase) {
  if (mode === "database") {
    return {
      send: async (id, body) => {
        const { error } = await supabase.from("spike_messages").insert({ sent_at_ms: Date.now(), body });
        if (error) throw new Error(error.message);
      },
      close: async () => {},
    };
  }
  const channel = supabase.channel(CHANNEL);
  await new Promise((resolve) => channel.subscribe((status) => status === "SUBSCRIBED" && resolve()));
  return {
    send: (id, body) =>
      channel.send({ type: "broadcast", event: "message", payload: { id, body, sent_at_ms: Date.now() } }),
    close: () => supabase.removeChannel(channel),
  };
}

// Sends a steady stream and then a burst, and times each message from sending to appearing on the page.
async function testLive(browser, supabase, mode) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  let navigations = 0;
  page.on("framenavigated", () => navigations++);
  await page.goto(`${BASE}?live=${mode}`);
  await page.waitForSelector('[data-live="connected"]', { timeout: 30000 });
  const navigationsBefore = navigations;
  await (await context.newCDPSession(page)).send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.evaluate(() => {
    window.__seen = [];
    new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.dataset?.sentAt) window.__seen.push(Date.now() - Number(node.dataset.sentAt));
        }
      }
    }).observe(document.getElementById("messages"), { childList: true });
  });

  const sender = await makeSender(mode, supabase);
  const steady = 30;
  const burst = 50;
  for (let i = 0; i < steady; i++) {
    await sender.send(`${mode}-s-${i}`, `הודעה ${i + 1}`);
    await sleep(1000);
  }
  await sleep(3000);
  const steadySeen = await page.evaluate(() => window.__seen.splice(0));
  await Promise.all(
    Array.from({ length: burst }, async (_, i) => {
      await sleep(i * 20);
      await sender.send(`${mode}-b-${i}`, `הודעה מהירה ${i + 1}`);
    }),
  );
  await sleep(5000);
  const burstSeen = await page.evaluate(() => window.__seen.splice(0));
  await sender.close();
  const reloads = navigations - navigationsBefore;
  await context.close();

  const summarize = (name, sent, seen) => ({
    name,
    sent,
    arrived: seen.length,
    p95: seen.length ? percentile(seen, 95) : null,
    slowest: seen.length ? Math.max(...seen) : null,
  });
  return { mode, reloads, rows: [summarize("One message per second", steady, steadySeen), summarize("50 messages within 1 s", burst, burstSeen)] };
}

async function setupTimes() {
  try {
    return JSON.parse(await readFile(path.join(RESULTS, "setup-times.json"), "utf8"));
  } catch {
    return null;
  }
}

function report({ weight, screens, control, loading, live, skipped, setup }) {
  const total = weight.reduce((sum, row) => sum + row.gzip, 0);
  const lines = ["# Results: React client spike", "", `Run on ${new Date().toISOString().slice(0, 10)} in Edge on a laptop. Phones are emulated.`, ""];
  if (setup) {
    lines.push("## Time to set up", "", "| Step | Time |", "|------|------|", `| First install | ${setup.installSeconds} s |`, `| Type check | ${setup.typecheckSeconds} s |`, `| Production build | ${setup.buildSeconds} s |`, "");
  }
  lines.push("## Page weight", "", "| File | Size | Compressed |", "|------|------|------------|");
  for (const row of weight) lines.push(`| ${row.file} | ${kb(row.raw)} | ${kb(row.gzip)} |`);
  lines.push(`| **Total** | | **${kb(total)}** |`, "");
  lines.push("## Screen sizes", "", "Each size was checked on all three tabs.", "", "| Screen | Width × height | Sideways scroll of the page | Elements past the edge | Controls under 44 px | Right to left | Content width |", "|--------|----------------|------------------|------------------------|----------------------|---------------|---------------|");
  for (const viewport of VIEWPORTS) {
    const rows = screens.filter((row) => row.width === viewport.width && row.height === viewport.height);
    lines.push(`| ${viewport.name} | ${viewport.width} × ${viewport.height} | ${rows.filter((r) => r.sideways).length} of ${rows.length} tabs | ${rows.reduce((n, r) => n + r.overflowing.length, 0)} | ${rows.reduce((n, r) => n + r.small.length, 0)} | ${rows.every((r) => r.rightToLeft) ? "Yes" : "No"} | ${Math.max(...rows.map((r) => r.contentWidth))} px |`);
  }
  lines.push("", `Check of the check: a planted too-wide element and a planted too-small button were ${control.sideways && control.wide && control.small ? "both caught" : "NOT both caught"}.`);
  lines.push("", "## Loading on an emulated slow phone", "", "Slow 4G (150 ms, 1.6 Mbit/s) and a CPU four times slower, with an empty cache.", "", `First content on the screen: median ${loading.median} ms over 5 runs (${loading.runs.join(", ")} ms).`, "");
  lines.push("## Live updates on the page", "", "From sending a message to its appearing on the page, on one page with a CPU four times slower.", "", "| Method | Pace | Sent | Arrived | 95% within | Slowest |", "|--------|------|------|---------|------------|---------|");
  for (const run of live) {
    for (const row of run.rows) lines.push(`| ${run.mode} | ${row.name} | ${row.sent} | ${row.arrived} | ${row.p95} ms | ${row.slowest} ms |`);
  }
  lines.push("");
  for (const run of live) lines.push(`Page reloads during the ${run.mode} test: ${run.reloads}.`);
  for (const note of skipped) lines.push("", note);
  lines.push("");
  return lines.join("\n");
}

await mkdir(RESULTS, { recursive: true });
const server = await serve();
const browser = await chromium.launch({ channel: "msedge", headless: true });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY);
try {
  const weight = await pageWeight();
  const screens = await testScreens(browser);
  const control = await testTheCheck(browser);
  const loading = await testLoading(browser);
  const live = [await testLive(browser, supabase, "broadcast")];
  const skipped = [];
  const { error } = await supabase.from("spike_messages").select("id").limit(1);
  if (error) skipped.push("The database-changes method was not run: the test table does not exist. See README.md.");
  else live.push(await testLive(browser, supabase, "database"));
  const setup = await setupTimes();
  const text = report({ weight, screens, control, loading, live, skipped, setup });
  await writeFile(path.join(RESULTS, "summary.md"), text);
  console.log(text);
  const problems = screens.filter((row) => row.sideways || row.overflowing.length || row.small.length);
  for (const row of problems) console.log("PROBLEM", row.width, row.tab, { sideways: row.sideways, over: row.overflowing, small: row.small });
} finally {
  await browser.close();
  server.close();
  await supabase.removeAllChannels();
}
