---
title: "Item Master Data Import Walkthrough"
type: "작업 과정 (Walkthrough)"
version: "v0.2.0"
date: "2026-01-29"
author: "시스템 AI"
status: "published"
source: "manual"
source_id: "e0dee542-90cb-443f-8a36-a96acfd54d8c"
created_at: "2026-03-23"
updated_at: "2026-04-07"
wiki_status: done
tags: [dev-notes, history, qms, walkthrough]
---

# Item Master Data Import Walkthrough

Successfully imported **55,009** items from the Excel file `품목마스터_20260129_011910.xlsx` into `db.json`.

## 변경 사항

### 1. Data Import Script

Created [`import_products.cjs`](file:///C:/Users/mjjeon/Desktop/QMS%20%ED%94%84%EB%A1%9C%EC%A0%9D%ED%8A%B8/shinwoo-valve-qms/import_products.cjs) to:

- Read the Excel file using `xlsx`.
- Map Korean headers to English properties.
- Update `db.json` with a new `products` array.

### 2. Database Update

Updated [`db.json`](file:///C:/Users/mjjeon/Desktop/QMS%20%ED%94%84%EB%A1%9C%EC%A0%9D%ED%8A%B8/shinwoo-valve-qms/db.json) to include the new product data.

## 검증 결과

### 데이터 무결성 검증

Ran verification script which confirmed:

- `products` key exists.
- Total count: **55,009** items.
- Sample data is correct.

**출력 예시:**

```json
{
  "id": "1099000001",
  "name": "",
  "spec": "",
  "unit": "EA",
  "category": "",
  "originalData": {
    "품목코드": 1099000001,
    "품목설명": "SF-A (스마트팬)",
    ...
  }
}
```

> [!NOTE]
> The original Excel data is preserved in the `originalData` field for reference.
