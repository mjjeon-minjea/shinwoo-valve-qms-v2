# 🛡️ 관리자 에이전트 — 담당 범위

## 자율도 레벨: 1 (Read-only 권장)
보안 도메인. 모든 수정은 차장님 직접 확인 필수.
Plan → Task → Walkthrough 결재 필수.

---

## ✅ 수정 가능한 파일
- `src/components/UserManagement.jsx`
- `src/components/PasswordChangeModal.jsx`
- `src/components/Header.jsx`
- `src/components/Hero.jsx`
- `api/admin-update-member.js`

## ✅ 수정 가능한 DB 테이블
- `users` (⚠️ 보안 주의)
- `settings`

## ⚠️ 수정 시 전체 영향 — 차장님 직접 확인 필수
- `src/contexts/UserContext.jsx` — 모든 에이전트 인증 의존
- `src/App.jsx` — 전체 라우팅

## ❌ 절대 수정 금지
- 인수검사/공정검사/게시판/업무관리 컴포넌트 일체
- `inspections`, `process_inspections`, `notices` 테이블

## 📌 Dashboard.jsx 허용 범위
```jsx
case 'members': return <UserManagement ... />;
case 'settings_home': return <HomepageSettings />;  // ← Dashboard.jsx에서 추출 예정
```

## 🔴 우선 수정 필요 항목
1. `api.js` DELETE 전체 삭제 버그 (Phase 1 최우선)
2. `users` 테이블 password 컬럼 평문 저장 제거
