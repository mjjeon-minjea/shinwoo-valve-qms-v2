---
name: antigravity-browser-guide
description: 안티그래비티 자체 브라우저(CDP 9222) 조작, 스크린샷 캡처 및 브라우저 녹화 아카이빙 표준 지침
---

# Antigravity Browser Control & Media Capture Guide (antigravity-browser-guide)

본 문서는 안티그래비티 AI 에이전트가 자체 브라우저(CDP 9222 포트 연동)를 제어하고, UI 검증 및 E2E 시연에 필수적인 **"Screenshots(스크린샷)"** 및 **"Browser Recordings(브라우저 녹화)"** 기능을 오작동 없이 안전하게 사용하기 위한 전역 표준 룰북입니다.

---

## 1. 🔌 안티그래비티 자체 브라우저 CDP 9222 연동 표준

에이전트는 E2E 테스트 및 브라우저 조작 시, 로컬 PC 시스템의 안정성을 최상위 가치로 두며 아래 프로토콜을 반드시 이행합니다.

### ① 독립 쌩 크롬 물리적 기동 영구 금지
- `chromium.launch({ headless: false })` 등을 사용하여 임의의 개별 브라우저 창을 띄우는 꼼수 개발 및 시연 행위는 금지합니다.
- 반드시 IDE 내장 관제 뷰어가 구동하는 디버깅 포트(`127.0.0.1:9222`)에 접속해야 합니다.

### ② CDP 새 탭 개설 및 수명 주기 안전장치
- Playwright `connectOverCDP`를 활용하여 이미 대기 중인 내장 브라우저 세션을 상속받습니다.
- 교착 방지를 위해 부모 브라우저 전체를 끄는 `browser.close()`의 호출은 금지하며, **생성된 시연용 새 탭(`page.close()`)만 물리적으로 종료**하여 리소스를 클린 반환합니다.

```javascript
const { chromium } = require('playwright');

// [정석 연동 템플릿]
const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const context = browser.contexts()[0];
const page = await context.newPage(); // 내장 브라우저 화면 옆에 새 탭 추가

try {
  await page.goto('https://shinwoo-valve-qms-testweb.vercel.app');
  // ... 로그인 및 E2E 테스트 검증 진행 ...
} finally {
  if (page) {
    await page.close(); // 새 탭만 안전하게 닫아 부모 CDP 프로세스 보존
}
```

### ③ E2E 테스트 도구 이원화 운영 규정 (자가 진단 vs 통합 관제)
에이전트는 브라우저 검증 및 E2E 구동 시, 그 성격과 목적에 따라 아래와 같이 두 도구를 엄격하게 분리 및 표준화하여 교차 운용해야 합니다.

1. **로컬 스크립트 (`record-login.cjs`) 사용 기준:**
   - **용도:** 오직 서버 정상 생존 여부 판별(Health Check) 및 AI 미가동 시 차장님 단독 구동용 **'자가 진단 검사 장비'**로만 그 성격과 목적을 철저히 제한하여 운용합니다.
   - **특징:** 본 명령은 단순 소켓 제어이므로 IDE 비디오 레코딩이 수반되지 않으며, 단순 소스 코드 디버깅 및 서버 생존 여부 판별 용도로만 한정적으로 가동합니다.
2. **내장 에이전트 (`browser_subagent`) 사용 기준:**
   - **용도:** 상기 자가 진단 목적 이외의 모든 E2E 실증, 비주얼 시연, UI 무결성 및 품질 증빙을 수반하는 모든 검증 과정은 **무조건 안티그래비티 자체 내장 `browser_subagent` 도구**만을 통하여 기동합니다.
   - **특징:** IDE 관제 센터가 강제 결합하여 실시간으로 화면의 모든 프레임 데이터 스트림을 가로채 WebP 애니메이션 파일로 인코딩하며, 이를 최종 완료 보고서(Walkthrough)의 물리 증빙으로 영구 축적합니다.

---

## 2. 📸 Screenshots (스크린샷) 기능 표준 지침

UI 스타일 변경, 주요 기능 구현, 또는 예외 현상이 발생했을 때 시각적 무결성을 입증하기 위해 스크린샷 캡처를 다음과 같이 수행합니다.

### ① 스크린샷 캡처 및 저장 경로
- Playwright API의 `page.screenshot({ path: '...' })`을 사용하여 시각 증빙을 캡처합니다.
- **저장 경로:** 반드시 안티그래비티 활성 대화창의 아티팩트 디렉토리 (`C:\Users\mjjeon\.gemini\antigravity-ide\brain\<conversation-id>\`) 하위로 설정합니다.

### ② 마크다운 및 완료 보고서 임베드 표준
- 스크린샷이 확보되면, 차장님의 신속한 품질 검토와 양방향 피드백을 위해 `walkthrough.md`나 주요 기획서에 아래 표준 규격으로 이미지를 물리 임베드하여 보고합니다.
- **규격:** `![설명 및 캡처 내용](file:///절대경로/파일명.png)` (반드시 absolute path 및 caption 사용)

---

## 3. 🎥 Browser Recordings (브라우저 녹화) 기능 표준 지침

사용자 흐름 E2E 테스트, 양식 작성 자동화 등 동적인 브라우저 조작 시연 시, 신우밸브 품질 표준 증빙을 위해 비디오 녹화를 병행합니다.

### ① browser_subagent 연동 녹화
- 에이전트는 동적 시연 요구 수령 시, 자체 내장된 `browser_subagent` 도구를 실행합니다.
- `RecordingName` 파라미터에 과업을 설명하는 통상적인 표준 명칭(예: `qms_browser_login`, `qms_inspection_registration` 등)을 명확하게 정의하여 호출합니다.

### ② 녹화 비디오 아티팩트 보존 및 임베드
- `browser_subagent` 구동 시 생성되는 WebP 브라우저 녹화 비디오는 자동으로 아티팩트 디렉토리에 저장됩니다.
- 시연 완료 보고 시, 최종 완료 보고서(Walkthrough)의 물리적 증빙 섹션에 해당 WebP 파일의 절대 경로를 마크다운 이미지 임베드 형식(`![시연 녹화본](file:///절대경로/파일명.webp)`)으로 삽입하여 시각적 증빙을 완성합니다.

---

## 4. 🧹 리소스 및 포트 충돌 자가 해결 지침 (CAPA)

만약 메모리 유령 크롬 잔존이나 9222 포트 교착으로 인해 레코딩 서브에이전트가 진입하지 못하는 등 비정상 동작 발생 시, 다음 자가 시정 절차를 수행합니다.

### ① 좀비 프로세스 전수 강제 살해 (Stop-Process)
- PowerShell 터미널을 통해 포트를 점유 중인 좀비 프로세스들을 즉시 청소합니다.
  ```powershell
  Stop-Process -Name "chrome", "node" -Force -ErrorAction SilentlyContinue
  ```

### ② 디버깅 포트(9222) 해방 확인
- 프로세스 청소 후, 통신 채널이 완전히 해방되었는지 아래 진단 명령어로 크로스 체크를 수행합니다.
  ```powershell
  Get-NetTCPConnection -LocalPort 9222 -ErrorAction SilentlyContinue
  ```
- 결과가 **완전한 공백**으로 떨어져 9222 포트의 깨끗한 격리 상태가 확보된 상태에서 안티그래비티 IDE 프로그램을 재기동하고 작업을 이어나갑니다.
