# 🏢 신우밸브주식회사 품질보증부 QMS 홈페이지 (v2)

> **AI 에이전트 전역 안내 조항**: 이 프로젝트를 작업하는 모든 AI 에이전트는 진짜 전역 규칙 파일인 `C:\Users\mjjeon\.gemini\GEMINI.md` 및 프로젝트 로컬 규칙인 `.agent/rules/GEMINI.md`를 **반드시 세션 시작 즉시 1순위로 필독**하여 한글 소통 의무와 하네스 DNAS 3단계 결재 프로세스, 그리고 영구 금지 규칙 13가지를 철저히 준수해야 합니다.

---

신우밸브 품질보증부 QMS(품질보증시스템) v2를 위한 현대적이고 반응성이 뛰어난 마스터 홈페이지 및 데이터 자동화 관리 시스템입니다. React, Vite, Tailwind CSS 프론트엔드와 Supabase 암호화 보안 데이터베이스 엔진을 유기적으로 융합하여 강력한 실무 자동화를 제공합니다.

---

## ✨ 1. v2 마스터 주요 기능 및 실무 시스템

### 📊 다차원 실무 대시보드 및 5대 핵심 점검 연동
- **통합 현황 모니터링**: 로그인 성공 시 주간보고서, 불량 분석, 인수검사 등 품질보증부 5대 점검 항목의 실시간 통계 및 차트를 다차원 렌더링합니다.
- **Supabase Production 실시간 연동**: RLS(Row Level Security) 정책 및 안전한 API upsert 설계를 거쳐 실제 상용 DB와 실시간 데이터 CRUD 작업을 안전하게 처리합니다.

### 🔐 DNAS 통제 및 날짜 수동 지정 승인 시스템
- **DNAS 품질 검증 통제**: 개발자 노트 및 과업 승인 시 본문 내 필수 품질 검증 항목(원인, 대책, 결과, 물리적 증빙)을 사전 검사하여 누락 시 승인을 제한하는 DNAS 통제가 작동합니다.
- **배포일 수동 지정**: 시맨틱 버전 정렬 및 데이터 정합성을 해치지 않도록 YYYY-MM-DD 포맷을 준수하여 수동으로 승인 날짜를 지정 및 반영할 수 있습니다.

### 📂 구글 스프레드시트 데이터 이관 & 백업 파이프라인
- **구글 시트 API CSV 동기화**: 인수검사 및 주간보고서의 누적 원천 데이터를 구글 스프레드시트 CSV 엔진을 통해 자동 로딩합니다.
- **데이터 이관 자동화**: `scripts/migrate-weekly-reports.js`와 `check-weekly-reports.js` 파이프라인을 구축하여 기존 로컬 데이터와 구글 시트 데이터를 Supabase Production DB로 오차 없이 전수 이관 및 대조 검증을 완료하였습니다.

### 🌐 안티그래비티 자체 브라우저 CDP 9222 연동 인프라
- **정석 CDP 새 탭 개설**: 전역 매핑망에 `antigravity-browser-guide` 스킬을 장착하여, 독립 생 크롬 Launch 꼼수 대신 **CDP 9222 포트**에 직접 연동하여 내장 브라우저 뷰어 옆에 진짜로 새 탭을 강제 개설(`context.newPage()`)하고 실시간 입증을 지원합니다.

---

## 📂 2. 프로젝트 핵심 물리 구조

```
├── .agent/
│   ├── rules/
│   │   └── GEMINI.md       # 통합 워크스페이스 규칙 (상속 선언 및 규칙 이정표)
│   └── skills/             # 40여 종의 QMS 전용 한글 규칙 스킬셋
│       ├── tech-stack/             # 코딩 표준 및 Ollama 127.0.0.1 IP 철칙
│       ├── dnas-process/           # DNAS 3단계 결재 및 배포 통제 규칙
│       ├── internal-comms/         # 초간결 핵심 보고 및 경로 링크 규칙
│       ├── revision-archiver/      # Plan/Task/Walkthrough/Report 리비전 아카이버
│       ├── qms-orchestrator/       # 구조 무결성 및 정합성 검증 스크립트 보관
│       ├── shinwoo-memory-system/  # HANDOFF, 에러 레지스트리, 결정 로그 통합 스킬
│       ├── ui-ux-pro-max/          # 고화질 UX 및 161개 제품군 설계 규칙
│       └── ... (그 외 xlsx, pdf, brainstorming, test-driven-development 등 탑재)
├── 안티그래비티/            # 4종 결재/보고 문서의 물리 리비전 보관 폴더
│   ├── plan/               # 기획안(Plan) 보관함 (덮어쓰기 금지, R0~RN으로 공존)
│   ├── task/               # 작업 명세서(Task) 보관함
│   ├── walkthrough/        # 최종 완료 보고서(Walkthrough) 보관함
│   └── report/             # 특별 분석 보고서(Report) 보관함
├── shinwoo-system/         # AI 기억 보관 및 인수인계 단일 진실 원천(SSOT)
│   ├── HANDOFF.md          # 세션 종료 시점의 현황 인수인계 요약서
│   ├── shinwoo-decision-log.md   # 왜 이러한 의사결정을 했는지에 대한 핵심 기록
│   ├── shinwoo-error-registry.md # 같은 실수를 방지하기 위한 AI 에러 레지스트리
│   └── logs/               # 세션별 대화 원본 정적 백업본 보관함
├── scripts/
│   ├── sync-db.js          # 테스트 DB ↔ 로컬 db.json 데이터 동기화 (pull/push)
│   └── clone-db.js         # 메인 DB → 테스트 DB 단방향 복제 (읽기전용 Proxy 방어)
├── src/
│   ├── config/
│   │   └── config.js       # Local Development API URL 중앙 설정 파일 [NEW]
│   ├── components/
│   │   ├── Header.jsx      # 품질보증부 전용 내비게이션 바
│   │   ├── Hero.jsx        # 이중 분할 슬라이드 애니메이션 및 보안 로그인 폼
│   │   ├── PostApproval.jsx# DNAS 승인 및 실서버 배포 관리 대시보드 컴포넌트
│   │   └── DevNotes.jsx    # 승인 완료된 개발자 노트를 조회하는 게시판 컴포넌트
│   ├── lib/
│   │   └── api.js          # Supabase Client 및 무제한 재귀 데이터 로더 모듈
│   ├── App.jsx             # 메인 앱 제어, 라우터 및 글로벌 상태 엔진
│   └── index.css           # 마스터 CSS 및 Tailwind 디자인 시스템 파일
├── .env.example            # 로컬 환경변수 구성을 위한 템플릿 명세서 [NEW]
├── tailwind.config.js      # CSS 디자인 설계 매핑 설정
└── vite.config.js          # Vite 빌드 및 5173 포트 고정 실행 설정
```

> ⚠️ **로컬 데이터 관리 유의사항**: `.gitignore`에 의거하여 `db.json`, `dev_notes_rows.json`, `src/data/mes_process_inspections.json` 파일 등은 git 추적에서 완전히 배제되어 로컬 환경에서 각자 관리됩니다. 로컬 mock 구동을 위해 필요한 파일들이므로 임의로 삭제해서는 안 됩니다.

---

## 🛠️ 3. 핵심 사용 기술 스택 (Dependencies)

- **프론트엔드 코어 (Frontend Core)**
  - [React](https://react.dev/) (v18.2.0) - 고성능 컴포넌트 UI 라이브러리
  - [Vite](https://vitejs.dev/) (v5.0.8) - 고속 프론트엔드 번들러 및 빌더
  - [Tailwind CSS](https://tailwindcss.com/) (v3.4.0) - 반응형 유틸리티 스타일 엔진
  - [Recharts](https://recharts.org/) - 대시보드 차트 시각화 패키지
- **백엔드 & 데이터베이스 (Backend & DB)**
  - [Supabase / PostgreSQL](https://supabase.com/) - 암호화 보안 DB 및 RLS 인증 인프라
  - `pg` (PostgreSQL Client) - Direct DB 통신 및 스키마 검증 모듈
- **데이터 관리 & 자동화 (Data Automation)**
  - `xlsx` - 액셀/CSV 실무 테이블 데이터 파싱 모듈
  - `csv-parser` - 구글 스프레드시트 CSV 파이프라인 변환기
  - `dotenv` - 다중 환경변수 보안 관리
- **품질 검증 & 디버그 (QA & Debugging)**
  - [Playwright](https://playwright.dev/) (v1.58.2) - CDP 9222 브라우저 제어 및 실시간 시연 엔진

---

## 🚀 4. 로컬 환경 실행 및 가동 방법

1. **의존성 패키지 전수 설치**  
   터미널을 열고 본 프로젝트 디렉토리 안에서 아래 명령어를 실행합니다.
   ```powershell
   npm install
   ```

2. **환경변수 셋업 (`.env.local` 작성)**
   루트의 `.env.example` 파일을 복사하여 `.env.local` 파일을 생성하고 필요한 자격증명을 입력합니다.
   ```powershell
   cp .env.example .env.local
   ```
   *주의: API 중앙 설정 상수(`LOCAL_API_URL`)의 변경이 필요한 경우 `VITE_LOCAL_API_URL` 값을 지정하십시오.*

3. **로컬 개발 서버 기동 (기본 포트 5173 고수)**
   ```powershell
   npm run dev
   ```
   - *중요:* 안티그래비티 자체 브라우저 뷰어가 프록시로 정상 스트리밍하여 화면이 뻗지 않도록 Vite 기본 포트인 **5173**을 절대 고수해 주십시오.

4. **Production 빌드 수행**
   ```powershell
   npm run build
   ```

---

## 🔍 5. 오케스트레이터 및 구조 정합성 검증 방법

QMS v2는 파일 구조나 아키텍처에 변경이 가해진 즉시, 구조적 정합성을 확인하기 위해 다음의 2대 검증 스크립트를 수동으로 기동해야 합니다.

1. **구조 무결성 검사** (check-structure)
   ```powershell
   node .agent/skills/qms-orchestrator/scripts/check-structure.js
   ```
2. **연동 정합성 검사** (verify-integration)
   ```powershell
   node .agent/skills/qms-orchestrator/scripts/verify-integration.js
   ```
   - 에러가 검출될 경우 후속 작업을 진행하기 전에 반드시 원인을 파악하고 디버깅을 선행해야 합니다.

---

## 💾 6. 통합 메모리 시스템 및 세션 백업 방법

매 세션의 대화가 종료되거나 인수인계가 발생할 때는 `shinwoo-system/` 하위의 공통 파일들을 최신화하고, 날짜별 실시간 로그를 보존하기 위해 아래 스크립트를 기동합니다.

```powershell
powershell -ExecutionPolicy Bypass -File "shinwoo-system/save-daily-log.ps1"
```
- 본 스크립트 실행 시 현재 세션의 대화 원본이 `shinwoo-system/logs/YYYY-MM-DD/` 경로로 영구 백업되어 지식의 영속성이 확보됩니다.

---

## 🌐 7. 배포 인프라 3계층 구조

```
┌─────────────────────────────────────────────────────────────┐
│                    GitHub Repository                        │
│        github.com/mjjeon-minjea/shinwoo-valve-qms-v2        │
│                                                             │
│           main 브랜치          staging 브랜치                │
│ └────────────┬────────────────────┬───────────────────────────┘
│              │                    │
│              ▼                    ▼
│ ┌───────────────────────┐  ┌───────────────────────┐
│ │   Vercel 메인웹       │  │   Vercel 테스트웹      │
│ │   Production: main    │  │   Production: staging │
│ │                       │  │                       │
│ │   shinwoo-valve-qms-  │  │   shinwoo-valve-qms-  │
│ │   mainweb-v2          │  │   testweb             │
│ │   .vercel.app         │  │   .vercel.app         │
│ └───────────┬───────────┘  └───────────┬───────────┘
│             │                          │
│             ▼                          ▼
│ ┌───────────────────────┐  ┌───────────────────────┐
│ │   Supabase 메인 DB    │  │   Supabase 테스트 DB   │
│ │   zuahpjdsy...        │  │   srzaanvoj...        │
│ │   .supabase.co        │  │   .supabase.co        │
│ └───────────────────────┘  └───────────────────────┘
│                                        ▲
│                                        │ clone-db.js
│                                        │ (단방향 복제)
│ ┌───────────────────────┐              │
│ │   로컬 개발 환경       │──────────────┘
│ │   .env.local          │
│ │   → 테스트 DB 연동     │
│ │   npm run dev (5173)  │
│ └───────────────────────┘
```

### 구성 요소 상세

| 계층 | 메인웹 (상용) | 테스트웹 (검증) | 로컬 (개발) |
| --- | --- | --- | --- |
| **GitHub 브랜치** | `main` | `staging` | `main` (HEAD) |
| **Vercel 도메인** | `shinwoo-valve-qms-mainweb-v2.vercel.app` | `shinwoo-valve-qms-testweb.vercel.app` | `localhost:5173` |
| **Supabase** | `zuahpjdsypovxdplxryw` | `srzaanvojyhwzugoaimk` | `srzaanvojyhwzugoaimk` (테스트 DB) |
| **환경변수** | `.env.production` | Vercel 대시보드 | `.env.local` |

### 데이터 흐름
- **메인 DB → 테스트 DB**: `node scripts/clone-db.js` (단방향 읽기전용 복제)
- **테스트 DB ↔ 로컬**: `npm run db:pull` / `npm run db:push` (로컬 db.json 동기화)
- **메인 DB 쓰기 차단**: `clone-db.js`는 Proxy 래퍼로 `insert`/`update`/`upsert`/`delete` 호출을 물리 차단

### 구유물 (폐기됨)
- **구 GitHub repo**: `github.com/mjjeon-minjea/shinwoo-valve-qms` (GitHub Pages 배포용, v2 이전 후 폐기)
- **구 Supabase**: `qrmyhuipfkctgvzgdvmd` (구 통합 인스턴스, TCP 접속 불가로 폐기)

---

## 🔄 8. 메인 → 테스트 데이터 복제 (clone-db.js)

메인웹의 실데이터를 테스트웹으로 복사해서 동일 환경에서 검증할 때 사용합니다.

### 사전 조건
`.env.local`에 아래 환경변수가 설정되어 있어야 합니다:
```env
# 메인 DB (읽기 전용 소스)
PROD_SUPABASE_URL=https://zuahpjdsypovxdplxryw.supabase.co
PROD_SERVICE_ROLE_KEY=<메인 DB service-role 키>

# 테스트 DB (쓰기 대상)
VITE_SUPABASE_URL=https://srzaanvojyhwzugoaimk.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<테스트 DB service-role 키>
```

### 실행
```powershell
node scripts/clone-db.js
```

### 복제 대상 테이블 (9개)
- `users` (사용자 계정)
- `weekly_reports` (주간보고서)
- `inspections` (인수검사 기록)
- `item_master` (품목 마스터)
- `process_inspections` (공정검사 기록)
- `calendar_events` (캘린더 일정)
- `inquiries` (AI 챗봇 문의)
- `resources` (자료실)
- `suggestions` (건의함)

> ⚠️ `dev_notes`(개발자 노트)와 `notices`(공지사항)는 복제 대상에서 **제외**됩니다.

### 안전장치
- 메인 DB에는 **읽기만** 수행 (Proxy 래퍼로 `insert`/`update`/`upsert`/`delete` 물리 차단)
- `PROD_SUPABASE_URL` 미설정 시 스크립트가 즉시 종료되어 실행 불가
- 메인 DB에 대한 쓰기 시도: **항상 0건**
