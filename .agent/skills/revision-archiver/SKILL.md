---
name: revision-archiver
description: QMS 마크다운 문서 4종(Plan, Task, Walkthrough, Report)의 리비전 자동 관리 스킬
triggers:
  - 아카이빙
  - 리비전
  - revision
  - plan
  - task
  - walkthrough
  - report
---

# Skill: Revision Archiver (revision-archiver)

## 1. 동작 원리
본 스킬은 에이전트가 `implementation_plan` 및 `walkthrough` 문서를 생성하거나 저장할 때, 수동 덮어쓰기를 방지하고 리비전을 자동 제어하는 도구입니다.

## 2. 세부 실행 프로토콜 및 저장 규칙
1. **대상 도메인별 저장 경로 규격**:
   - **Plan (기획안)** ➔ `C:\Users\mjjeon\Desktop\QMS 프로젝트\shinwoo-valve-qms\안티그래비티\plan\`
   - **Task (작업 명세)** ➔ `C:\Users\mjjeon\Desktop\QMS 프로젝트\shinwoo-valve-qms\안티그래비티\task\`
   - **Walkthrough (완료 보고)** ➔ `C:\Users\mjjeon\Desktop\QMS 프로젝트\shinwoo-valve-qms\안티그래비티\walkthrough\`
   - **Report (특별 분석 보고)** ➔ `C:\Users\mjjeon\Desktop\QMS 프로젝트\shinwoo-valve-qms\안티그래비티\report\`

2. **명명 및 리비전 보증 공식**:
   - 마크다운 파일 작명 표준: `YYYY-MM-DD_[주제명]_R[N].md`
   - 스캔 시 리비전 검출용 정규식: `_R(\d+)`
   - **주제 동일성 판정 규칙**: 파일 목록 조회 후, 파일명의 날짜(YYYY-MM-DD)와 리비전(`_R\d+`)을 정규식으로 소거하고 공백 및 특수문자를 제거한 핵심 키워드 문자열이 기존 파일과 100% 일치할 경우 동일 주제군으로 강제 인식하여 R 번호를 1 증가시킨다. (일치하지 않으면 R0로 신설)
