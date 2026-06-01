# 신우밸브 AI 핵심 결정 로그
> 이 파일은 영구 누적됩니다. 삭제하지 마세요.
> "왜 이런 결정을 했는가"를 기록하여 새 대화에서도 맥락이 이어지도록 합니다.

---

## 결정 목록

### DEC-001: n8n 환경 — 로컬 전환
- **날짜**: 2026-05-08 (대화 a9fea188)
- **결정**: n8n Cloud에서 로컬(localhost:5678)로 전환
- **이유**: Cloud는 실행 횟수 제한(Starter 플랜). 로컬은 무제한 실행 가능
- **영향**: 외부 접속을 위해 localtunnel 필수. 터널 URL: `https://shinwoo-n8n.loca.lt` (고정)
- **주의**: 새 대화에서 n8n 설계 시 반드시 로컬 기준으로 할 것

### DEC-002: AI 모델 — Ollama(Gemma4)만 사용
- **날짜**: 2026-05-08 (대화 a9fea188)
- **결정**: Claude(Anthropic) 완전 배제, 로컬 Ollama(gemma4:latest)만 사용
- **이유**: 비용 절감 + 데이터 로컬 보안 + 인터넷 없이도 동작
- **주의**: n8n 워크플로우에서 OpenAI 노드 대신 HTTP Request로 Ollama API 호출

### DEC-003: 에이전트 12인 구성 — 조직도 기반
- **날짜**: 2026-05-09 (대화 726de206)
- **결정**: 에이전트는 QA 기능 기반이 아닌 신우밸브 실제 조직도 기반으로 구성
- **이유**: 실제 업무 흐름에 맞게 라우팅해야 실용성 있음
- **확정 구성**:
  1. 비서+기획담당자 오케스트레이터 (메인)
  2. QA 에이전트 (audit_schedules)
  3. QC 에이전트 (calibration_schedules)
  4. 문서관리, 5.생산, 6.구매, 7.경영지원, 8.기술
  9. 인사 (team_members), 10.총무, 11.기획담당자, 12.디자인기획

### DEC-004: Telegram 봇 — 단일 봇 유지
- **날짜**: 2026-05-09 (대화 726de206)
- **결정**: 에이전트별 12개 봇 대신 @mjjeon_personalbot 단일 봇으로 메시지 라우팅
- **이유**: 12개 봇 관리 복잡성 대비 실용적 이득 없음
- **현재 봇**: @mjjeon_personalbot, Chat ID: 8525448553

### DEC-005: 프롬프트 언어 — 혼합 방식
- **날짜**: 2026-05-09 (대화 726de206)
- **결정**: CEO 라우터 분류 프롬프트는 영문, 에이전트 응답은 한글
- **이유**: Gemma4는 영문 학습 데이터가 많아 영문 분류가 정확도 높음. 응답은 한글이 가독성 좋음

### DEC-006: 메모리 시스템 최종 구조 확정
- **날짜**: 2026-05-11 (대화 726de206)
- **결정**: 규칙은 `.claude/rules/`, 스킬은 `.claude/skills/`, 데이터는 `shinwoo-system/` 안으로 통합
- **이유**: Antigravity 실제 로딩 경로 확인 후 확정. `.agents/skills/`는 백업으로만 유지
- **주의**: 신규 규칙/스킬 생성 시 `.claude/` 경로 사용

### DEC-007: 민감 정보 분리 (secrets.md)
- **날짜**: 2026-05-11 (대화 726de206)
- **결정**: Telegram 토큰, Chat ID 등 민감 정보는 `secrets.md`에만 저장. HANDOFF.md에는 "참고"만 표시
- **이유**: HANDOFF.md가 노출되면 봇 완전 장악 가능. 민감 정보는 반드시 분리
- **주의**: `secrets.md`는 `.gitignore` 적용됨. Git에 커밋 금지

### DEC-008: 텔레그램 그룹방 — 에이전트 팀 채널 운영
- **날짜**: 2026-05-11 (대화 630790d5)
- **결정**: 개인 DM 대신 "신우밸브 AI 에이전트팀" 그룹방으로 모든 에이전트 응답 통합
- **이유**: 옵션 A(봇 1개, 그룹방) 선택 — 구현 빠르고 관리 단순
- **그룹 Chat ID**: `-5160422366`
- **주의**: 모든 워크플로우 chatId가 `-5160422366`으로 업데이트됨. 개인 DM(`8525448553`)으로 롤백 시 전체 수정 필요

### DEC-009: 터널 — localtunnel → ngrok 전환 결정
- **날짜**: 2026-05-11 (대화 630790d5)
- **결정**: localtunnel 폐기, ngrok으로 전환
- **이유**: localtunnel 503/Connection reset 반복으로 텔레그램 webhook 연결 불안정. ngrok은 안정적 전용 서버 사용
- **다음 작업**: ngrok.com 가입 → authtoken 발급 → `ngrok authtoken [토큰]` → `ngrok http 5678` → webhook URL 재등록
- **주의**: ngrok 무료 플랜은 재시작 시 URL 변경됨. 변경될 때마다 텔레그램 webhook 재등록 필요 (유료 플랜은 고정 URL 가능)

### DEC-010: Telegram 봇 Privacy Mode DISABLED
- **날짜**: 2026-05-12 (대화 630790d5)
- **결정**: @mjjeon_personalbot의 Privacy Mode를 DISABLED로 설정
- **이유**: 그룹에서 일반 텍스트 메시지를 봇이 수신하려면 Privacy Mode 비활성화 필수. 기본값은 ENABLED (명령어/멘션만 수신)
- **방법**: BotFather → /setprivacy → 봇 선택 → Disable
- **주의**: 다시 Enable로 바꾸면 그룹 메시지 수신 불가. 유지 필요

### DEC-011: ngrok authtoken 등록 및 터널 방식 확정
- **날짜**: 2026-05-12 (대화 630790d5)
- **결정**: ngrok을 공식 터널로 확정, authtoken 등록 완료
- **이유**: localtunnel의 구조적 불안정(503, Connection reset) 대비 ngrok은 안정적
- **단점**: 무료 플랜은 재시작마다 URL 바뀜 → 매번 `setWebhook` 재등록 필요
- **n8n 시작 절차**: ngrok 먼저 시작 → URL 확인 → `$env:WEBHOOK_URL=[URL]` 설정 → `n8n start` → webhook 재등록
- **개선안**: ngrok 유료 플랜($10/월)으로 고정 URL 확보 시 재등록 불필요

### DEC-012: 회의록/대화 저장 — Supabase → PC 로컬 전환
- **날짜**: 2026-05-12 (대화 9725b157)
- **결정**: meeting_minutes 및 모든 에이전트 대화 기록을 Supabase 대신 PC 로컬 파일로 저장
- **이유**: Supabase의 기술적 우위가 없음. LLM이 어차피 텍스트를 읽어 요약하므로 파일 기반도 동등. 인터넷 의존 없이 완전 자립형 구조
- **저장 구조** (connectai 방식 적용):
  ```
  shinwoo-system/
  ├── conversations/YYYY-MM-DD.md   ← 텔레그램 원문 (비서만)
  ├── sessions/YYYY-MM-DDTHH-MM/
  │   ├── secretary_agent.md
  │   ├── qa_agent.md
  │   └── qc_agent.md
  └── agents/
      ├── secretary/memory.md
      ├── qa/memory.md
      └── qc/memory.md
  ```
- **구현**: n8n 3개 워크플로우에 SAVE_Secretary_Log / SAVE_QA_Log / SAVE_QC_Log Code 노드 추가
- **주의**: Supabase `meeting_minutes` 테이블은 비워둬도 됨. 로컬 파일이 기준

### DEC-013: QMS 절차서 배치 — _shared + 에이전트별 procedures 이중 구조
- **날짜**: 2026-05-31
- **결정**: QUALITY_MANAGEMENT_MANUAL → `_shared/procedures/`, 나머지 37개 QAP → 각 에이전트 `procedures/` 격리 배치
- **이유**: 에이전트가 전체 wiki 검색 시 담당 외 문서까지 조회되는 문제 방지. 매뉴얼은 모든 에이전트 공통 참조 필요
- **V9.0 정정 반영**: QAP-900-01(소비자구매정보) → `11_planning`, QAP-540-02(용접자재관리) → `08_technical`
- **wiki_query.py**: agent_key 동적 인자 + _shared 병합 하이브리드 검색으로 개조 완료

### DEC-014: CEO 라우팅 버그 — "자격인정" 키워드 HR로 오분류
- **날짜**: 2026-05-31
- **문제**: 텔레그램 실 테스트에서 QAP-120-01 질문이 02_qa 대신 09_hr로 라우팅됨
- **원인**: router.py KEYWORD_MAP에 "자격인정" 키워드 미등록 → LLM이 HR로 판단
- **조치 필요**: router.py에 `"자격인정"`, `"QAP-120"` → `qa` 키워드 명시 추가

### DEC-015: 아키텍처 전환 — n8n 최소화 + 모듈형 로컬 에이전트
- **날짜**: 2026-05-13 (대화 bfd6e847)
- **결정**: n8n은 외부 연동(Gmail 수신, Telegram 전송)만 담당. 핵심 로직·메모리·라우팅은 로컬 PC(Python 오케스트레이터)로 이전
- **이유**: n8n은 워크플로우 자동화 도구이지 에이전트 오케스트레이션 플랫폼이 아님. 12개 에이전트 관리·메모리 공유·복잡한 라우팅에 구조적 한계 존재
- **영향**: 기존 [CEO] 업무 라우팅 워크플로우 → 로컬 오케스트레이터로 대체 예정. 스케줄 알림 3개 워크플로우는 유지
- **주의**: 새 대화에서 에이전트 설계 시 n8n 기반이 아닌 로컬 Python 기준으로 진행

### DEC-016: 실행 프레임워크 — 커스텀 Python + Ollama API 직접 호출
- **날짜**: 2026-05-13 (대화 bfd6e847)
- **결정**: LangGraph, CrewAI 등 외부 AI 프레임워크 미사용. 커스텀 Python 오케스트레이터 + Ollama API 직접 호출 방식으로 확정
- **이유**: MD 파일 기반 에이전트 구조 위에 LangGraph를 얹으면 추상 레이어 이중화. 직접 호출이 디버깅 용이, 유연성 최대, 학습 비용 최소
- **영향**: FastAPI로 엔드포인트 구성 → n8n이 HTTP POST로 호출
- **주의**: Ollama API는 `http://127.0.0.1:11434` 사용 (localhost 금지 — ERR-009 참고)

### DEC-017: 에이전트 MD 파일 구조 — connectai 형식 채용
- **날짜**: 2026-05-13 (대화 bfd6e847)
- **결정**: 각 에이전트 폴더에 config.md / goal.md / prompt.md / memory.md / tools.md + tools/ 하위폴더 구조 채용. connectai 이름은 신우밸브 기준으로 재정의
- **이유**: 이미 검증된 MD 기반 에이전트 OS 구조. 파일 시스템이 곧 에이전트 상태 관리 시스템
- **자율성 레벨 기본값**: AUTONOMY_LEVEL 2 (Draft — 초안 작성 후 승인)
- **공유 폴더**: _shared/ (identity.md, goals.md, decisions.md, schedule.md, _system.md, agent_models.json)
- **주의**: 이름만 새로 정의. connectai의 에이전트 이름(secretary, youtube 등) 그대로 사용 금지

### DEC-018: 최종 아키텍처 확정 — 13인 에이전트 + 순수 Python
- **날짜**: 2026-05-15 (대화 bfd6e847)
- **결정**:
  1. 에이전트 13개 (CEO 신규 추가 → 00_ceo)
  2. 프레임워크: 순수 Python (CrewAI/LangGraph 미사용)
  3. 메모리: 완전 로컬 (MD + SQLite)
  4. 외부 연동: n8n 완전 제거 → telebot polling + Gmail API + APScheduler
- **이유**: CEO/비서 역할 분리로 과부하 해결. 순수 Python은 투명성·디버깅 용이성 최우선. n8n 제거로 단일 Python 프로세스로 통합
- **구조**: `shinwoo-agents/` 폴더 → _shared/ + agents/00_ceo~12_design/ + core/ + integrations/ + sessions/
- **주의**: Gmail OAuth는 Python용 credentials.json 별도 발급 필요 (n8n OAuth 재사용 불가)

---

## 새 결정 추가 형식

```markdown
### DEC-XXX: [결정 제목]
- **날짜**: YYYY-MM-DD (대화 ID)
- **결정**: [무엇을 결정했나]
- **이유**: [왜 그 결정을 했나]
- **영향**: [어떤 영향이 있나]
- **주의**: [새 대화에서 이 결정 관련 주의사항]
```

### DEC-019: 13봇 아키텍처 + Wave 병렬 처리 확정
- **날짜**: 2026-05-16 (대화 e0c67f5d)
- **결정**: CEO 봇(그룹) + 비서 봇(DM) + 전문 에이전트 봇 11개로 구성. Wave 1(수집)/Wave 2(검증)/Final(보고) 병렬 처리 패턴 확정
- **이유**: 에이전트별 봇이 그룹에서 직접 발언하여 시각적 구분 + Wave 병렬 처리로 응답 속도 및 정확도 향상
- **주의**: 전문 에이전트 봇 토큰 없을 시 CEO 봇으로 폴백(fallback) 처리됨. BotFather rate limit으로 7개는 추후 생성 예정

### DEC-020: Connect AI Lab 분석 — 자율 학습 루프 도입 결정
- **날짜**: 2026-05-16 (대화 e0c67f5d)
- **결정**: Connect AI Lab의 '무한 자율 대화 루프' 개념 채택. autonomous_loop.py + obsidian_writer.py 구현 예정
- **이유**: 에이전트가 유휴 시간에 자율 학습하고 결과를 Obsidian wiki에 자동 저장 → 지식 누적
- **주의**: Chrome Extension 불필요. Python으로 동일 기능 구현. 현재 시스템이 Connect AI보다 상위 구조

### DEC-021: 시작프로그램 구조 정리
- **날짜**: 2026-05-17 (대화 e0c67f5d)
- **결정**: 시작프로그램에서 .bat 파일 제거, VBS 파일만 유지. n8n 실행 시 -WindowStyle Hidden 적용
- **이유**: .bat 파일은 CMD 창이 필수 발생. VBS의 window=0 옵션이 진정한 백그라운드 실행
- **확정 시작프로그램**: Ollama.lnk / ShinwooAI_Start.vbs / ShinwooAI_TunnelStart.vbs
- **주의**: ShinwooAI.bat 삭제 완료. start_system.ps1에서 n8n은 Hidden으로 수정 완료
