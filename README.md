# 🏢 신우밸브주식회사 품질보증부 QMS 홈페이지 (v2)

> **AI 에이전트 전역 안내 조항**: 이 프로젝트를 작업하는 모든 AI 에이전트는 진짜 전역 규칙 파일인 `C:\Users\mjjeon\.gemini\GEMINI.md` 및 프로젝트 로컬 규칙인 `.agent/rules/` 디렉토리를 **반드시 세션 시작 즉시 1순위로 필독**하여 한글 소통 의무와 하네스 DNAS 3단계 결재 프로세스, 그리고 영구 금지 규칙 13가지를 철저히 준수해야 합니다.

---

신우밸브 품질보증부 QMS(품질보증시스템) v2를 위한 현대적이고 반응성이 뛰어난 마스터 홈페이지 및 데이터 자동화 관리 시스템입니다. React, Vite, Tailwind CSS 프론트엔드와 Supabase 암호화 보안 데이터베이스 엔진을 유기적으로 융합하여 강력한 실무 자동화를 제공합니다.

---

## ✨ 1. v2 마스터 주요 기능 및 실무 시스템

### 📊 다차원 실무 대시보드 및 5대 핵심 점검 연동
* **통합 현황 모니터링**: 로그인 성공 시 주간보고서, 불량 분석, 인수검사 등 품질보증부 5대 점검 항목의 실시간 통계 및 차트를 다차원 렌더링합니다.
* **Supabase Production 실시간 연동**: RLS(Row Level Security) 정책 및 안전한 API upsert 설계를 거쳐 실제 상용 DB와 실시간 데이터 CRUD 작업을 안전하게 처리합니다.

### 🔐 Supabase 기반 암호화 보안 인증 관리
* **실무 보안 규격 준수**: 품질보증부 전용 계정들의 이메일 보안 인증 관리 및 `qms-auth-v2` 스토리지 키 기반 암호화 세션 유지를 제공합니다.
* **이메일 강제 잠금 복구 프로토콜**: unconfirmed 상태의 이메일 인증 강제 처리 및 데이터 자동 연계를 완벽하게 탑재했습니다.

### 📂 구글 스프레드시트 데이터 이관 & 백업 파이프라인
* **구글 시트 API CSV 동기화**: 인수검사 및 주간보고서의 누적 원천 데이터를 구글 스프레드시트 CSV 엔진을 통해 자동 로딩합니다.
* **데이터 이관 자동화**: `scripts/migrate-weekly-reports.js`와 `check-weekly-reports.js` 파이프라인을 구축하여 기존 로컬 데이터와 구글 시트 데이터를 Supabase Production DB로 오차 없이 전수 이관 및 대조 검증을 완료하였습니다.

### 🌐 안티그래비티 자체 브라우저 CDP 9222 연동 인프라
* **정석 CDP 새 탭 개설**: 차장님이 직접 뚫어주신 `skills/` 전역 매핑망에 `antigravity-browser-guide` 스킬을 장착하여, 독립 생 크롬 Launch 꼼수 대신 **CDP 9222 포트**에 직접 연동하여 내장 브라우저 뷰어 옆에 진짜로 새 탭을 강제 개설(`context.newPage()`)하고 실시간 입증을 지원합니다.

---

## 📂 2. 프로젝트 핵심 물리 구조

```
├── .agent/
│   ├── rules/
│   │   ├── GEMINI.md       # 마스터 규칙 인덱스 (전역 규칙 카피본)
│   │   ├── 01_tech_stack.md# 파워셸 고수 및 F12 진단 기술 규칙
│   │   ├── 02_dnas_process.md # 3단계 결재 DNAS 의무 규칙
│   │   └── 03_archiving.md # 지식 아카이빙 규칙
│   └── skills/
│       └── qms-orchestrator/ # QMS v2 오케스트레이터 및 검증 모듈
├── 안티그래비티/
│   ├── plan/               # 기획안(Plan) 물리 덮어쓰기 금지 보관함
│   ├── report/             # 최종 자백/중간 보고서(R0~R3) 물리 보관함
│   ├── screenshot/         # CDP 새 탭 추가 실증 캡처 등 이미지 보관함
│   └── walkthrough/        # 최종 완료 보고서(Walkthrough) 물리 보관함
├── scripts/
│   ├── migrate-weekly-reports.js # 주간보고서 데이터 Supabase 이관 파이프라인
│   ├── check-weekly-reports.js   # 이관 데이터 정합성 크로스 대조 검증 스크립트
│   ├── verify-cdp-tab.cjs        # CDP 9222 포트 내장 브라우저 새 탭 제어 실증 스크립트
│   └── test-prod-db-conn.cjs     # Production DB 직접 접속 픽스 테스트 스크립트
├── src/
│   ├── components/
│   │   ├── Header.jsx      # 품질보증부 전용 내비게이션 바
│   │   ├── Hero.jsx        # 이중 분할 슬라이드 애니메이션 및 보안 로그인 폼
│   │   └── Dashboard.jsx   # 로그인 후 안전하게 런칭되는 실무 관리 대시보드
│   ├── lib/
│   │   └── api.js          # Supabase Client 및 무제한 재귀 데이터 로더 모듈
│   ├── App.jsx             # 메인 앱 제어, 라우터 및 글로벌 상태 엔진
│   └── index.css           # 마스터 CSS 및 Tailwind 디자인 시스템 파일
├── tailwind.config.js      # CSS 디자인 설계 매핑 설정
└── vite.config.js          # Vite 빌드 및 5173 포트 고정 실행 설정
```

---

## 🛠️ 3. 핵심 사용 기술 스택 (Dependencies)

* **프론트엔드 코어 (Frontend Core)**
  * [React](https://react.dev/) (v18.2.0) - 고성능 컴포넌트 UI 라이브러리
  * [Vite](https://vitejs.dev/) (v5.0.8) - 고속 프론트엔드 번들러 및 빌더
  * [Tailwind CSS](https://tailwindcss.com/) (v3.4.0) - 반응형 유틸리티 스타일 엔진
  * [Recharts](https://recharts.org/) - 대시보드 차트 시각화 패키지
* **백엔드 & 데이터베이스 (Backend & DB)**
  * [Supabase / PostgreSQL](https://supabase.com/) - 암호화 보안 DB 및 인증 인프라
  * `pg` (PostgreSQL Client) - Direct DB 통신 및 스키마 검증 모듈
* **데이터 관리 & 자동화 (Data Automation)**
  * `xlsx` - 액셀/CSV 실무 테이블 데이터 파싱 모듈
  * `csv-parser` - 구글 스프레드시트 CSV 파이프라인 변환기
  * `dotenv` - 다중 환경변수(.env.local/.env.production) 보안 관리
* **품질 검증 & 디버그 (QA & Debugging)**
  * [Playwright](https://playwright.dev/) (v1.58.2) - CDP 9222 브라우저 제어 및 실시간 시연 엔진

---

## 🚀 4. 로컬 환경 실행 및 가동 방법

1. **의존성 패키지 전수 설치**  
   터미널을 열고 본 프로젝트 디렉토리 안에서 아래 명령어를 실행합니다.
   ```powershell
   npm install
   ```

2. **로컬 개발 서버 기동 (기본 포트 5173 고수)**  
   ```powershell
   npm run dev
   ```
   * *중요:* 안티그래비티 자체 브라우저 뷰어(`localhost:51579`)가 프록시로 정상 스트리밍하여 화면이 뻗지 않도록 Vite 기본 포트인 **5173**을 절대 고수해 주십시오.

3. **Production 빌드 수행**  
   ```powershell
   npm run build
   ```
