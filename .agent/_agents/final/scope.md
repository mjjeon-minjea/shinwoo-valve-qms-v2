# 🔍 최종검사 에이전트 — 담당 범위

## 자율도 레벨: 2 (Draft) — 설계 완료 후 재검토
모든 수정은 Plan → Task → Walkthrough 결재 필수.

---

## ✅ 수정 가능한 파일 (구현 후)
- `src/components/FinalInspectionDashboard.jsx` ← 신규 생성 예정
- `src/components/FinalInspectionHistory.jsx` ← 신규 생성 예정

## ✅ 수정 가능한 DB 테이블
- `final_inspections` ← 신규 설계 예정

## ❌ 절대 수정 금지
- 기존 모든 컴포넌트 (인수검사/공정검사/게시판/업무관리/관리자)
- `inspections`, `process_inspections` 테이블 (읽기 참조는 허용)

## 📌 Dashboard.jsx 허용 범위
```jsx
case 'final': return <FinalInspectionDashboard />;  // 현재 PlaceholderView → 교체 예정
```
