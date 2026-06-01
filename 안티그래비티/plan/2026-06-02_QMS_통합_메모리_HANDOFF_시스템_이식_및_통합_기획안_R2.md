# 🤝 신우밸브 QMS v2 통합 메모리 (HANDOFF) 시스템 이식 및 규칙 융합 기획안 (R2)

> [!IMPORTANT]
> **[차장님 지적 사항 수용: 3대 이식/교정 실물 완제 소스 코드 100% 등재]**
> "대충 처리하겠다"는 안일한 요약 방식을 전면 타파하고, 이번 이식 수술 과정에서 실제 반영될 모든 물리적 완제 소스 코드를 한 줄의 생략(...)도 없이 기획서 R2에 전격 박제 수록합니다. 차장님께서 코드의 안전성을 100% 검증하실 수 있도록 설계했습니다.

---

## 💻 1. 이식/생성될 3대 실물 완제 소스 코드 명세

### ① `SKILL.md` (최종 갱신될 전역 메모리 스킬 코드 전체)
- **대상 경로**: `C:\Users\mjjeon\.gemini\antigravity-ide\skills\shinwoo-memory-system\SKILL.md`
- **반영 소스 코드**:
```markdown
---
name: shinwoo-memory-system
description: >
  신우밸브 AI 시스템 통합 메모리 스킬.
  대화 종료/시작 시 HANDOFF.md, error-registry.md, decision-log.md를 동기화하고
  날짜별 로그를 자동 저장하여 대화 간 컨텍스트 유실을 방지합니다.
triggers:
  - 기억해
  - 저장해
  - 종료해
  - 이어서
  - HANDOFF
---

# 신우밸브 통합 메모리 시스템 스킬

## Antigravity 2.0 환경 주의사항

> Hooks(PreToolUse, PostToolUse 등)는 Antigravity에서 자동 작동하지 않습니다.
> 이 스킬의 모든 절차는 AI가 rules/GEMINI.md의 지시에 따라 대화 중에 "수동으로" 실행합니다.

---

## 핵심 원칙

1. **실수는 반드시 레지스트리에 기록** — 단순 사과나 인정으로 끝내지 않는다.
2. **추론 금지** — 접속 정보, 인프라 현황은 파일 확인 후 판단.
3. **계층적 기억**:
   - Level 1: `HANDOFF.md` — 현황 요약 (매 대화 필수)
   - Level 2: `shinwoo-decision-log.md` — 결정 이유 (필요 시)
   - Level 3: `shinwoo-error-registry.md` — 실수 방지 (매 대화 필수)
   - Level 4: `logs/YYYY-MM-DD/` — 전체 원문 (검색용)

---

## 새 대화 시작 절차 (Session Start Protocol)

### Step 1: 실수 레지스트리 읽기 (원천 차단)
- 경로: `c:\Users\mjjeon\Desktop\QMS 프로젝트\shinwoo-valve-qms\shinwoo-system\shinwoo-error-registry.md`

### Step 2: HANDOFF.md 읽기 (현황)
- 경로: `c:\Users\mjjeon\Desktop\QMS 프로젝트\shinwoo-valve-qms\shinwoo-system\HANDOFF.md`

### Step 3: 결정 로그 읽기 (맥락)
- 경로: `c:\Users\mjjeon\Desktop\QMS 프로젝트\shinwoo-valve-qms\shinwoo-system\shinwoo-decision-log.md`

### Step 4: 현황 보고 후 시작
```
📋 현황 확인 완료
- 현재 Phase: [XX]
- 다음 작업: [XX]  
- 주의(error-registry 기반): [XX]
```

---

## 종료 절차 (기억해/저장해/종료해 호출 시)

1. `HANDOFF.md` 갱신 (확인된 값만, 추측 금지)
2. 이번 대화 실수 ➔ `error-registry.md`에 `ERR-[번호]` 추가
3. 중요 결정 ➔ `decision-log.md`에 `DEC-[번호]` 추가
4. 날짜별 로그 저장 안내:
   - PowerShell 실행: `c:\Users\mjjeon\Desktop\QMS 프로젝트\shinwoo-valve-qms\shinwoo-system\save-daily-log.ps1`
5. 저장 완료 보고

---

## 실수 발생 즉시 처리

1. `error-registry.md`에 `ERR-XXX` 즉시 추가
2. 재발 방지 규칙 현재 대화에 즉시 적용
3. 사용자에게 업데이트 완료 보고

---

## 파일 위치 요약

| 파일 | 경로 |
|------|------|
| HANDOFF.md | `c:\Users\mjjeon\Desktop\QMS 프로젝트\shinwoo-valve-qms\shinwoo-system\HANDOFF.md` |
| 실수 레지스트리 | `c:\Users\mjjeon\Desktop\QMS 프로젝트\shinwoo-valve-qms\shinwoo-system\shinwoo-error-registry.md` |
| 결정 로그 | `c:\Users\mjjeon\Desktop\QMS 프로젝트\shinwoo-valve-qms\shinwoo-system\shinwoo-decision-log.md` |
| 날짜별 로그 | `c:\Users\mjjeon\Desktop\QMS 프로젝트\shinwoo-valve-qms\shinwoo-system\logs\YYYY-MM-DD\` |
| 로그 스크립트 | `c:\Users\mjjeon\Desktop\QMS 프로젝트\shinwoo-valve-qms\shinwoo-system\save-daily-log.ps1` |
```

---

### ② `save-daily-log.ps1` (수정 적용될 PowerShell 백업 스크립트 전체)
- **대상 경로**: `c:\Users\mjjeon\Desktop\QMS 프로젝트\shinwoo-valve-qms\shinwoo-system\save-daily-log.ps1`
- **반영 소스 코드**:
```powershell
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
    # 안티그래비티 2.0의 실제 세션 이력 마크다운 로그 및 transcript 경로 검색
    $transcriptPath = Join-Path $conv.FullName ".system_generated\logs\transcript.jsonl"
    $mdLogPath = Join-Path $conv.FullName "walkthrough.md" # 또는 주요 마크다운

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
```

---

### ③ `GEMINI.md` (융합 갱신될 3대 고삐 규칙 룰셋 코드 추가분 전체)
- **대상 경로**: `c:\Users\mjjeon\Desktop\QMS 프로젝트\shinwoo-valve-qms\.agent\rules\GEMINI.md` 및 `C:\Users\mjjeon\.gemini\GEMINI.md`
- **반영 소스 코드 (기존 룰북 하단에 추가될 정밀 병합 본)**:
```markdown
## 🚨 [최우선] 명시적 실행 승인 및 AI 행동 통제 제약

### 1. 명시적 승인 키워드 필수 프로세스
- 사용자가 입력창에 **"승인"**, **"허가"**, **"진행"**, **"시작"**, **"Go"** 등의 명시적인 의사 표현을 주어 결재하지 않은 경우, 코드를 수정(write_to_file)하거나 원격 반영(git push)하는 모든 물리 도구 호출을 **원천 차단**한다.
- 단순 조회(`view_file`, `list_dir`, `git status`)를 통한 현황 진단은 팩트 파악을 위해 즉시 기동하되, 기획안 승인 전까지는 코드의 변경을 유발하지 않는다.
- 비동기 태스크 구동 완료 시, 후속 작업을 임의로 개시하지 않고 완료 상태만 텍스트 보고한 후 즉시 대기한다.

### 2. ⚡ 안드레 카파시 식 AI 코딩 행동 고삐 규격
- **Simplicity First (과설계 방지)**: 요청 사항에 없는 추상 클래스, 장황한 인터페이스 설계, 디자인 패턴 남용, "나중에 쓰일 기능"은 단 한 줄도 코드에 적지 않는다. 50줄로 해결될 코드를 200줄로 늘리지 마라.
- **Surgical Changes (수술식 최소 변경)**: 소스코드를 수정할 때, 지정된 요건 범위 외의 인접한 멀쩡한 코드의 인덴팅, 줄바꿈, Adjacent Comments를 임의로 재정리(오지랖 리팩토링)하지 마라. 본인이 선호하는 린터가 있더라도 원본 파일 스타일을 100% 모방한다.
- **Ollama IP 127.0.0.1 강제 규칙**: 로컬 AI API 연동(11434 포트) 시에는 IPv6 교착 에러를 막기 위해 `localhost` 사용을 금지하고 반드시 `127.0.0.1`을 강제하되, 일반 로컬 Vite 개발 서버 및 API는 기존의 환경 변수(Vite 기본값)를 철저히 이격 보존하여 침범하지 않는다.

### 3. 🔋 AI 비용 절약 및 아티팩트 발행 상세 규격
- 제공하는 한글 텍스트 답변이 **300자 이상**이 되거나 **표(Table), 로직 구조, 다이어그램**을 출력하는 경우, 채팅창의 명료성을 위해 우측 뷰 패널에 아티팩트로 발행한다.
- 새로운 계획서(`implementation_plan.md`), 태스크(`task.md`) 등을 발행할 때 기존 파일이 존재하면 단순 덮어쓰기(`Overwrite=true`)를 금지하며, `_v2`, `_v3` 등의 버전 번호를 올려 신규 독립 파일로 공존 생성한다.
```

---

## 🔒 2. 잠긴 표면 (Locked Surface) 및 행동 제약

* **절대 수정 금지 파일 (Locked Surface):**
  - `.eslintrc.cjs`
  - `.agent/rules/04_harness_constraints.md`
  - `.agent/skills/qms-orchestrator/scripts/verify-integration.js`
  - `.agent/skills/qms-orchestrator/scripts/check-structure.js`
* **인간 통제 영역 (Human-Controlled):**
  - 메인 상용 서버 배포 관련 `git push origin main` 은 철저히 차장님의 명시적 승인 전까지 하드 락(Hard Lock) 유지.
  - 이식에 따른 기존 파일의 물리적 제거 및 이동은 차장님의 사전 승인 하에 진행.

---

## 🛠️ 3. 검증 계획 (Verification Plan)

### A. 정적 무결성 점검
- PowerShell로 이식 대상 파일들의 물리적 존재 여부 및 인코딩 점검.
- 복사된 `save-daily-log.ps1` 스크립트 파일이 윈도우 환경에서 실행 차단되지 않도록 권한 획득 여부 확인.

### B. 시동성 검증 (TDD식 동작 실증)
1. **스킬 감지 테스트**: AI에게 *"shinwoo-memory-system 스킬이 로드되었는지 확인해줘"*라고 지시하여 스킬 구조 검증.
2. **HANDOFF 로드 테스트**: 이식된 `HANDOFF.md`, `error-registry.md`, `decision-log.md`를 문제없이 읽어 들이는지 대화창에서 읽기 시연.
3. **무인 백업 스크립트 시운전**: `save-daily-log.ps1`을 백그라운드로 호출하여, 오늘 자 세션 이력(`C:\Users\mjjeon\Desktop\QMS 프로젝트\shinwoo-valve-qms`)이 `shinwoo-system/logs/2026-06-02/` 하위 파일들로 에러 없이 백업되는지 시각적으로 완벽 증빙.

---

차장님의 명시적 **"승인"** 또는 피드백 오더가 접수되는 즉시, 2단계 `task.md`를 기동하고 정밀 이식 수술을 신속히 집행하겠습니다.
