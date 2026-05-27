# 신우밸브주식회사 품질보증부 QMS AI 행동 강령 인덱스 (AGENTS.md)

이 문서는 안티그래비티(Gemini) 코딩 에이전트가 신우밸브 QMS v2 프로젝트를 안전하고 규격에 맞게 개발하도록 통제하는 **하네스 행동 강령 인덱스**입니다.

## 🧭 규칙 인덱스 (Rules Index)

에이전트는 코드 작성 및 의사결정 시 아래 규칙들을 순서대로 준수하며, 작업 전 반드시 규칙 내용을 로드해야 합니다.

1. **전역 최상위 규칙:** [GEMINI.md](file:///C:/Users/mjjeon/.gemini/GEMINI.md)
   - 에이전트 정체성 및 한글 통신 규격 (조항 1)
   - 3단계 결재 프로세스 DNAS (조항 2)
   - 안티그래비티 아티팩트 6대 분류 표준 (조항 3)
   - 전역 하네스 엔지니어링 제약 (조항 4)
2. **기술 스택 및 OS 가이드:** [.agent/rules/01_tech_stack.md](file:///C:/Users/mjjeon/Desktop/QMS%20프로젝트/shinwoo-valve-qms/.agent/rules/01_tech_stack.md)
3. **DNAS 결재 가이드라인:** [.agent/rules/02_dnas_process.md](file:///C:/Users/mjjeon/Desktop/QMS%20프로젝트/shinwoo-valve-qms/.agent/rules/02_dnas_process.md)
4. **지식 아카이빙 가이드:** [.agent/rules/03_archiving.md](file:///C:/Users/mjjeon/Desktop/QMS%20프로젝트/shinwoo-valve-qms/.agent/rules/03_archiving.md)

---

## 🔒 하네스 엔지니어링 통제 범위 요약

- **잠긴 표면 (Locked Surface):** `.eslintrc.cjs`, `.agent/rules/04_harness_constraints.md` 등은 어떠한 경우에도 에이전트 단독 수정이 불가합니다.
- **인간 통제 영역 (Human-controlled):** 파일 삭제, DB 스키마 직접 수정, `git push` 배포는 반드시 전민재 차장님의 승인 하에 대행 실행합니다.
- **자체 체크리스트 및 영구 금지:** 기획안 작성 전 10대 체크리스트와 8대 영구 금지 규칙을 반드시 준수합니다.

---

* **최종 갱신일:** 2026-05-27
* **작성자:** 안티그래비티 (Antigravity)
