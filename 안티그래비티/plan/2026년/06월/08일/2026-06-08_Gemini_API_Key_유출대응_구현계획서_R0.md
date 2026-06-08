# 📋 Gemini API Key 유출 대응 및 서버 경유 개편 구현계획서 (R0)

* **작성일자:** 2026년 06월 08일
* **보고대상:** 신우밸브주식회사 품질보증부 전민재 차장님
* **작성자:** QMS AI 전담 비서 안티그래비티

---

## 🎯 1. 구현 목표

1. **API Key 유출 위협 차단**: 브라우저 직접 호출 방식을 폐기하고, 백엔드 서버(Proxy) 경유 호출 방식으로 구조를 전환하여 프론트엔드 JS 번들 내 API Key 노출을 원천 방지합니다.
2. **Git 히스토리 정화**: 유출된 파일인 `.env.local.bak`을 과거 Commit History에서 완전히 소거하고 원격 저장소(`main`, `staging`)에 강제 푸시하여 보안 감사 경고를 완벽히 해소합니다.

---

## 🛠️ 2. Proposed Changes (변경 대상 및 범위)

### 2.1 Backend: 로컬 개발 서버 라우트 추가
#### [MODIFY] [server.js](file:///C:/Users/mjjeon/Desktop/QMS%20프로젝트/shinwoo-valve-qms/server.js)
* `/api/sync-sheets` 경로의 POST 라우트를 추가합니다.
* 이 라우트에서 `api/sync-sheets.js` 모듈을 동적으로 가져와(Serverless Function 로직) 실행함으로써 로컬 환경(3001 포트)에서도 동기화 동작이 완벽하게 백엔드 단에서 가동되도록 처리합니다.

### 2.2 Frontend: Gemini 호출 로직 위임 및 정제
#### [MODIFY] [InboundHistory.jsx](file:///C:/Users/mjjeon/Desktop/QMS%20프로젝트/shinwoo-valve-qms/src/components/InboundHistory.jsx)
* `handleGoogleSync` 내부의 복잡한 로컬 CSV 파싱, 브라우저에서의 직접 Gemini API 호출, Supabase 직접 Upsert 로직을 전면 소거합니다.
* 대신, 백엔드 API인 `LOCAL_API_URL/api/sync-sheets`로 POST 요청을 날려 동기화 작업을 위임하고, 성공 시 화면 새로고침(`fetchInspections`)을 수행하도록 교정합니다.
* 프론트엔드 단의 `classifyDefectTypeWithGemini` 함수 및 `VITE_GEMINI_API_KEY` 환경변수 참조 코드를 영구 삭제합니다.

### 2.3 Git: 커밋 이력 소거 및 강제 배포
* **Git 히스토리 소거 명령어 (PowerShell 규격):**
  ```powershell
  git filter-branch --force --index-filter "git rm --cached --ignore-unmatch .env.local.bak" --prune-empty --tag-name-filter cat -- --all
  ```
* **원격 강제 배포 (Force Push):**
  * `staging` 및 `main` 브랜치에 각각 강제 푸시(`git push origin --force --all`)를 진행하여 유출 이력을 깃허브 상에서 완벽히 소거합니다.

---

## 🧪 3. Verification Plan (검증 및 배포 시나리오)

### 3.1 로컬 검증 (Local QA)
1. 로컬 API 서버(`server.js`) 및 Vite 개발 서버 기동.
2. **"구글 시트 즉시 동기화"** 버튼을 눌러, 로컬 백엔드 서버(3001)의 `/api/sync-sheets`가 호출되고 Supabase DB에 무결하게 데이터가 삽입되는지 로그로 교차 검증.
3. 브라우저 개발자 도구(F12)의 Network 탭에서 구글 Gemini API 호출(`/generateContent`)이 아닌 백엔드 API 호출만 일어나는지 물리적 증빙 확보.

### 3.2 배포 및 깃 히스토리 검증 (Deployment & History Clean Check)
1. 로컬 Git에서 `git filter-branch`를 통한 `.env.local.bak` 완전 제거 확인.
2. `staging` 브랜치 강제 푸시 ➡️ Vercel Staging 배포 연동 확인 및 기능 테스트.
3. `main` 브랜치 강제 푸시 ➡️ Vercel Production 배포 연동 확인 및 실환경 동작 모니터링.
4. GitHub 상에서 유출 커밋 링크가 정상적으로 404로 비활성화되었는지 검증.
