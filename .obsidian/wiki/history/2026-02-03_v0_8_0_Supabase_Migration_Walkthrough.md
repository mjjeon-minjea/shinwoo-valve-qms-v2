---
title: "Supabase Migration Walkthrough"
type: "작업 과정 (Walkthrough)"
version: "v0.8.0"
date: "2026-02-03"
author: "시스템 AI"
status: "published"
source: "manual"
source_id: "6335fdab-bbb7-460e-916d-3a819c041078"
created_at: "2026-03-23"
updated_at: "2026-04-07"
wiki_status: done
tags: dev-notes, history, qms, walkthrough
---

# Supabase Migration Walkthrough

## Overview

Successfully migrated the backend data source from a local `db.json` file to **Supabase** (PostgreSQL) to enable full functionality on Vercel deployments.

## Changes

### 1. Database Schema Created

- Created tables for `users`, `inspections`, `item_master`, `weekly_reports`, `notices`, `resources`, `inquiries`, and `settings`.
- Applied schema patches to include missing columns (`rank`, `itemType`, `attachment`, etc.).

### 2. Data Migration

- **Script:** `scripts/migrate_to_supabase.js`
- **Volume:**
  - `inspections`: ~10,000 rows
  - `item_master`: ~50,000 rows
  - Other tables: Small configuration data
- All data from local `db.json` has been uploaded to Supabase.

### 3. Application Code (`src/lib/api.js`)

- Removed "Local JSON Server" bypass.
- Enabled Supabase Client using environment variables.
- Implemented `API.fetch` adapter to translate REST calls to Supabase SDK methods (`.select()`, `.insert()`, `.update()`).

## Verification

### 4. Vercel Deployment & Fixes

> [!IMPORTANT]
> The initial deployment showed no data because environment variables were missing in Vercel.

- **Issue 1: Missing Environment Variables:**
  - `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` were not set in Vercel project settings (security best practice excludes `.env` from git).
  - **Fix:** Manually added keys in Vercel Dashboard -> Settings -> Environment Variables.

- **Issue 2: Hardcoded Localhost URLs:**
  - Components (`WeeklyReport.jsx`, `WeeklyStatus.jsx`, `CalendarView.jsx`, `UserContext.jsx`) still had hardcoded `fetch('http://localhost:3001/...')`.
  - **Fix:** Refactored all components to use the centralized `api.fetch` adapter, ensuring they connect to Supabase in production.

## Verification

1. **Browser Subagent:** Verified successful login and data loading on the live site (`shinwoo-valve-qms.vercel.app`).
2. **User Confirmation:** User verified data visibility on external devices after the fix.

## Next Steps

- Monitor for any data inconsistencies.
- Consider enabling Row Level Security (RLS) policies in Supabase for enhanced data protection.

### 5. Supabase Debugging (The "Browser Agent" Victory)

- **Issue:** Manual data migration caused ID sequence collisions (`duplicate key value`), preventing new report creation.
- **Challenge:** User unable to run SQL fixes manually. AI initially thought browser control was impossible due to auth barriers.
- **Breakthrough:**
  - Deployed **Browser Subagent**, successfully navigated GitHub SSO, and accessed Supabase Dashboard.
  - Executed SQL fix (`setval`) directly via the agent, resolving the ID collision permanently.
- **Bug Fixes:**
  - **Missing Buttons:** Fixed `WeeklyReport.jsx` to use relaxed ID comparison (`String(id)`), resolving a type mismatch between Postgres and Local state.
  - **Resubmit Failure:** Implemented optimistic UI updates in `handleResubmit` to prevent race conditions showing stale data.
