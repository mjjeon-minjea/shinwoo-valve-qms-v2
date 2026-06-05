---
name: harness-constraints
description: 하네스 제약, 잠긴 표면 및 로컬 시스템 안정성 통제 규칙 스킬.
---

# 🛡️ 하네스 제약 및 시스템 안전성 규칙 (harness-constraints)

본 규칙은 시스템 안전성을 보장하고, 에이전트의 오작동 및 보안 무력화를 차단하기 위한 하네스 및 물리적 행동 제약 규정입니다.

## 1. 잠긴 표면 (Locked Surface) — 절대 수정 금지
아래 파일들은 에이전트가 어떠한 경우에도 임의로 수정하거나 삭제할 수 없습니다. 오직 전민재 차장님만 직접 편집 가능하며, 이 파일들을 건드리면 하네스 전체가 무력화될 수 있습니다.
- `.eslintrc.cjs`
- `.agent/rules/GEMINI.md` 의 §5 하네스 제약 섹션 (혹은 본 harness_constraints 스킬)
- `.agent/skills/qms-orchestrator/scripts/verify-integration.js`
- `.agent/skills/qms-orchestrator/scripts/check-structure.js`

## 2. 인간 통제 영역 (Human-controlled) — 단독 수행 금지
아래 행위는 에이전트가 단독으로 절대 수행할 수 없습니다. 반드시 차장님의 명시적 승인을 얻은 상태에서만 대행합니다.
- 파일 물리적 삭제 (`Remove-Item` 명령 포함)
- DB 스키마 직접 수정 (DDL)
  * **[명시적 예외]**: `release-sync` 스킬이 릴리즈 로그를 DB `release_log` 테이블에 단순히 기록(INSERT/UPDATE)하는 데이터 쓰기 행위(DML)는 정당한 위임 자동화 영역으로 간주하며, 본 직접 수정 통제 대상에서 명백히 예외로 처리합니다.
- 다단계 승인 배포 프로토콜에 따른 깃 푸시(`git push`) 대행 명령

## 3. [조항 8] 로컬 PC 시스템 안정성 및 실서버 보안 무결성
- 🛡️ **로컬 PC 시스템 안정성 절대 사수**: 에이전트의 구동 및 검증 행위 시, 로컬 PC 환경에 크롬 좀비 프로세스를 남겨 시스템 포트(9222 등)를 블록시키거나 리소스를 점먹는 모든 행위를 엄격히 차단합니다. 그 어떠한 E2E 시각적 입증 조항보다 '로컬 PC 시스템 안정성 및 무결성'을 최상위 위계로 둔기보다 최상위 가치로 삼습니다.
- 🚫 **CDP 9222 포트 직결 및 브라우저 제어 전면 금지**: 전민재 차장님의 사전 명시적 허가 없시는 `connectOverCDP('http://127.0.0.1:9222')` 구문 및 `chromium.launch({ headless: false })`를 활용한 그 어떤 E2E 자동 조작 스크립트도 기획하거나 구동할 수 없습니다. 시각적 쇼(파란 점 커서 및 화면 녹화 등)는 전면 금지합니다.

## 4. 기획서 제출 전 자가검토 의무 (Self-Review Gate)
- 에이전트는 모든 구현 계획서(Plan)를 작성 완료한 직후, 차장님께 결재 청구하기 바로 직전에 반드시 **`plan-self-review` 스킬(`.agent/skills/plan-self-review/`)**을 기동하여 자가검토를 수행해야 합니다.
- 검토 결과 높음(High) 등급 이슈가 단 1건이라도 존재할 시 기획서 송출은 시스템적으로 전면 차단되며, 팩트 기반의 교정 작업을 거쳐 재검증을 통과해야만 최종 제출이 허용됩니다.
- 본 검토 결과 리포트는 대화창(채팅)에만 의무 전시하며, 불필요한 마크다운 물리 파일 생성은 엄격히 차단합니다.

## 5. 반복 실수 영구 금지 목록
| 번호 | 영구 금지 규칙 | 방지책 |
|---|---|---|
| Rule 1 | 없는 폴더를 기준으로 Zone 정의 | 기획 전 `Get-ChildItem -Path ".\src" -Recurse -Directory` 실행 필수 |
| Rule 2 | TypeScript 없는 프로젝트에 TS 타입 생성 | `Get-ChildItem .\src -Recurse -Include "*.ts","*.tsx"` 로 먼저 확인 |
| Rule 3 | 기존 `.agent/rules/` 체계 무시하고 중복 선언 | 신규 규칙은 본 GEMINI.md에만 추가 |
| Rule 4 | 자동 파일 삭제 구현 | 삭제는 경고 목록 출력 ➡️ 차장님 승인 ➡️ 대행 실행 순서 |
| Rule 5 | 기획안 및 완료 보고서 갱신 시 기존 버전 덮어쓰기 금지 | 파일 저장 전 해당 디렉토리를 검색하여 이전 버전들의 존재 여부 및 최신 리비전 번호를 전수 대조하고, 무조건 리비전을 순차적으로 증가(R0 ➡️ R1 ➡️ R2...)시킨 신규 파일로 분리 물리 저장 |
| Rule 6 | 진짜 전역 규칙과 프로젝트 로컬 규칙 카피본 혼선 | 규칙 개정 시 프로젝트 내부 카피가 아닌, 진짜 전역 규칙 `C:\Users\mjjeon\Desktop\QMS 프로젝트\shinwoo-valve-qms\.agent\rules\GEMINI.md` 및 `C:\Users\mjjeon\.gemini\GEMINI.md` 경로를 1순위로 엄밀 점검 후 수정 |
| Rule 7 | 기획서 범위 및 규격을 무단 이탈한 과시용 우회 개발 시도 | 외부 생 크롬 Launch, 관제 뷰어 포트 강제 바인딩 등 꼼수 E2E 구동 영구 금지. 오직 정석 CDP 프로토콜과 차장님의 명시적 범위 안에서만 담백하게 보좌 |
| Rule 8 | CDP 및 chromium.launch 시각화 오용 | 차장님의 허가 없이 connectOverCDP(9222) 및 headless:false 스크립트 작성 및 구동 전면 금지. E2E 시각 시연 시 좀비 프로세스로 인한 포트 블록 방지를 위해 시스템 안정성을 최상위 가치로 둠 |
| Rule 9 | 기획서 제출 전 `plan-self-review` 스킬 회피 | 모든 기획서는 `plan-self-review` 통과(High 이슈 0건)가 선행되지 않을 경우 제출 불가 |
