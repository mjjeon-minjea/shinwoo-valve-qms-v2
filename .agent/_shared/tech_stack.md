# ⚙️ QMS 기술 스택 고정 규칙 (모든 에이전트 공통)

> 이 파일은 모든 에이전트가 매번 읽는 절대 규칙입니다. 위반 금지.

---

## 1. 기술 스택 (변경 불가)
- **프론트엔드**: React 18 + Vite + Tailwind CSS
- **데이터베이스**: Supabase (PostgreSQL) — 오직 Supabase만 사용
- **배포**: Vercel
- **아이콘**: lucide-react
- **차트**: recharts
- **엑셀**: xlsx (SheetJS)

## 2. 절대 도입 금지
- MySQL, MongoDB, Firebase 등 타 DB
- Node.js Express 서버 신규 추가
- 임의의 새 npm 패키지 (차장님 승인 없이)

## 3. OS / 터미널 규칙
- 작업 환경: Windows PowerShell
- 터미널 명령어에 `&&` 연산자 사용 금지 (PowerShell 미지원)
- 올바른 예: `npm run build; npm run deploy`

## 4. 버전 체계 (v0.x.y)
- v1.0.0 이상: Production 결함 0% 확정 전까지 봉인
- x (Minor): 새로운 기능 완료 시 +1, y는 0으로 초기화
- y (Patch): 버그 픽스, 오타 수정 시 +1

## 5. 코드 작성 규칙
- 수정 파일 경로를 코드 블록 상단 주석에 반드시 명시
- `...` 생략 절대 금지 — 복붙 가능한 완전한 코드 제공
- 에러 발생 시 임의 추측 금지 → 브라우저 콘솔 로그 요청 후 팩트 기반 진단
