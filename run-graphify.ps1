$env:PATH += ";C:\Users\mjjeon\AppData\Local\Python\pythoncore-3.14-64\Scripts"

$RAW_PATH = "C:\Users\mjjeon\Desktop\QMS " + [char]0xD504 + [char]0xB85C + [char]0xC81D + [char]0xD2B8 + "\shinwoo-valve-qms\.obsidian\raw"
$BASE     = "C:\Users\mjjeon\Desktop\QMS " + [char]0xD504 + [char]0xB85C + [char]0xC81D + [char]0xD2B8 + "\shinwoo-valve-qms"
$OUT_SRC  = "$RAW_PATH\graphify-out"
$OUT_DEST = "$BASE\graphify-out"

Write-Host "Running graphify on raw/ ..."
graphify update $RAW_PATH

Write-Host ""
Write-Host "Copying results to project root graphify-out/ ..."
New-Item -ItemType Directory -Path $OUT_DEST -Force | Out-Null

Copy-Item "$OUT_SRC\graph.html"      $OUT_DEST -Force -ErrorAction SilentlyContinue
Copy-Item "$OUT_SRC\graph.json"      $OUT_DEST -Force
Copy-Item "$OUT_SRC\GRAPH_REPORT.md" $OUT_DEST -Force

Write-Host "Done. Output:"
Get-ChildItem $OUT_DEST | Select-Object Name
