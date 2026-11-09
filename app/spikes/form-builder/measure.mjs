/**
 * Spike F6: how much does each way of building forms add to the page, and does our own version cover REQ-61?
 * Each candidate is bundled and minified. React is left out, because the page has it already.
 */
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const REACT = ["react", "react-dom", "react-dom/client", "react/jsx-runtime"];
const LOADERS = { ".woff": "dataurl", ".woff2": "dataurl", ".ttf": "dataurl", ".eot": "dataurl", ".svg": "dataurl", ".png": "dataurl", ".gif": "dataurl" };
const CANDIDATES = {
  "own code": 'export * from "../../own-form.jsx";',
  "SurveyJS form library": 'export { Model } from "survey-core"; export { Survey } from "survey-react-ui"; import "survey-core/survey-core.min.css";',
  "Form.io": 'export { Formio, FormBuilder, Form } from "@formio/js";',
};

const out = resolve("out");
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, "entries"), { recursive: true });
mkdirSync("results", { recursive: true });

const results = { sizes: {} };
for (const [name, source] of Object.entries(CANDIDATES)) {
  const key = name.replaceAll(" ", "-").replaceAll(".", "");
  const entry = join(out, "entries", `${key}.jsx`);
  writeFileSync(entry, source);
  const outdir = join(out, key);
  await build({ entryPoints: [entry], bundle: true, minify: true, format: "esm", jsx: "automatic", external: REACT, loader: LOADERS, outdir, logLevel: "error", define: { "process.env.NODE_ENV": '"production"', global: "globalThis" } });
  const files = readdirSync(outdir).filter((f) => [".js", ".css"].includes(extname(f)));
  const bytes = files.map((f) => readFileSync(join(outdir, f)));
  results.sizes[name] = {
    minified_kb: Number((bytes.reduce((n, b) => n + b.length, 0) / 1024).toFixed(1)),
    compressed_kb: Number((bytes.reduce((n, b) => n + gzipSync(b).length, 0) / 1024).toFixed(1)),
  };
}

// Our own version, rendered on the server: every question type, and the check for missing answers.
const testFile = join(out, "own-test.mjs");
await build({ entryPoints: ["own-form.jsx"], bundle: true, format: "esm", jsx: "automatic", platform: "node", packages: "external", outfile: testFile, logLevel: "error" });
writeFileSync(join(out, "package.json"), "{}");
const { createElement } = await import("react");
const { renderToStaticMarkup } = await import("react-dom/server");
const own = await import(pathToFileURL(testFile).href);
const form = {
  questions: [
    { id: "a", type: "single", title: "שאלה א", options: ["כן", "לא"] },
    { id: "b", type: "multiple", title: "שאלה ב", options: ["אחת", "שתיים", "שלוש"] },
    { id: "c", type: "scale", title: "שאלה ג", options: [] },
    { id: "d", type: "text", title: "שאלה ד", options: [] },
  ],
};
const html = renderToStaticMarkup(createElement(own.FormWindow, { form, onSubmit: () => {} }));
const full = { a: "כן", b: ["אחת", "שלוש"], c: 4, d: "תשובה" };
results.own_code = {
  source_lines: readFileSync("own-form.jsx", "utf8").trim().split("\n").length,
  radio_inputs: html.match(/type="radio"/g)?.length ?? 0,
  checkbox_inputs: html.match(/type="checkbox"/g)?.length ?? 0,
  text_areas: html.match(/<textarea/g)?.length ?? 0,
  right_to_left: html.includes('dir="rtl"'),
  all_unanswered_found: own.missingAnswers(form, {}).length,
  missing_when_all_answered: own.missingAnswers(form, full).length,
  missing_when_multiple_is_empty: own.missingAnswers(form, { ...full, b: [] }).map((q) => q.id),
};
writeFileSync("results/run.json", `${JSON.stringify(results, null, 2)}\n`, "utf8");
console.log(JSON.stringify(results, null, 1));
