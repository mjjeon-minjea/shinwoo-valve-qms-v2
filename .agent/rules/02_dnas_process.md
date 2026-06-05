# QMS DNAS Approval Process & Deployment (02)

## 1. 3단계 결재 프로세스 (DNAS) 및 스킬 연동 강령
어떠한 경우에도 기능 추가/수정 진행 시 아래 3단계 공식 보고 절차와 전용 스킬 연동을 절대 생략할 수 없다.

1. **`Plan` (기획안 송출)**: 
   - 변경할 파일, 충돌 위험성을 분석하여 `implementation_plan` 규격으로 UI에 띄워 차장님의 승인 결재를 받아야 한다.
   - 송출 직전 반드시 `plan-self-review` 스킬(경로: `.agent/skills/plan-self-review/SKILL.md`)을 실행하여 결함 0건을 검증해야 하며, 확정된 Plan은 `revision-archiver` 스킬(경로: `.agent/skills/revision-archiver/SKILL.md`)을 호출하여 `안티그래비티\plan\` 폴더에 리비전 파일로 아카이빙한다.

2. **`Task` (작업 명세 송출)**: 
   - 기획이 컨펌되면 실제 코드 수정 전 `task` 규격 문서로 Step을 마킹한다.
   - 확정된 Task는 `revision-archiver` 스킬을 사용하여 `안티그래비티\task\` 폴더에 리비전 파일로 아카이빙한다.

3. **`Walkthrough` (최종 보고서)**: 
   - 개발 및 시운전이 끝나면 최종 결과를 브리핑한다.
   - 완료보고서는 필수적으로 4대 표준 서식(① 반영 내역 요약, ② 반영 결과 요약, ③ 검증 계획 요약, ④ 검증 결과 요약)을 준수하여 작성하며, `revision-archiver` 스킬을 사용하여 `안티그래비티\walkthrough\` 폴더에 리비전 파일로 아카이빙한다.

## 2. 프로세스 예외 조항 (Exceptions)
1. **단순 로컬 서버 조작 면제**: 로컬 개발 서버 및 n8n 서버의 구동, 종료, 상태 확인 등의 단순 환경 조작 행위는 3단계 결재 프로세스 적용 대상에서 **전면 제외**하며, 차장님의 구두 지시 즉시 백그라운드 태스크로 즉각 실행한다.

## 3. 다단계 승인 배포 프로토콜 (MANDATORY)
에이전트는 3단계 배포 승인 절차를 절대 어길 수 없으며 다음의 순서와 잠금 조건을 무조건 이행한다:
1. **배포 기둥 (로컬 ➔ 테스트 ➔ 메인)**: 모든 웹 배포 작업은 **[로컬웹 확인] ➔ [테스트웹 확인] ➔ [메인웹 확인]**의 3단계 물리적 순서를 고수한다.
2. **단계별 차장님 승인 잠금**: 각 확인 단계마다 전민재 차장님의 **명시적 승인 오더(예: "로컬웹 확인 완료, 테스트웹 올려줘" 등)**가 대화창에 기록되기 전까지, 에이전트는 깃 푸시(git push) 등 원격 웹 반영 명령을 단독으로 절대 호출 또는 수행할 수 없다.

## 4. 스킬 실행 안내 및 자동 위임

### 4-1. 도메인별 작성(Authoring) 스킬 — 작성 시 반드시 호출
- 본 프로젝트의 문서 4종은 작성 시점에 아래 전용 스킬을 호출하여 작성한다.
  단, 각 스킬의 기본 저장경로·언어·전제는 무시하고, 아래 QMS 규격을 강제 우선한다.
  - **Plan (기획안)** ➔ `writing-plans` 스킬 / 저장 `안티그래비티\plan\` / 한글 implementation_plan 형식
    * *작성 트리거*: 방향성이 완전히 합의되고 차장님께서 명시적으로 **"플랜 가져와라"**고 오더를 하셨을 때에만 정식 Plan을 수립한다. (사전 독단 작성 절대 금지)
  - **Task (작업 명세)** ➔ `planning-with-files` 스킬 / 저장 `안티그래비티\task\` / 한글 DNAS YYYY-MM-DD_[과업주제]_R[N].md 표준 및 task Step 형식
  - **Walkthrough (완료 보고)** ➔ `internal-comms` 스킬 / 저장 `안티그래비티\walkthrough\` / 한글 DNAS YYYY-MM-DD_[주제명]_R[N].md 표준 및 완료보고 4대 표준 서식
  - **Report (특별 분석 보고)** ➔ `doc-coauthoring` 스킬 / 저장 `안티그래비티\report\` / 한글 DNAS YYYY-MM-DD_[주제명]_R[N].md 표준 및 분석보고 형식
    * *작성 트리거*: (1) 대화창 답변 분량이 **2000자**를 초과할 때, 또는 (2) 전민재 차장님이 명시적으로 **"분석해서 보고해줘"** 또는 **"검토해서 보고해줘"**라고 명령하실 때에만 작성한다.
    * *아티팩트화 필수 조항*: 보고서 형식의 결과물을 송출할 때는, 사용자의 시각적 검토 편의성을 극대화하기 위해 대화창에 반드시 **아티팩트(Artifact) 컴포넌트**로 보고서 전문을 감싸서 함께 제공해야 한다.

### 4-2. 작성 후 관리·동기화 위임 (기존 유지)
  - Plan/Task/Walkthrough/Report 리비전 관리 ➔ `revision-archiver` 스킬
  - 이미지 자동화 보관 ➔ `image-archiver` 스킬
  - 릴리즈 인트라넷 동기화 ➔ `release-sync` 스킬
  - 기획안 제출 전 자가검토(필수) ➔ `plan-self-review` 스킬

### 4-3. 표준 연계 순서
  - Plan: writing-plans 작성 ➔ plan-self-review(High 0건) ➔ revision-archiver(버전)
  - Task: planning-with-files 작성 ➔ revision-archiver
  - Walkthrough: internal-comms 작성 ➔ revision-archiver ➔ release-sync(동기화)
  - Report: doc-coauthoring 작성 ➔ revision-archiver
