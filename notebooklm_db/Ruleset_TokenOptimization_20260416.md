# [지식 자산] AI 토큰 최적화 및 원격 저장소 동기화 규칙

- **분류**: 룰셋 (Ruleset)
- **주제**: 대용량 로컬 데이터 처리 최적화 및 AI 행동 강령 개정
- **날짜**: 2026-04-16

---

## 1. 개요 (Background)
신우밸브 QMS 프로젝트의 로컬 데이터 저장소인 `db.json`은 공정 및 인수 검사 데이터를 포함하여 약 1.9만 줄 이상의 대용량 구조를 가짐. 이는 AI와의 대화 시 컨텍스트 토큰을 과도하게 소비하여 응답 지연 및 비효율을 초래함.

## 2. 주요 분석 및 의사결정 (Analysis & Decision)

### 2.1 `db.json`의 용도 재확정
- **로컬 샌드박스**: 클라우드(Supabase) 서버 없이도 오프라인에서 시스템 전 기능을 구동하기 위한 필수 데이터 소스.
- **물리적 백업**: 서버 장애나 휴먼 에러 발생 시 최후의 복구 수단.
- **결론**: 파일 자체를 삭제하거나 데이터를 분리하지 않고 물리적으로 유지함.

### 2.2 토큰 소모 문제 해결 (AI 행동 강령 개정)
- 데이터 파일은 유지하되, AI 에이전트가 이를 읽을 때 대용량 섹션(inspections)을 스스로 무시하도록 규칙을 설정함.

## 3. 최종 확정 룰셋 (Final Ruleset)

### 3.1 AI 행동 강령(AI_INTERACTION_RULES.md) 제5장 신설
- **대용량 데이터 무시 원칙**: `db.json` 분석 시 `process_inspections` 및 `receiving_inspections` 섹션의 Row 데이터 전수 읽기를 금지하고 구조(Keys)만 파악함.
- **전수 읽기 제한**: 명시적 지시가 없는 한 대용량 데이터 파일(`*.json`, `*.csv`)의 전수 읽기를 자제함.
- **요약 보고**: 수만 건의 로우 데이터 대신 핵심 통계치 및 결론 위주로 요약 보고함.

### 3.2 원격 저장소 동기화
- 개정된 룰셋을 로컬에서 수정한 후, Git을 통해 원격 저장소(`origin/main`)에 즉시 반영하여 모든 팀원 및 에이전트가 최신 규칙을 공유하도록 함.

---

## 4. 관련 증빙 및 파일
- **규칙 파일**: [AI_INTERACTION_RULES.md](file:///c:/Users/mjjeon/Desktop/QMS%20프로젝트/shinwoo-valve-qms/AI_INTERACTION_RULES.md)
- **동기화 스크립트**: [sync-db.js](file:///c:/Users/mjjeon/Desktop/QMS%20프로젝트/shinwoo-valve-qms/scripts/sync-db.js)
- **저장 경로**: `C:\Users\mjjeon\Desktop\QMS 프로젝트\shinwoo-valve-qms\notebooklm_db\`

---
*본 문서는 차장님의 지시에 따라 AI가 스스로 분석하여 생성한 공식 지식 자산입니다.*
