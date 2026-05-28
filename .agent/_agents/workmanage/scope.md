# 📅 업무관리 에이전트 — 담당 범위

## 자율도 레벨: 2 (Draft)
모든 수정은 Plan → Task → Walkthrough 결재 필수.

---

## ✅ 수정 가능한 파일
- `src/components/WeeklyReport.jsx`
- `src/components/WeeklyStatus.jsx`
- `src/components/CalendarView.jsx`
- `src/components/Chatbot.jsx`

## ✅ 수정 가능한 DB 테이블
- `weekly_reports`
- `chatbot_inquiries`

## ❌ 절대 수정 금지
- 인수검사/공정검사/최종검사 관련 컴포넌트 일체
- 게시판 관련 컴포넌트 일체
- `inspections`, `process_inspections`, `users` 테이블
- `src/lib/api.js`, `src/App.jsx`

## 📌 Dashboard.jsx 허용 범위
```jsx
case 'weekly_report': return <WeeklyReport user={user} />;
case 'weekly_status': return <WeeklyStatus />;
case 'schedule': return <CalendarView user={user} />;
```
※ Chatbot은 Dashboard 외부(App.jsx)에서도 렌더링됨 — 전역 영향 주의
