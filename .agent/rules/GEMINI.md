# [신우밸브 QMS 전용 아키텍처 인덱스]

## 1. Rules (수동적 제약사항 가이드라인)
QMS 프로젝트의 기술 및 정책 룰은 `.agent/rules/` 트리를 따른다.

| Rule Domain | File Path | Purpose |
|---|---|---|
| Tech Stack & OS | `.agent/rules/01_tech_stack.md` | React, Supabase, PowerShell 제약 및 에러 대응 방식 |
| DNAS Process | `.agent/rules/02_dnas_process.md` | 기획안/보고서 작성 시 3단계(Plan-Task-Walkthrough) 필수 프로세스 |
| Knowledge Archiving | `.agent/rules/03_archiving.md` | 대화 내용 저장(NotebookLM 4대 카테고리) 및 추출 기준 |

## 2. Skills (능동적 검증 및 실행 스킬)
서브 툴 및 커스텀 검증 스크립트는 `.agent/skills/` 트리를 따른다.

| Skill | Purpose |
|-------|---------|
| `verify-implementation` | 프로젝트의 모든 verify 스킬을 순차 실행하여 통합 검증 보고서를 생성합니다 |
| `manage-skills` | 세션 변경사항을 분석하고, 검증 스킬을 생성/업데이트하며, GEMINI.md를 관리합니다 |
| `merge-worktree` | 현재 worktree 브랜치를 main(또는 지정 대상) 브랜치로 squash-merge하고 포괄적인 커밋 메시지를 생성합니다 |

## 3. GitHub (Commit / Push) 배포 파이프라인 지침
에이전트는 차장님의 지시에 따라 아래 3가지 환경에 맞추어 작업을 분리하여 수행하고 배포해야 한다.

> 🛡️ **[안전장치 필수: 배포 전 3단 검증]**
> 테스트 배포 및 실서버 배포를 위한 `git push` 명령어를 실행하기 직전에, 에이전트는 반드시 아래 3가지 항목을 차장님께 보고하고 **승인(맞아, 진행해 등)**을 받아야 한다.
> 1. **현재 연결된 Git 주소 확인:** 배포 목적지에 따라 정확한 깃허브 주소가 맞는지 확인 (Test: `qms.git` / Main: `qms-v2.git`)
> 2. **타겟 브랜치 확인:** `main` 브랜치가 맞는지 확인
> 3. **반영될 최종 웹 주소:** (Test: shinwoo-valve-qms.vercel.app / Main: shinwoo-valve-qms-v2.vercel.app)

1. **로컬 개발 (지시 예: "로컬에서 만들어줘")**
   - 브랜치 변경 및 Commit/Push 없이 로컬 파일만 수정 (`npm run dev`용)
2. **테스트 배포 (지시 예: "테스트 웹에 올려봐")**
   - 타겟 원격 저장소(`test-origin`: `shinwoo-valve-qms.git`)로 연결 ➔ Commit ➔ **(배포 전 3단 검증 보고 및 승인 대기)** ➔ `git push test-origin main` 실행
   - 차장님 전용의 독립된 테스트 웹 사이트에 반영됨
3. **실서버 배포 (지시 예: "메인 웹에 반영해")**
   - 타겟 원격 저장소(`origin`: `shinwoo-valve-qms-v2.git`)로 연결 ➔ Commit ➔ **(배포 전 3단 검증 보고 및 승인 대기)** ➔ `git push origin main` 실행
   - 실제 운영 중인 V2 메인 웹 사이트에 반영됨

---

## 4. 하네스 엔지니어링 제약 (Harness Engineering — QMS 전용)

> 이 섹션은 QMS v2 프로젝트에서 하네스 엔지니어링을 적용하기 위한 행동 강령이다.
> QMS 프로젝트 작업 시 반드시 준수해야 하며, 세부 규칙은 `.agent/rules/04_harness_constraints.md`를 참조한다.

### 4-1. 세션 시작 시 필독 파일 (QMS 프로젝트 진입 즉시)

새 세션이 시작되고 QMS 프로젝트를 작업할 때는 아래 파일들을 반드시 먼저 읽어야 한다.
기획이나 코드 작성을 이 파일들을 읽기 전에 시작하는 것은 룰셋 위반이다.

| 우선순위 | 파일 경로 | 내용 |
|---|---|---|
| 1 | `.agent/rules/01_tech_stack.md` | OS, 기술 스택, PowerShell 규칙 |
| 2 | `.agent/rules/02_dnas_process.md` | 결재 3단계 프로세스 (DNAS) |
| 3 | `.agent/rules/03_archiving.md` | 지식 아카이빙 규칙 |
| 4 | `.agent/rules/04_harness_constraints.md` | 하네스 행동 제약 (구축 완료 후 활성) |
| 5 | `package.json` | 현재 설치된 의존성 확인 |
| 6 | `src/lib/api.js` | 실제 API 구조 확인 |

### 4-2. 잠긴 표면 (Locked Surface) — 절대 수정 금지

아래 파일은 에이전트가 어떠한 경우에도 수정하거나 삭제할 수 없다.
오직 차장님만 직접 편집 가능하다. 이 파일을 수정하면 하네스 전체가 무력화된다.

- `.eslintrc.cjs`
- `.agent/rules/04_harness_constraints.md`
- `.agent/skills/qms-orchestrator/scripts/verify-integration.js`
- `.agent/skills/qms-orchestrator/scripts/check-structure.js`

### 4-3. 인간 통제 영역 (Human-controlled) — 단독 수행 금지

아래 행위는 에이전트가 단독으로 절대 수행할 수 없다.
반드시 차장님의 명시적 승인을 받은 후에만 대행 실행한다.

- 파일 물리적 삭제 (`Remove-Item` 명령 포함)
- DB 스키마 직접 수정
- `git push` 배포 (기존 3단 검증 절차 유지)

### 4-4. 기획안 작성 전 자체 체크리스트

기획안(Plan) 문서를 제출하기 전에 아래 항목을 전부 자체 점검해야 한다.
미완료 항목이 하나라도 있으면 제출하지 않는다.

```
□ 세션 시작 시 필독 파일 6개를 전부 읽었는가?
□ 기획안에서 언급한 폴더/파일이 실제로 존재하는지 확인했는가?
□ 잠긴 표면 목록을 기획안에 명시했는가?
□ 피드백 루프가 감지→기록→경보→결재 4단계로 완결되는가?
□ 각 단계마다 롤백 방법이 명시됐는가?
□ 모든 CLI 명령어가 PowerShell 문법인가? (rm 사용 금지, Remove-Item 사용)
□ import.meta.env 대신 dotenv + process.env를 사용했는가? (Node.js 스크립트)
□ 환경변수 이름이 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY인지 확인했는가?
□ RegEx가 ([^/'"]+) 패턴으로 첫 번째 세그먼트만 추출하는가? (lazy/optional 금지)
□ 파괴적 행위(파일 삭제 등)가 Human-controlled로 분류됐는가?
□ CLAUDE.md를 생성하거나 참조하는 내용이 없는가? (GEMINI.md로 대체)
```

### 4-5. 반복 실수 영구 금지 목록

아래 실수들은 R0~R4 검토에서 반복적으로 발생한 패턴이다. 영구 금지한다.

| 번호 | 영구 금지 규칙 | 방지책 |
|---|---|---|
| Rule 1 | 없는 폴더를 기준으로 Zone 정의 | 기획 전 `Get-ChildItem -Path ".\src" -Recurse -Directory` 실행 필수 |
| Rule 2 | TypeScript 없는 프로젝트에 TS 타입 생성 | `Get-ChildItem .\src -Recurse -Include "*.ts","*.tsx"` 로 먼저 확인 |
| Rule 3 | `import.meta.env` Node.js에서 사용 | Node.js 스크립트는 반드시 `dotenv` 사용 |
| Rule 4 | `PROJECT_ID`, `ANON_KEY` 변수명 사용 | 실제 변수명: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| Rule 5 | lazy RegEx + optional suffix 조합 | `([^/'"]+)` 패턴(greedy)으로 첫 세그먼트만 캡처 |
| Rule 6 | `rm` 명령어 사용 | PowerShell에서는 `Remove-Item` 사용 |
| Rule 7 | 기존 `.agent/rules/` 체계 무시하고 중복 선언 | 신규 규칙은 `04_harness_constraints.md`에만 추가 |
| Rule 8 | 자동 파일 삭제 구현 | 삭제는 경고 목록 출력 → 차장님 승인 → 대행 실행 순서 |
| Rule 9 | CLAUDE.md 생성 또는 참조 | 전역 규칙은 GEMINI.md 전용. CLAUDE.md 사용 금지 |
