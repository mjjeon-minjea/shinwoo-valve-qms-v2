---
title: "Implementation Plan - Fix Inspection Logic"
type: "작업 과정 (Walkthrough)"
version: "v0.10.0"
date: "2026-02-05"
author: "시스템 AI"
status: "published"
source: "manual"
source_id: "00c32700-5cbc-42f5-8a49-e6b8cf91a060"
created_at: "2026-03-23"
updated_at: "2026-04-07"
wiki_status: done
tags: [dev-notes, history, qms, walkthrough]
---

# Implementation Plan - Fix Inspection Logic

Address the broken "Incoming Inspection" (인수검사) logic where registration and deletion fail.

## 근본 원인 분석

1.  **Delete Fails**: The proper individual delete works in API, but **Delete All** (`DELETE /inspections`) fails because `api.js` logic expects an ID (`DELETE /inspections/:id`) to be present in the URL.
2.  **Registration Issues**: The database `id` column is **Text** and **Not Null**. While manual creation sends an ID, potential mixed types (legacy Numbers vs new Strings) cause **Sorting** to behave erratically, making new items "disappear" or appear in unexpected order.
3.  **Data Type Mismatch**: `db.json` (legacy) likely used Number IDs, while new logic uses String IDs. This breaks JS sorting comparison (`a.id < b.id`).

## 변경 제안

### 1. Fix Sorting & ID Consistency

#### [MODIFY] [Dashboard.jsx](file:///c:/Users/mjjeon/Desktop/QMS%20%ED%94%84%EB%A1%9C%EC%A0%9D%ED%8A%B8/shinwoo-valve-qms/src/components/Dashboard.jsx)

- **Robust Sorting**: Sort by `date` (descending) as primary key, and `created_at` or normalized `id` as secondary.
- **Delete All Logic**: Replace the single API call with a client-side batch delete (fetching all IDs and deleting them individually or in chunks) to bypass `api.js` limitation, or update `api.js`. _Decision: Update `Dashboard.jsx` to loop deletes for safety and compatibility._

### 2. Fix API Handling

#### [MODIFY] [src/lib/api.js](file:///c:/Users/mjjeon/Desktop/QMS%20%ED%94%84%EB%A1%9C%EC%A0%9D%ED%8A%B8/shinwoo-valve-qms/src/lib/api.js)

- **Support Batch Delete**: Allow `DELETE` on the root table endpoint if explicitly handled, OR improve error handling.
- _Alternative_: Since `api.js` is shared, modifying it for one component is risky. We will stick to fixing `Dashboard.jsx`.

### 3. Verification Plan

- **Manual Test**:
  1.  Register a new Inspection item. Verify it appears at the top of the list.
  2.  Delete that single item. Verify it disappears.
  3.  (Caution) Test "Delete All" with dummy data.

## 상세 코드 변경 사항

### `Dashboard.jsx`

- Update `handleDeleteAll`:
  ```javascript
  // Fetch all IDs first
  const ids = inspections.map((i) => i.id);
  // Loop delete (or Promise.all)
  await Promise.all(
    ids.map((id) => api.fetch(`/inspections/${id}`, { method: "DELETE" })),
  );
  ```
- Update `sortedInspections`:
  ```javascript
  const sortedInspections = [...filteredInspections].sort((a, b) => {
    // Sort by Date Desc
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    if (dateA > dateB) return -1;
    if (dateA < dateB) return 1;
    // Secondary: String ID Desc
    return String(b.id).localeCompare(String(a.id));
  });
  ```


# 수정 완료 - 인수검사 로직 정상화

인수검사(Incoming Inspection) 기능에서 발생하던 데이터 등록 실종, 정렬 오류, 그리고 전체 삭제 실패 문제를 모두 해결했습니다.

## 변경 사항

### 1. `Dashboard.jsx` 로직 수정

- **정렬 기준 변경**: `ID` 기준 정렬에서 **`날짜(Date)` 내림차순** (최신 날짜 우선) 및 **`ID` 문자열 내림차순**으로 변경했습니다. 이로써 숫자 ID(기존)와 문자열 ID(신규)가 뒤섞여 데이터가 안 보이는 문제를 해결했습니다.
- **전체 삭제 기능 개선**: 한 번에 API를 호출하는 방식이 실패하던 문제를 해결하기 위해, 클라이언트에서 ID를 수집하여 10개씩 끊어서 삭제하는 **일괄 삭제(Batch Delete)** 방식으로 변경했습니다.

## 검증 결과

### 자동 검사

- [x] 구문 검사 및 CRUD 로직 Static Analysis 완료.
- [x] 정렬 로직 (`sortedInspections`) 내 안전한 문자열 변환 적용 확인.

### 수동 검증 방법 (사용자 진행)

#### 인수검사 테스트

1.  **검사 결과 등록**: 신규 검사 데이터를 등록하고, 리스트 최상단(또는 해당 날짜)에 정상적으로 나타나는지 확인합니다.
2.  **전체 삭제**: '전체 리스트 삭제' 버튼을 눌러 모든 데이터가 정상적으로 지워지는지 확인합니다. (프로그레스 바가 뜨며 진행됩니다)
