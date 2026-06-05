---
title: "Process Inspection Implementation Tasks"
type: "할 일 (Task)"
version: "v0.13.0"
date: "2026-03-12"
author: "시스템 AI"
status: "published"
source: "manual"
source_id: "4503063b-40dc-47b1-9d8e-45ca70b9ec22"
created_at: "2026-03-23"
updated_at: "2026-04-07"
wiki_status: done
tags: [dev-notes, history, qms, task]
---

# Process Inspection Implementation Tasks

## 1단계: 대시보드 통합 및 UI 개선 (Completed)
- [x] Seed the database (`db.json`) with sample data using `seed_process.js`.
- [x] Update `Dashboard.jsx` routing and states.
- [x] Refactor `ProcessInspectionDashboard.jsx` to fetch data from the backend API.
- [x] Refine Dashboard UI to match Inbound Inspection style and remove "Data Export" button.
- [x] Connect the dashboard charts and tables to the live API data.
- [x] Verify the UI and data binding in the browser.

## 2단계: 사이드바 진화 및 이력 관리
- [x] Update `Dashboard.jsx` to make '공정검사' a collapsible menu group with identical sub-menus to '인수검사'.
- [ ] Create `ProcessHistory.jsx` (or component) replicating the features of `[[history/2026-04-12_v0_24_0_[개발_노트]_v0.24.0_(P13)_-_Dashboard.jsx_컴포넌트_분리|InboundHistory]]`.
    - Setup history list grid with filtering & pagination.
    - Create Excel upload logic with fields relevant to process inspections.
    - Implement manual add, update, and delete actions.
- [ ] Implement `종합분석현황` (Comprehensive Analysis Status) views.
- [ ] Implement `공정별 분석현황` (Process Specific Analysis Status) views.
