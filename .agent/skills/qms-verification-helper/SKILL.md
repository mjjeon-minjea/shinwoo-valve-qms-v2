---
name: qms-verification-helper
description: QMS 시스템의 통합 동작 검증, 디버깅 및 에러 트래킹을 제어하는 규칙 스킬.
---

# 🛠️ QMS 통합 검증 및 디버깅 규칙 (qms-verification-helper)

본 스킬은 에이전트가 코드를 커밋하거나 차장님께 최종 완료 보고를 올리기 전, 코드의 무결성 및 통합 동작을 입증하기 위한 정형화된 검증 규격입니다.

## 1. 구현 완료 전 자동 검증 (Verification Before Completion)
- 에이전트는 과업이 완료되었다고 주장하거나 커밋을 작성하기 전, 반드시 다음 검증 스크립트를 수동으로 구동하여 빌드 및 연동에 실패 에러가 없는지 팩트로 입증해야 합니다.
```powershell
node .agent/skills/qms-orchestrator/scripts/check-structure.js
node .agent/skills/qms-orchestrator/scripts/verify-integration.js
```
- 모든 검증 결과 로그는 완료 보고서(Walkthrough)의 '검증 결과 요약' 섹션에 물리적인 증빙으로 박제해야 합니다.

## 2. 체계적 디버깅 (Systematic Debugging)
- 빌드 에러 및 테스트 실패가 수신되면, 코드를 주먹구구식으로 고쳐보는 행위를 엄격히 금지합니다.
- 반드시 [증상 ➡️ 기술적 원인 분석 ➡️ 임시 가설 수립 및 테스트 ➡️ 영구 픽스 적용] 순으로 디버깅을 전개하며, 해결 즉시 트러블슈팅 이력(`troubleshoot_*.md`)으로 지식 자산화합니다.
