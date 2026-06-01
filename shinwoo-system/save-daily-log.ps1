# save-daily-log.ps1
# 신우밸브 AI QMS v2 — 날짜별 대화 로그 저장 및 백업 스크립트
# 위치: shinwoo-system\save-daily-log.ps1
# 실행: .\shinwoo-system\save-daily-log.ps1

$today = Get-Date -Format "yyyy-MM-dd"
$brainBase = "$env:USERPROFILE\.gemini\antigravity-ide\brain"
$logsBase  = "$PSScriptRoot\logs\$today"

# 날짜 폴더 생성
if (-not (Test-Path $logsBase)) {
    New-Item -ItemType Directory -Path $logsBase -Force | Out-Null
}

Write-Host "=== 신우밸브 QMS v2 AI 로그 백업 ===" -ForegroundColor Cyan
Write-Host "날짜: $today"
Write-Host "백업 저장소: $logsBase"
Write-Host ""

# brain 폴더 내 모든 대화 폴더의 transcript.jsonl 복사 (안티그래비티 2.0 규격 대응)
$conversations = Get-ChildItem -Path $brainBase -Directory -ErrorAction SilentlyContinue

if (-not $conversations) {
    Write-Host "  ⚠️ brain 폴더를 찾을 수 없습니다: $brainBase" -ForegroundColor Yellow
    exit 1
}

$saved = 0
foreach ($conv in $conversations) {
    if ($null -eq $conv -or -not $conv.FullName) { continue }
    # 문자열 보간으로 안전 결합하여 Join-Path null 바인딩 오류 회피
    $transcriptPath = "$($conv.FullName)\.system_generated\logs\transcript.jsonl"
    $mdLogPath = "$($conv.FullName)\walkthrough.md"


    # 오늘 생성되거나 수정된 대화 백업 처리
    if (Test-Path $transcriptPath) {
        $lastWrite = (Get-Item $transcriptPath).LastWriteTime.ToString("yyyy-MM-dd")

        if ($lastWrite -eq $today) {
            $shortId = $conv.Name.Substring(0, [Math]::Min(8, $conv.Name.Length))
            $destFile = Join-Path $logsBase "$($conv.Name)_transcript.jsonl"
            Copy-Item -Path $transcriptPath -Destination $destFile -Force
            
            # walkthrough.md가 존재하는 경우 함께 스냅샷 백업
            if (Test-Path $mdLogPath) {
                Copy-Item -Path $mdLogPath -Destination (Join-Path $logsBase "$($conv.Name)_walkthrough.md") -Force
            }
            
            Write-Host "  ✅ 백업 성공: $shortId... → $today 하위 파일 백업 완료" -ForegroundColor Green
            $saved++
        }
    }
}

if ($saved -eq 0) {
    Write-Host "  ℹ️ 오늘 백업할 수정/생성된 대화 세션이 없습니다." -ForegroundColor Gray
}

Write-Host ""
Write-Host "완료! 오늘 백업 완료된 대화 세션 수: $saved" -ForegroundColor Cyan

# 전체 날짜별 로그 목록
Write-Host ""
Write-Host "=== 백업 날짜별 누적 로그 현황 ===" -ForegroundColor Yellow
$allDates = Get-ChildItem -Path "$PSScriptRoot\logs" -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending
foreach ($d in $allDates) {
    $count = (Get-ChildItem -Path $d.FullName -File).Count
    Write-Host "  $($d.Name) — 총 $count 개 백업 파일 존재" -ForegroundColor White
}
