# 🤝 신우밸브 QMS v2 통합 메모리 (HANDOFF) 시스템 이식 및 규칙 융합 기획안 (R1)

> [!WARNING]
> **[2026-06-02 자가 인스펙션에 따른 잠재 충돌 요소 3대 보완책 반영]**
> 차장님의 예리한 인스펙션 질문에 입각하여 본 플랜의 잠재적 위험성 및 충돌 요소를 전수 분석하고, 이를 원천 예방하는 차단벽 설계를 R1에 긴급 보강하였습니다.

---

## 🚨 1. 자가 진단한 3대 잠재 충돌 요소 및 원천 방어책

### ① Vite 로컬 서버 IP vs Ollama IP의 미묘한 혼선 (환경변수 충돌 예방)
- **위험성**: 이식자료 규칙은 AI가 Ollama 연동 시 무조건 `127.0.0.1`만 사용하게 강제합니다(`ERR-009`). 그러나 QMS v2의 Vite 개발 서버와 Supabase Gateway 로컬 API 통신은 `localhost` 주소를 기반으로 빌드되어 있어, AI가 과도하게 룰북을 강제하다 개발 서버 설정까지 `127.0.0.1`로 덮어씌우는 스타일 과부하 충돌이 발생할 수 있습니다.
- **방어책**: **"Ollama 로컬 AI 모델 API 호출(11434 포트)"**에만 `127.0.0.1` 규칙을 엄격 적용하며, 일반 Vite 개발용 API 및 Supabase 통신은 기존의 파일 규칙과 환경 변수(Vite 기본값)를 철저히 이격 보존하여 절대 침범하지 않습니다.

### ② 무단 백그라운드 Python 자동화 훅의 충돌 (Husky 및 Git Hook 충돌 예방)
- **위험성**: 이식자료의 규칙은 세션 시작/종료 시 백그라운드로 Python 자동 훅(`session_start.py`, `session_end.py`)을 구동하게 유도합니다. 그러나 차장님 PC의 로컬 Python 패키지 환경(FastAPI, pyTelegramBotAPI 의존성 등)이 무결하지 않거나 Husky 커밋 린터와 충돌 시, 커밋이 영구 블록되어 차장님의 작업이 중단되는 끔찍한 에러가 날 수 있습니다.
- **방어책**: 이번 이식 단계에서는 무단 자동 Python 훅 실행 체계는 **전면 제외**하며, 오직 정밀 아카이빙 자산(`HANDOFF.md`, `error-registry.md`, `decision-log.md`)과 스킬 폴더를 수동 조작 및 백업 스크립트(`save-daily-log.ps1`)에 국한해 안전 이식하여 로컬 환경의 보안 무결성을 최우선 확보합니다.

### ③ 전역 스킬 로드 경로의 이원화 충돌 (스킬 탐지 오류 예방)
- **위험성**: 이식자료 내에서는 스킬 로드 경로가 구버전인 `.claude/skills/` 혹은 `personal/.agents/skills/`로 혼재 기재되어 있어 복사 위치를 헷갈릴 시 안티그래비티가 스킬을 탐지 못하고 에러를 내뱉습니다.
- **방어책**: 전역 스킬 복사 대상 경로는 오직 진짜 안티그래비티 2.0 규격 경로인 **`C:\Users\mjjeon\.gemini\antigravity-ide\skills\shinwoo-memory-system\`** 하위로 단일화하여 무조건적으로 타겟을 고정합니다.

---

## 📌 2. 이식 환경 절대 경로 매핑 (mjjeon 환경 특화)

이식 자료 내에 존재하는 구버전 노트북 경로(`mjjeo`/`personal`)들을 현재 노트북 환경(`mjjeon`/`shinwoo-valve-qms`)에 완벽하게 대응하도록 물리적 매핑 및 이관을 설계합니다.

| **자산 구분** | **원본 이식자료 경로** | **최종 이식 대상 경로 (mjjeon 환경)** | **핵심 조정 및 경로 갱신 내용** |
| :--- | :--- | :--- | :--- |
| **1. 메모리 스킬** | `이식자료\.agents\skills\shinwoo-memory-system\` | `C:\Users\mjjeon\.gemini\antigravity-ide\skills\shinwoo-memory-system\` | `SKILL.md` 내부의 모든 구버전 하드코딩 경로를 현재 워크스페이스의 `shinwoo-system\` 하위로 전수 치환 및 보정. |
| **2. 실수 예방 DB** | `이식자료\shinwoo-system\shinwoo-error-registry.md` | `c:\Users\mjjeon\Desktop\QMS 프로젝트\shinwoo-valve-qms\shinwoo-system\shinwoo-error-registry.md` | 과거에 누적된 ERR-001~ERR-016 실수 및 재발 방지 패턴을 그대로 승계하여 재발 차단. |
| **3. 결정 이력 DB** | `이식자료\shinwoo-system\shinwoo-decision-log.md` | `c:\Users\mjjeon\Desktop\QMS 프로젝트\shinwoo-valve-qms\shinwoo-system\shinwoo-decision-log.md` | DEC-001~DEC-019 아키텍처 결정 이력을 영구 보존. |
| **4. 세션 현황판** | `이식자료\shinwoo-system\HANDOFF.md` | `c:\Users\mjjeon\Desktop\QMS 프로젝트\shinwoo-valve-qms\shinwoo-system\HANDOFF.md` | QMS v2 6월 1일 자 도메인 동기화 최종 완료 및 6월 2일 아침 세션 시작 시점에 맞춰 내용을 정교하게 리팩토링. |
| **5. 백업 스크립트** | `이식자료\shinwoo-system\save-daily-log.ps1` | `c:\Users\mjjeon\Desktop\QMS 프로젝트\shinwoo-valve-qms\shinwoo-system\save-daily-log.ps1` | `$brainBase` 검색 절대 경로를 `C:\Users\mjjeon\.gemini\antigravity-ide\brain`으로 정밀 조율하여 PowerShell 백업 기동 보장. |

---

## 🔒 3. 잠긴 표면 (Locked Surface) 및 행동 제약

* **절대 수정 금지 파일 (Locked Surface):**
  - `.eslintrc.cjs`
  - `.agent/rules/04_harness_constraints.md`
  - `.agent/skills/qms-orchestrator/scripts/verify-integration.js`
  - `.agent/skills/qms-orchestrator/scripts/check-structure.js`
* **인간 통제 영역 (Human-Controlled):**
  - 메인 상용 서버 배포 관련 `git push origin main` 은 철저히 차장님의 명시적 승인 전까지 하드 락(Hard Lock) 유지.
  - 이식에 따른 기존 파일의 물리적 제거 및 이동은 차장님의 사전 승인 하에 진행.

---

## 🚨 4. 전역 룰북(GEMINI.md) 정밀 융합(Merge) 설계안

이식자료의 `GEMINI.md`를 그대로 덮어쓸 경우, QMS v2 고유 하네스 제약 사항(배포 3단 프로토콜, 14대 금지 규칙)이 유실되는 치명적 파멸이 일어납니다. 따라서 다음과 같이 **최상위 지능형 융합**을 설계합니다.

* **융합 방식**: 기존 `.agent/rules/GEMINI.md`와 `C:\Users\mjjeon\.gemini\GEMINI.md`의 구조를 그대로 보존하되, 이식자료의 핵심 행동 규칙들을 신규 섹션으로 정밀 등재합니다.
* **신설할 룰셋 섹션:**
  1. **🚨 [최우선] 명시적 실행 승인 규칙**: 대화 시작 시 대기 상태 감지, 비동기 태스크 완료 시 자동 후속 실행 제동, 도구 사용 전 명시적 키워드 획득 프로세스 강화.
  2. **⚡ 안드레 카파시 식 AI 코딩 행동 고삐 규격**: Simplicity First(과설계 금지), Surgical Changes(수술식 최소 변경, 오지랖 정렬 금지) 추가.
  3. **🔋 AI 비용 절약 및 아티팩트 발행 상세 규칙**: 300자 이상/표/로직 출력 시 아티팩트 강제 발행 및 격리 분리 규칙 수립.

---

## 🛠️ 5. 검증 계획 (Verification Plan)

### A. 정적 무결성 점검
- PowerShell로 이식 대상 파일들의 물리적 존재 여부 및 인코딩 점검.
- 복사된 `save-daily-log.ps1` 스크립트 파일이 윈도우 환경에서 실행 차단되지 않도록 권한 획득 여부 확인.

### B. 시동성 검증 (TDD식 동작 실증)
1. **스킬 감지 테스트**: AI에게 *"shinwoo-memory-system 스킬이 로드되었는지 확인해줘"*라고 지시하여 스킬 구조 검증.
2. **HANDOFF 로드 테스트**: 이식된 `HANDOFF.md`, `error-registry.md`, `decision-log.md`를 문제없이 읽어 들이는지 대화창에서 읽기 시연.
3. **무인 백업 스크립트 시운전**: `save-daily-log.ps1`을 백그라운드로 호출하여, 오늘 자 세션 이력(`C:\Users\mjjeon\.gemini\antigravity-ide\brain\ae29063b...`)이 `shinwoo-system/logs/2026-06-02/` 하위 마크다운 파일로 에러 없이 백업되는지 시각적으로 완벽 증빙.

---

차장님의 명시적 **"승인"** 또는 피드백 오더가 접수되는 즉시, 2단계 `task.md`를 기동하고 정밀 이식 수술을 신속히 집행하겠습니다.
