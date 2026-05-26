# [신우밸브 QMS 전용 아키텍처 인덱스]

> **🚨 [절대 조항]**
> 차장이 명시적으로 [보고 생략]을 지시하지 않는 이상, 단순 텍스트 수정이든 스킬 이식이든 무조건 3단계 문서(implementation_plan, task, walkthrough)를 발행하여 결재를 받아야 한다. 자의적 판단에 의한 생략은 절대 금지한다.

## 1. Rules (수동적 제약사항 가이드라인)
QMS 프로젝트의 기술 및 정책 룰은 `.agent/rules/` 트리를 따른다.

| Rule Domain | File Path | Purpose |
|---|---|---|
| Tech Stack & OS | `.agent/rules/01_tech_stack.md` | React, Supabase, PowerShell 제약 및 에러 대응 방식 |
| DNAS Process | `.agent/rules/02_dnas_process.md` | 기획안/보고서 작성 시 3단계(Plan-Task-Walkthrough) 필수 프로세스 |
| Knowledge Archiving | `.agent/rules/03_archiving.md` | 대화 내용 저장(NotebookLM 4대 카테고리) 및 추출 기준 |

## 2. Skills (능동적 검증 및 실행 스킬)
서브 툴 및 커스텀 검증 스크립트는 `.agent/skills/` 트리를 따른다.

| Skill | Purpose |
|-------|---------|
| `verify-implementation` | 프로젝트의 모든 verify 스킬을 순차 실행하여 통합 검증 보고서를 생성합니다 |
| `manage-skills` | 세션 변경사항을 분석하고, 검증 스킬을 생성/업데이트하며, GEMINI.md를 관리합니다 |
| `merge-worktree` | 현재 worktree 브랜치를 main(또는 지정 대상) 브랜치로 squash-merge하고 포괄적인 커밋 메시지를 생성합니다 |
