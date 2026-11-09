/**
 * Spike: which file format and tool give a Hebrew attendance sheet that opens correctly in Excel (REQ-19)?
 * "node run.mjs" writes the sheet of a made-up class in three ways.
 * "check-in-excel.ps1" then reads the files in real Excel, and "node run.mjs check" scores what Excel saw.
 */
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import ExcelJS from "exceljs";
import writeExcelFile from "write-excel-file/node";

const HEADERS = ["תעודת זהות", "שם", "נוכחות", "איך נקבע", "הערה"];
const CLASS_SIZE = 50;
const REPEATS = 5;
const WIDTHS = [14, 24, 10, 14, 40];

/** The hard cases come first: leading zeros, punctuation, and notes that look like Excel formulas. */
const SPECIAL = [
  ["012345678", "דנה כהן", "נוכח", "זיהוי פנים", "בלי הערה"],
  ["000000018", "ז'קלין לוי", "נוכח", "שורה ומושב", "=1+1"],
  ["123456782", "כהן, דני", "נעדר", "אישור מרצה", '=HYPERLINK("http://example.com","לחצו")'],
  ["987654321", 'דני "הגדול" לוי', "נוכח", "זיהוי פנים", "+972501234567"],
  ["000000026", "שרה", "נוכח", "זיהוי פנים", "@SUM(A1)"],
];
const STUDENTS = [
  ...SPECIAL,
  ...Array.from({ length: CLASS_SIZE - SPECIAL.length }, (_, i) => [String(200000000 + i * 37), `סטודנט ${i + 6}`, "נוכח", "זיהוי פנים", ""]),
];

const outDir = resolve("out");
const paths = { "write-excel-file": resolve(outDir, "write-excel-file.xlsx"), exceljs: resolve(outDir, "exceljs.xlsx"), csv: resolve(outDir, "plain.csv") };

const writers = {
  "write-excel-file": () =>
    writeExcelFile(
      [
        HEADERS.map((value) => ({ value, fontWeight: "bold" })),
        ...STUDENTS.map((row) => row.map((value) => ({ type: String, value }))),
      ],
      { sheet: "נוכחות", rightToLeft: true, stickyRowsCount: 1, columns: WIDTHS.map((width) => ({ width })) },
    ).toFile(paths["write-excel-file"]),
  exceljs: async () => {
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet("נוכחות", { views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }] });
    sheet.columns = WIDTHS.map((width) => ({ width }));
    sheet.addRow(HEADERS).font = { bold: true };
    for (const row of STUDENTS) sheet.addRow(row).numFmt = "@";
    await book.xlsx.writeFile(paths.exceljs);
  },
  csv: async () => {
    const field = (value) => `"${value.replaceAll('"', '""')}"`;
    const lines = [HEADERS, ...STUDENTS].map((row) => row.map(field).join(","));
    writeFileSync(paths.csv, `﻿${lines.join("\r\n")}\r\n`, "utf8");
  },
};

mkdirSync(outDir, { recursive: true });
mkdirSync("results", { recursive: true });

if (process.argv[2] === "check") {
  const read = JSON.parse(readFileSync("results/excel-read.json", "utf8").replace(/^﻿/, ""));
  const run = JSON.parse(readFileSync("results/run.json", "utf8"));
  const scored = Object.entries(read).map(([tool, excel]) => ({
    tool,
    rows_seen: excel.rows,
    right_to_left: excel.rtl,
    ids_correct: excel.ids.filter((text, i) => text === SPECIAL[i][0]).length,
    names_correct: excel.names.filter((text, i) => text === SPECIAL[i][1]).length,
    notes_kept_as_text: excel.formula.filter((isFormula, i) => !isFormula && excel.notes[i] === SPECIAL[i][4]).length,
    notes_run_as_formulas: excel.formula.filter(Boolean).length,
    ids_seen: excel.ids,
  }));
  writeFileSync("results/run.json", `${JSON.stringify({ ...run, excel: scored, special_cases: SPECIAL.length }, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(scored, null, 1));
  process.exit(0);
}

const tools = {};
for (const [tool, write] of Object.entries(writers)) {
  const times = [];
  for (let i = 0; i < REPEATS; i++) {
    const started = performance.now();
    await write();
    times.push(Math.round(performance.now() - started));
  }
  tools[tool] = { median_ms: [...times].sort((a, b) => a - b)[Math.floor(REPEATS / 2)], file_bytes: statSync(paths[tool]).size };
}
writeFileSync("results/run.json", `${JSON.stringify({ students: CLASS_SIZE, repeats: REPEATS, tools }, null, 2)}\n`, "utf8");
console.log(JSON.stringify(tools, null, 1));
