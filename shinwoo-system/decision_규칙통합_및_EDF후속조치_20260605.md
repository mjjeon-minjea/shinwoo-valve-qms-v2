# 의사결정 로그 — 2026-06-05 오후 세션

## 1. 규칙 파일 통합 (01~04 → GEMINI.md)
- **채택**: `.agent/rules/` 하위 4개 파일(01_tech_stack, 02_dnas_process, 03_archiving, 04_harness_constraints)을 GEMINI.md 단일 파일로 통합
- **사유**: 파일 분리가 실질적 이점 없이 관리 복잡도만 증가. 에이전트가 규칙을 찾지 못하는 원인이 됨.
- **결재**: 차장님 즉시 명시적 승인 ("오케이 긴급승인 당장 수정 및 보완해")

## 2. HANDOFF.md 공식 경로 = shinwoo-system/
- **채택**: `shinwoo-system\HANDOFF.md`를 유일한 공식 경로로 확정
- **사유**: 경로 미지정으로 에이전트가 매 세션마다 다른 위치에 생성하는 문제 해소
- **반영 범위**: 전역 규칙 [조항 5], 워크스페이스 규칙 §3-2, knowledge-extractor 스킬

## 3. clone-db TARGET_TABLES 확정 10종
- **채택**: `users, dev_notes, notices, weekly_reports, process_inspections, inspections, item_master, inquiries, suggestions, settings`
- **기각**: `calendar_events, resources` (테스트 DB 미존재), `receiving_inspections, system_settings` (양쪽 DB 미존재)
- **근거**: 2026-06-05 15:52 라이브 REST API 쿼리 실측

## 4. Database password vs service_role key 구분
- **결정**: Database password Reset 실행, service_role key 로테이션은 보류
- **사유**: Supabase에서 service_role key 개별 로테이션 기능 존재 여부 미확인. DB password 변경으로 PostgreSQL 직접 접속 보안은 강화됨.
