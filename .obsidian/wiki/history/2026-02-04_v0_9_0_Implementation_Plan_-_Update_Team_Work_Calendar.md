---
title: "Implementation Plan - Update Team Work Calendar"
type: "구현 계획서 (Implementation Plan)"
version: "v0.9.0"
date: "2026-02-04"
author: "시스템 AI"
status: "published"
source: "manual"
source_id: "4a1a8188-e249-40bc-a418-b40ed09c15ba"
created_at: "2026-03-23"
updated_at: "2026-04-07"
wiki_status: done
tags: dev-notes, history, qms, plan
---

# Implementation Plan - Update Team Work Calendar

The "Team Work Calendar" (`CalendarView.jsx`) currently lacks recent Schedule improvements implemented in `WeeklyReport` and `WeeklyStatus`. This causes a mismatch in data presentation and user confusion regarding meeting times and vacation status.

## 사용자 검토 필요

> [!NOTE]
> This change will strictly align the Calendar view with the Weekly Status view.
>
> - "Vacation" events will display "종일" (All Day) tag.
> - Other events (like Meetings) will display their Time (e.g., "14:00").
> - Events within a single day cell will be sorted by time.

## 변경 제안

### 컴포넌트

#### [MODIFY] [CalendarView.jsx](file:///c:/Users/mjjeon/Desktop/QMS%20%ED%94%84%EB%A1%9C%EC%A0%9D%ED%8A%B8/shinwoo-valve-qms/src/components/CalendarView.jsx)

- **Update Data Fetching**: Ensure `time` field is preserved when processing schedule events.
- **Implement Sorting**: Sort `dayEvents` by time (Vacations first, then by time) before rendering.
- **Update Item Rendering**:
  - For `category === 'schedule'`:
    - If `type === '휴가'`, display "종일" badge.
    - Otherwise, if `time` exists, display the time.
  - Update the `title` tooltip to include time info if available.

## 검증 계획

### 수동 검증

1.  **Navigate to "팀 업무 캘린더" (Team Work Calendar)**.
2.  **Check "Vacation" Events**:
    - Confirm they show the "종일" tag.
    - Confirm they are sorted at the top of the day cell.
3.  **Check "Meeting" Events**:
    - Confirm they show the Time (e.g., "14:00").
    - Confirm the tooltip displays `[14:00] [미팅] Name: Content`.
4.  **Compare with "Weekly Status"**:
    - Verify that the order and content match the "Weekly Status" dashboard for the same week.
