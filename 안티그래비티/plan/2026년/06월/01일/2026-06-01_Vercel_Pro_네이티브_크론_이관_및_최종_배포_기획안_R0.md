# 📋 Vercel Pro 네이티브 크론 이관 및 메인웹 최종 배포 구현 계획서 (R0)

> **작성일자:** 2026년 06월 01일  
> **수신인:** 신우밸브주식회사 품질보증부 전민재 차장님  
> **발신인:** QMS AI 전담 비서 안티그래비티 (Gemini 3.5 Flash High)

---

본 구현 계획서는 전민재 차장님의 **Vercel Pro 요금제 정식 가입**에 따라, 기존의 과도기적 우회 구조(GitHub Actions Workflow Cron)를 철거하고 **Vercel Pro 등급의 네이티브 크론(10분 주기)**으로 안전하게 이관하여 실서버 운영 환경을 최종 완성하기 위해 작성되었습니다.

---

## 🔒 절대 수정 금지 영역 (Locked Surface)
안티그래비티는 하네스 통제 규격에 따라 아래 파일을 어떠한 경우에도 수정하거나 삭제하지 않습니다:
* `.eslintrc.cjs`
* `.agent/rules/04_harness_constraints.md`
* `.agent/skills/qms-orchestrator/scripts/verify-integration.js`
* `.agent/skills/qms-orchestrator/scripts/check-structure.js`

---

## 📢 차장님 검토 및 피드백 필요 (User Review Required)

> [!IMPORTANT]
> **1. GitHub Actions 우회 크론 Workflow 웹 비활성화 처리 (Human-controlled)**
> * 현재 로컬 코드베이스 및 Git 이력 실사 결과, `.github/workflows/` 디렉토리와 파일은 로컬에 물리적으로 존재하지 않는 것으로 확인되었습니다.
> * 차장님께서 테스트용 원격 저장소(`qms.git` - test-origin) 혹은 GitHub Actions 웹 콘솔에서 직접 수동으로 Workflow를 생성 및 기동하셨을 가능성이 높습니다.
> * 원격의 불필요한 중복 호출 및 과금 방지를 위해, GitHub 웹 UI 상에서 **`[Actions] ➔ [해당 우회 Workflow 선택] ➔ [...] ➔ [Disable Workflow]`** 설정을 통해 수동 비활성화해 주시는 것을 권장해 드립니다.

> [!IMPORTANT]
> **2. 3단계 배포 승인 프로토콜 준수**
> * 최종 실서버 배포(`qms-v2.git` ➔ 메인 Vercel 반영)는 반드시 **[로컬웹 확인] ➔ [테스트웹 확인] ➔ [메인웹 최종 반영]**의 순서를 엄격히 준수합니다.
> * 원격 배포 명령어(`git push`) 기동 직전에 차장님께 **[3단 배포 보고 체크리스트]**를 드려 명시적인 승인 인가를 획득한 후에만 물리적 반영을 수행합니다.

---

## ❓ 오픈 질문 (Open Questions)
* **동기화 URL 및 변수 확인:** 메인 프로덕션 배포 시, Vercel 환경변수(`GOOGLE_SHEETS_CSV_URL`, `VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`)가 Vercel Pro 콘솔상에 정상 등록되어 있는지 배포 직전 단계에서 최종적으로 크로스체크를 진행하겠습니다.

---

## 🛠️ 제안된 변경 사항 (Proposed Changes)

### 1. 백엔드 및 구성 파일 컴포넌트 (Configuration Layer)

#### [MODIFY] [vercel.json](file:///c:/Users/mjjeon/Desktop/QMS%20프로젝트/shinwoo-valve-qms/vercel.json)
* **변경 목적:** 무료 우회용으로 하루 1회 돌려 두었던 네이티브 크론 설정을 **10분 주기**로 대폭 단축하여 실시간에 가까운 정밀 연동을 가동합니다.
* **수정 내용:**
```diff
 {
     "crons": [
         {
             "path": "/api/sync-sheets",
-            "schedule": "0 0 * * *"
+            "schedule": "*/10 * * * *"
         }
     ],
     "rewrites": [
```

---

### 2. GitHub Actions 크론 정리 컴포넌트 (CI/CD Layer)

#### [DELETE] [Hobby 우회용 Actions Cron] (Human-controlled / Web UI 전용)
* **내용:** 로컬 저장소 상에 관련 파일(`.github/workflows/*.yml`)이 존재하는 것으로 식별될 시 `Remove-Item`을 차장님 승인 하에 실행하며, 존재하지 않는 원격 웹 전용일 경우 GitHub 웹 콘솔 상에서 수동 비활성화(Disable) 조치를 인가합니다.

---

## 🔄 피드백 루프 안전장치 (Feedback Loop)
크론 스케줄러가 10분 주기로 호출될 때의 안전성을 담보하기 위해 아래의 4단계 피드백 루프가 계속 동작합니다:
1. **감지 (Detection):** Vercel Serverless Function `/api/sync-sheets` 구동 중 구글 시트 원격 Fetch 에러, Gemini API 토큰 만료 또는 Supabase 트랜잭션 충돌 발생 시 예외를 즉각 Catch합니다.
2. **기록 (Logging):** 에러 로그를 DB 내 `system_logs` 및 Vercel Function Runtime Logs에 정밀 타임스탬프와 함께 기록합니다.
3. **경보 (Alert):** 동기화 중대 결함 시, UI 대시보드 상단에 **[⚠️ 구글 동기화 일시 오류 발생 (이전 저장된 캐시 데이터 표시 중)]** 경보 배너를 노출하여 실시간 인지가 가능하도록 보좌합니다.
4. **결재 (Approval):** 장애 상황에서도 차장님께서 대시보드의 **[수동 즉시 동기화]** 버튼을 통해 안전한 강제 재시도를 즉각 집행하실 수 있도록 보조 컨트롤을 제공합니다.

---

## 🛡️ 3단계 배포 파이프라인 및 단계별 롤백 방안 (Rollback Plan)

```
[1단계: 로컬 포트 정합성 검증] ➔ [2단계: 테스트웹(Staging DB) 반영] ➔ [3단계: 메인웹(Production) 최종 배포]
```

### 1단계: 로컬 포트 검증
* **검증:** 로컬 PowerShell 환경에서 빌드 테스트(`npm run build`) 및 ESLint 문법 린트(`npm run lint`)를 선제 수행하여 무결함을 확정합니다.
* **롤백:** 로컬 빌드 혹은 문법 결함 발생 시, `git checkout` 또는 `git reset --hard`를 통해 로컬 변경분을 즉시 복구합니다.

### 2단계: 테스트웹 배포 검증 (test-origin)
* **검증:** GitHub 테스트 저장소(`qms.git` / test-origin)로 푸시 후, 테스트 Vercel(`shinwoo-valve-qms.vercel.app`)의 10분 주기 크론 동작 정합성 및 Staging DB 연동 상태를 확인합니다.
* **롤백:** 비정상 감지 시, Vercel 콘솔에서 **"이전 성공 배포 버전(Previous Deployment)"**으로 즉시 1초 만에 롤백합니다.

### 3단계: 메인웹 최종 배포 (origin)
* **검증:** 차장님의 3단계 명시적 승인 오더 획득 후, GitHub 실서버 저장소(`qms-v2.git` / origin)로 squash-merge 및 푸시를 실행하여 실서버 Vercel(`shinwoo-valve-qms-v2.vercel.app`) 배포를 완수하고, 실시간 크론 상태를 점검합니다.
* **롤백:** 운영계 사이트 비정상 상태 감지 즉시, Vercel 프로덕션 배포를 이전 성공 빌드로 긴급 롤백하고 Supabase DB는 백업 DDL을 가동해 데이터 정합성을 복구합니다. (파괴적 행위 시 차장님 승인 필수 적용)

---

## 🏁 검증 계획 (Verification Plan)

### Automated Tests (자동화 검증)
* 로컬 PowerShell 빌드 및 린트 검증 명령 실행:
  ```powershell
  # 1. 의존성 무결함 테스트 및 빌드 정상 완료 검증
  npm run build
  # 2. 코드 품질 검사
  npm run lint
  ```

### Manual Verification (수동 검증)
1. 로컬 환경에서 `vercel.json` 수정 후 파일 문법 및 정합성 검토.
2. 3단계 배포 승인 프로토콜에 따라 차장님께 단계별 승인(로컬 -> 테스트웹 -> 메인웹) 요청 및 인가 획득 확인.
3. 배포 완료 후, Vercel Pro 콘솔의 **[Project Settings] ➔ [Crons]** 탭에서 `10분 주기(*/10 * * * *)` 크론 스케줄이 정상 활성화되었는지 스크린샷과 로그로 크로스 검수 보고.
