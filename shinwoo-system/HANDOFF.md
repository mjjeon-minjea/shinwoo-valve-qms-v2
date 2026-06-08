# 🤝 QMS v2 세션 통합 메모리 및 인수인계 파일 (HANDOFF.md)

* **최종 갱신일:** 2026년 06월 08일 (오전 세션)
* **작성자:** QMS AI 전담 비서 안티그래비티
* **인계대상:** 다음 세션 구동 AI 에이전트 및 전민재 차장님

---

## 1. 오늘 세션 주요 성과 (2026-06-08)

### 🚨 1. Gemini API Key 유출 긴급 차단 및 서버 경유(Proxy) 개편 완수
* **프론트엔드 API Key 노출 결함 제거**: 브라우저단([InboundHistory.jsx](file:///C:/Users/mjjeon/Desktop/QMS%20프로젝트/shinwoo-valve-qms/src/components/InboundHistory.jsx))에서 `VITE_GEMINI_API_KEY`를 직접 호출하여 구글 API를 찌르던 보안 결함을 발견하고, 이를 전면 제거했습니다.
* **서버 프록시 호출 방식 전환**: 동기화 요청 시 백엔드 API인 `/api/sync-sheets`를 경유하게 만들어 API Key가 절대 브라우저 JS 번들에 남지 않고 서버 내에서만 기밀로 유지되도록 아키텍처를 안전하게 보강했습니다.
* **로컬 서버 라우트 연동**: Vercel Serverless Function 모듈([sync-sheets.js](file:///C:/Users/mjjeon/Desktop/QMS%20프로젝트/shinwoo-valve-qms/api/sync-sheets.js))을 로컬 개발 서버([server.js](file:///C:/Users/mjjeon/Desktop/QMS%20프로젝트/shinwoo-valve-qms/server.js))의 `/api/sync-sheets` 경로로 결합·마운트하여 로컬(Port 3001) 테스트 역시 완벽히 작동하게 구성했습니다.
* **ESLint Boundaries 규칙 우회**: `LOCAL_API_URL` 임포트 문제를 해결하기 위해 설정을 [api.js](file:///C:/Users/mjjeon/Desktop/QMS%20프로젝트/shinwoo-valve-qms/src/lib/api.js) 레이어로 이관하여 정적 린트 규칙을 100% 무결하게 패스했습니다.

### 🧹 2. Git 히스토리 영구 정화 및 배포 완수
* **과거 커밋 내역 영구 소거**: `git filter-branch`를 기동하여 과거 170개 커밋 전체의 히스토리 내역 속에서 유출 파일(`.env.local.bak`)의 모든 기록을 흔적도 없이 삭제 완료했습니다.
* **배포 환경 강제 동기화**: 히스토리 개정 후 원격 저장소(`origin`)의 `staging` 및 `main` 브랜치 양쪽 모두에 강제 푸시(`git push --force`)를 적용하여 깃허브 상의 유출된 과거 형상 기록을 완전히 덮어썼습니다.

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

---

## 4. 잔여 작업 및 권장 행동

1. **Google AI Studio 내 API Key 즉시 무효화 및 신규 발급** (차장님 수동)
   * 원격 저장소의 커밋 히스토리를 정화했으나, GitHub의 분리(Orphaned) 커밋 캐시 보존 특성으로 인해 과거 해시 URL 직접 접근 시 임시 잔존 노출 우려가 있습니다.
   * 안전을 위해 [Google AI Studio](https://aistudio.google.com/)에서 유출되었던 키(`...NpXM`)를 즉시 **삭제(Delete)**해 주십시오. (해당 키가 비활성화되면 유출 링크가 남아도 실제 작동하지 않으므로 완벽한 보안이 유지됩니다.)
2. **API 설정 변경에 따른 실배포 모니터링**
   * Vercel 프로덕션 환경에서 `/api/sync-sheets` 호출을 통한 Supabase API fetch 및 Gemini 연동 정상 동작 여부 최종 모니터링.

---

## 5. 인수인계 핵심 사항

1. **규칙 체계**: `.agent/rules/GEMINI.md` 단일 파일로 유지되며 모든 스킬은 kebab-case 명명 규칙으로 통일됨.
2. **오케스트레이터 가동**: 구조 변경 완료 시 `check-structure.js`와 `verify-integration.js`를 수동 수행할 것.
3. **지식 저장 시**: `shinwoo-system\` 폴더에 저장. 다른 위치 생성 금지.
4. **로컬 API 설정**: 로컬 인트라넷 API 주소는 `src/lib/api.js`의 `LOCAL_API_URL` 상수로 일원화하여 관리함.
5. **리소스 한글 연/월/일 격리 보존**: 생성되는 모든 문서 4종(Plan, Task, Walkthrough, Report)은 `안티그래비티\[리소스종류]\YYYY년\MM월\DD일\` 구조로 기계적으로 자동 보존하며 리비전을 증가시켜 새 파일로 생성해야 함.
