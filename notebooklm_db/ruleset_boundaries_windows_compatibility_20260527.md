# [절대 룰셋 (SOP)] ESLint Boundaries Windows 경로 충돌 방지 및 검증 규칙 (2026-05-27)

* **룰셋 ID:** `ruleset_boundaries_windows_compatibility_20260527`
* **최종 갱신일:** 2026-05-27
* **적용 대상:** 향후 프론트엔드 및 AI 아키텍처 제약 관리 표준 운영 절차 (SOP)

---

## 1. 개요 및 목적
Windows OS의 경로 구분자(`\`)와 Linux/macOS의 경로 구분자(`/`) 간의 불일치로 인해, `eslint-plugin-boundaries`에서 root 폴더 파일(예: `src/App.jsx`, `src/main.jsx`)을 어떤 zone 패턴에도 매칭하지 못하고 `boundaries/no-unknown-files` 에러를 뿜는 드리프트 현상이 확인되었습니다. 이를 해결하고 향후 정합성을 지키기 위한 절대 룰셋을 정의합니다.

## 2. 필수 준수 지침 (SOP)

### [지침 1] boundaries/no-unknown-files 규칙의 완화
* **규칙:** `.eslintrc.cjs` 내에서 `boundaries/no-unknown-files` 규칙 강도는 절대 `'error'`로 고정하지 마라.
* **이유:** 경로 구분자 파싱 오류로 인한 예상치 못한 로컬 빌드 중단을 방지하기 위해 항상 `'warn'` 상태로 유지하여 유연하게 대처한다.

### [지침 2] boundaries 아키텍처 위반 0건 자가 검증 표준 절차
에이전트 또는 개발자가 하네스 작업을 완료한 경우, 반드시 다음 절차를 거쳐 boundaries 에러 무결성을 전수 확인해야 한다.
1. `package.json`의 JSON 무결성 실측 검사:
   ```powershell
   node -e "require('./package.json'); console.log('JSON OK')"
   ```
2. 프로젝트 린트의 에러 0건(Clean) 여부 실측 검사:
   ```powershell
   npm run lint
   ```
   - 최종 결과에서 **"0 errors"** 문구를 직접 눈으로 식별하고 검출하여, 단순 경고(warnings) 개수가 max-warnings 범위 내인지 확인 완료할 것.

### [지침 3] Locked Surface 영역 수정 엄격 제한
* `.eslintrc.cjs` 등 하네스 고정 파일은 에이전트 단독 수정이 불가하며, 수정 필요시 반드시 차장님의 승인 하에 안전이 검증된 형태의 로직만을 대행 이식한다.
