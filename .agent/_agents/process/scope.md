# ⚙️ 공정검사 에이전트 — 담당 범위

## 자율도 레벨: 2 (Draft)
모든 수정은 Plan → Task → Walkthrough 결재 필수.

---

## ✅ 수정 가능한 파일 (완전 독립)
- `src/components/ProcessInspectionDashboard.jsx`
- `src/components/ProcessHistory.jsx`
- `src/components/ProcessAnalysis.jsx`
- `src/components/WorkplaceAnalysis.jsx`
- `src/components/EquipmentAnalysis.jsx`
- `src/components/ModelCategoryAnalysis.jsx`

## ✅ 수정 가능한 DB 테이블
- `process_inspections`

## ❌ 절대 수정 금지
- 인수검사 관련 컴포넌트 일체
- 게시판 관련 컴포넌트 일체
- 업무관리 관련 컴포넌트 일체
- `inspections`, `users`, `notices` 등 타 테이블
- `src/lib/api.js`, `src/App.jsx`

## 📌 Dashboard.jsx 허용 범위
```jsx
case 'process':
case 'process_dashboard': return <ProcessInspectionDashboard user={user} isAdmin={isAdmin} />;
case 'process_by_process': return <ProcessAnalysis />;
case 'process_by_workplace': return <WorkplaceAnalysis />;
case 'process_by_equipment': return <EquipmentAnalysis />;
case 'process_by_model_category': return <ModelCategoryAnalysis />;
case 'process_history': return <ProcessHistory />;
```
