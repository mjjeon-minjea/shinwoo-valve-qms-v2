---
title: "QMS v2 5단계 점진적 하네스 이식 기획안 (R1)"
type: "구현 계획서 (Implementation Plan)"
source_folder: "안티그래비티/plan"
source_file: "2026-05-27_QMS_v2_점진적_하네스_이식_기획안_R1.md"
date: "2026-05-27"
revision: "R1"
author: "AI (Antigravity)"
wiki_status: done
tags: antigravity, plan, history, qms
---

# QMS v2 5단계 점진적 하네스 이식 기획안 (R1)

본 기획안은 클로드의 R0 검토 보고서 내 **"개선 권고 사항"**을 100% 반영하여, 가상 사례(Celery, Redis 등)를 전면 폐기하고 **실제 QMS v2 코드베이스(Vite, Supabase CLI, api.js, .eslintrc.cjs)에 정밀 밀착**시켰으며, 잠긴 표면(Locked Surface) 분류, 롤백 경로, 피드백 루프 완결 구조, 그리고 PowerShell 환경 문법을 철저히 준수하여 전면 보완한 **R1 버전 기술 기획서**입니다.

* **갱신 작성일:** 2026-05-27  
* **문서 버전:** R1  
* **보관 경로:** `안티그래비티/plan/2026-05-27_QMS_v2_점진적_하네스_이식_기획안_R1.md`

---

## 1. 목적 및 변경 영향 범위

* **목적:** Mitchell Hashimoto의 AI 도입 6단계 여정 중 "4단계: 단일 에이전트" 환경에서 발생하는 5대 병폐(스타일 붕괴, 아키텍처 무시, 반복되는 망각, 파일 누적, 컨텍스트 불안)를 차단하기 위해, 에이전트의 오작동을 통제하고 올바른 궤도로 유도하는 **5대 하네스 안전망(지시문서, 아키텍처제약, 피드백루프, 지식저장소, 가비지 컬렉션)**을 안전하게 점진 구축합니다.
* **변경 영향 범위:**
  - `CLAUDE.md` [NEW] - 하네스 트리거 포인터 및 변경 이력 수록
  - `.agent/rules/04_harness_constraints.md` [NEW] - 하네스 세부 행동 통제 규칙
  - `.eslintrc.cjs` [MODIFY] - `eslint-plugin-boundaries` 룰 추가 및 `scripts/` 제외 패턴 재검토
  - `package.json` [MODIFY] - boundaries 플러그인, husky, lint-staged 패키지 추가
  - `.agent/skills/qms-orchestrator/scripts/verify-integration.js` [NEW] - Supabase CLI 연동 통합 정합성 검증 센서
  - `.agent/logs/integration-check.tsv` [NEW] - append-only 유형의 검사 이력 로그
  - `docs/decisions/001-supabase-caching.md` [NEW] - Supabase JS SDK 데이터 캐싱 전략 ADR
  - `docs/failures/001-mock-sync-drift.md` [NEW] - Vite Local Mock Server 동기화 실패 기록
  - `.agent/skills/qms-orchestrator/scripts/check-structure.js` [NEW] - 구조 드리프트 및 오염 파일 경고 센서

---

## 2. 잠긴 표면 (Locked Surface) 분할 통제 계획

에이전트가 검증 도구나 제약 파일 자체를 변조하여 결함을 은폐하는 도덕적 해이를 기술적으로 방지하기 위해, 프로젝트 내 모든 파일 표면을 4대 표면 클래스로 명확히 나누어 제어합니다.

| 표면 클래스 | 대상 파일 / 경로 | 통제 강도 및 규칙 |
|:---|:---|:---|
| **잠긴 표면 (Locked)** | `.eslintrc.cjs`<br>`.agent/rules/04_harness_constraints.md`<br>`verify-integration.js`<br>`check-structure.js` | **수정 불가:** 에이전트는 본 파일을 절대 수정·삭제할 수 없으며 오직 차장님만 수동 편집 가능 |
| **편집 가능 (Editable)** | `src/**`<br>`AGENTS.md` (인덱스) | **수정 허용:** 작업 요건에 따라 자유롭게 생성 및 편집 가능 |
| **추가 전용 (Append-only)** | `.agent/logs/integration-check.tsv`<br>`docs/failures/**` | **추가만 허용:** 새로운 실패 기록이나 검증 로그를 뒤에 덧붙여 쓰는 것만 허용 (덮어쓰기 금지) |
| **인간 통제 (Human-controlled)** | 파일 물리적 삭제, DB 스키마 직접 수정, git push 배포 | **승인 필수:** 에이전트 단독 수행 금지, 차장님의 명시적 수동 승인 후 대행 |

---

## 📅 3. 5단계 이식 로드맵 및 구체적 구현 사양

```mermaid
gantt
    title QMS v2 5단계 점진적 하네스 이식 일정 (R1)
    dateFormat  YYYY-MM-DD
    section 1단계
    AGENTS.md 인덱스 제정 (공수: 1일)      :active, p1, 2026-05-27, 1d
    section 2단계
    ESLint Boundaries 제약 (공수: 2일)    :p2, after p1, 2d
    section 3단계
    verify-integration 센서 (공수: 5일)   :p3, after p2, 5d
    section 4단계
    QMS 실물 지식 저장소 구축 (공수: 2일)  :p4, after p3, 2d
    section 5단계
    드리프트 경고 센서 장착 (공수: 1일)    :p5, after p4, 1d
```

### 1단계: [지시 문서] `AGENTS.md` 인덱스 문서 및 신규 룰 제정
* **목적:** 정보의 이원화(SSOT 붕괴)를 막고 기존 `.agent/rules/` 체계와 하네스 룰을 유기적으로 융합합니다.
* **구현 사양:**
  - `AGENTS.md`는 새로운 규칙을 중복 나열하지 않고, 기존 `.agent/rules/` 파일들을 참조하는 **진입 인덱스(Index Document)**로 설계합니다.
  - 신규 행동 제약 사항은 `.agent/rules/04_harness_constraints.md`에 격리 수록합니다.
  - **사전 코드베이스 감사(Audit) 반영:** 현재 `src/lib/api.js` 내에 잔존하는 12개의 `console.log` 호출부를 단계적으로 소거하고 공식 Logger 모듈로 전환하는 리팩토링 예외 규정을 포함시킵니다.
* **검증 기준:** `AGENTS.md` 내 `@see` 링크 포인터들이 끊어짐 없이 연결되는지 마크다운 정합성 검사.

---

### 2단계: [아키텍처 제약] ESLint Boundaries 제약 및 pre-commit 환경
* **목표:** 레이어 간 단방향 의존성 규칙을 구조적으로 강제합니다.
* **구현 사양:**
  - **채택 도구:** `eslint-plugin-boundaries@^4.x` 및 `husky`, `lint-staged`
  - **설치 명령어 (PowerShell):**
    ```powershell
    npm install --save-dev eslint-plugin-boundaries@^4.x husky lint-staged
    ```
  - **Zone 경계 정의:** `ui` (src/components/, src/pages/) ➔ `hooks/` ➔ `lib/` (src/lib/) 단방향 흐름만 허용. `src/lib/`이 상위 UI 컴포넌트를 import하면 즉시 린트 에러 방출.
  - **scripts/ 린트 ignore 패턴 재검토:** `.eslintrc.cjs` 내 `ignorePatterns`에서 `scripts/`를 제거하여 하네스용 검사 스크립트도 린트 영향권에 편입시킵니다.
* **검증 기준:** 하위 레이어가 상위 레이어를 역참조하는 임시 파일(`src/lib/temp_import.js`) 생성 시, `npm run lint`로 에러가 검출되는지 확인.

---

### 3단계: [피드백 루프] `verify-integration.js` 정합성 검증 센서
* **목표:** 정적 파싱의 한계를 극복하고 API-UI 간 경계면 불일치를 엄밀히 스캔합니다.
* **구현 사양:**
  - **정적 파싱 방식 보완:** `src/lib/api.js`가 Supabase 클라이언트를 다루므로, 로컬 Supabase CLI 도구를 구동하여 데이터베이스 스키마 기반 TypeScript 타입을 생성하고 이를 대조 기준으로 삼습니다.
    ```powershell
    npx supabase gen types typescript --local > src/types/supabase.ts
    ```
  - **감지 및 센서 피드백 완결 루프 (4단계 완결):**
    1. **감지:** `verify-integration.js` 스크립트를 구동하여 `src/types/supabase.ts`와 프론트엔드 React Hook(`fetchJson<T>`)의 타입 파라미터 간 필드 명칭(camelCase/snake_case) 불일치를 Grep 스캔.
    2. **기록:** 검사 결과를 `.agent/logs/integration-check.tsv` 파일에 append-only 이력으로 기록.
    3. **경보:** 불일치 감지 즉시 빌드 exit code `1`을 방출하며 콘솔에 오류 상세 위치(파일:라인) 표시.
    4. **결재 에스컬레이션:** 에이전트의 자동 수정을 금지하고 즉시 차장님 수동 확인을 위한 DNAS Plan 단계로 보고 에스컬레이션.
* **공수 산정 근거:** QMS v2의 24개 핵심 컴포넌트 및 DB 테이블 스키마 매핑 라인 수가 대규모이므로, 단순 감지 로직의 구현과 타입 안정성 파싱 코드 작성에 총 5일의 공수를 현실적으로 배정합니다.
* **검증 기준:** 의도적으로 불일치 타입(`src/types/test_mismatch.ts`)을 주입하고 스크립트를 실행하여 exit code `1`이 성공적으로 터져 나오는지 검증.

---

### 4단계: [지식 저장소] docs/ 디렉토리 개설 및 QMS 실물 지식 적재
* **목표:** 가상의 비현실적 사례를 배제하고 QMS v2의 실제 기술적 의사결정과 실패 이력을 축적합니다.
* **구현 사양:**
  - **실물 ADR 탑재:**
    - `docs/decisions/001-supabase-caching.md` ➔ Supabase JS SDK 호출 데이터의 Unlogged Table 캐싱 및 Router v7(React-Query) 기반 캐싱 전략 채택 이유와 트레이드오프 기록.
  - **실물 실패 기록 탑재:**
    - `docs/failures/001-mock-sync-drift.md` ➔ Vite Local Mock Server와 express Gateway 간의 동기화 불일치(Drift)로 인한 과거 검사성적서 누락 버그의 원인 및 영구 방지법 수록.
  - **Novelty Gate 룰 추가:** 에이전트가 새로운 라이브러리 도입을 제안하기 전, 반드시 `docs/decisions/`를 전독하여 기존 채택 방안과 비교하게 하는 강제 룰을 `.agent/rules/04_harness_constraints.md`에 장착.
* **검증 기준:** `docs/` 하위 마크다운 파일들의 표준 ADR 템플릿(상태, 날짜, 맥락, 결정, 근거, 대안, 결과 필드 포함) 준수 여부 정적 검사.

---

### 5단계: [가비지 컬렉션] 구조 드리프트 및 오염 파일 경고 센서
* **목표:** 파괴적인 자동 삭제를 방지하고, 철저히 차장님의 통제하에 드리프트를 소거합니다.
* **구현 사양:**
  - **자동 삭제 기능 완전 폐지:** 에이전트가 독단적으로 파일을 삭제하지 못하도록 제한합니다.
  - **경고 센서 흐름 구축:**
    1. `.agent/skills/qms-orchestrator/scripts/check-structure.js` 가 `src/` 및 `.agent/` 폴더 내에 오염 파일(`temp_*`, `*_backup` 등) 및 룰 불일치(Drift)가 발생했는지 감지.
    2. 감지된 오염 항목을 터미널 콘솔에 경고 목록으로 출력.
    3. 에이전트가 이를 정리할 때 차장님께 **"수동 삭제 승인 청구"**를 하고 승인을 얻은 후에 `rm` 대행 명령을 수행.
* **감시 범위 확장:** 소스코드 폴더뿐 아니라 AI 가동 영역인 `.agent/skills/` 및 `.agent/rules/` 폴더까지 감시 영역에 포함시킵니다.
* **검증 기준:** 임시 파일(`src/temp_test.js`)을 강제 생성하고 감지 센서를 구동했을 때, 삭제 대기 경고 목록에 올바르게 검출되는지 확인.

---

## 🧪 4. 통합 검증 및 롤백 계획 (Verification & Rollback)

### 단계별 롤백 시나리오 (Rollback Strategy)

| 검증 단계 | 실패 상황 (Exit 1) | 롤백 행동 지침 (PowerShell) |
|:---|:---|:---|
| **1단계** | AGENTS.md 링크가 깨짐 | `git checkout -- AGENTS.md` 실행 후 수정안 재검토 |
| **2단계** | ESLint boundaries 설치 오류 | `npm install` 롤백 및 `git checkout -- package.json .eslintrc.cjs` |
| **3단계** | verify-integration.js 빌드 차단 | `git stash`를 가동하여 임시 변경사항을 백업 공간으로 격리한 후 3단계 Plan 재작성 |
| **4단계** | 지식 문서 포맷 불일치 | `git checkout -- docs/` 실행하여 템플릿 규격에 맞추어 재작성 |
| **5단계** | 구조 드리프트 잔재 감지 | 감지된 오염 파일을 백업 폴더(`_workspace/backup/`)로 수동 이동 처리 |

### 단계별 검증 스케줄
- **1단계 검증:** `AGENTS.md` 인덱스 무결성 검증
- **2단계 검증:** boundaries 린트 룰 동작 수동 검사 (`npm run lint`)
- **3단계 검증:** `verify-integration.js` 센서 감지 성능 테스트 (`node .agent/skills/qms-orchestrator/scripts/verify-integration.js`)
- **4단계 검증:** ADR-001 및 Failure-001 문서의 포맷 및 용어 일치 검사
- **5단계 검증:** 가비지 클리너 감지 경고 목록 출력 및 차장님 수동 승인 루틴 드라이런
