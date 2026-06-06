# encoding: utf-8
$ErrorActionPreference = "Stop"

$antiName = -join @([char]50504, [char]54000, [char]44536, [char]47000, [char]48708, [char]54000)
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptPath "..\..")

$mdFiles = Get-ChildItem -Path (Join-Path $repoRoot $antiName) -Filter "*.md" -Recurse
$allValid = $true

Write-Host "=== 마크다운 이미지 링크 유효성 검사 시작 ==="

foreach ($file in $mdFiles) {
    # 텍스트 로드
    $content = Get-Content -Path $file.FullName -Raw -Encoding utf8
    
    # 이미지 링크 패턴: ![캡션](경로)
    $matches = [Regex]::Matches($content, '!\[.*?\]\((.*?)\)')
    foreach ($m in $matches) {
        $link = $m.Groups[1].Value
        
        # 이미지 폴더를 지칭하는 경우만 체크
        if ($link -like "*images*") {
            $parentDir = Split-Path -Parent $file.FullName
            # 상대경로 결합 및 표준화
            $resolvedPath = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($parentDir, $link))
            
            if (-not (Test-Path $resolvedPath)) {
                Write-Host "Link Error in $($file.FullName):" -ForegroundColor Red
                Write-Host "  -> 경로: $link" -ForegroundColor Red
                Write-Host "  -> 해석결과: $resolvedPath (Not Found)" -ForegroundColor Red
                $allValid = $false
            } else {
                Write-Host "Link OK in $($file.Name): $link" -ForegroundColor Green
            }
        }
    }
}

if ($allValid) {
    Write-Host "`n[성공] 모든 마크다운 문서 내 이미지 상대경로가 실존 경로와 100% 정상 매치됩니다." -ForegroundColor Green
} else {
    Write-Error "일부 이미지 링크 검증 실패!"
}
