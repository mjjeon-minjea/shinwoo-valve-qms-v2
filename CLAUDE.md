# [GEMINI 지역 규칙]

> **🚨 [절대 조항]**
> 차장이 명시적으로 [보고 생략]을 지시하지 않는 이상, 단순 텍스트 수정이든 스킬 이식이든 무조건 3단계 문서(implementation_plan, task, walkthrough)를 발행하여 결재를 받아야 한다. 자의적 판단에 의한 생략은 절대 금지한다.

## Skills

커스텀 검증 및 유지보수 스킬은 `.agent/skills/`에 정의되어 있습니다.

| Skill | Purpose |
|-------|---------|
| `verify-implementation` | 프로젝트의 모든 verify 스킬을 순차 실행하여 통합 검증 보고서를 생성합니다 |
| `manage-skills` | 세션 변경사항을 분석하고, 검증 스킬을 생성/업데이트하며, CLAUDE.md를 관리합니다 |
| `merge-worktree` | 현재 worktree 브랜치를 main(또는 지정 대상) 브랜치로 squash-merge하고 포괄적인 커밋 메시지를 생성합니다 |
