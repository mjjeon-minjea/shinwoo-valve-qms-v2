# 트러블슈팅 — 2026-06-05 오후 세션

## 1. clone-db 스키마 불일치 (dev_notes.manager / notices.files)
- **증상**: `clone-db.js` 재실행 시 `dev_notes` → "Could not find the 'manager' column", `notices` → "Could not find the 'files' column" 에러
- **원인**: 메인 DB에는 해당 컬럼이 존재하지만 테스트 DB에는 누락
- **해결**: 차장님 승인 후 Supabase SQL Editor에서 ALTER TABLE 실행
  ```sql
  ALTER TABLE dev_notes ADD COLUMN IF NOT EXISTS manager text;
  ALTER TABLE notices ADD COLUMN IF NOT EXISTS files jsonb;
  ```
- **결과**: 재실행 시 10종 2,894건 전부 복제 성공

## 2. 빌드 OOM (Out Of Memory)
- **증상**: `npx vite build` 실행 시 exit code `-1073740791` (메모리 크래시)
- **원인**: 안티그래비티 에이전트 + 브라우저 동시 구동으로 로컬 PC 메모리 부족
- **영향**: clone-db 변경과 무관. Vercel 서버 빌드에는 무영향.
- **대응**: 로컬 빌드 필요 시 `$env:NODE_OPTIONS="--max-old-space-size=8192"` 설정 또는 다른 프로세스 종료 후 재시도

## 3. 해당 사항 없음 (N/A)
- 절대 룰셋(SOP): 해당 사항 없음 (기존 규칙 보완만 수행)
- 기능 명세(Feature Spec): 해당 사항 없음 (신규 기능 개발 없음)
