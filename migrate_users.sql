-- 회원(users) 테이블 마이그레이션 (추가분)

INSERT INTO public."users" ("id", "email", "password", "name", "company", "role", "status", "rank", "date") VALUES ('1', 'mjjeon@shinwoovalve.com', '1', '전민재', '품질보증부', 'manager', 'Active', '과장', '2025-12-30') ON CONFLICT ("id") DO NOTHING;
INSERT INTO public."users" ("id", "email", "password", "name", "company", "role", "status", "rank", "date") VALUES ('2', 'jslee@shinwoovalve.com', '1', '이종선', '품질보증부', 'employee', 'Active', '대리', '2026-01-01') ON CONFLICT ("id") DO NOTHING;
INSERT INTO public."users" ("id", "email", "password", "name", "company", "role", "status", "rank", "date") VALUES ('1769999551878', 'ysson@shinwoovalve.com', '1', '손양수', '품질보증부', 'director', 'Active', '부장', '2026-02-02') ON CONFLICT ("id") DO NOTHING;
INSERT INTO public."users" ("id", "email", "password", "name", "company", "role", "status", "rank", "date") VALUES ('1769999649940', 'hchwang@shinwoovalve.com', '1', '황희찬', '품질보증부', 'employee', 'Active', '계장', '2026-02-02') ON CONFLICT ("id") DO NOTHING;
INSERT INTO public."users" ("id", "email", "password", "name", "company", "role", "status", "rank", "date") VALUES ('1769999734858', 'shcho@shinwoovalve.com', '1', '조승현', '품질보증부', 'employee', 'Active', '사원', '2026-02-02') ON CONFLICT ("id") DO NOTHING;
