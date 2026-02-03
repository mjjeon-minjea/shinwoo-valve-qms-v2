-- [종합 수리 키트]
-- 이 코드는 테이블이 없으면 만들고, 있으면 부족한 칸만 추가합니다. (에러 방지용)

-- 1. 필수 확장 기능 켜기
create extension if not exists "uuid-ossp";

-- 2. 사용자 테이블 (Users)
create table if not exists users (
  id bigint primary key,
  email text,
  password text,
  name text,
  company text,
  role text,
  rank text, -- 직급
  date text,
  status text
);
-- 혹시 테이블은 있는데 rank가 없을까봐 추가
alter table users add column if not exists rank text;


-- 3. 품목 마스터 (Item Master) - 아까 에러난 부분!
create table if not exists item_master (
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
-- 컬럼 보강
alter table item_master add column if not exists "subCategory" text;
alter table item_master add column if not exists "minorCategory" text;
alter table item_master add column if not exists "originalData" jsonb;


-- 4. 검사 이력 (Inspections)
create table if not exists inspections (
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
  "inspectionReportNo" text
);
-- 컬럼 보강
alter table inspections add column if not exists "itemType" text;
alter table inspections add column if not exists "defectType" text;
alter table inspections add column if not exists "inspectionReportNo" text;


-- 5. 주간 보고서 (Weekly Reports)
create table if not exists weekly_reports (
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


-- 6. 기타 테이블들
create table if not exists notices (
  id serial primary key,
  title text,
  type text,
  author text,
  content text,
  date text,
  views numeric default 0
);
alter table notices add column if not exists views numeric default 0;

create table if not exists resources (
  id serial primary key,
  title text,
  type text,
  author text,
  content text,
  date text,
  attachment text,
  views numeric default 0
);
alter table resources add column if not exists views numeric default 0;

create table if not exists inquiries (
  id text primary key,
  type text,
  title text,
  content text,
  author text,
  date text,
  status text,
  messages jsonb default '[]'
);

create table if not exists settings (
  id text primary key,
  "popupEnabled" boolean
);
