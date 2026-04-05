-- ==========================================
-- 상용 DB(Production) 전체 사용자 추출본
-- ==========================================
DROP TABLE IF EXISTS public.users CASCADE;
CREATE TABLE public.users (
  id bigint PRIMARY KEY,
  email text,
  password text,
  name text,
  company text,
  role text,
  rank text,
  date text,
  status text
);
INSERT INTO public.users (id, email, password, name, company, role, rank, date, status) VALUES
(1, 'mjjeon@shinwoovalve.com', '1', '전민재', '품질보증부', 'manager', '차장', '2026-04-05', 'Active'),
(999, 'admin_stg@shinwoo.com', 'admin123', '스테이징관리자', '품질보증부', 'manager', '최고관리자', '2026-04-05', 'Active');
