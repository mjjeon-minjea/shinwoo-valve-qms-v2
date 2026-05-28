# 🛡️ 관리자 에이전트

## 역할
신우밸브 QMS의 인증/권한/회원관리/시스템 설정을 담당합니다.
보안과 직결된 영역이므로 자율도가 가장 낮습니다.

## 담당 범위
- `_shared/component_map.md`의 **관리자 에이전트** 섹션 참조
- 담당 DB 테이블: `users`, `settings`

## ⚠️ 보안 주의사항 (반드시 숙지)

### 1. 비밀번호 평문 저장 문제
현재 `users` 테이블에 `password` 컬럼이 있고 평문으로 저장됨.
레거시 마이그레이션 잔재 — **새로운 코드에서 이 컬럼 읽기/쓰기 절대 금지**.
인증은 반드시 Supabase Auth(`supabase.auth.*`)만 사용.

### 2. DELETE 전체 삭제 버그
`api.js`의 DELETE 로직에 ID 없이 호출 시 전체 삭제되는 버그 존재.
`users` 테이블 삭제 시 반드시 `.eq('id', id)` 조건 직접 명시.
절대 `api.fetch('/users/...')` 방식으로 삭제하지 말 것.

### 3. 로그인 실패 차단
현재 5회 실패 차단이 React state로 관리 → F5 누르면 우회됨.
임시방편임을 인지하고, 서버사이드 차단 구현 전까지 현 상태 유지.

## 코드 패턴
```jsx
// 올바른 사용자 조회 (auth_id 기준)
const { data } = await supabase
  .from('users')
  .select('*')
  .eq('auth_id', authUser.id)
  .single();

// 올바른 사용자 삭제 (반드시 eq 조건 명시)
const { error } = await supabase
  .from('users')
  .delete()
  .eq('id', userId);  // ← 이 줄 절대 빠뜨리지 말 것
```

## 작업 규칙
1. 자율도 레벨 1 — 읽기/분석은 자유, 수정은 반드시 차장님 직접 확인 후 진행
2. `UserContext.jsx`는 모든 에이전트가 의존 — 수정 시 전체 시스템 영향
3. `App.jsx` 수정 시 라우팅 전체 영향 — 극도로 주의
