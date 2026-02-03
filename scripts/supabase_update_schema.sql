-- Add missing columns to Users
alter table users add column if not exists rank text;

-- Add missing columns to Inspections
alter table inspections add column if not exists "itemType" text;
alter table inspections add column if not exists "defectType" text;
alter table inspections add column if not exists "inspectionReportNo" text;

-- Add missing columns to Products/ItemMaster if needed
alter table item_master add column if not exists "subCategory" text;
alter table item_master add column if not exists "minorCategory" text;
alter table item_master add column if not exists "originalData" jsonb;

-- Re-run table creations just in case (IF NOT EXISTS protects existing ones)
create extension if not exists "uuid-ossp";

-- ... (Rest of table creation logic from previous step if needed, but ALTER is key here)
