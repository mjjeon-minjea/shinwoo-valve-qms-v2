$frontendPort = 5173
$backendPort = 3001

$frontendProcess = Get-NetTCPConnection -LocalPort $frontendPort -State Listen -ErrorAction SilentlyContinue
$backendProcess = Get-NetTCPConnection -LocalPort $backendPort -State Listen -ErrorAction SilentlyContinue

Clear-Host
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "              QMS 개발 서버 구동 상태 점검" -ForegroundColor Green
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

$allRunning = $true

if ($null -ne $frontendProcess) {
    Write-Host "[OK] 프론트엔드 서버 (Vite, 포트 $frontendPort) : 정상 실행 중" -ForegroundColor Green
} else {
    Write-Host "[FAIL] 프론트엔드 서버 (Vite, 포트 $frontendPort) : 꺼져 있음!" -ForegroundColor Red
    $allRunning = $false
}

if ($null -ne $backendProcess) {
    Write-Host "[OK] 백엔드 API 서버 (JSON Server, 포트 $backendPort) : 정상 실행 중" -ForegroundColor Green
} else {
    Write-Host "[FAIL] 백엔드 API 서버 (JSON Server, 포트 $backendPort) : 꺼져 있음!" -ForegroundColor Red
    $allRunning = $false
}

Write-Host ""
Write-Host "===================================================" -ForegroundColor Cyan

if ($allRunning -eq $true) {
    Write-Host "모든 서버가 정상적으로 켜져 있습니다. 브라우저로 접속 가능합니다!" -ForegroundColor Yellow
    Write-Host "접속 주소: http://localhost:5173" -ForegroundColor White
} else {
    Write-Host "하나 이상의 서버가 꺼져 있습니다." -ForegroundColor Red
    Write-Host "개발 환경을 올바르게 실행하려면 터미널 창을 두 개 열고 각각 아래 명령어를 입력하세요:" -ForegroundColor Yellow
    Write-Host "  1. npm run dev" -ForegroundColor White
    Write-Host "  2. node server.js" -ForegroundColor White
}
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "아무 키나 누르면 종료됩니다..." -ForegroundColor Gray
$host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") | Out-Null
