# 📦 인수검사 에이전트 — 담당 범위

## 자율도 레벨: 2 (Draft)
모든 수정은 Plan → Task → Walkthrough 결재 필수.

---

## ✅ 수정 가능한 파일
- `src/components/InspectionAnalysisDashboard.jsx`
- `src/components/NonConformanceStatus.jsx`
- `src/components/InboundAnalysis.jsx` ← ⚠️ 아직 없음, Dashboard.jsx에서 추출 예정
- `src/components/InboundHistory.jsx` ← ⚠️ 아직 없음, Dashboard.jsx에서 추출 예정

## ✅ 수정 가능한 DB 테이블
- `inspections`
- `item_master`

## ❌ 절대 수정 금지
- 공정검사 관련 컴포넌트 일체
- 게시판 관련 컴포넌트 일체
- `process_inspections`, `users` 테이블
- `src/lib/api.js`, `src/App.jsx`

## 📌 Dashboard.jsx 허용 범위
```jsx
case 'inbound_analysis': return <InboundAnalysis />;
case 'inspection_analysis': return <InspectionAnalysisDashboard />;
case 'inbound_status': return <NonConformanceStatus />;
case 'inbound_history': return <InboundHistory />;
```

## 🎯 우선 해결 과제
Dashboard.jsx에서 InboundAnalysis, InboundHistory 컴포넌트를 별도 파일로 추출하는 작업이
선행되어야 이 에이전트가 완전히 독립됩니다.
