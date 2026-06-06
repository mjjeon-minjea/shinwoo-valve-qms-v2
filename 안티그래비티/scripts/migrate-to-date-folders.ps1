# encoding: utf-8
$ErrorActionPreference = "Stop"

# 한글 폴더명 및 유니코드 아스크 문자 정의 (인코딩 에러 원천 차단)
# "안티그래비티" = 안(50504) 티(54000) 그(44536) 래(47000) 비(48708) 티(54000)
$antiName = -join @([char]50504, [char]54000, [char]44536, [char]47000, [char]48708, [char]54000)
# "년" = 45380, "월" = 50900, "일" = 51068
$kYear = [char]45380
$kMonth = [char]50900
$kDay = [char]51068

# 스크립트 실행 경로 및 저장소 루트 식별
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptPath "..\..")

Write-Host "=== QMS Resources Migration Start ==="
Write-Host "Repo Root: $repoRoot"
Write-Host "Target Folder Name: $antiName"

# 1. 이관 대상 설정
$docFolders = @("plan", "task", "walkthrough", "report")
$imageDateMap = @{} # 이미지 파일별 이관 일자 매핑 수집용

# 2. 이미지 파일 이관 및 날짜 매핑 수집
$imagesPath = Join-Path $repoRoot "$antiName\images"
if (Test-Path $imagesPath) {
    Write-Host "`n[1/3] Analyzing and Moving Image Files..."
    $imgFiles = Get-ChildItem -Path $imagesPath -File
    foreach ($file in $imgFiles) {
        $date = $file.LastWriteTime
        $yearStr = $date.ToString("yyyy") + $kYear
        $monthStr = $date.ToString("MM") + $kMonth
        $dayStr = $date.ToString("dd") + $kDay
        
        $destSubPath = "images\$yearStr\$monthStr\$dayStr"
        $destFullPath = Join-Path $repoRoot "$antiName\$destSubPath"
        
        # 맵에 기록 (치환용)
        $imageDateMap[$file.Name] = "$yearStr/$monthStr/$dayStr"
        
        if (-not (Test-Path $destFullPath)) {
            New-Item -ItemType Directory -Force -Path $destFullPath | Out-Null
        }
        
        $srcFile = $file.FullName
        $destFile = Join-Path $destFullPath $file.Name
        Write-Host "  -> Moving Image: $($file.Name) to $destSubPath"
        
        try {
            git mv "$srcFile" "$destFile" 2>$null
        } catch {
            Move-Item -Path "$srcFile" -Destination "$destFile" -Force
        }
    }
}

# 3. 문서 4종 폴더 이관
Write-Host "`n[2/3] Moving 4 Document Folders (Plan, Task, Walkthrough, Report)..."
$movedDocs = @()

foreach ($folder in $docFolders) {
    $folderPath = Join-Path $repoRoot "$antiName\$folder"
    if (-not (Test-Path $folderPath)) { continue }
    
    $files = Get-ChildItem -Path $folderPath -File -Filter "*.md"
    foreach ($file in $files) {
        # 파일명에서 날짜 추출 시도
        if ($file.Name -match "^(\d{4})-(\d{2})-(\d{2})") {
            $yearStr = $Matches[1] + $kYear
            $monthStr = $Matches[2] + $kMonth
            $dayStr = $Matches[3] + $kDay
        } else {
            $date = $file.LastWriteTime
            $yearStr = $date.ToString("yyyy") + $kYear
            $monthStr = $date.ToString("MM") + $kMonth
            $dayStr = $date.ToString("dd") + $kDay
        }
        
        $destSubPath = "$folder\$yearStr\$monthStr\$dayStr"
        $destFullPath = Join-Path $repoRoot "$antiName\$destSubPath"
        
        if (-not (Test-Path $destFullPath)) {
            New-Item -ItemType Directory -Force -Path $destFullPath | Out-Null
        }
        
        $srcFile = $file.FullName
        $destFile = Join-Path $destFullPath $file.Name
        Write-Host "  -> Moving Doc: $($file.Name) to $destSubPath"
        
        try {
            git mv "$srcFile" "$destFile" 2>$null
        } catch {
            Move-Item -Path "$srcFile" -Destination "$destFile" -Force
        }
        
        $movedDocs += [PSCustomObject]@{
            FullPath = $destFile
            RelativeDepth = 3
        }
    }
}

# 4. 문서 내 이미지 상대 경로 치환
Write-Host "`n[3/3] Autotuning Markdown Image Links..."
foreach ($doc in $movedDocs) {
    $content = Get-Content -Path $doc.FullPath -Raw -Encoding utf8
    $hasChanges = $false
    
    # 마크다운 이미지 정규식: !\[캡션\](../images/파일명)
    $matches = [Regex]::Matches($content, '!\[(.*?)\]\(\.\./images/(.*?)\)')
    foreach ($m in $matches) {
        $caption = $m.Groups[1].Value
        $imgName = $m.Groups[2].Value
        
        if ($imageDateMap.ContainsKey($imgName)) {
            $imgDateSubPath = $imageDateMap[$imgName]
            $newLink = "../../../images/$imgDateSubPath/$imgName"
            $oldLinkPattern = [Regex]::Escape($m.Value)
            $newLinkFull = "![$caption]($newLink)"
            
            $content = [Regex]::Replace($content, $oldLinkPattern, $newLinkFull)
            $hasChanges = $true
            Write-Host "  -> Fixing link in $($doc.FullPath | Split-Path -Leaf): $imgName to $newLink"
        } else {
            $newLink = "../../../images/$imgName"
            $oldLinkPattern = [Regex]::Escape($m.Value)
            $newLinkFull = "![$caption]($newLink)"
            $content = [Regex]::Replace($content, $oldLinkPattern, $newLinkFull)
            $hasChanges = $true
            Write-Host "  [!] Warning: Image $imgName not found in map, using fallback: $newLink"
        }
    }
    
    if ($hasChanges) {
        [System.IO.File]::WriteAllText($doc.FullPath, $content, [System.Text.Encoding]::UTF8)
    }
}

Write-Host "`n=== Migration Completed Successfully! ==="
