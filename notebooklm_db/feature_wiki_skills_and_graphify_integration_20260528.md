# 기능 명세서 - Obsidian 위키 스킬 3종 세트 및 Graphify 통합 지식 관리 시스템

- **문서 유형:** 기능 명세 (Feature Spec)
- **작성일자:** 2026년 5월 28일
- **작성자:** 안티gravity (QMS AI 에이전트)
- **결재권자:** 신우밸브주식회사 품질보증부 전민재 차장님

---

## 1. 개요 및 전체 아키텍처
본 명세서는 신우밸브 QMS 전용 지식베이스 고도화를 위해 연동된 **Obsidian 위키 스킬 3종 세트**와 **Graphify 지식 시각화 모듈**의 통합 작동 원리와 구조를 설명합니다.

```mermaid
graph TD
    Raw[raw/ 10대 출처 파일 수집] --> Ingest[wiki-ingest 스킬]
    Ingest --> Wiki[wiki/ 4대 영역 문서 분배]
    Wiki --> Link[개념 간 [[Wikilink]] 상호 참조 연결]
    Wiki --> Query[wiki-query 스킬]
    Wiki --> Lint[wiki-lint 스킬]
    Raw --> Graphify[Graphify 갱신 스크립트: run-graphify.ps1]
    Graphify --> Visual[graphify-out/graph.html 시각화 시각화]
```

## 2. 세부 기능 모듈 설명

### ① 위키 스킬 3종 세트 (AI 전용)
AI 에이전트의 위키 제어 역량을 위해 `.agent/skills/`에 3종의 전용 명령어 스킬을 설계 및 배치 완료하였습니다.

1. **`/ingest` (wiki-ingest):**
   - **기능:** `raw/` 폴더 내에 수집된 신규 파일 중 `wiki_status: pending` 상태인 문서를 자동 스캔하여 위키 표준 양식으로 정제한 뒤, 알맞은 `wiki/` 서브 영역으로 자동 배포 및 수집 기록(`log.md`, `index.md`)을 동기화합니다.
2. **`/query` (wiki-query - "Knowledge Flywheel" 핵심):**
   - **기능:** 지식 그래프 및 위키 전반의 지식 자산을 검색해 차장님의 질문에 답변합니다. `wiki/index.md` 구조 분석 ➔ 연관 페이지 독해 ➔ `[[Wikilink]]` 출처 명시 답변 단계를 밟으며, 답변 완성도가 우수할 경우 자동으로 위키의 신규 페이지로 정식 승격해 영구 보관합니다.
3. **`/lint` (wiki-lint):**
   - **기능:** 위키 내부의 손상되거나 깨진 `[[Wikilink]]`, 부적절한 서브 폴더 위치, 메인 인덱스와의 정밀도 불일치를 진단하여 결함을 모니터링합니다.

### ② Graphify 지식 시각화 연동
- **위치:** `C:\Users\mjjeon\Desktop\QMS 프로젝트\shinwoo-valve-qms\graphify-out\`
- **기능:** 수집된 위키 노드 간의 군집도(Community)와 중심성(Centrality)을 분석하여 `graph.html`로 동적 시각화합니다. 사용자는 브라우저 상에서 마우스 드래그 및 검색 기능을 통해 연관 개념들의 유기적 관계망을 실시간 탐색할 수 있습니다.

## 3. 설정 정보 및 파일 경로
- **스킬 정의 경로:** `.agent/skills/wiki-ingest/`, `wiki-query/`, `wiki-lint/`
- **시각화 엔진 결과 경로:** `graphify-out/graph.html`, `graphify-out/GRAPH_REPORT.md`
