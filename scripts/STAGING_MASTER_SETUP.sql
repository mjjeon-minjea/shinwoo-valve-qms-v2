-- ======================================================================
-- [신우밸브 QMS] STAGING MASTER SETUP SCRIPT
-- 작성일: 2026-04-06
-- 설명: 스테이징 환경 전용 통합 SQL (인증 엔진 훼손 방지 및 무혈 마이그레이션 탑재)
-- ======================================================================

BEGIN;

-- 1. 확장 기능 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. 기존 테이블 완전 철거 (순서 준수)
DROP TABLE IF EXISTS public.suggestions CASCADE;
DROP TABLE IF EXISTS public.dev_notes CASCADE;
DROP TABLE IF EXISTS public.weekly_reports CASCADE;
DROP TABLE IF EXISTS public.process_inspections CASCADE;
DROP TABLE IF EXISTS public.inspections CASCADE;
DROP TABLE IF EXISTS public.notices CASCADE;
DROP TABLE IF EXISTS public.resources CASCADE;
DROP TABLE IF EXISTS public.inquiries CASCADE;
DROP TABLE IF EXISTS public.calendar_events CASCADE;
DROP TABLE IF EXISTS public.item_master CASCADE;
DROP TABLE IF EXISTS public.settings CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- 3. 핵심 테이블: public.users (무혈 입성용 베이스캠프)
CREATE TABLE public.users (
  id text PRIMARY KEY, -- 임시 ID 허용
  auth_id uuid, -- [P2 추가] Supabase Auth UUID 1:1 전담 매핑
  email text UNIQUE NOT NULL,
  password text NOT NULL, -- 자동 마이그레이션용 비밀번호 (해시 전)
  name text,
  company text DEFAULT '신우밸브(주)',
  role text DEFAULT 'user',
  rank text,
  date text DEFAULT to_char(now(), 'YYYY-MM-DD'),
  status text DEFAULT 'Active',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- 4. 부속 테이블 구축 (게시판, 업무보고 등)
CREATE TABLE public.dev_notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    content text,
    version text DEFAULT 'v1.0.0',
    status text DEFAULT 'published',
    author text,
    manager text,
    date text DEFAULT to_char(now(), 'YYYY-MM-DD'),
    type text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

CREATE TABLE public.suggestions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    content text NOT NULL,
    type text NOT NULL,
    status text DEFAULT 'draft',
    author text,
    "authorEmail" text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.weekly_reports (
  id serial primary key,
  "authorId" text,
  "authorName" text,
  "weekStartDate" text,
  status text DEFAULT '작성중',
  schedule jsonb default '[]',
  projects jsonb default '[]',
  issues jsonb default '[]',
  samples jsonb default '[]',
  "createdDate" text DEFAULT to_char(now(), 'YYYY-MM-DD'),
  "reviewerComment" text,
  "approverComment" text
);

CREATE TABLE public.item_master (
  id text primary key,
  name text,
  spec text,
  unit text,
  category text,
  "subCategory" text,
  "minorCategory" text,
  type text,
  "originalData" jsonb
);

CREATE TABLE public.settings (
  id text primary key,
  "popupEnabled" boolean DEFAULT false
);

-- 5. 기초 데이터 주입 (차장님 및 팀원 계정)
INSERT INTO public.users (id, email, password, name, role, rank, status)
VALUES 
('v-mjjeon-001', 'mjjeon@shinwoovalve.com', '1', '전민재 차장', 'manager', '차장', 'Active'),
('v-jslee-001', 'jslee@shinwoovalve.com', '1', '이종선 대리', 'employee', '대리', 'Active'),
('v-admin-stg', 'admin_stg@shinwoo.com', 'admin123', '스테이징 관리자', 'admin', '차장', 'Active')
ON CONFLICT (email) DO NOTHING;

INSERT INTO public.settings (id, "popupEnabled") VALUES ('popup_status', false) ON CONFLICT DO NOTHING;

-- 6. 보안 설정 (RLS 활성화 및 권한 부여)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- 6-1. 기본 인증 유저 전체 접근 권한 (테스트용)
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN SELECT unnest(ARRAY['users', 'dev_notes', 'weekly_reports', 'item_master', 'settings', 'suggestions']) 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Enable ALL for authenticated users" ON public.%I', t);
        EXECUTE format('CREATE POLICY "Enable ALL for authenticated users" ON public.%I FOR ALL TO authenticated USING (true)', t);
        
        -- 익명(Anon) 유저 읽기 권한 (초기 가입 전 화면 렌더링용)
        EXECUTE format('DROP POLICY IF EXISTS "Enable read for anon users" ON public.%I', t);
        EXECUTE format('CREATE POLICY "Enable read for anon users" ON public.%I FOR SELECT TO anon USING (true)', t);
    END LOOP;
END
$$;

-- 7. 자동 마이그레이션 보조 함수 (기존 비번 검증)
CREATE OR REPLACE FUNCTION check_legacy_password(check_email text, check_password text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.users WHERE email = check_email AND password = check_password);
END;
$$;

COMMIT;

SELECT '✅ 스테이징 마스터 SQL 세팅이 완료되었습니다. 이제 로그인을 시도하십시오!' as "Antigravity Result";
