-- [ID 번호표 기계 초기화 스크립트]
-- 데이터를 강제로 밀어넣은 후에는, 번호표 뽑는 기계(Sequence)를 현재 가장 큰 번호 다음으로 맞춰줘야 합니다.

-- 1. 주간보고서 ID 시퀀스 맞추기
SELECT setval('weekly_reports_id_seq', (SELECT MAX(id) FROM weekly_reports));

-- 2. 공지사항 ID 시퀀스 맞추기
SELECT setval('notices_id_seq', (SELECT MAX(id) FROM notices));

-- 3. 자료실 ID 시퀀스 맞추기
SELECT setval('resources_id_seq', (SELECT MAX(id) FROM resources));

-- 결과 확인용 (선택)
-- SELECT currval('weekly_reports_id_seq');
