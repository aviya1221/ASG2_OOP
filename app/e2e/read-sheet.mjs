/**
 * Prints the contents of a spreadsheet as JSON. It runs as its own process,
 * because ExcelJS cannot be loaded inside the test runner.
 */
import ExcelJS from "exceljs";

const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(process.argv[2]);
const sheet = workbook.worksheets[0];

const rows = [];
let formulas = 0;
sheet.eachRow((row) => {
  const cells = [];
  for (let column = 1; column <= sheet.columnCount; column += 1) {
    const cell = row.getCell(column);
    if (cell.formula) formulas += 1;
    cells.push(cell.value);
  }
  rows.push(cells);
});

console.log(JSON.stringify({ rightToLeft: Boolean(sheet.views[0]?.rightToLeft), rows, formulas }));
