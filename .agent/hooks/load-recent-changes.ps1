# Hook: SessionStart
# 세션 시작 시 실행: 최근 CHANGELOG 및 git 커밋 이력을 컨텍스트로 출력
# 원본: load-recent-changes.sh (kimoring-ai-skills) → PowerShell 변환

$ErrorActionPreference = "SilentlyContinue"

# git 루트 경로 확인 (worktree 안전)
$REPO_ROOT = git rev-parse --show-toplevel 2>$null
if (-not $REPO_ROOT) {
    $REPO_ROOT = $env:QMS_PROJECT_DIR
}
if (-not $REPO_ROOT) { exit 0 }

Set-Location $REPO_ROOT

$CHANGELOG = Join-Path $REPO_ROOT "docs\CHANGELOG.md"
$CONTEXT = ""

# 최근 CHANGELOG 항목 (마지막 20줄)
if (Test-Path $CHANGELOG) {
    $RECENT_CHANGELOG = (Get-Content $CHANGELOG -Tail 20 -ErrorAction SilentlyContinue) -join "`n"
    if ($RECENT_CHANGELOG) {
        $CONTEXT = "Recent CHANGELOG entries:`n$RECENT_CHANGELOG`n`n"
    }
}

# 최근 git 커밋 (10개)
$RECENT_COMMITS = (git log --oneline -10 2>$null) -join "`n"
if ($RECENT_COMMITS) {
    $CONTEXT = "$CONTEXT`Recent commits:`n$RECENT_COMMITS"
}

# JSON 형식으로 출력 (Claude Code 훅 시스템용)
if ($CONTEXT) {
    # JSON 특수문자 이스케이프
    $escaped = $CONTEXT `
        -replace '\\', '\\\\' `
        -replace '"', '\"' `
        -replace "`r`n", '\n' `
        -replace "`n", '\n' `
        -replace "`t", '\t'
    Write-Output "{`"additionalContext`": `"$escaped`"}"
}
