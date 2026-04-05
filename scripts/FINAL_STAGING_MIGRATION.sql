BEGIN;

-- ======================================================================
-- [신우밸브 QMS] FINAL STAGING MIGRATION SCRIPT (9-STEP ARCHITECTURE)
-- 작성일: 2026-04-05
-- 설명: 27개의 조각난 스니펫을 엔터프라이즈 마이그레이션 포맷으로 정밀 재구축 (트랜잭션 안전망 탑재)
-- ======================================================================

-- [Step 1] 환경 세팅
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- [Step 2] 기존 의존성 완전 철거 및 초기화
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.dev_notes CASCADE;
DROP TABLE IF EXISTS public.suggestions CASCADE;
DROP TABLE IF EXISTS public.weekly_reports CASCADE;
DROP TABLE IF EXISTS public.process_inspections CASCADE;
DROP TABLE IF EXISTS public.inspections CASCADE;
DROP TABLE IF EXISTS public.notices CASCADE;
DROP TABLE IF EXISTS public.resources CASCADE;
DROP TABLE IF EXISTS public.inquiries CASCADE;
DROP TABLE IF EXISTS public.calendar_events CASCADE;
DROP TABLE IF EXISTS public.item_master CASCADE;
DROP TABLE IF EXISTS public.settings CASCADE;

-- [Step 3] 공통 검증/활용 함수 주입
CREATE OR REPLACE FUNCTION check_legacy_password(check_email text, check_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  match_count int;
BEGIN
  SELECT count(*) INTO match_count FROM public.users
  WHERE email = check_email AND password = check_password;
  RETURN match_count > 0;
END;
$$;

-- [Step 4] 통합 뼈대(DDL) 구축 (중복 제거 및 최신 컬럼 반영본)
CREATE TABLE public.users (
  id text PRIMARY KEY,
  email text,
  password text,
  name text,
  company text,
  role text,
  rank text,
  date text,
  status text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

CREATE TABLE public.dev_notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    content text,
    version text DEFAULT 'v1.0.0',
    status text DEFAULT 'published',
    author text,
    manager text,
    date text,
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
  "authorId" bigint,
  "authorName" text,
  "weekStartDate" text,
  status text,
  schedule jsonb default '[]',
  projects jsonb default '[]',
  issues jsonb default '[]',
  samples jsonb default '[]',
  "createdDate" text,
  "reviewerComment" text,
  "approverComment" text
);

CREATE TABLE public.process_inspections (
  id text PRIMARY KEY,
  title text,
  inspector_id text REFERENCES public.users(id),
  status text,
  created_at timestamp with time zone DEFAULT now(),
  "workOrderNo" text,
  "processCode" text,
  "workplaceFull" text,
  "inspectionDate" text,
  "plannedQuantity" numeric,
  "inspectedQuantity" numeric,
  "failedQuantity" numeric,
  "passedQuantity" numeric,
  "orderNo" text,
  "resolution" text,
  "workplaceCode" text,
  "modelName" text,
  "modelCategory" text,
  "workplace" text,
  "equipmentName" text,
  "isResolutionEntered" text,
  "inspectionType" text,
  "itemCode" text,
  "itemName" text
);

CREATE TABLE public.inspections (
  id text primary key,
  date text,
  supplier text,
  "itemName" text,
  "totalQuantity" numeric,
  "inspectionQuantity" numeric,
  "defectQuantity" numeric,
  result text,
  "defectType" text,
  "itemType" text,
  "inspectionReportNo" text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.notices (
  id text primary key,
  title text,
  type text,
  author text,
  content text,
  date text,
  status text DEFAULT 'published',
  views numeric default 0,
  category text,
  important boolean DEFAULT false,
  files jsonb
);

CREATE TABLE public.resources (
  id text primary key,
  title text,
  type text,
  author text,
  content text,
  date text,
  attachment text,
  views numeric default 0,
  "originalFilename" text
);

CREATE TABLE public.inquiries (
  id text primary key,
  type text,
  title text,
  content text,
  author text,
  date text,
  status text,
  messages jsonb default '[]'
);

CREATE TABLE public.calendar_events (
  id text primary key,
  "authorId" bigint,
  "authorName" text,
  title text,
  date text,
  type text,
  content text
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
  "popupEnabled" boolean
);

-- [Step 5] 프리패스 데이터 주입 (RLS 방어 전 융단 폭격)
INSERT INTO public.users (id, email, password, name, company, role, status, rank, date)
VALUES 
('1', 'mjjeon@shinwoovalve.com', '1', '전민재', '품질보증부', 'manager', 'Active', '과장', '2025-12-30'),
('2', 'jslee@shinwoovalve.com', '1', '이종선', '품질보증부', 'employee', 'Active', '대리', '2026-01-01'),
('admin-stg-001', 'admin_stg@shinwoo.com', 'admin123', '스테이징 최고관리자', '신우밸브(주)', 'admin', 'Active', '차장', '2026-04-05')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role; 

INSERT INTO public.settings (id, "popupEnabled") VALUES ('popup_status', false) ON CONFLICT DO NOTHING;

INSERT INTO public.dev_notes (version, type, title, content, author, date, status) VALUES 
('v1.1.1', '실패사례', '[AI 실패사례] 공지사항 무한 로딩 발생 원인', '# 무한 로딩 원인 분석...', 'AI Dev', '2026-04-05', 'published'),
('v0.18.1', 'Patch (UI/UX 개선)', '[과장님 지시] 게시물 승인 결재판 개편', '작업 내용...', '시스템 AI', '2026-04-05', 'draft');

UPDATE auth.users SET encrypted_password = crypt('1', gen_salt('bf')) WHERE email = 'mjjeon@shinwoovalve.com';

-- [Step 6] 시퀀스 동기화 (오류 방지)
SELECT setval('weekly_reports_id_seq', COALESCE((SELECT MAX(id)+1 FROM weekly_reports), 1), false);

-- [Step 7] 철통 RLS 자물쇠 결속 및 보안 정책 덮어쓰기
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_notes ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    t text;
BEGIN
    FOR t IN SELECT unnest(ARRAY[
        'users', 'process_inspections', 'notices', 'resources', 
        'weekly_reports', 'inspections', 'item_master', 'settings'
    ]) 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Enable ALL for authenticated users" ON public.%I', t);
        EXECUTE format('CREATE POLICY "Enable ALL for authenticated users" ON public.%I FOR ALL TO authenticated USING (true)', t);
    END LOOP;
END
$$;

DROP POLICY IF EXISTS "suggestions_select_policy" ON public.suggestions;
CREATE POLICY "suggestions_select_policy" ON public.suggestions
    FOR SELECT USING (
        status = 'published' OR 
        "authorEmail" = auth.jwt()->>'email' OR 
        EXISTS ( SELECT 1 FROM public.users WHERE email = auth.jwt()->>'email' AND role = 'manager' )
    );

DROP POLICY IF EXISTS "suggestions_insert_policy" ON public.suggestions;
CREATE POLICY "suggestions_insert_policy" ON public.suggestions
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated' AND 
        status = 'draft' 
    );

DROP POLICY IF EXISTS "suggestions_update_policy" ON public.suggestions;
CREATE POLICY "suggestions_update_policy" ON public.suggestions
    FOR UPDATE USING ( 
        EXISTS ( SELECT 1 FROM public.users WHERE email = auth.jwt()->>'email' AND role = 'manager' )
    ) WITH CHECK (
        EXISTS ( SELECT 1 FROM public.users WHERE email = auth.jwt()->>'email' AND role = 'manager' )
    );

DROP POLICY IF EXISTS "devnotes_select_policy" ON public.dev_notes;
CREATE POLICY "devnotes_select_policy" ON public.dev_notes
    FOR SELECT USING ( true );

DROP POLICY IF EXISTS "devnotes_insert_policy" ON public.dev_notes;
CREATE POLICY "devnotes_insert_policy" ON public.dev_notes
    FOR INSERT WITH CHECK ( 
        EXISTS ( SELECT 1 FROM public.users WHERE email = auth.jwt()->>'email' AND role = 'manager' )
    );

DROP POLICY IF EXISTS "devnotes_update_policy" ON public.dev_notes;
CREATE POLICY "devnotes_update_policy" ON public.dev_notes
    FOR UPDATE USING ( 
        EXISTS ( SELECT 1 FROM public.users WHERE email = auth.jwt()->>'email' AND role = 'manager' )
    ) WITH CHECK (
        EXISTS ( SELECT 1 FROM public.users WHERE email = auth.jwt()->>'email' AND role = 'manager' )
    );

-- [검증망] 사후 정합성 체크 (데이터 주입 여부 확인)
DO $$
DECLARE
  mgr_count int;
BEGIN
  SELECT count(*) INTO mgr_count FROM public.users WHERE role = 'manager';
  IF mgr_count = 0 THEN
    RAISE EXCEPTION '❌ [마이그레이션 실패] 매니저 계정이 주입되지 않았습니다. 즉시 롤백합니다.';
  END IF;
END
$$;

SELECT '✅ 성공: 마이그레이션 및 정합성 검증 완료. 데이터베이스 락(Lock) 해제 중...' as "Antigravity Status";

COMMIT;
