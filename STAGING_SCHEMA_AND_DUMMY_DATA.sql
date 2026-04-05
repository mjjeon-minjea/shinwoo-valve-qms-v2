-- ========================================================
-- 신우밸브 QMS Staging DB 마이그레이션 및 더미 데이터 삽입 스크립트
-- ========================================================

-- UUID 확장 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. 사용자 (Users) 테이블 생성
CREATE TABLE IF NOT EXISTS public.users (
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

-- 더미 최고 관리자 계정 삽입 (비밀번호: admin123)
INSERT INTO public.users (id, email, password, name, company, role, rank, date, status)
VALUES (999999, 'admin_stg@shinwoo.com', 'admin123', '스테이징관리자', '품질보증부', 'manager', '최고관리자', '2026-04-03', 'Active')
ON CONFLICT (id) DO NOTHING;


-- 2. 주간 보고서 (Weekly Reports) 테이블 생성
CREATE TABLE IF NOT EXISTS public.weekly_reports (
  id serial PRIMARY KEY,
  "authorId" bigint,
  "authorName" text,
  "weekStartDate" text,
  status text,
  schedule jsonb DEFAULT '[]',
  projects jsonb DEFAULT '[]',
  issues jsonb DEFAULT '[]',
  samples jsonb DEFAULT '[]',
  "createdDate" text,
  "reviewerComment" text,
  "approverComment" text
);

-- 3. 공정 검사 (Process Inspections) 테이블 생성
CREATE TABLE IF NOT EXISTS public.process_inspections (
  id text PRIMARY KEY,
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
  "isResolutionEntered" text
);

-- 4. 인수 검사 (Inspections) 테이블 생성
CREATE TABLE IF NOT EXISTS public.inspections (
  id text PRIMARY KEY,
  date text,
  supplier text,
  "itemName" text,
  "totalQuantity" numeric,
  "inspectionQuantity" numeric,
  "defectQuantity" numeric,
  result text,
  "defectType" text,
  "itemType" text,
  "inspectionReportNo" text
);

-- 5. 공지사항 (Notices) 테이블 생성
CREATE TABLE IF NOT EXISTS public.notices (
  id text PRIMARY KEY,
  title text,
  type text,
  author text,
  content text,
  date text,
  views numeric DEFAULT 0
);

-- 6. 자료실 (Resources) 테이블 생성
CREATE TABLE IF NOT EXISTS public.resources (
  id text PRIMARY KEY,
  title text,
  type text,
  author text,
  content text,
  date text,
  attachment text,
  views numeric DEFAULT 0,
  "originalFilename" text
);

-- 7. 고객 문의 (Inquiries) 테이블 생성
CREATE TABLE IF NOT EXISTS public.inquiries (
  id text PRIMARY KEY,
  type text,
  title text,
  content text,
  author text,
  date text,
  status text,
  messages jsonb DEFAULT '[]'
);

-- 8. 캘린더 이벤트 (Calendar Events) 테이블 생성
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id text PRIMARY KEY,
  "authorId" bigint,
  "authorName" text,
  title text,
  date text,
  type text,
  content text
);

-- 9. 품목 정보 (Item Master) 테이블 생성
CREATE TABLE IF NOT EXISTS public.item_master (
  id text PRIMARY KEY,
  name text,
  spec text,
  unit text,
  category text,
  "subCategory" text,
  "minorCategory" text,
  type text,
  "originalData" jsonb
);

-- 10. 세팅 (Settings) 테이블 생성
CREATE TABLE IF NOT EXISTS public.settings (
  id text PRIMARY KEY,
  "popupEnabled" boolean
);
