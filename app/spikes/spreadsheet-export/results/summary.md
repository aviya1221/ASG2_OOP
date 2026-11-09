# Attendance sheet export spike: measured results

The raw numbers are in [run.json](run.json), and what Excel showed is in [excel-read.json](excel-read.json).

## Setup, 2026-11-09

A made-up class of 50, written on Node 22 and read in Excel on Windows. Five rows hold hard cases: ID numbers that start with zeros, names with an apostrophe, a comma or quotation marks, and notes that look like formulas.

## Results

| Measure | write-excel-file 4.1.1 | ExcelJS 4.4.0 | CSV |
|---|---|---|---|
| Rows in Excel | 51 of 51 | 51 of 51 | 51 of 51 |
| ID numbers shown correctly | 5 of 5 | 5 of 5 | 0 of 5 |
| Names shown correctly | 5 of 5 | 5 of 5 | 5 of 5 |
| Notes kept as written | 5 of 5 | 5 of 5 | 1 of 5 |
| Notes run as formulas | 0 of 5 | 0 of 5 | 3 of 5 |
| The file sets right to left | Yes | Yes | Not possible in CSV |
| File size | 4.6 KB | 8.4 KB | 3.5 KB |
| Time to write, median of 5 | 10 ms | 15 ms | Under 1 ms |
| Library size, minified | 70.8 KB | 947.7 KB | None |

In the CSV file Excel showed the ID number 012345678 as 12345678 and 123456782 as 1.23E+08, and it ran `=1+1` as a formula.

Only Excel on Windows was checked, and the libraries ran on a server, not in a browser.
