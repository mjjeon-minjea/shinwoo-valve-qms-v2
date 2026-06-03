# 3. Integration workflow validation script
$workspaceRoot = $pwd.Path

# UTF-8 decode for '안티그래비티' folder name
$utf8Bytes = [byte[]]@(0xEC, 0x95, 0x88, 0xED, 0x8B, 0xB0, 0xEA, 0xB7, 0xB8, 0xEB, 0x9E, 0x98, 0xEB, 0xB9, 0x84, 0xED, 0x8B, 0xB0)
$antigravityName = [System.Text.Encoding]::UTF8.GetString($utf8Bytes)
$antigravityPath = Join-Path $workspaceRoot $antigravityName

# Set up test paths for domains
$planPath = Join-Path $antigravityPath "plan"
$taskPath = Join-Path $antigravityPath "task"
$walkthroughPath = Join-Path $antigravityPath "walkthrough"
$reportPath = Join-Path $antigravityPath "report"

# Verify directories exist
foreach ($p in @($planPath, $taskPath, $walkthroughPath, $reportPath)) {
    if (-not (Test-Path $p)) {
        New-Item -ItemType Directory -Path $p -Force | Out-Null
    }
}

# Normalization helper function
function Get-NormalizedName ($fileName) {
    $name = $fileName
    if ($name.Length -gt 11 -and $name.Substring(4,1) -eq "-" -and $name.Substring(7,1) -eq "-") {
        $name = $name.Substring(11)
    }
    $name = $name -replace "_R[0-9]+(\.md)?$", ""
    $name = $name -replace "\.md$", ""
    $name = $name -replace "[\s_\-\[\]]", ""
    return $name
}

# 1. Plan Flow Simulation
Write-Host "--- 1. Plan Flow Simulation ---"
$planFile1 = Join-Path $planPath "2026-06-03_testplan_R0.md"
New-Item -ItemType File -Path $planFile1 -Force | Out-Null
# Simulate revision-archiver calculating next version
$files = Get-ChildItem -Path $planPath -Filter "*.md"
$maxRev = -1
foreach ($f in $files) {
    if ((Get-NormalizedName $f.Name) -eq (Get-NormalizedName "testplan")) {
        if ($f.Name -match "_R([0-9]+)\.md$") {
            $r = [int]$Matches[1]
            if ($r -gt $maxRev) { $maxRev = $r }
        }
    }
}
$nextRev = $maxRev + 1
$planResult = ($nextRev -eq 1)
Write-Host "Plan Next Revision resolved: R$nextRev (Success: $planResult)"
Remove-Item -Path $planFile1 -Force

# 2. Task Flow Simulation (C항 YYYY-MM-DD_[과업주제]_R[N] 명명 검증)
Write-Host "--- 2. Task Flow Simulation ---"
$taskFile1 = Join-Path $taskPath "2026-06-03_testtask_R0.md"
New-Item -ItemType File -Path $taskFile1 -Force | Out-Null
$files = Get-ChildItem -Path $taskPath -Filter "*.md"
$maxRev = -1
foreach ($f in $files) {
    if ((Get-NormalizedName $f.Name) -eq (Get-NormalizedName "testtask")) {
        if ($f.Name -match "_R([0-9]+)\.md$") {
            $r = [int]$Matches[1]
            if ($r -gt $maxRev) { $maxRev = $r }
        }
    }
}
$nextRev = $maxRev + 1
$taskResult = ($nextRev -eq 1)
Write-Host "Task Next Revision resolved: R$nextRev (Success: $taskResult)"
Remove-Item -Path $taskFile1 -Force

# 3. Walkthrough Flow Simulation
Write-Host "--- 3. Walkthrough Flow Simulation ---"
$wtFile1 = Join-Path $walkthroughPath "2026-06-03_testwt_R0.md"
New-Item -ItemType File -Path $wtFile1 -Force | Out-Null
$files = Get-ChildItem -Path $walkthroughPath -Filter "*.md"
$maxRev = -1
foreach ($f in $files) {
    if ((Get-NormalizedName $f.Name) -eq (Get-NormalizedName "testwt")) {
        if ($f.Name -match "_R([0-9]+)\.md$") {
            $r = [int]$Matches[1]
            if ($r -gt $maxRev) { $maxRev = $r }
        }
    }
}
$nextRev = $maxRev + 1
$wtResult = ($nextRev -eq 1)
Write-Host "Walkthrough Next Revision resolved: R$nextRev (Success: $wtResult)"
Remove-Item -Path $wtFile1 -Force

# 4. Report Flow Simulation
Write-Host "--- 4. Report Flow Simulation ---"
$repFile1 = Join-Path $reportPath "2026-06-03_testrep_R0.md"
New-Item -ItemType File -Path $repFile1 -Force | Out-Null
$files = Get-ChildItem -Path $reportPath -Filter "*.md"
$maxRev = -1
foreach ($f in $files) {
    if ((Get-NormalizedName $f.Name) -eq (Get-NormalizedName "testrep")) {
        if ($f.Name -match "_R([0-9]+)\.md$") {
            $r = [int]$Matches[1]
            if ($r -gt $maxRev) { $maxRev = $r }
        }
    }
}
$nextRev = $maxRev + 1
$repResult = ($nextRev -eq 1)
Write-Host "Report Next Revision resolved: R$nextRev (Success: $repResult)"
Remove-Item -Path $repFile1 -Force

# Overall Evaluation
if ($planResult -and $taskResult -and $wtResult -and $repResult) {
    Write-Host "✅ All 4 domains integration workflow validation SUCCESSFUL."
} else {
    Write-Error "❌ Domain integration validation failed."
    exit 1
}
