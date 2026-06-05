---
name: qms-orchestrator
description: QMS 시스템 검증 및 아키텍처 구조 점검을 위한 통합 오케스트레이터 검증 도구 스킬입니다.
triggers:
  - 검증
  - 구조점검
  - 빌드체크
---

# QMS 오케스트레이터 검증 도구 스킬 (qms-orchestrator)

본 문서는 QMS 아키텍처의 정적 구조와 DB 스키마 정합성을 검증하기 위한 오케스트레이터 도구의 사용 지침입니다.

---

## 1. 핵심 원칙
- **구조 변경 사후 검증 필수**: 아티팩트 수정, 신규 스킬 추가 또는 구조 변경을 완수한 즉시, 반드시 본 오케스트레이터의 2대 검증 스크립트를 수동으로 구동하여 드리프트를 감지합니다.
- **예외 발생 시 디버깅 처리**: 빌드 에러나 정합성 불일치가 나타나면 작업을 완료 보고하지 않고 우선 디버깅을 실행합니다.

---

## 2. 검증 스크립트 실행 프로토콜

- **구조 및 가비지 린트 체크**:
  ```powershell
  node .agent/skills/qms-orchestrator/scripts/check-structure.js
  ```
- **원격/로컬 스키마 정합성 검증**:
  ```powershell
  node .agent/skills/qms-orchestrator/scripts/verify-integration.js
  ```
