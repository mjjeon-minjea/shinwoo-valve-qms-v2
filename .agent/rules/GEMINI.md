# [신우밸브 QMS 전용 아키텍처 인덱스]

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

## 3. GitHub (Commit / Push) 배포 파이프라인 지침
에이전트는 차장님의 지시에 따라 아래 3가지 환경에 맞추어 작업을 분리하여 수행하고 배포해야 한다.

> 🛡️ **[안전장치 필수: 배포 전 3단 검증]**
> 테스트 배포 및 실서버 배포를 위한 `git push` 명령어를 실행하기 직전에, 에이전트는 반드시 아래 3가지 항목을 차장님께 보고하고 **승인(맞아, 진행해 등)**을 받아야 한다.
> 1. **현재 연결된 Git 주소 확인:** `git remote -v` 결과가 `shinwoo-valve-qms-v2.git`가 맞는지 확인
> 2. **타겟 브랜치 확인:** 테스트 배포면 `test`, 실서버 배포면 `main` 브랜치가 맞는지 확인
> 3. **반영될 최종 웹 주소:** (Test: Preview 임시 주소 / Main: shinwoo-valve-qms-v2.vercel.app)

1. **로컬 개발 (지시 예: "로컬에서 만들어줘")**
   - 브랜치 변경 및 Commit/Push 없이 로컬 파일만 수정 (`npm run dev`용)
2. **테스트 배포 (지시 예: "테스트 웹에 올려봐")**
   - `test` 브랜치 체크아웃 ➔ Commit ➔ **(배포 전 3단 검증 보고 및 승인 대기)** ➔ `git push origin test` 실행
   - Vercel의 Preview DB(구형)와 연결된 임시 테스트 주소가 생성됨
3. **실서버 배포 (지시 예: "메인 웹에 반영해")**
   - `main` 브랜치로 Merge ➔ Commit ➔ **(배포 전 3단 검증 보고 및 승인 대기)** ➔ `git push origin main` 실행
   - Vercel의 Production DB(신규)와 연결된 실제 운영 주소가 업데이트됨
