# 🤝 QMS v2 세션 통합 메모리 및 인수인계 파일 (HANDOFF.md)

* **최종 갱신일:** 2026년 06월 06일 (오후 세션)
* **작성자:** QMS AI 전담 비서 안티그래비티
* **인계대상:** 다음 세션 구동 AI 에이전트 및 전민재 차장님

---

## 1. 오늘 세션 주요 성과 (2026-06-06)

### 🗂️ 1. 안티그래비티 리소스 한글 연/월/일 정돈 완수 (오전)
- **63개 파일 전수 이관 정돈**: `plan/`, `task/`, `walkthrough/`, `report/`, `images/` 하위에 무작위로 쌓여 있던 63개 이상의 기존 파일들을 파일명 및 생성일 기준으로 한글 `YYYY년\MM월\DD일\` 하위 폴더로 `git mv` 일괄 안전하게 이관하여 에디터 화면 도배 문제를 해결했습니다.
- **규칙 및 스킬의 존치 기반 개정**: `image-archiver`와 `revision-archiver` 스킬을 삭제하지 않고 유지하여 런타임 잠재 에러를 원천 차단하되, 각 스킬 내부의 보관 경로 공식만 `YYYY년\MM월\DD일\` 한글 일자 구조로 개정했습니다.
- **규칙 전수 동기화**: 글로벌 규칙 `GEMINI.md` 및 연관 스킬들(`dnas-process`, `qms-planning-suite`) 내의 모든 문서/리소스 저장 타겟 경로들을 개정된 한글 날짜 경로로 보정 완료했습니다.
- **상대경로 보정 및 유효성 검사**: 파일 이동에 따라 문서 내의 이미지 상대 경로들이 깨지지 않도록 일괄 치환·보정하였으며, 자체 검증 스크립트(`verify-links.ps1`)를 기동하여 404 깨짐 없이 100% 실존 매칭됨을 입증했습니다.

### 📋 2. 저장소 하이진(위생) 보강 완수 (오전)
- **추적 파일 700여 개 대량 해제**: 시크릿 변형(`.env.local.bak` 등), 백업 데이터 덤프(`db.json`, `mes_process_inspections.json` 등), 빌드로그, 임시 스크래치(`scratch/`), 생성 캐시(`graphify-out/`) 등의 git 추적을 완벽하게 해제(`git rm --cached`).
- **옵시디언 위키 콘텐츠 완전 보존**: `.obsidian` 에디터 개인 설정 및 캐시만 무시하도록 `.gitignore`를 보강하되, 실제 위키 콘텐츠 파일(`.obsidian/wiki/` 97개 문서)과 헌법인 `.obsidian/GEMINI.md`는 안전하게 예외처리하여 추적을 정상 보존.
- **.env.example 템플릿 신규 생성**: 환경변수 설정 명세 템플릿을 신규 생성하여 git 추적에 추가.

### ⚙️ 3. localhost:3001 API 설정 중앙화 (오전)
- **config.js 신규 주입**: `src/config/config.js`를 생성하여 인트라넷 API 호출 주소(`LOCAL_API_URL`)를 중앙화.
- **소스코드 이관 및 가드 보존**: `PostApproval.jsx` 및 `DevNotes.jsx`에서 하드코딩되었던 주소를 상수로 대체. 빌드 후 프로덕션 환경과의 분기를 위해 `import.meta.env.DEV` 가드 조건은 철저하게 보존.

### 🗑️ 4. 중복 및 임시 파일 정리 (오전)
- 루트 경로에 방치되어 있던 중복 `HANDOFF.md` 및 `scratch/clean_obsidian_wiki.js` 파일을 삭제하여 저장소 위생 극대화.

### 🚀 5. 스테이징 및 메인 배포 완료 (오전)
- 원격 fetch refspec 설정 오류를 진단·수정하고, 수정 완료된 모든 소스를 `staging` 및 `main` 브랜치에 각각 정상 푸시 완료.

### 📋 5. Claude 구조점검 대응 및 스킬 정규화 완료 (오전)
- **Claude 지적사항 팩트체크 및 반박**: NUL 바이트 손상 지적이 허위임을 Node.js 바이너리 전수 조사를 통해 규명 (Null count = 0).
- **kebab-case 개편**: `dnas_process`, `tech_stack`, `harness_constraints`, `knowledge_archiving` 4종 스킬을 kebab-case 폴더명 및 스킬명(`dnas-process`, `tech-stack`, `harness-constraints`, `knowledge-archiving`)으로 변경하고 `rules/GEMINI.md`와 동기화 완료.
- **오케스트레이터 보완**: 누락되었던 `qms-orchestrator/SKILL.md`를 신규 생성 및 주입.
- **SOT(단일 진실 공급원) 수립**: `.agent/_shared` 하위의 중복 파일(`dnas_process.md`, `tech_stack.md`)을 완전히 제거하여 중복을 차단.
- **react-best-practices name 일치**: frontmatter name을 `react-best-practices`로 수정하여 폴더명과 일치 완료.

### 📂 2. 규칙 리포트 및 완료보고서 공식 이관
- **공식 이관 완료**: [Plan R4](file:///C:/Users/mjjeon/Desktop/QMS%20프로젝트/shinwoo-valve-qms/안티그래비티/plan/2026-06-06_QMS_규칙통합_및_스킬화_R4.md) 및 [Walkthrough R2](file:///C:/Users/mjjeon/Desktop/QMS%20프로젝트/shinwoo-valve-qms/안티그래비티/walkthrough/2026-06-06_QMS_규칙통합_및_스킬화_R2.md)를 공식 이관하여 정식 저장.

### 🚀 3. 스테이징 및 메인 배포 완료
- 수정 완료된 소스를 `staging` 및 `main` 브랜치에 각각 정상 푸시 완료.

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
3. **API 설정 변경에 따른 실배포 모니터링**: Vercel 프로덕션 배포 시 Supabase API fetch 동작 무결성 모니터링

---

## 5. 인수인계 핵심 사항

1. **규칙 체계**: `.agent/rules/GEMINI.md` 단일 파일로 유지되며 모든 스킬은 kebab-case 명명 규칙으로 통일됨.
2. **오케스트레이터 가동**: 변경 시 반드시 `check-structure.js`와 `verify-integration.js`를 수동 수행하여 구조 무결성을 확보할 것.
3. **지식 저장 시**: `shinwoo-system\` 폴더에 저장. 다른 위치 생성 금지.
4. **저장소 위생 및 옵시디언 예외**: `.obsidian/` 내 에디터 설정 및 캐시는 무시하되, 위키 콘텐츠 및 `GEMINI.md` 파일은 `!.obsidian/wiki/`, `!.obsidian/GEMINI.md` 예외 처리를 통해 항상 git 추적을 보존해야 함.
5. **로컬 API 설정**: 로컬 인트라넷 API 주소는 `src/config/config.js`의 `LOCAL_API_URL` 상수로 일원화하여 관리함.
6. **리소스 한글 연/월/일 격리 보존**: 앞으로 생성되는 모든 문서 4종(Plan, Task, Walkthrough, Report) 및 아카이빙 이미지는 `안티그래비티\[리소스종류]\YYYY년\MM월\DD일\` 구조로 기계적으로 자동 이관 및 보존되며, 문서 수정 시 `R0 ➡️ R1 ➡️ R2...` 순으로 리비전을 올려 개별 독립 파일로 생성해야 함.

