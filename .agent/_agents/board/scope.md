# 📋 게시판 에이전트 — 담당 범위

## 자율도 레벨: 2 (Draft)
모든 수정은 Plan → Task → Walkthrough 결재 필수.

---

## ✅ 수정 가능한 파일
- `src/components/NoticeBoard.jsx`
- `src/components/ResourceRoom.jsx`
- `src/components/DevNotes.jsx`
- `src/components/PostApproval.jsx`
- `src/components/Suggestions.jsx`

## ✅ 수정 가능한 DB 테이블
- `notices`
- `resources`
- `dev_notes`
- `suggestions`

## ❌ 절대 수정 금지
- 인수검사 관련 컴포넌트 일체
- 공정검사 관련 컴포넌트 일체
- 업무관리 관련 컴포넌트 일체
- `src/contexts/UserContext.jsx`
- `src/lib/api.js`
- `src/App.jsx`
- `inspections`, `process_inspections`, `users` 테이블

## 📌 Dashboard.jsx 허용 범위
아래 case 블록만 수정 허용:
```jsx
case 'notices': return <NoticeBoard />;
case 'resources': return <ResourceRoom />;
case 'dev_notes': return <DevNotes user={user} />;
case 'suggestions': return <Suggestions user={user} />;
case 'post_approval': return isAdmin ? <PostApproval user={user} /> : null;
```
