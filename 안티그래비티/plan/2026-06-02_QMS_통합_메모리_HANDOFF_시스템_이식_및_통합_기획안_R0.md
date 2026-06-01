# 🤝 신우밸브 QMS v2 통합 메모리 (HANDOFF) 시스템 이식 및 규칙 융합 기획안 (R0)

본 기획안은 타 노트북에서 성공적으로 구동되던 신우밸브 통합 메모리 시스템(HANDOFF, 실수 예방 DB, 결정 이력 DB, 백업 스크립트, 세션 백업 스킬)을 현재 QMS v2 프로젝트 워크스페이스 환경에 오차 없이 이식하고, 전역 룰북(`GEMINI.md`)과 정밀 융합하기 위한 마스터 설계서입니다.

---

## 📌 1. 이식 환경 절대 경로 매핑 (mjjeon 환경 특화)

이식 자료 내에 존재하는 구버전 노트북 경로(`mjjeo`/`personal`)들을 현재 노트북 환경(`mjjeon`/`shinwoo-valve-qms`)에 완벽하게 대응하도록 물리적 매핑 및 이관을 설계합니다.

| **자산 구분** | **원본 이식자료 경로** | **최종 이식 대상 경로 (mjjeon 환경)** | **핵심 조정 및 경로 갱신 내용** |
| :--- | :--- | :--- | :--- |
| **1. 메모리 스킬** | `이식자료\.agents\skills\shinwoo-memory-system\` | `C:\Users\mjjeon\.gemini\antigravity-ide\skills\shinwoo-memory-system\` | `SKILL.md` 내부의 모든 구버전 하드코딩 경로를 현재 워크스페이스의 `shinwoo-system\` 하위로 전수 치환 및 보정. |
| **2. 실수 예방 DB** | `이식자료\shinwoo-system\shinwoo-error-registry.md` | `c:\Users\mjjeon\Desktop\QMS 프로젝트\shinwoo-valve-qms\shinwoo-system\shinwoo-error-registry.md` | 과거에 누적된 ERR-001~ERR-016 실수 및 재발 방지 패턴을 그대로 승계하여 재발 차단. |
| **3. 결정 이력 DB** | `이식자료\shinwoo-system\shinwoo-decision-log.md` | `c:\Users\mjjeon\Desktop\QMS 프로젝트\shinwoo-valve-qms\shinwoo-system\shinwoo-decision-log.md` | DEC-001~DEC-019 아키텍처 결정 이력을 영구 보존. |
| **4. 세션 현황판** | `이식자료\shinwoo-system\HANDOFF.md` | `c:\Users\mjjeon\Desktop\QMS 프로젝트\shinwoo-valve-qms\shinwoo-system\HANDOFF.md` | QMS v2 6월 1일 자 도메인 동기화 최종 완료 및 6월 2일 아침 세션 시작 시점에 맞춰 내용을 정교하게 리팩토링. |
| **5. 백업 스크립트** | `이식자료\shinwoo-system\save-daily-log.ps1` | `c:\Users\mjjeon\Desktop\QMS 프로젝트\shinwoo-valve-qms\shinwoo-system\save-daily-log.ps1` | `$brainBase` 검색 절대 경로를 `C:\Users\mjjeon\.gemini\antigravity-ide\brain`으로 정밀 조율하여 PowerShell 백업 기동 보장. |

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

## 🚨 3. 전역 룰북(GEMINI.md) 정밀 융합(Merge) 설계안

이식자료의 `GEMINI.md`를 그대로 덮어쓸 경우, QMS v2 고유 하네스 제약 사항(배포 3단 프로토콜, 14대 금지 규칙)이 유실되는 치명적 파멸이 일어납니다. 따라서 다음과 같이 **최상위 지능형 융합**을 설계합니다.

* **융합 방식**: 기존 `.agent/rules/GEMINI.md`와 `C:\Users\mjjeon\.gemini\GEMINI.md`의 구조를 그대로 보존하되, 이식자료의 핵심 행동 규칙들을 신규 섹션으로 정밀 등재합니다.
* **신설할 룰셋 섹션:**
  1. **🚨 [최우선] 명시적 실행 승인 규칙**: 대화 시작 시 대기 상태 감지, 비동기 태스크 완료 시 자동 후속 실행 제동, 도구 사용 전 명시적 키워드 획득 프로세스 강화.
  2. **⚡ 안드레 카파시 식 AI 코딩 행동 고삐 규격**: Simplicity First(과설계 금지), Surgical Changes(수술식 최소 변경, 오지랖 정렬 금지) 추가.
  3. **🔋 AI 비용 절약 및 아티팩트 발행 상세 규칙**: 300자 이상/표/로직 출력 시 아티팩트 강제 발행 및 격리 분리 규칙 수립.

---

## 🛠️ 4. 검증 계획 (Verification Plan)

### A. 정적 무결성 점검
- PowerShell로 이식 대상 파일들의 물리적 존재 여부 및 인코딩 점검.
- 복사된 `save-daily-log.ps1` 스크립트 파일이 윈도우 환경에서 실행 차단되지 않도록 권한 획득 여부 확인.

### B. 시동성 검증 (TDD식 동작 실증)
1. **스킬 감지 테스트**: AI에게 *"shinwoo-memory-system 스킬이 로드되었는지 확인해줘"*라고 지시하여 스킬 구조 검증.
2. **HANDOFF 로드 테스트**: 이식된 `HANDOFF.md`, `error-registry.md`, `decision-log.md`를 문제없이 읽어 들이는지 대화창에서 읽기 시연.
3. **무인 백업 스크립트 시운전**: `save-daily-log.ps1`을 백그라운드로 호출하여, 오늘 자 세션 이력(`C:\Users\mjjeon\.gemini\antigravity-ide\brain\ae29063b...`)이 `shinwoo-system/logs/2026-06-02/` 하위 마크다운 파일로 에러 없이 백업되는지 시각적으로 완벽 증빙.

---

차장님의 명시적 **"승인"** 또는 피드백 오더가 접수되는 즉시, 2단계 `task.md`를 기동하고 정밀 이식 수술을 신속히 집행하겠습니다.
