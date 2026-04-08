# Hook: Stop
# 세션 종료 시 실행: 변경 파일 전체 스테이지 → 커밋 메시지 생성 → 커밋 → CHANGELOG 갱신
# claude -p 실패 시 WIP 메시지로 폴백
# 원본: commit-session.sh (kimoring-ai-skills) → PowerShell 변환

$ErrorActionPreference = "SilentlyContinue"

# git 루트 경로 확인 (worktree 안전)
$REPO_ROOT = git rev-parse --show-toplevel 2>$null
if (-not $REPO_ROOT) {
    $REPO_ROOT = $env:QMS_PROJECT_DIR
}
if (-not $REPO_ROOT) { exit 0 }

Set-Location $REPO_ROOT

# 모든 변경 사항 스테이지
git add -A 2>$null

# 커밋할 내용 없으면 종료
$diffCheck = git diff-index --quiet HEAD 2>$null
if ($LASTEXITCODE -eq 0) { exit 0 }

# diff 추출 (최대 2000줄)
$DIFF = (git diff --cached 2>$null) -join "`n"
$DIFF_LINES = $DIFF -split "`n" | Select-Object -First 2000
$DIFF = $DIFF_LINES -join "`n"

# Claude headless 모드로 커밋 메시지 생성 시도
$COMMIT_MSG = ""
$claudeExists = Get-Command claude -ErrorAction SilentlyContinue
if ($claudeExists) {
    $prompt = @"
You are a commit message generator. Based on the following git diff, write a single commit message.
Rules:
- First line MUST start with 'WIP(scope): short summary' (max 72 chars)
- Always use 'WIP' as the type prefix, never feat/fix/refactor/etc.
- If needed, add a blank line then bullet points for details
- Be concise and specific
- Output ONLY the commit message, nothing else
"@
    $COMMIT_MSG = ($DIFF | claude -p $prompt 2>$null)
}

# 폴백: claude 실패 또는 빈 메시지
if (-not $COMMIT_MSG) {
    $FILE_COUNT = (git diff --cached --name-only 2>$null | Measure-Object -Line).Lines
    $COMMIT_MSG = "wip: update $FILE_COUNT files"
}

# 커밋 실행
$COMMIT_MSG | git commit -F - --no-verify 2>$null

# CHANGELOG 갱신 (파일 존재 시)
$CHANGELOG = Join-Path $REPO_ROOT "docs\CHANGELOG.md"
if (Test-Path $CHANGELOG) {
    $TIMESTAMP = Get-Date -Format "yyyy-MM-dd HH:mm"
    $FIRST_LINE = ($COMMIT_MSG -split "`n")[0]
    $content = Get-Content $CHANGELOG -Raw

    if ($content -match "## \[Unreleased\]") {
        $newEntry = "- $TIMESTAMP`: $FIRST_LINE"
        $content = $content -replace "(## \[Unreleased\])", "`$1`n$newEntry"
        Set-Content $CHANGELOG $content -Encoding UTF8
    }

    git add $CHANGELOG 2>$null
    $diffCheck2 = git diff-index --quiet HEAD 2>$null
    if ($LASTEXITCODE -ne 0) {
        git commit -m "docs: auto-update changelog" --no-verify 2>$null
    }
}

Write-Host "commit-session 훅 실행 완료"
