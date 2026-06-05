---
title: "Walkthrough - Weekly Report Fix"
type: "작업 과정 (Walkthrough)"
version: "v0.10.0"
date: "2026-02-05"
author: "시스템 AI"
status: "published"
source: "manual"
source_id: "bd004fc6-d4b7-4f16-97a9-c2c767693e97"
created_at: "2026-03-23"
updated_at: "2026-04-07"
wiki_status: done
tags: [dev-notes, history, qms, walkthrough]
---

# Walkthrough - Weekly Report Fix

I have fixed the issue where the Weekly Report page would show a white screen (crash) when the API returned unexpected data or when the report data was not yet loaded.

## Changes

### 1. `src/components/WeeklyReport.jsx`

#### Fix 1: Safe Array Handling

Added a safety check to ensure `reports` state is always an array, preventing crashes when the API returns an error (common on Vercel without a backend).

```javascript
// Before
setReports(data);

// After
setReports(Array.isArray(data) ? data : []);
```

#### Fix 2: Null Property Access Protection (Critical Fix)

Added optional chaining (`?.`) when accessing `report.status`. This prevents the "Cannot read properties of null" error that occurs during the initial render or if the API fetch fails.

```javascript
// Before
const canReview = user.role === "manager" && report.status === "submitted";
const canApprove =
  user.role === "director" &&
  (report.status === "reviewed" || report.status === "submitted");

// After
const canReview = user.role === "manager" && report?.status === "submitted";
const canApprove =
  user.role === "director" &&
  (report?.status === "reviewed" || report?.status === "submitted");
```

## 검증 결과

### Browser Verification (Vercel Repro)

- [x] Reproduced the white screen crash on Vercel (`https://shinwoo-valve-qms.vercel.app/`).
- [x] Confirmed the error was `TypeError: Cannot read properties of null (reading 'status')`.
- [x] Applied the fix (`report?.status`) which directly addresses this specific error.

### 수동 검증

- [ ] User to verify page loads correctly in browser after deployment updates.
