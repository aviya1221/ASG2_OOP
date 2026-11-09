# Reads the three files in real Excel and records what a teacher would see. Files are opened read-only.
$ErrorActionPreference = 'Stop'
$out = Join-Path $PSScriptRoot 'out'
$files = [ordered]@{ 'write-excel-file' = 'write-excel-file.xlsx'; 'exceljs' = 'exceljs.xlsx'; 'csv' = 'plain.csv' }
$specialRows = 2..6
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$result = [ordered]@{}
try {
    foreach ($tool in $files.Keys) {
        $book = $excel.Workbooks.Open((Join-Path $out $files[$tool]), 0, $true)
        $sheet = $book.Worksheets.Item(1)
        $sheet.Activate()
        $result[$tool] = [ordered]@{
            rows    = $sheet.UsedRange.Rows.Count
            rtl     = [bool]$excel.ActiveWindow.DisplayRightToLeft
            ids     = @($specialRows | ForEach-Object { [string]$sheet.Cells.Item($_, 1).Text })
            names   = @($specialRows | ForEach-Object { [string]$sheet.Cells.Item($_, 2).Text })
            notes   = @($specialRows | ForEach-Object { [string]$sheet.Cells.Item($_, 5).Text })
            formula = @($specialRows | ForEach-Object { [bool]$sheet.Cells.Item($_, 5).HasFormula })
        }
        $book.Close($false)
    }
}
finally {
    $excel.Quit()
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel)
}
$result | ConvertTo-Json -Depth 4 | Set-Content (Join-Path $PSScriptRoot 'results/excel-read.json') -Encoding utf8
