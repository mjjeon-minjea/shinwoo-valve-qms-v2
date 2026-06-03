# 2. Topic normalization and revision control validation script
$workspaceRoot = $pwd.Path

# Restore '안티그래비티' via UTF-8 bytes to avoid encoding issues
$utf8Bytes = [byte[]]@(0xEC, 0x95, 0x88, 0xED, 0x8B, 0xB0, 0xEA, 0xB7, 0xB8, 0xEB, 0x9E, 0x98, 0xEB, 0xB9, 0x84, 0xED, 0x8B, 0xB0)
$antigravityName = [System.Text.Encoding]::UTF8.GetString($utf8Bytes)
$planPath = Join-Path $workspaceRoot (Join-Path $antigravityName "plan")

Write-Host "Target Plan Path: $planPath"

# Create directory if it does not exist
if (-not (Test-Path $planPath)) {
    New-Item -ItemType Directory -Path $planPath -Force | Out-Null
}

# 1. Create mock files for testing
$file1 = Join-Path $planPath "2026-06-02_inspect_R1.md"
$file2 = Join-Path $planPath "2026-06-03_inspect_R0.md"
New-Item -ItemType File -Path $file1 -Force | Out-Null
New-Item -ItemType File -Path $file2 -Force | Out-Null
Write-Host "Created mock files for testing."

# 2. Define target topic to archive
$newSubject = "inspect"
$newDate = "2026-06-03"

# Normalization function (No complex regex brackets to avoid parsing error)
function Get-NormalizedSubject ($fileName) {
    # If starting with date prefix (11 characters like 'YYYY-MM-DD_'), strip it
    $name = $fileName
    if ($name.Length -gt 11 -and $name.Substring(4,1) -eq "-" -and $name.Substring(7,1) -eq "-") {
        $name = $name.Substring(11)
    }
    # Remove _R\d+ suffix and extension
    $name = $name -replace "_R[0-9]+(\.md)?$", ""
    $name = $name -replace "\.md$", ""
    # Strip spaces and underscores
    $name = $name -replace "[\s_\-\[\]]", ""
    return $name
}

# 3. Scan existing files to find match and max revision
$maxRevision = -1
$subjectMatchCount = 0

$existingFiles = Get-ChildItem -Path $planPath -Filter "*.md"
foreach ($file in $existingFiles) {
    $normSubject = Get-NormalizedSubject $file.Name
    $targetNorm = Get-NormalizedSubject $newSubject
    
    if ($normSubject -eq $targetNorm) {
        $subjectMatchCount++
        # Parse revision number
        if ($file.Name -match "_R([0-9]+)\.md$") {
            $revNum = [int]$Matches[1]
            if ($revNum -gt $maxRevision) {
                $maxRevision = $revNum
            }
        }
    }
}

Write-Host "Matching topic count: $subjectMatchCount"
Write-Host "Max revision found: $maxRevision"

# 4. Calculate next revision
$nextRevision = 0
if ($subjectMatchCount -gt 0) {
    $nextRevision = $maxRevision + 1
}

$nextFileName = "${newDate}_${newSubject}_R${nextRevision}.md"
Write-Host "Calculated next file name: $nextFileName"

# 5. Validation check (Expected nextRevision is 2 since max was R1)
if ($nextRevision -eq 2) {
    Write-Host "✅ Revision normalization and increment validation successful: R2 resolved."
    # Clean up mock files
    Remove-Item -Path $file1 -Force
    Remove-Item -Path $file2 -Force
    Write-Host "Cleaned up mock files."
} else {
    Write-Error "❌ Validation failed: Expected R2, but got R$nextRevision"
    Remove-Item -Path $file1 -Force
    Remove-Item -Path $file2 -Force
    exit 1
}
