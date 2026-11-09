# Spike: attendance sheet export

Hands-on test for the tools report: which format and tool give a Hebrew attendance sheet that opens correctly in Excel (REQ-19)?

It writes the sheet of a made-up class of 50 with `write-excel-file`, with ExcelJS and as CSV, and then reads each file in real Excel.

## Run

Needs Excel on Windows.

```sh
npm install
npm start
pwsh -File check-in-excel.ps1
node run.mjs check
```

See [results/summary.md](results/summary.md).
