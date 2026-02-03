-- [ID 번호표 기계 초기화 스크립트 (수정본)]
-- Postgres Type Casting 명시

-- 1. 주간보고서 ID 시퀀스 맞추기
SELECT setval('weekly_reports_id_seq', (SELECT MAX(id) FROM weekly_reports)::bigint);

-- 2. 공지사항 ID 시퀀스 맞추기
SELECT setval('notices_id_seq', (SELECT MAX(id) FROM notices)::bigint);

-- 3. 자료실 ID 시퀀스 맞추기
SELECT setval('resources_id_seq', (SELECT MAX(id) FROM resources)::bigint);
