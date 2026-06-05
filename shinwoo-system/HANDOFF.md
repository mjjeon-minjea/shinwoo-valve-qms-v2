# 🤝 QMS v2 세션 통합 메모리 및 인수인계 파일 (HANDOFF.md)

* **최종 갱신일:** 2026년 06월 05일 (오후 세션)
* **작성자:** QMS AI 전담 비서 안티그래비티
* **인계대상:** 다음 세션 구동 AI 에이전트 및 전민재 차장님

---

## 1. 오늘 세션 주요 성과 (2026-06-05 오후)

### 📋 1. 팩트체크 후속 조치 [E][D][F] 완료
- **[E] clone-db TARGET_TABLES 교정**: 9종 → 10종 (`dev_notes`, `notices`, `settings` 추가 / `calendar_events`, `resources` 제외)
- **복제 결과**: 10개 테이블, 총 2,894건 복제, 메인 DB 쓰기 0건
- **[D] DDL 승인 게이트**: `clone-db.js` 상단에 차장님 사전 승인 규칙 주석 명기
- **[F] Database password**: 메인 DB 비밀번호 로테이션 완료
- **스키마 보정**: 테스트 DB `dev_notes.manager`(text), `notices.files`(jsonb) 컬럼 ALTER TABLE 추가

### 📂 2. 규칙 통합 및 정비
- `.agent/rules/` 하위 01~04 개별 파일 삭제 → `GEMINI.md` 단일 파일로 통합
- 전역 규칙, plan-self-review 스킬, README.md, HANDOFF.md, docs 2건의 참조를 전부 수정
- `GEMINI.md` 섹션 제목에서 `(구 XX)` 출처 표시 제거

### 🗂️ 3. HANDOFF 경로 공식화
- **공식 경로 확정**: `shinwoo-system\HANDOFF.md` (프로젝트 루트 기준)
- 전역 규칙 [조항 5], 워크스페이스 규칙 §3-2, knowledge-extractor 스킬에 경로 명시
- 루트 `HANDOFF.md` → `shinwoo-system\HANDOFF.md`로 이동 완료

---

## 2. 배포 인프라 3계층 좌표 (확정)

| 계층 | 메인웹 | 테스트웹 | 로컬 |
|------|--------|---------|------|
| Vercel | `shinwoo-valve-qms-mainweb-v2.vercel.app` | `shinwoo-valve-qms-testweb.vercel.app` | `localhost:5173` |
| GitHub | `main` | `staging` | `main` (HEAD) |
| Supabase | `zuahpjdsypovxdplxryw` | `srzaanvojyhwzugoaimk` | 테스트 DB 동일 |

---

## 3. clone-db 확정 테이블 (10종)

| 테이블 | 비고 |
|--------|------|
| `users`, `dev_notes`, `notices`, `weekly_reports` | |
| `process_inspections`, `inspections`, `item_master` | |
| `inquiries`, `suggestions`, `settings` | |
| ~~`calendar_events`~~, ~~`resources`~~ | 테스트 DB 미존재 → 제외 |
| ~~`receiving_inspections`~~, ~~`system_settings`~~ | 양쪽 DB 미존재 |

---

## 4. 잔여 작업

1. **메인웹 Vercel 설정 확인** (W4 — 차장님 수동)
2. **구 GitHub Pages 비활성화** (W7 — 차장님 수동)
3. **빌드 OOM**: 로컬 `npx vite build` 시 메모리 부족 크래시 — Vercel 서버 빌드에는 무영향
4. **service_role key 로테이션**: Supabase에서 개별 로테이션 기능 확인 필요 (보류)

---

## 5. 인수인계 핵심 사항

1. **규칙 체계**: `.agent/rules/GEMINI.md` 단일 파일로 통합됨. 01~04 개별 파일은 삭제됨.
2. **문서 4종 작성 시**: `.agent/rules/GEMINI.md` §4-3 표준 연계 순서 준수 (writing-plans → plan-self-review → revision-archiver)
3. **지식 저장 시**: `shinwoo-system\` 폴더에 저장. 다른 위치 생성 금지.
4. **clone-db 재실행**: `node scripts/clone-db.js` (`.env.local`에 키 설정 완료)
