---
title: "Weekly Report & Schedule Improvements"
type: "할 일 (Task)"
version: "v0.8.0"
date: "2026-02-04"
author: "시스템 AI"
status: "published"
source: "manual"
source_id: "c438e37f-cf22-4f10-9207-8d2d2a32a23b"
created_at: "2026-03-23"
updated_at: "2026-04-07"
wiki_status: done
tags: dev-notes, history, qms, task
---

# Weekly Report & Schedule Improvements

## Status

- [x] Research codebase to identify components for "Weekly Business Status" and "Weekly Report Form" <!-- id: 0 -->
- [x] Create Implementation Plan <!-- id: 1 -->
- [x] Add "Time" field to Weekly Report form (`WeeklyReport.jsx`) <!-- id: 2 -->
- [x] Update Schedule/Attendance display to sort by Date and Time (`WeeklyStatus.jsx`) <!-- id: 3 -->
- [x] Refine Time Input with Hour/Minute dropdowns <!-- id: 5 -->
- [x] Handle "Vacation" type as All Day event (`WeeklyReport.jsx`, `WeeklyStatus.jsx`) <!-- id: 6 -->
- [x] Verify changes <!-- id: 4 -->
- [x] Fix Team Work Calendar (`CalendarView.jsx`)
  - [x] Update sorting logic (Vacation -> Date -> Time)
  - [x] Render 'Vacation' as 'All Day' (종일)
  - [x] Render Time for regular events
  - [x] Filter by 'Approved' status only
  - [x] Cleanup test data (Feb 4th) on Vercel
- [x] Allow Report Resubmit for 'Reviewed' status (`WeeklyReport.jsx`)
