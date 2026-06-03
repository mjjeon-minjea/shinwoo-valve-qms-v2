# 1. 동적 세션 경로 탐색 검증 스크립트 (UTF-8 바이트 디코딩 우회 버전)
$brainPath = "C:\Users\mjjeon\.gemini\antigravity-ide\brain"

# 현재 위치($pwd)로부터 워크스페이스 루트 경로 획득 (코드 내 한글 배제)
$workspaceRoot = $pwd.Path

# '안티그래비티' 한글 폴더명을 UTF-8 바이트 배열로부터 동적 복원
# 안(EC 95 88) 티(ED 8B B0) 그(EA B7 B8) 래(EB 9E 98) 비(EB B9 84) 티(ED 8B B0)
$utf8Bytes = [byte[]]@(0xEC, 0x95, 0x88, 0xED, 0x8B, 0xB0, 0xEA, 0xB7, 0xB8, 0xEB, 0x9E, 0x98, 0xEB, 0xB9, 0x84, 0xED, 0x8B, 0xB0)
$antigravityName = [System.Text.Encoding]::UTF8.GetString($utf8Bytes)

# 'images' 폴더 경로 조립
$destPath = Join-Path $workspaceRoot (Join-Path $antigravityName "images")

Write-Host "Workspace Root: $workspaceRoot"
Write-Host "Target Images Path: $destPath"

# destination 디렉토리가 없으면 생성
if (-not (Test-Path $destPath)) {
    New-Item -ItemType Directory -Path $destPath -Force | Out-Null
}

# 1. 가장 최근 수정된 세션 폴더(mtime 기준 최신) 탐색
$latestSession = Get-ChildItem -Path $brainPath -Directory | 
                 Sort-Object LastWriteTime -Descending | 
                 Select-Object -First 1

if ($null -eq $latestSession) {
    Write-Error "세션 디렉토리를 찾을 수 없습니다."
    exit 1
}

Write-Host "최신 세션 폴더: $($latestSession.FullName)"

# 2. 검증을 위한 임시 가짜 이미지 파일 생성
$tempImgName = "test_temp_img_$(Get-Date -Format 'yyyyMMddHHmmss').png"
$tempImgPath = Join-Path $latestSession.FullName $tempImgName
New-Item -ItemType File -Path $tempImgPath -Force | Out-Null
Write-Host "임시 이미지 파일 생성: $tempImgPath"

# 3. 최신 세션 내에서 방금 생성된 최신 이미지 탐색
$latestImage = Get-ChildItem -Path $latestSession.FullName -Filter "*.png" | 
               Sort-Object LastWriteTime -Descending | 
               Select-Object -First 1

if ($null -eq $latestImage) {
    Write-Error "이미지 파일을 찾을 수 없습니다."
    exit 1
}

Write-Host "대상 이미지: $($latestImage.FullName)"

# 4. 복사 실행
$targetFile = Join-Path $destPath $latestImage.Name
Copy-Item -Path $latestImage.FullName -Destination $targetFile -Force

if (Test-Path $targetFile) {
    Write-Host "✅ 이미지 복사 검증 성공: $targetFile"
    # 테스트용 임시 파일들 정리
    Remove-Item -Path $tempImgPath -Force
    Remove-Item -Path $targetFile -Force
    Write-Host "임시 파일 정리 완료."
} else {
    Write-Error "❌ 이미지 복사 실패"
    exit 1
}
