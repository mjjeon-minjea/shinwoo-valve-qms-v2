# 신우밸브주식회사 품질보증부 QMS AI 행동 강령 및 규칙 인덱스 (GEMINI.md)

이 문서는 안티그래비티(Gemini) 코딩 에이전트가 신우밸브 QMS v2 프로젝트를 안전하고 규격에 맞게 개발하도록 통제하는 **하네스 행동 강령 및 마스터 규칙 인덱스**입니다. 과거 `AGENTS.md`와 파일 시스템에 흩어져 있던 규칙들이 본 문서 하나로 완전히 통합 연동되었습니다.

## 🧭 제1장. 전역 최상위 규칙 (Rules)

에이전트는 코드 작성 및 의사결정 시 아래 규칙들을 순서대로 준수하며, 작업 전 반드시 다음 규칙 파일들을 로드(import)하여 작동해야 합니다.

@./01_tech_stack.md
@./02_dnas_process.md
@./03_archiving.md

---

## 🛠️ 제2장. 능동적 검증 및 실행 스킬 (Skills)
서브 툴 및 커스텀 검증 스크립트는 `.agent/skills/` 트리를 따른다.

| Skill | Purpose |
|-------|---------|
| `verify-implementation` | 프로젝트의 모든 verify 스킬을 순차 실행하여 통합 검증 보고서를 생성합니다 |
| `manage-skills` | 세션 변경사항을 분석하고, 검증 스킬을 생성/업데이트하며, GEMINI.md를 관리합니다 |
| `merge-worktree` | 현재 worktree 브랜치를 main(또는 지정 대상) 브랜치로 squash-merge하고 포괄적인 커밋 메시지를 생성합니다 |

---

## 🚀 제3장. GitHub 배포 파이프라인 및 물리적 통제

### [조항 3.1] 다단계 승인 배포 프로토콜 및 하드 락(Hard Lock)
모든 웹 배포 작업은 **[로컬웹 확인] ➔ [테스트웹 확인] ➔ [메인웹 확인]**의 3단계 물리적 순서를 절대 고수한다.
각 확인 단계마다 전민재 차장님의 **명시적 승인 오더(예: "로컬웹 확인 완료, 테스트웹 올려줘", "진행해" 등)**가 대화창에 기록되기 전까지, 에이전트는 `git push` 등 원격 웹 반영 명령을 단독으로 절대 호출 또는 수행할 수 없다. 

> 🛡️ **[안전장치 필수: 배포 전 3단 검증 보고]**
> `git push` 명령어 실행 직전, 에이전트는 반드시 아래 3가지를 보고하고 **승인(맞아, 진행해 등)**을 받아야 한다.
> 1. **현재 연결된 Git 주소 확인:** (Test: `qms.git` / Main: `qms-v2.git`)
> 2. **타겟 브랜치 확인:** `main` 브랜치가 맞는지 확인
> 3. **반영될 최종 웹 주소:** (Test: shinwoo-valve-qms.vercel.app / Main: shinwoo-valve-qms-v2.vercel.app)
> 
> **이 조항을 위반하려는 순간 즉시 작업을 중단하고, 차장님께 배포 3단 보고 체크리스트를 먼저 출력한 뒤 명시적 승인 키워드를 요청해야 한다.**

---

## 🔒 제4장. 하네스 엔지니어링 제약 (Harness Engineering — QMS 전용)

### 4-1. 세션 시작 시 필독 파일 (QMS 프로젝트 진입 즉시)
새 세션이 시작되고 QMS 프로젝트를 작업할 때는 아래 파일들을 반드시 먼저 읽어야 한다.
1. `package.json` (현재 설치된 의존성 확인)
2. `src/lib/api.js` (실제 API 구조 확인)

### 4-2. 잠긴 표면 (Locked Surface) — 절대 수정 금지
아래 파일은 에이전트가 단독으로 절대 수정하거나 삭제할 수 없다. 차장님만 직접 편집 가능하다.
- `.eslintrc.cjs`
- `.agent/rules/04_harness_constraints.md`
- `.agent/skills/qms-orchestrator/scripts/verify-integration.js`
- `.agent/skills/qms-orchestrator/scripts/check-structure.js`

### 4-3. 인간 통제 영역 (Human-controlled) — 단독 수행 금지
아래 행위는 반드시 차장님의 명시적 승인을 받은 후에만 대행 실행한다.
- 파일 물리적 삭제 (`Remove-Item` 명령 포함)
- DB 스키마 직접 수정
- `git push` 배포 (위 [조항 3.1] 승인 프로토콜 적용)

### 4-4. 기획안 작성 전 자체 체크리스트
기획안(Plan) 문서를 제출하기 전에 아래 항목을 전부 자체 점검해야 한다.
```
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
