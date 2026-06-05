---
title: "Supabase Migration Plan (Vercel Fix)"
type: "구현 계획서 (Implementation Plan)"
version: "v0.8.0"
date: "2026-02-03"
author: "시스템 AI"
status: "published"
source: "manual"
source_id: "e597424f-afc9-46be-a388-c4f4a79dfabe"
created_at: "2026-03-23"
updated_at: "2026-04-07"
wiki_status: done
tags: [dev-notes, history, qms, plan]
---

# Supabase Migration Plan (Vercel Fix)

## Goal

Migrate the backend data source from a local `db.json` (JSON Server) to **Supabase** (PostgreSQL) to enable full functionality on the Vercel deployment.

## 사용자 검토 필요

> [!IMPORTANT]
> **Supabase Credentials Needed**:
> I need the **Supabase URL** and **Anon Key** to proceed.
> You can find these in your Supabase Dashboard -> Project Settings -> API.

> [!WARNING]
> **Data Migration**:
> All current data in `db.json` (Local) will be uploaded to Supabase.
> Please ensure `db.json` contains the latest data you want to preserve.

## 변경 제안

### 1. Database Setup

- Analyze `db.json` to identify required tables (e.g., `users`, `weekly_reports`, `inspections`).
- Create a script to automatically create these tables and insert data into Supabase.

### 2. Codebase Updates

#### [MODIFY] `src/lib/api.js`

- Revert the "Local JSON Server" bypass.
- Uncomment and configure the `createClient` initialization using environment variables.

#### [NEW] `.env` (Local only)

- Create a `.env` file to store `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

#### [NEW] `scripts/migrate_to_supabase.js`

- A Node.js script to:
  1. Read `db.json`.
  2. Connect to Supabase.
  3. Upsert data into corresponding tables.

## 검증 계획

1. **Local Test**: Run the app locally pointing to Supabase and verify data loads correctly.
2. **Migration Verification**: Check Supabase Dashboard to see if data counts match `db.json`.
3. **Deployment**: Push changes to GitHub and check Vercel deployment.
