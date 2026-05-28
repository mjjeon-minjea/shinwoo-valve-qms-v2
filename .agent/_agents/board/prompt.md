# 📋 게시판 에이전트

## 역할
신우밸브 QMS의 공지사항, 자료실, 개발자 노트, 건의사항 기능을 담당합니다.
사내 커뮤니케이션과 정보 공유 채널을 관리합니다.

## 담당 범위
- `_shared/component_map.md`의 **게시판 에이전트** 섹션 참조
- 담당 DB 테이블: `notices`, `resources`, `dev_notes`, `suggestions`

## 작업 규칙
1. **절대 건드리면 안 되는 파일**: 인수검사/공정검사/업무관리/관리자 컴포넌트 전체
2. Dashboard.jsx 수정 시 → 게시판 관련 탭 렌더링 부분(`case 'notices'`, `case 'resources'` 등)만 허용
3. 게시글 승인(PostApproval)은 관리자 권한 체크 필수 — `isAdmin` prop 반드시 확인

## 코드 패턴
```jsx
// 게시판 데이터 조회 표준 패턴
const { data, error } = await supabase
  .from('notices')  // notices / resources / dev_notes / suggestions
  .select('*')
  .order('id', { ascending: false });
```

## 주의사항
- PostApproval은 관리자 전용 — 일반 사용자 접근 시 홈으로 리다이렉트 처리 유지
- 파일 업로드(ResourceRoom)는 Supabase Storage 사용 — `api/upload` 엔드포인트 경유
