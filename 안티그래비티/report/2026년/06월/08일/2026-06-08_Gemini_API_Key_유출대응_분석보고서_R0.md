# 📋 Gemini API Key 유출 대응 분석 보고서 (R0)

* **작성일자:** 2026년 06월 08일
* **보고대상:** 신우밸브주식회사 품질보증부 전민재 차장님
* **작성자:** QMS AI 전담 비서 안티그래비티

---

## 🚨 1. 유출 현황 및 원인 분석

### 1.1 유출 경로
* **유출 파일:** `.env.local.bak`
* **유출 커밋 해시:** `fa1decad50711ff94404de1f2847e6bcc2db98a1`
* **원격 저장소 링크:** [GitHub 유출 파일 링크](https://github.com/mjjeon-minjea/shinwoo-valve-qms-v2/blob/fa1decad50711ff94404de1f2847e6bcc2db98a1/.env.local.bak)

### 1.2 발생 원인
* 과거 개발 과정에서 백업 목적으로 생성된 임시 파일인 `.env.local.bak`이 Git 추적 해제(`.gitignore` 적용 및 `git rm --cached`) 조치가 완수되기 전에 커밋되어 원격 저장소 (`main` 및 `staging` 브랜치)로 푸시되었습니다.
* 이로 인해 현재 최신 커밋 상태에서는 해당 파일이 삭제되어 보이지 않지만, **Git의 과거 커밋 히스토리 기록**에 백업 파일의 원본 내용이 영구적으로 보존되어 노출되었습니다.

---

## 🛠️ 2. 긴급 대응 복구 방안 (3단계 조치)

> [!IMPORTANT]
> Git 히스토리를 개정하기에 앞서, 노출된 API Key 자체의 보안 조치가 최우선적으로 실행되어야 합니다.

### [1단계] Google AI Studio 내 API Key 즉시 비활성화 및 신규 발급
* **작업 주체:** 전민재 차장님 (수동)
* **조치 내용:**
  1. [Google AI Studio](https://aistudio.google.com/)에 접속합니다.
  2. 유출 경고가 발생한 API Key (`...NpXM`)를 즉시 **삭제(Delete)**하여 비활성화합니다.
  3. 신규 API Key를 재발급받으신 후, 로컬의 `.env.local` 및 `.env` 파일의 값을 갱신합니다.
     * *주의: 새로 발급받은 API Key가 적힌 `.env.local` 등은 절대로 Git에 다시 커밋되어서는 안 됩니다.*

### [2단계] Git 히스토리 기록 영구 소거 (`git filter-branch`)
* **작업 주체:** AI 에이전트 (차장님 승인 후 수행)
* **조치 내용:** 
  * 로컬 및 원격 저장소 전체 히스토리(모든 브랜치 및 태그)에서 `.env.local.bak` 파일의 흔적을 영구 말살하기 위해 Git 내장 도구를 기동합니다.
  * **실행 명령어 (PowerShell 규격):**
    ```powershell
    git filter-branch --force --index-filter "git rm --cached --ignore-unmatch .env.local.bak" --prune-empty --tag-name-filter cat -- --all
    ```

### [3단계] 원격 저장소 강제 푸시 및 반영 검증
* **작업 주체:** AI 에이전트 (차장님 승인 후 수행)
* **조치 내용:**
  * 히스토리가 개정되면 로컬과 원격의 해시가 어긋나게 되므로 원격 저장소(`origin`)에 강제 푸시를 수행하여 덮어씁니다.
  * **실행 명령어 (PowerShell 규격):**
    ```powershell
    git push origin --force --all
    git push origin --force --tags
    ```
  * 반영 완료 후 브라우저 및 GitHub CLI를 사용하여 해당 유출 커밋 링크가 404로 무력화되었는지 최종 검증을 수행합니다.

---

## 🛡️ 4. 향후 재발 방지 대책

1. **로컬 백업 파일 생성 금지 및 `.gitignore` 엄격화**
   * `.env.local.bak`, `*.bak`, `*.tmp` 와 같은 백업/임시 파일이 저장소 내에 절대 생성되지 않도록 로컬 위생 상태를 항시 감시합니다.
   * 이미 지난 세션(2026-06-06)에서 `.gitignore` 강화를 완료하였으나, 추가로 `*.bak` 패턴을 명시하여 원천 차단합니다.
2. **시크릿 스캔 자동 연동 사전 점검**
   * 커밋 전에 로컬에서 민감 정보(API Key, Token 등) 유출 여부를 감지할 수 있도록, 향후 `git-secrets` 등의 훅(Hook)을 추가로 배치하는 방안을 고려합니다.
