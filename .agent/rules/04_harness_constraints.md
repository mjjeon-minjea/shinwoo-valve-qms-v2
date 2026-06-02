# QMS Harness Engineering & Global Prohibitions (04)

## 1. 잠긴 표면 (Locked Surface) — 절대 수정 금지
아래 파일은 에이전트가 어떠한 경우에도 수정하거나 삭제할 수 없다. 오직 차장님만 직접 편집 가능하며, 이 파일들을 건드리면 하네스 전체가 무력화된다.
- `.eslintrc.cjs`
- `.agent/rules/04_harness_constraints.md`
- `.agent/skills/qms-orchestrator/scripts/verify-integration.js`
- `.agent/skills/qms-orchestrator/scripts/check-structure.js`

## 2. 인간 통제 영역 (Human-controlled) — 단독 수행 금지
아래 행위는 에이전트가 단독으로 절대 수행할 수 없다. 반드시 차장님의 명시적 승인을 받은 후에만 대행 실행한다.
- 파일 물리적 삭제 (`Remove-Item` 명령 포함)
- DB 스키마 직접 수정 (DDL)
  * **[명시적 예외]**: `release-sync` 스킬이 릴리즈 로그를 DB `release_log` 테이블에 단순히 기록(INSERT/UPDATE)하는 데이터 쓰기 행위(DML)는 정당한 위임 자동화 영역으로 간주하며, 본 직접 수정 통제 대상에서 명백히 예외로 처리한다.
- 다단계 승인 배포 프로토콜에 따른 깃 푸시(git push) 대행 명령

## 3. 기획안 작성 전 자체 체크리스트
기획안(Plan) 문서를 제출하기 전에 아래 항목을 전부 자체 점검해야 한다. 미완료 항목이 하나라도 있으면 제출하지 않는다.
```
□ 세션 시작 시 필독 파일 6개를 전부 읽었는가?
□ 기획안에서 언급한 폴더/파일이 실제로 존재하는지 확인했는가?
□ 잠긴 표면 목록을 기획안에 명시했는가?
□ 피드백 루프가 감지→기록→경보→결재 4단계로 완결되는가?
□ 각 단계마다 롤백 방법이 명시됐는가?
□ 모든 CLI 명령어가 PowerShell 문법인가? (Remove-Item 사용)
□ import.meta.env 대신 dotenv + process.env를 사용했는가? (Node.js 스크립트)
□ 환경변수 이름이 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY인지 확인했는가?
□ RegEx가 ([^/'"]+) 패턴으로 첫 번째 세그먼트만 추출하는가?
□ 파괴적 행위(파일 삭제 등)가 Human-controlled로 분류됐는가?
□ CLAUDE.md를 생성하거나 참조하는 내용이 없는가? (GEMINI.md로 대체)
□ 기획안 작성 완료 직후, plan-self-review 스킬을 작동하여 자가검토 결과를 대화창에 투명하게 보고했는가?
```

## 4. 반복 실수 영구 금지 목록
| 번호 | 영구 금지 규칙 | 방지책 |
|---|---|---|
| Rule 1 | 없는 폴더를 기준으로 Zone 정의 | 기획 전 `Get-ChildItem -Path ".\src" -Recurse -Directory` 실행 필수 |
| Rule 2 | TypeScript 없는 프로젝트에 TS 타입 생성 | `Get-ChildItem .\src -Recurse -Include "*.ts","*.tsx"` 로 먼저 확인 |
| Rule 3 | 기존 `.agent/rules/` 체계 무시하고 중복 선언 | 신규 규칙은 `04_harness_constraints.md`에만 추가 |
| Rule 4 | 자동 파일 삭제 구현 | 삭제는 경고 목록 출력 → 차장님 승인 → 대행 실행 순서 |
| Rule 5 | 기획안 및 완료 보고서 갱신 시 기존 버전 덮어쓰기 금지 | 파일 저장 전 해당 디렉토리를 검색하여 이전 버전들의 존재 여부 및 최신 리비전 번호를 전수 대조하고, 무조건 리비전을 순차적으로 증가(R0 ➔ R1 ➔ R2...)시킨 신규 파일로 분리 물리 저장 |
| Rule 6 | 진짜 전역 규칙과 프로젝트 로컬 규칙 카피본 혼선 | 규칙 개정 시 프로젝트 내부 카피가 아닌, 진짜 전역 규칙 `C:\Users\mjjeon\Desktop\QMS 프로젝트\shinwoo-valve-qms\.agent\rules\GEMINI.md` 경로를 1순위로 엄밀 점검 후 수정 |
| Rule 7 | 기획서 범위 및 규격을 무단 이탈한 과시용 우회 개발 시도 | 외부 생 크롬 Launch, 관제 뷰어 포트 강제 바인딩 등 꼼수 E2E 구동 영구 금지. 오직 정석 CDP 프로토콜과 차장님의 명시적 범위 안에서만 담백하게 보좌 |
| Rule 8 | CDP 및 chromium.launch 시각화 오용 | 차장님의 허가 없이 connectOverCDP(9222) 및 headless:false 스크립트 작성 및 구동 전면 금지. E2E 시각 시연 시 좀비 프로세스로 인한 포트 블록 방지를 위해 시스템 안정성을 최상위 가치로 둠 |
| Rule 9 | 기획서 제출 전 `plan-self-review` 스킬 회피 | 모든 기획서는 `plan-self-review` 통과(High 이슈 0건)가 선행되지 않을 경우 제출 불가 |

## 5. 기획서 제출 전 자가검토 의무 (Self-Review Gate)
- 에이전트는 모든 구현 계획서(Plan)를 작성 완료한 직후, 차장님께 결재 청구하기 바로 직전에 반드시 **`plan-self-review` 스킬(`.agent/skills/plan-self-review/`)**을 기동하여 자가검토 수행해야 한다.
- 검토 결과 높음(High) 등급 이슈가 단 1건이라도 존재할 시 기획서 송출은 시스템적으로 전면 차단되며, 팩트 기반의 교정 작업을 거쳐 재검증을 통과해야만 최종 제출이 허용된다.
- 본 검토 결과 리포트는 대화창(채팅)에만 의무 전시하며, 불필요한 마크다운 물리 파일 생성은 엄격히 차단한다.
