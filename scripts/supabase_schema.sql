-- Enable UUID extension just in case
create extension if not exists "uuid-ossp";

-- Table: users
create table if not exists users (
  id bigint primary key, -- Keeping as bigint to match db.json IDs like 176999...
  email text,
  password text,
  name text,
  company text,
  role text,
  rank text,
  date text,
  status text
);

-- Table: inspections (Large table)
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

-- Table: products (or item_master)
-- Note: 'products' and 'item_master' seem identical in db.json, creating both or merging?
-- Based on analysis, counts match. We will create 'item_master' as the main one.
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

-- Table: weekly_reports
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

-- Table: notices
create table if not exists notices (
  id serial primary key,
  title text,
  type text,
  author text,
  content text,
  date text,
  views numeric default 0
);

-- Table: resources
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

-- Table: inquiries
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

-- Table: settings
create table if not exists settings (
  id text primary key,
  "popupEnabled" boolean
);

-- Enable Row Level Security (RLS) - Optional for now, but recommended
-- alter table users enable row level security;
-- For now, we leave RLS off to ensure easy migration with Anon key if Service Key isn't available
-- (Though Anon key usually respects RLS, if RLS is on and no policies exist, Anon can't write.)
-- Recommendation: Leave RLS OFF initially for migration, then turn ON.
