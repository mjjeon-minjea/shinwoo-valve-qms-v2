# 신우밸브 AI 실수 레지스트리
> 이 파일은 영구 누적됩니다. 삭제하지 마세요.
> 새 대화 시작 시 반드시 이 파일을 읽고 같은 실수 반복을 차단합니다.

---

## 실수 목록

### ERR-001
- **날짜**: 2026-05-11
- **실수**: 이전 대화(a9fea188)의 task.md를 확인하지 않고 새 implementation_plan.md를 작성하여 에이전트 구성이 달라짐
- **원인**: 새 대화에서 이전 작업 파일을 조회하지 않고 계획을 수립함
- **영향**: Phase 3-B 에이전트 구성이 실제 조직도 기반(task.md)과 QA 기능 기반(plan.md)으로 불일치 발생
- **재발 방지 규칙**: 새 대화에서 계획 수립 전 반드시 `brain/[최신 대화ID]/task.md` 읽기

### ERR-002
- **날짜**: 2026-05-11
- **실수**: n8n이 로컬(localhost:5678)임에도 클라우드(n8n Cloud) 기준으로 설계
- **원인**: HANDOFF.md가 없어서 접속 정보를 추측함
- **영향**: 워크플로우 설계 방향 전체 오류
- **재발 방지 규칙**: 접속 정보(n8n, Supabase, Telegram)는 반드시 HANDOFF.md에서만 읽음. 파일 없으면 사용자에게 확인 요청

### ERR-003
- **날짜**: 2026-05-11
- **실수**: Supabase가 이미 구축(shinwoo-ai-secondbrain)됐음에도 "없다"고 판단하여 신규 생성 언급
- **원인**: 이전 대화 확인 없이 추론으로 판단
- **영향**: 불필요한 재작업 발생 및 사용자 혼란
- **재발 방지 규칙**: 인프라 현황(Supabase, n8n 워크플로우 등)은 반드시 task.md 또는 HANDOFF.md로 확인 후 판단. 추론 금지

### ERR-004
- **날짜**: 2026-05-11
- **실수**: 신규 스킬 파일을 `personal/skills/`에 생성했으나 Antigravity 실제 로딩 경로는 `personal/.agents/skills/`임
- **원인**: Antigravity의 스킬 로딩 경로를 확인하지 않고 임의로 경로 설정
- **영향**: 스킬 파일이 시스템에 로딩되지 않아 무용지물
- **재발 방지 규칙**: 스킬 생성 시 반드시 `.agents/skills/` 경로 사용. `personal/skills/`는 로딩 안 됨

### ERR-005
- **날짜**: 2026-05-11
- **실수**: 규칙 0(무조건 실행)과 규칙 1(키워드 조건 실행)을 처음 설계 시 충돌하게 작성
- **원인**: 규칙 간 역할 분리를 명확히 하지 않고 작성
- **영향**: 키워드 없이 대화 시작 시 규칙 1이 발동 안 되는 허점 발생
- **재발 방지 규칙**: 규칙 작성 시 각 규칙의 발동 조건이 겹치거나 충돌하지 않는지 반드시 교차 검토

### ERR-006
- **날짜**: 2026-05-11 (대화 630790d5)
- **실수**: n8n Telegram webhook을 localtunnel로 유지하려 했으나 503/Connection reset 반복 발생으로 텔레그램 실전 테스트 실패
- **원인**: localtunnel은 공개 무료 서버로 구조적으로 불안정. 고정 서브도메인도 재기동 시 타 사용자와 충돌 가능성 있음
- **영향**: 텔레그램 그룹방 테스트 불가. 다음 세션으로 이월
- **재발 방지 규칙**: 텔레그램 webhook 연동은 **ngrok**으로 교체할 것. localtunnel은 내부 테스트용으로만 사용. ngrok authtoken 발급 후 `ngrok http 5678` → URL을 webhook에 등록하는 절차 확립

### ERR-007
- **날짜**: 2026-05-11 (대화 630790d5)
- **실수**: n8n API PUT 요청 시 `settings` 객체에 n8n이 허용하지 않는 추가 필드가 포함되어 `request/body must NOT have additional properties` 오류 발생
- **원인**: GET으로 받은 워크플로우 전체를 그대로 PUT body로 사용
- **영향**: 워크플로우 업데이트 실패, 재시도 필요
- **재발 방지 규칙**: PUT 업데이트 시 body는 `{ name, nodes, connections, settings: { executionOrder }, staticData: null }` 최소 구성만 사용. GET 응답의 모든 필드를 그대로 PUT하지 말 것

---

## 새 실수 추가 형식

```markdown
### ERR-XXX
- **날짜**: YYYY-MM-DD
- **실수**: [무엇을 잘못했나]
- **원인**: [왜 그런 실수가 발생했나]
- **영향**: [어떤 문제가 생겼나]
- **재발 방지 규칙**: [다음부터 어떻게 할 것인가]
```

### ERR-008
- **날짜**: 2026-05-12 (대화 9725b157)
- **실수**: n8n Code 노드에서 require('path')와 require('fs') 사용 → Module 'path' is disallowed 오류
- **원인**: n8n Code 노드는 기본적으로 Node.js 내장 모듈을 보안상 차단. NODE_FUNCTION_ALLOW_BUILTIN 환경변수 미설정
- **영향**: MEETING 경로 전체 실패 (QA 에이전트 호출 불가)
- **재발 방지 규칙**: n8n Code 노드에서 fs, path 등 내장 모듈 사용 시 반드시 .env에 NODE_FUNCTION_ALLOW_BUILTIN=fs,path,os 추가 및 n8n 재시작 필요. start_system.ps1에도 포함할 것

### ERR-009
- **날짜**: 2026-05-12 (대화 9725b157)
- **실수**: Ollama Credential baseUrl을 `http://localhost:11434`로 설정 → AI Agent 노드에서 `fetch failed` 오류
- **원인**: n8n이 내부적으로 localhost를 IPv6(::1)로 해석 → Ollama는 IPv4(127.0.0.1)에서만 수신
- **영향**: AI Agent 노드 전체 실패
- **재발 방지 규칙**: Ollama Credential baseUrl은 반드시 `http://127.0.0.1:11434` 사용. localhost 절대 금지

### ERR-010
- **날짜**: 2026-05-12 (대화 9725b157)
- **실수**: Execute Workflow 노드 typeVersion 1.1에서 workflowInputs 포맷 오류로 sub-workflow 실행 전 실패
- **원인**: typeVersion 1.1의 workflowInputs 스키마가 typeVersion 1과 다름. 검증 없이 사용
- **영향**: 라우터에서 에이전트 호출 불가 (Error executing workflow with item at index 0)
- **재발 방지 규칙**: Execute Workflow 노드는 typeVersion 1 사용. workflowInputs 없이 기본 데이터 전달 방식 사용

### ERR-011
- **날짜**: 2026-05-12 (대화 9725b157)
- **실수**: 라우터 활성화 시 sub-workflow(비서/QA/QC)가 비활성 상태여서 400 오류
- **원인**: n8n은 Execute Workflow가 참조하는 sub-workflow가 active여야 라우터 활성화 허용
- **영향**: 라우터 활성화 실패
- **재발 방지 규칙**: 활성화 순서 필수 — 비서 → QA → QC 에이전트 먼저 활성화 → 라우터 마지막 활성화

### ERR-012
- **날짜**: 2026-05-12 (대화 9725b157)
- **실수**: Ollama Credential 삭제 후 재생성 시 ID가 변경됨 → 모든 워크플로우에서 credential not found 오류
- **원인**: credential 삭제 시 이를 참조하는 워크플로우 노드를 일괄 업데이트하지 않음
- **영향**: 비서/QA/QC 에이전트 전체 credential 재설정 필요
- **재발 방지 규칙**: Credential 삭제 전 해당 ID를 참조하는 워크플로우 목록 확인 후 일괄 업데이트 스크립트 실행. 가능하면 삭제 대신 데이터만 수정

### ERR-013
- **날짜**: 2026-05-16 (대화 e0c67f5d)
- **실수**: BotFather에서 봇 11개 연속 생성 시도 → rate limit 발생 (70267초 대기)
- **원인**: BotFather 봇 생성 횟수 제한을 사전에 확인하지 않고 한 번에 생성 지시
- **영향**: 차장님 작업 중단, 약 19.5시간 대기 필요
- **재발 방지 규칙**: BotFather 봇 생성은 하루 2~3개씩 나눠서 진행. 사전에 rate limit 정책 확인 필수

### ERR-014
- **날짜**: 2026-05-17 (대화 e0c67f5d)
- **실수**: start_system.ps1에서 n8n을 `-WindowStyle Normal`로 실행 → 매 부팅 시 PowerShell 창 표시
- **원인**: 디버깅 편의를 위해 Normal로 설정했으나 백그라운드 운영 시 수정하지 않음
- **영향**: 부팅 시마다 n8n PowerShell 창이 화면에 노출
- **재발 방지 규칙**: 백그라운드 실행 스크립트의 Start-Process는 반드시 `-WindowStyle Hidden` 사용. `.bat` 파일은 시작프로그램에 절대 등록 금지 (VBS 사용)

### ERR-015 — 2026-05-17 [자동 감지]
- **패턴키**: localhost_usage
- **현상**: Ollama 연동 시 localhost 사용 (127.0.0.1 사용 필수)
- **해결**: 모든 Ollama 호출에서 localhost → 127.0.0.1 로 교체
- **상태**: drift_monitor 자동 등록

### ERR-016 — 2026-05-21
- **현상**: 아티팩트 생성 시 기존 중요 파일의 백업이나 버전 분리 없이 Overwrite=true로 단순 덮어쓰기하여 1단계 계획서를 유실할 뻔함. 이를 해결하기 위해 GEMINI.md에 [아티팩트 덮어쓰기 금지 및 자동 버전 분리 규칙]을 명문화하여 이식함.
- **해결**: GEMINI.md 내 아티팩트 전역 규칙에 덮어쓰기 금지 조항을 추가하고, v2/v3 형식의 버전 분리 물리 생성을 강제함.
- **상태**: 신규 등록
