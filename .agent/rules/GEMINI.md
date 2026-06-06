---
trigger: always_on
---

# 🗺️ 신우밸브 QMS v2 워크스페이스 통합 규칙 (GEMINI.md)

## ⚖️ §0. 통합 전역 마스터 규칙 (Identity)
본 규칙은 신우밸브 QMS v2 시스템 개발에 참여하는 안티그래비티 에이전트의 행위를 규제하는 최상위 규격입니다.

### [조항 1] 에이전트 정체성 및 한글 통신 규격 (Identity & Language)
1. 에이전트는 대화 상대방이 **신우밸브주식회사 품질보증부 전민재 차장**임을 명확히 인지하고 항상 최상의 격식과 정중함을 갖추어 대답한다.
2. 모든 진행 상황과 대답은 반드시 한글(한국어)로 작성한다.
3. 모든 진행 상태창(Task UI의 TaskName, TaskSummary, TaskStatus)과 내부 도구 사용 시 출력되는 메시지도 예외 없이 무조건 한글로만 출력한다.

---

## 🗺️ §1. 규칙 스킬 이정표 (SOP Navigator)
에이전트는 작업 상황에 따라 아래 지정된 경로의 한글 스킬 규칙(`.agent/skills/*/SKILL.md`)을 최우선적으로 탐색하고 읽어야 합니다.

### 1. 전역 제어 핵심 규칙 스킬

* **tech-stack (기술 스택)**
  * **경로**: `.agent/skills/tech-stack/SKILL.md`
  * **상황**: 코딩 및 시스템 환경 변경 시
  * **철칙**: 최소한의 변경(Surgical Changes) 적용 및 Ollama IP 절대 사용 금지

* **qms-planning-suite (기획/수행)**
  * **경로**: `.agent/skills/qms-planning-suite/SKILL.md`
  * **상황**: 기획안/작업 명세 수립 시
  * **철칙**: 구현 시작 전 Plan 작성 및 작업 완료 후 Report 작성 의무 준수

* **internal-comms (보고 가이드)**
  * **경로**: `.agent/skills/internal-comms/SKILL.md`
  * **상황**: 문서 및 보고서 작성 송출 시
  * **철칙**: 전민재 차장님 보고는 항상 초간결 핵심 요약과 파일 링크 위주로 구성

* **dnas-process (결재/배포)**
  * **경로**: `.agent/skills/dnas-process/SKILL.md`
  * **상황**: 결재 승인 획득 및 깃 배포 시
  * **철칙**: DNAS 3단계 결재 프로세스 및 명시적 승인 사후 집행 철칙 준수

* **knowledge-extractor (지식 추출)**
  * **경로**: `.agent/skills/knowledge-extractor/SKILL.md`
  * **상황**: 대화 종료 및 지식 추출 시
  * **철칙**: 세션 종료 및 인수인계 발생 시 HANDOFF.md 백업 및 지식 자산화 위임

* **revision-archiver (리비전 관리)**
  * **경로**: `.agent/skills/revision-archiver/SKILL.md`
  * **상황**: 아티팩트 리비전 관리 시
  * **철칙**: 아티팩트 수정 시 원본 덮어쓰기 금지 및 한글 '연/월/일' 폴더 하위에 리비전 분리 저장

* **image-archiver (이미지 아카이브)**
  * **경로**: `.agent/skills/image-archiver/SKILL.md`
  * **상황**: 이미지 생성 및 보관 시
  * **철칙**: 생성형 이미지 생성 즉시 한글 '연/월/일' 이미지 아카이브 폴더로 자동 이전 보존

* **harness-constraints (시스템 제약)**
  * **경로**: `.agent/skills/harness-constraints/SKILL.md`
  * **상황**: 잠긴 표면 및 시스템 제약 검사 시
  * **철칙**: CDP 포트 임의 제어 차단 및 로컬 PC의 시스템 안정성/보안 보장

* **antigravity-browser-guide (브라우저 제어 가이드)**
  * **경로**: `.agent/skills/antigravity-browser-guide/SKILL.md`
  * **상황**: 자체 내장 브라우저 조작 및 E2E 시연 녹화 아카이빙 시
  * **철칙**: 독립 크롬 단독 실행 금지 및 subagent 비디오 녹화본의 아티팩트 보존 준수

* **shinwoo-memory-system (통합 메모리 시스템)**
  * **경로**: `.agent/skills/shinwoo-memory-system/SKILL.md`
  * **상황**: 세션 종료/시작 시 컨텍스트 백업 및 날짜별 로그 관리 시
  * **철칙**: 종료 전 HANDOFF.md, error-registry.md, decision-log.md 동기화 의무 준수

* **knowledge-archiving (지식 아카이빙 규칙)**
  * **경로**: `.agent/skills/knowledge-archiving/SKILL.md`
  * **상황**: 지식 자산화 저장 및 NotebookLM 아카이빙 시
  * **철칙**: 지식 저장 시 다중 분할 저장 및 과거 날짜 명기 규칙 준수

* **qms-orchestrator (오케스트레이터 검증)**
  * **경로**: `.agent/skills/qms-orchestrator/SKILL.md`
  * **상황**: 구조 변경 사후 검사 및 아키텍처/스키마 정합성 검증 시
  * **철칙**: 구조 변경 완료 즉시 2대 검증 스크립트 수동 구동 및 에러 시 디버깅 선행

---

### 2. 일반 직무 및 보조 스킬 지도 (SOP Map)

* **xlsx (Excel 스프레드시트)**
  * **경로**: `.agent/skills/xlsx/SKILL.md`
  * **상황**: Excel 스프레드시트 제어 및 데이터 분석
  * **철칙**: 수식(Formula) 우선 적용 및 재계산(Recalculate)을 통한 오차 검산 의무화

* **pdf (PDF 문서)**
  * **경로**: `.agent/skills/pdf/SKILL.md`
  * **상황**: PDF 문서 병합/분할 및 텍스트 추출
  * **철칙**: PDF 텍스트 추출 시 영역 좌표 재정밀화 처리를 통해 데이터 누락 차단

* **brainstorming (브레인스토밍)**
  * **경로**: `.agent/skills/brainstorming/SKILL.md`
  * **상황**: 구현 기획 전 아이디어 설계 및 조율
  * **철칙**: 코딩 구현 전에 전민재 차장님의 본질적 의도와 요구사항을 사전 조율

* **test-driven-development (테스트 주도 개발)**
  * **경로**: `.agent/skills/test-driven-development/SKILL.md`
  * **상황**: 신규 기능 구현 및 버그 수정 시작
  * **철칙**: 실제 로직 코드 작성 전에 실패하는 테스트 케이스 선행 설계 및 TDD 적용

* **qms-code-reviewer (코드 리뷰어)**
  * **경로**: `.agent/skills/qms-code-reviewer/SKILL.md`
  * **상황**: 코드 품질 검수 및 차장님 피드백 반영
  * **철칙**: 차장님의 코드 리뷰 지적 사항을 100% 리팩토링 및 검증에 반영

* **qms-wiki-manager (위키 매니저)**
  * **경로**: `.agent/skills/qms-wiki-manager/SKILL.md`
  * **상황**: QMS 위키 데이터 린트 및 인제스트
  * **철칙**: 위키 문서 추가 시 린트 검사 수행 및 정적 정합성 무결성 확보

* **qms-verification-helper (검증 헬퍼)**
  * **경로**: `.agent/skills/qms-verification-helper/SKILL.md`
  * **상황**: 통합 동작 검증 및 디버깅
  * **철칙**: 구현 완료 보고 전에 통합 테스트 2회 이상 재확인 및 디버깅 로그 검증

* **release-sync (릴리즈 동기화)**
  * **경로**: `.agent/skills/release-sync/SKILL.md`
  * **상황**: 과업 완료 동기화 및 배포 로그 작성
  * **철칙**: 최종 병합 직후 로컬 SQLite DB의 release_log 테이블 쓰기 의무 수행

* **using-git-worktrees (깃 워크트리)**
  * **경로**: `.agent/skills/using-git-worktrees/SKILL.md`
  * **상황**: 피처 브랜치 개발 및 격리 환경 구축
  * **철칙**: 독립된 작업을 위해 git worktree를 생성하여 로컬 마스터 브랜치 보호

* **defuddle (웹 본문 추출)**
  * **경로**: `.agent/skills/defuddle/SKILL.md`
  * **상황**: 웹 브라우저 분석 및 본문 추출
  * **철칙**: 웹 브라우저 로드 시 광고 및 메뉴를 배제한 순수 본문 마크다운 추출

* **doc-coauthoring (공동 문서 작성)**
  * **경로**: `.agent/skills/doc-coauthoring/SKILL.md`
  * **상황**: 명세서 및 보고서 공동 문서 작성
  * **철칙**: 컨텍스트 수집 -> 정제 -> 독자 검증의 3단계 공동 집필 모델 강제 적용

* **brand-guidelines (브랜드 가이드라인)**
  * **경로**: `.agent/skills/brand-guidelines/SKILL.md`
  * **상황**: UI 개발 시 색상 및 레이아웃 정의
  * **철칙**: 신우 QMS 공식 브랜드 팔레트 및 타이포그래피 스타일 필수 적용

* **ui-ux-pro-max (고화질 UX)**
  * **경로**: `.agent/skills/ui-ux-pro-max/SKILL.md`
  * **상황**: 고화질 인터랙션 화면 UX 구현
  * **철칙**: 161개 제품 유형별 디자인 가이드라인 준수 및 사용자 접근성 충족

* **web-artifacts-builder (아티팩트 빌더)**
  * **경로**: `.agent/skills/web-artifacts-builder/SKILL.md`
  * **상황**: 복잡한 다중 컴포넌트 아티팩트 빌드
  * **철칙**: 상태 관리와 라우팅이 탑재된 claude.ai용 리액트 아티팩트 빌드 구현

* **web-design-guidelines (디자인 가이드라인)**
  * **경로**: `.agent/skills/web-design-guidelines/SKILL.md`
  * **상황**: UI 마크업 디자인 및 반응형 검수
  * **철칙**: 웹 인터페이스 가이드라인 준수 및 시맨틱 HTML5 구조 유효성 검사

* **writing-skills / skill-creator (스킬 에디터)**
  * **경로**: `.agent/skills/writing-skills/SKILL.md`
  * **상황**: 에이전트 스킬 신규 제작 및 개선
  * **철칙**: 신규 스킬 추가 시 TDD 기반의 동작 평가 및 명세 정합성 검증 강제

* **dispatching-parallel-agents (병렬 에이전트)**
  * **경로**: `.agent/skills/dispatching-parallel-agents/SKILL.md`
  * **상황**: 의존성 없는 병렬 태스크 실행
  * **철칙**: 상태를 공유하지 않는 태스크를 서브에이전트 병렬 구동하여 처리 단축

* **finishing-a-development-branch (브랜치 종결)**
  * **경로**: `.agent/skills/finishing-a-development-branch/SKILL.md`
  * **상황**: 개발 브랜치 최종 마무리 및 병합
  * **철칙**: 로컬 머지, PR 생성, 보존 여부에 대한 명확한 선택지 제공 및 보고

* **baoyu-markdown-tools (마크다운 도구)**
  * **경로**: `.agent/skills/baoyu-markdown-tools/SKILL.md`
  * **상황**: 마크다운 서식 포맷팅 및 이미지 압축
  * **철칙**: 마크다운 포맷 린트와 Mermaid 다이어그램 렌더링 검사 및 정적 압축

* **theme-factory (테마 팩토리)**
  * **경로**: `.agent/skills/theme-factory/SKILL.md`
  * **상황**: 문서/슬라이드 테마 자동 생산
  * **철칙**: 10대 사전 정의 스타일 테마를 엄격히 적용하여 레이아웃 조율

* **using-superpowers (에이전트 권한 제어)**
  * **경로**: `.agent/skills/using-superpowers/SKILL.md`
  * **상황**: 에이전트의 전능적 능력 사용 통제
  * **철칙**: 도구 호출 전 스킬 탐색 조건 및 질문 프롬프트 구성 제약 준수

* **frontend-design (프론트엔드 목업)**
  * **경로**: `.agent/skills/frontend-design/SKILL.md`
  * **상황**: 범용 프론트엔드 목업 설계
  * **철칙**: 사용자 흐름 중심의 인터랙티브 컴포넌트 및 시각 요소 최적화

* **react-best-practices (React 최적화)**
  * **경로**: `.agent/skills/react-best-practices/SKILL.md`
  * **상황**: React 컴포넌트 성능 최적화
  * **철칙**: Vercel 기준의 최적 렌더링 및 불필요한 재렌더링 차단 (메모이제이션)

* **supabase-postgres-best-practices (Supabase 최적화)**
  * **경로**: `.agent/skills/supabase-postgres-best-practices/SKILL.md`
  * **상황**: Supabase Postgres 쿼리 고도화
  * **철칙**: RLS 보안 및 쿼리 실행 계획(Explain) 분석을 통한 인덱스 설계 준수

* **plan-self-review (계획 자가검토)**
  * **경로**: `.agent/skills/plan-self-review/SKILL.md`
  * **상황**: 계획 단계의 엣지케이스 자가 검토
  * **철칙**: 계획 수립 단계에서 발생 가능한 부작용 및 예외 처리에 대한 자가 피드백

