# 🤝 QMS v2 세션 통합 메모리 및 인수인계 파일 (HANDOFF.md)

* **최종 갱신일:** 2026년 06월 05일
* **작성자:** QMS AI 전담 비서 안티그래비티
* **인계대상:** 다음 세션 구동 AI 에이전트 및 전민재 차장님

---

## 1. 어제 세션의 장애 및 조치 이력 (Yesterday Memories)
* **장애 요약**: Supabase Production 환경 GoTrue 인증 모듈 붕괴 및 Production DB RLS 보안 락다운 사태 발생.
* **해결 계획**:
  * 3단계 격리 아키텍처 수립 및 장애 분석 리포트([qms_supabase_incident_report_r1.md](file:///C:/Users/mjjeon/.gemini/antigravity-ide/brain/c0a990f2-3503-48d8-b7d6-603cb3dd318d/qms_supabase_incident_report_r1.md)) 작성 완료.
  * 규칙과 스킬의 분격 이격을 통해 아키텍처적 안정성을 강화하기로 결정.

---

## 2. 오늘 자 규칙 및 스킬 개편 반영 결과 (Today Tasks)

### 📂 1. 규칙 정비
* **[GEMINI.md](file:///C:/Users/mjjeon/.gemini/GEMINI.md) (최상위 전역 규칙)**
  * **[조항 2]**: 2000자 초과 장문 발생 시 `revision-archiver` 스킬을 사용하여 Report를 안전하게 물리 보관 및 리비전 관리하도록 위임.
  * **[조항 6]**: `generate_image`로 생성된 이미지를 `image-archiver` 스킬을 즉시 가동하여 공식 보관 폴더로 강제 이전.
* **[02_dnas_process.md](file:///c:/Users/mjjeon/Desktop/QMS 프로젝트/shinwoo-valve-qms/.agent/rules/02_dnas_process.md) (결재 규칙)**
  * DNAS 3단계 프로세스 내 연동 스킬(Plan-writing-plans, Task-planning-with-files, Walkthrough-internal-comms)을 명시하고 Walkthrough 작성 시 4대 표준 서식(반영 내역, 반영 결과, 검증 계획, 검증 결과 요약)을 명문화.
  * ## 4. 스킬 실행 안내 및 자동 위임 섹션에 도메인별 작성 스킬 매핑(`4-1`), 관리·동기화 위임(`4-2`), 표준 연계 순서(`4-3`)의 구체 TO-BE 코드 블록 주입 완료.

### 🛠️ 2. 스킬 본문 보정 및 신설
* **`revision-archiver/SKILL.md`**: triggers에 `task`, `report` 적용 및 정규화 주제 동일성 판정(Dedup) 알고리즘 주입. (제목 및 섹션 1 보존)
* **`image-archiver/SKILL.md` (신설)**: UUID 하드코딩 오류를 제거하고 mtime 기준 최신 세션 임시 이미지를 자동 탐색하는 동적 복사 메커니즘 탑재.
* **`planning-with-files/SKILL.md`**: frontmatter hooks 블록을 통째로 삭제하여 QMS 결재 흐름과의 간섭을 차단하고, 저장경로를 `안티그래비티\task\` 및 파일명 `YYYY-MM-DD_[과업주제]_R[N].md`로 강제 오버라이드.
* **`writing-plans`, `internal-comms`, `doc-coauthoring` SKILL.md**: 각 본문에 QMS 전용 경로 및 한글 작성 제약사항 이식 완료.

### 🧪 3. 시운전 및 검증 완료
* **동적 세션 탐색 (`test_image_archiver.ps1`)**: **성공**. UUID 하드코딩 없이 최신 세션 내 임시 이미지를 정확하게 포착 및 복사.
* **주제 동일성 및 리비전 (`test_revision_dedup.ps1`)**: **성공**. 동일 주제를 식별하여 리비전을 순차 증분(`R2`) 계산.
* **통합 연계 실운전 (`test_integration_flow.ps1`)**: **성공**. 4대 도메인(Plan, Task, Walkthrough, Report) 전체 아카이빙 연계 완결.

---

## 2-B. 2026-06-05 세션: 배포 인프라 정비 (Today Tasks)

### 🔧 1. DB 정체 규명 및 좌표 정비 (W1)
- `qrmyhuipfkctgvzgdvmd` DB → **폐기 인스턴스** 확정 (TCP False + 폭파사건 보고서 근거).
- `.env.local` 교정: `PROD_SUPABASE_URL` = `https://zuahpjdsypovxdplxryw.supabase.co` (메인), `VITE_SUPABASE_URL` = 테스트 DB.

### 🌿 2. staging 브랜치 + Vercel 재배선 (W2, W3)
- `git push -u origin staging` → 원격 등록 완료.
- 테스트웹 Vercel: 구 레포 Disconnect → `shinwoo-valve-qms-v2` 재연결 → Production Branch = **`staging`** 변경 완료.
- 도메인 `shinwoo-valve-qms-testweb.vercel.app` 정상 작동 확인.

### 📦 3. 데이터 복제 파이프라인 구축 (W6)
- `clone-db.js` 신규 작성 (메인 DB Proxy 읽기전용 래퍼 탑재).
- **복제 대상 테이블 확정 9종**: `users`, `weekly_reports`, `inspections`, `item_master`, `process_inspections`, `calendar_events`, `inquiries`, `resources`, `suggestions`.
- **제외 테이블**: `dev_notes`, `notices` (로컬 관리), `settings` (로컬→서버).
- **테스트 DB 스키마 동기화**: `process_inspections` 누락 컬럼 4종 ALTER TABLE 성공 (`title`, `inspector_id`, `status`, `created_at`).
- **최종 실행 결과**: 9종 테이블, **총 2,801건 복제 완료**, 메인 DB 쓰기 **0건** (Proxy 물리 차단).

### 🧹 4. 레거시 정리 (W5, W7)
- 위험 스크립트 4종 삭제 (`test-prod-db-conn.js` 등 메인 DB 패스워드 평문 포함 파일).
- `package.json` GH Pages 스크립트 소거, `vite.config.js` base 단일화, `test-origin` 리모트 삭제.

### ⚠️ 5. 잔여 작업 (차장님 수동)
- 메인 DB 비밀번호 로테이션(재발급).
- W4: 메인웹 Vercel 설정 확인.
- W7: 구 GitHub Pages 비활성화.
- Task 8: `.gemini` KI 타임스탬프 직접 대조.

---

## 3. 토큰 및 비용 모니터링 (Token & Cost)
* **모델명**: GEMINI 3.5 FLASH (HIGH)
* **단가**: 입력 $1.50 / 출력 $9.00 (1백만 토큰당)
* **비용 통제 팁**: API 호출 비용 누적을 방지하기 위해 반드시 **컨텍스트 캐싱(Context Caching - 입력 $0.15/1M)** 기능을 연동할 것.
* **오늘 세션 소모 합계 (1차~6차 턴)**:
  * 누적 소모 토큰: 약 203,000 토큰 / 출력 약 780 토큰.
  * 누적 비용 합계: **$1.8381** (한화 약 **2,481.44원**).

---

## 4. 인수인계 핵심 사항 (Next Action Items)
1. **차기 세션 시작 시 최우선 조치**: 본 `HANDOFF.md`를 1순위로 읽어 장애 복구 맥락 및 정비된 스킬 구성을 즉각 로드할 것.
2. **검증 스크립트 보존**: `scratch/` 내에 생성된 파워쉘 테스트 스크립트 3종은 삭제하지 않고 보관할 것.
3. **배포 인프라 3계층 좌표 (2026-06-05 확정)**:
   - 메인웹: Vercel `shinwoo-valve-qms-mainweb-v2.vercel.app` ← GitHub `main` ← Supabase `zuahpjdsypovxdplxryw`
   - 테스트웹: Vercel `shinwoo-valve-qms-testweb.vercel.app` ← GitHub `staging` ← Supabase `srzaanvojyhwzugoaimk`
   - 로컬웹: `localhost:5173` ← 테스트 DB 동일
4. **clone-db.js 재실행 시 참고**: 메인 키는 `.env.local`의 `PROD_SERVICE_ROLE_KEY`에 이미 입력 완료. `node scripts/clone-db.js`로 즉시 실행 가능.
5. **문서 4종 작성 시 필수 점검**: `02_dnas_process.md` §4-3 표준 연계 순서를 반드시 준수할 것 (internal-comms → revision-archiver → release-sync).
