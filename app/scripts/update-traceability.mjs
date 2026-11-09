/**
 * Writes test results into the Status column of the traceability matrix (docs/04-SRS.md).
 * Reads the JUnit reports in app/reports, where every test name holds its test case ID,
 * and app/manual-results.json for the tests that a person runs.
 *
 * With --summary it prints a short table and changes nothing.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const here = (path) => fileURLToPath(new URL(path, import.meta.url));
const REPORTS = here("../reports");
const MANUAL = here("../manual-results.json");
const SRS = here("../../docs/04-SRS.md");

/** Reads every JUnit report: "failed" if any test of a case failed, "passed" if at least one ran and none failed. */
export function resultsFromReports(xmlFiles) {
  const results = new Map();
  for (const xml of xmlFiles) {
    for (const match of xml.matchAll(/<testcase\b([^>]*?)(\/>|>([\s\S]*?)<\/testcase>)/g)) {
      const id = /\bname="[^"]*?(TC-\d{3})/.exec(match[1])?.[1];
      const body = match[3] ?? "";
      if (!id || /<skipped\b/.test(body)) continue;
      const failed = /<(failure|error)\b/.test(body);
      results.set(id, failed || results.get(id) === "failed" ? "failed" : "passed");
    }
  }
  return results;
}

/** A requirement passes only when every one of its test cases has passed. */
export function requirementStatus(testCases, results) {
  const states = testCases.map((id) => results.get(id));
  if (states.includes("failed")) return "Failed";
  return states.every((state) => state === "passed") ? "Passed" : "Not run";
}

/** Returns the matrix text with new statuses, and how many requirements have each status. */
export function updateMatrix(text, results) {
  const counts = { Passed: 0, Failed: 0, "Not run": 0, Gap: 0 };
  const updated = text.replace(
    /^(\| (?:REQ|NFR)-\d\d\b[^|\n]*\|[^|\n]*\|[^|\n]*\| )([^|\n]*?) \| (Gap|Not run|Passed|Failed) \|\r?$/gm,
    (line, start, testCases) => {
      const ids = testCases.match(/TC-\d{3}/g);
      if (!ids) {
        counts.Gap += 1;
        return line;
      }
      const status = requirementStatus(ids, results);
      counts[status] += 1;
      return `${start}${testCases} | ${status} |${line.endsWith("\r") ? "\r" : ""}`;
    },
  );
  return { updated, counts };
}

function main() {
  const reportFiles = existsSync(REPORTS) ? readdirSync(REPORTS).filter((name) => name.endsWith(".xml")) : [];
  const results = resultsFromReports(reportFiles.map((name) => readFileSync(`${REPORTS}/${name}`, "utf8")));
  if (existsSync(MANUAL)) {
    for (const [id, state] of Object.entries(JSON.parse(readFileSync(MANUAL, "utf8")))) results.set(id, state);
  }

  const text = readFileSync(SRS, "utf8");
  const { updated, counts } = updateMatrix(text, results);

  if (process.argv.includes("--summary")) {
    console.log("| Status | Requirements |\n|--------|--------------|");
    for (const [status, count] of Object.entries(counts)) console.log(`| ${status} | ${count} |`);
    return;
  }
  writeFileSync(SRS, updated);
  console.log(`Test cases with a result: ${results.size}.`, counts);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
