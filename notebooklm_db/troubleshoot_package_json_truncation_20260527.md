# [트러블슈팅] package.json 2107바이트 truncated 물리적 파손 복구 이력 (2026-05-27)

* **트러블슈팅 ID:** `troubleshoot_package_json_truncation_20260527`
* **일자:** 2026-05-27
* **기록 목적:** package.json의 물리적 truncated(잘림) 재발 방지 및 완전 복구 매뉴얼 보존

---

## 1. 증상 (Symptom)
* 이전 작업 및 세션 진행 중, `package.json`이 62줄 "postcss": "^2107" 또는 "lint-stag" 부분에서 물리적으로 뚝 끊겨 닫는 중괄호(`}`)가 유실되는 truncated 현상 발생.
* 이로 인해 모든 npm 명령 실행 시 `EJSONPARSE` 구문 파싱 에러를 뿜으며 개발망과 린트망 전체가 완전히 마비되는 치명적 빌드 다운 현상 관측.

## 2. 기술적 원인 (Technical Cause)
1. **버퍼 및 토큰 유실:** AI 에이전트가 파일 쓰기 도구(`write_to_file` 또는 `replace_file_content`)를 이용하여 package.json 전체를 오버라이트 혹은 덮어쓰기 하는 과정에서 Unix-Windows CRLF 인코딩 혼선 및 쓰기 버퍼 중단으로 인해 물리적인 잘림 발생.
2. **형상 동기화 실패:** 파손된 2107바이트의 `package.json`이 이전 커밋에 그대로 포함되어 형상에 등록되면서, 단순 `git checkout HEAD` 실행 시에도 파손된 파일이 리스토어되어 지속적인 실패 유발.

## 3. 해결 코드 및 복구 절차 (Remediation SOP)

### Step 1: 유효 형상으로의 강제 복구
가장 확실하게 정합성이 증명된 이전의 안전 커밋(`3ca48f9`)을 지목하여 깃(Git)으로부터 package.json의 원본을 강제로 복구 추출합니다:
```powershell
git checkout 3ca48f9 -- package.json
```

### Step 2: 스크립트 재이식 및 크기/바이트 실측
안전하게 복원된 원본 `package.json` 파일의 devDependencies 뒤에 하네스용 스크립트와 prepare, lint-staged 설정을 다시 정확하게 안착시켰습니다.
* **복구 완료 규격:** 총 **76라인**, **2,353바이트** 무결점 확인.

### Step 3: 실측 구동 검증 (Verification)
터미널을 통해 실제 JSON의 정상 파싱 여부를 크로스체크합니다:
```powershell
node -e "require('./package.json'); console.log('JSON OK')"
```
* **성공 지표:** `JSON OK`가 성공적으로 출력되고, `npm run lint`가 `0 errors`로 정상 컴파일되는 것을 실측 확인 후 작업을 종료합니다.
