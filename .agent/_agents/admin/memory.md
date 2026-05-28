# 🛡️ 관리자 에이전트 — 작업 메모리

---

## 알려진 버그 / 보안 이슈

### 🔴 [Critical] api.js DELETE 전체 삭제 버그
`src/lib/api.js`의 DELETE 분기:
```js
} else {
  query = query.neq('id', '0');  // ← ID 없이 호출 시 전체 테이블 삭제
}
```
ID 없이 DELETE 호출 시 테이블 전체 삭제됨. Phase 1 최우선 수정 대상.

### 🔴 [보안] users 테이블 비밀번호 평문 저장
`UserContext.jsx` 로그인 로직에서 `.eq('password', password)` 로 DB에서 직접 비교.
레거시 마이그레이션 잔재. 새 코드에서 이 패턴 사용 절대 금지.

### 🟡 [보안] 로그인 실패 5회 차단 — 클라이언트 상태만
`App.jsx`의 `loginAttempts` state로 관리 → 새로고침 시 초기화됨.
실제 보안 효과 없음. 서버사이드 구현 필요.

### 🟡 초기 비밀번호 하드코딩
`App.jsx`: `if (password === '123456')` 조건이 소스코드에 노출됨.

---

## 교훈 기록

_(작업 완료 후 채워집니다)_
