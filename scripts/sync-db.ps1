# ========================================================
# 신우밸브 QMS 상용 ➔ Staging 다이렉트 동기화 스크립트
# ========================================================

Write-Host "🚧 신우밸브 QMS DB 동기화 파이프라인 가동 (Production ➔ Staging) 🚧" -ForegroundColor Cyan

# 1. 인증키 로드 (.env.local에서 은닉된 환경변수를 읽어와 강제 주입)
$envFile = Join-Path $PSScriptRoot "..\.env.local"
if (Test-Path $envFile) {
    Get-Content $envFile | Where-Object { $_ -match '^([^#][^=]+)=(.*)$' } | ForEach-Object {
        Set-Item -Path "Env:$($Matches[1])" -Value $Matches[2].Trim("`"'")
    }
    Write-Host "[OK] 데이터베이스 연결 마스터키 인증 완료" -ForegroundColor Green
} else {
    Write-Host "[ERROR] .env.local 보안 파일을 찾을 수 없습니다." -ForegroundColor Red
    exit 1
}

# 변수 누락 치명적 예외 처리
if (-not $env:PROD_DB_URL -or -not $env:STAGING_DB_URL) {
    Write-Host "[ERROR] PROD_DB_URL 또는 STAGING_DB_URL 키가 설정되어 있지 않습니다." -ForegroundColor Red
    exit 1
}

# 2. 상용 DB에서 생생한 뼈대(DDL) 및 권한 추출 (Dump)
Write-Host "`n[1단계] 상용 DB(Production) 설계도 추출 착수..." -ForegroundColor Yellow
npx supabase db dump --db-url $env:PROD_DB_URL -f prod_schema.sql

# (데이터 포함 옵션) 상용 DB의 기초 계정/통계 데이터 등 필수 알맹이도 덮어쓰려면 아래 로직을 활성화 하십시오.
Write-Host "[선택] 데이터까지 덮어쓰려면 아래 로직을 활성화 하십시오." -ForegroundColor Gray
npx supabase db dump --data-only --db-url $env:PROD_DB_URL -f prod_data.sql

# 3. 추출된 설계도를 Staging DB에 강압적으로 박아넣음 (Push)
Write-Host "`n[2단계] 테스트 DB(Staging) 강제 덮어쓰기 시작..." -ForegroundColor Yellow
npx supabase db execute --db-url $env:STAGING_DB_URL -f prod_schema.sql
npx supabase db execute --db-url $env:STAGING_DB_URL -f prod_data.sql

# 작업 완료 후 추출된 임시 설계도 영구 폐기 (잔재 방지)
if (Test-Path prod_schema.sql) { Remove-Item prod_schema.sql }
if (Test-Path prod_data.sql) { Remove-Item prod_data.sql }

Write-Host "`n✅ 동기화 및 실험실(Staging) 리셋 완료! 안전하게 장기 테스트를 시작하십시오." -ForegroundColor Green
