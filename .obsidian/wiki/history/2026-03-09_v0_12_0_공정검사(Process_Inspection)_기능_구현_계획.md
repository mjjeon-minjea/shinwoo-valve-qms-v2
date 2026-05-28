---
title: "공정검사(Process Inspection) 기능 구현 계획"
type: "구현 계획서 (Implementation Plan)"
version: "v0.12.0"
date: "2026-03-09"
author: "시스템 AI"
status: "published"
source: "manual"
source_id: "deda2764-f3af-413c-b4a8-7363c479bfbe"
created_at: "2026-03-23"
updated_at: "2026-04-07"
wiki_status: done
tags: dev-notes, history, qms, plan
---

# 공정검사(Process Inspection) 기능 구현 계획

인수검사(수입검사)와 별개로, 제조 공정 중 발생하는 불량 및 검사 데이터를 관리하고 분석하기 위한 **공정검사 현황** 페이지를 구현합니다.

## 사용자 검토 필요

> [!IMPORTANT]
> 아래 기획안을 확인해 주시고, 추가하고 싶은 차트나 특별히 관리해야 하는 공정명(예: 가공, 조립, 도장 등) 혹은 데이터 필드가 있다면 알려주세요!

## 변경 제안

---

### UI Components

#### [NEW] `src/components/ProcessInspectionDashboard.jsx`

대시보드와 데이터 관리(CRUD)가 결합된 통합 화면입니다. (인수검사 페이지와 유사한 세련된 레이아웃 적용)

- **Summary Cards (요약 카드)**
  - 총 생산 수량 (Total Production Quantity)
  - 총 검사 수량 (Total Inspected Quantity) & 검사율
  - 총 불량 수량 (Total Defect Quantity)
  - 공정 불량률 (%) (Defect Rate = Defect Qty / Inspected Qty \* 100)
- **Charts (시각화 차트)**
  - **공정별 불량 현황 (Bar Chart)**: 어떤 공정에서 불량이 가장 많이 발생하는지?
  - **유형별 불량 비율 (Pie Chart)**: 치수불량, 조립불량, 외관불량 등 비율 파악.
  - **일자별 추이 (Composed Chart)**: 생산량과 불량수량의 일자별 트렌드 라인.
- **Data Table & Management (데이터 그리드 및 관리)**
  - 필터링 및 검색이 가능한 검사 이력 테이블.
  - 신규 검사 결과 등록 / 수정 / 삭제 모달 폼.
  - **엑셀 일괄 업로드 기능** (인수검사와 동일한 기능) 연동.

#### [MODIFY] `src/components/Dashboard.jsx`

- `activeTab === 'process'` 일 때 표시되는 `PlaceholderView`를 새로 제작할 `ProcessInspectionDashboard` 컴포넌트로 교체합니다.

---

### Backend / Data Model

#### [MODIFY] `server.js` (또는 더미 JSON 데이터 파일)

- 새로운 데이터 엔드포인트 `/process_inspections` 를 다룰 수 있도록 지원합니다. (JSON server 기본 동작 활용)
- **Data Schema 예상 (Process Inspection)**
  ```json
  {
    "id": "12345",
    "date": "2024-03-09",
    "processName": "조립공정", // 가공, 임가공, 조립, 도장, 포장 등
    "itemName": "BALL VALVE 50A",
    "inspector": "홍길동",
    "totalQuantity": 500,
    "inspectedQuantity": 50,
    "defectQuantity": 2,
    "defectType": "조립불량"
  }
  ```

## 검증 계획

### 자동화 테스트

- `npm run lint` 및 `npm run build`를 통해 문법 오류 및 빌드 에러 확인.

### 수동 검증

- 브라우저를 통해 로컬 서버(`http://localhost:5173`) 접속.
- 좌측 사이드바 메뉴에서 "공정검사 현황" 탭 클릭.
- 기능 테스트:
  1. 신규 공정검사 데이터 입력 모달 렌더링 확인.
  2. 샘플 데이터 입력 후 차트가 올바르게 업데이트되는지 확인.
  3. 엑셀 업로드 테스트.
