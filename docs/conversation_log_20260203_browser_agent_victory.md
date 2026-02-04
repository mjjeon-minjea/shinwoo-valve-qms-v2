# 2026-02-03 개발 및 디버깅 로그 (Supabase & Vercel 안정화)

## 1. 개요

이 문서는 2026년 2월 3일 진행된 **Supabase ID Sequence 오류 해결** 및 **Vercel 배포 환경에서의 UI 버그 수정** 과정을 기록합니다. 특히, 로컬 환경에서는 발생하지 않던 문제들이 클라우드 환경(Vercel)에서 발생하여 이를 해결하는 과정이 주된 내용입니다.

## 2. 주요 문제 및 해결 과정

### [이슈 1] 저장 시 "500 Error" 및 "Duplicate Key" 발생

- **현상:** Vercel 배포 후 주간보고서 저장 시 오류 발생.
- **원인:** `db.json` 데이터를 수동으로 Supabase에 이관한 후, Postgres의 **Auto-increment Sequence(자동 번호 발급기)**가 마지막 ID 값을 인지하지 못하고 `1`번부터 다시 발급하려다 충돌 발생.
- **해결 (Browser Subagent 활용):**
  - 사용자가 SQL 실행에 어려움을 겪음.
  - **AI Browser Subagent**를 가동하여 GitHub SSO로 Supabase 대시보드에 직접 로그인.
  - SQL Editor에서 아래 명령어를 직접 실행하여 Sequence를 현재 최대 ID 값(`MAX(id)`) 이후로 재설정함.
  ```sql
  SELECT setval('weekly_reports_id_seq', (SELECT MAX(id) FROM weekly_reports)::bigint);
  ```

### [이슈 2] 임시저장/제출 후 버튼(수정/삭제) 사라짐

- **현상:** Vercel에서 저장 버튼을 누르면 "저장됨" 알림 후 수정/제출 버튼이 사라지고 비활성화됨.
- **원인:**
  - 로컬(`json-server`)은 ID가 `Number`(`123`)였으나, Supabase(`Postgres`) 저장 후 반환되는 ID가 `String`(`"123"`)이었음.
  - React 코드에서 `user.id === report.authorId` (Strict Equality) 비교가 실패하여, 작성자가 아닌 "Reviewer"로 오인됨.
- **해결:**
  - `WeeklyReport.jsx`의 모든 ID 비교 로직을 `String(a) === String(b)`로 변경하여 타입 불일치 해결.

### [이슈 3] "재상신" 버튼 클릭 시 반응 없음

- **현상:** 승인된 보고서를 수정하려고 "재상신"을 눌러도 화면이 "작성 모드"로 전환되지 않음.
- **원인:** API 호출은 성공했으나, 화면을 갱신하는 `fetchReports()`가 (네트워크 지연 등으로) 이전 상태("승인됨") 데이터를 다시 가져오는 **Race Condition** 발생.
- **해결:**
  - `handleResubmit` 함수에서 API 성공 응답(`savedData`)을 받자마자, `setReport(savedData)`를 통해 **로컬 UI 상태를 즉시 갱신**하도록 수정 (Optimistic UI Update).

## 3. 결론 및 배훈

- **Local vs Cloud:** 로컬 개발 편의성(CORS 무시, 느슨한 타입)이 실제 배포 시에는 독이 될 수 있음을 확인.
- **AI Agent 활용:** 브라우저 제어가 불가능할 줄 알았던 상황에서, Agent 스스로 로그인 및 SQL 실행을 성공시켜 "안 되는 것을 되게 하는" 경험을 함.
- **상태:** 현재 시스템은 Supabase DB와 완벽히 연동되며, 모든 CRUD 및 상태 변경 기능이 Vercel 환경에서 정상 작동함.
