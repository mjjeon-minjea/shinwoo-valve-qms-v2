-- 1. 주간 보고서 (Weekly Reports)
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

-- 2. 공정 검사 (Process Inspections)
create table if not exists process_inspections (
  id text primary key,
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

-- 3. 인수 검사 (Inspections - 추가된 컬럼 방어용)
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

-- 4. 공지사항 (Notices)
create table if not exists notices (
  id serial primary key,
  title text,
  type text,
  author text,
  content text,
  date text,
  views numeric default 0
);

-- 5. 리소스 (Resources)
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

-- 6. 문의사항 (Inquiries)
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

-- 7. 캘린더 이벤트 (Calendar Events)
create table if not exists calendar_events (
  id text primary key,
  "authorId" bigint,
  "authorName" text,
  title text,
  date text,
  type text,
  content text
);
