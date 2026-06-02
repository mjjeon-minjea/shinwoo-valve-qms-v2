# 🗺️ 신우밸브 QMS v2 워크스페이스 마스터 규칙 (GEMINI.md)

## ⚖️ 1. 전역 규칙 상속 선언 (Inheritance)
- 본 워크스페이스 내 모든 에이전트 구동 및 코딩 행위는 PC 최상위 진짜 전역 규칙인 **`C:\Users\mjjeon\.gemini\GEMINI.md`**을 기본 베이스(초헌법)로 삼아 철저히 상속하고 준수한다.

## 🗺️ 2. 하부 개별 규칙 구성 및 참조 이정표 (SOP Navigator)

에이전트는 작업 상황에 따라 아래 표에 지정된 경로의 하부 규칙을 1순위로 탐색하고 읽어야 한다.

| 상황별 작업 유형 | 참조할 개별 규칙 파일 | 정확한 물리적 보관 경로 |
| :--- | :--- | :--- |
| **코딩 스타일 검수 및 패키지 분석 시** | **01** (기술 스택 룰) | `.agent/rules/01_tech_stack.md` |
| **Plan/Task/Walkthrough 결재 청구 및 배포 시** | **02** (결재 및 배포 룰) | `.agent/rules/02_dnas_process.md` |
| **대화 종료 및 지식 자산화 추출 명령 시** | **03** (지식 아카이빙 룰) | `.agent/rules/03_archiving.md` |
| **잠긴 표면 검사 및 영구 금지 규칙 위반 방지 시** | **04** (하네스 제약 룰) | `.agent/rules/04_harness_constraints.md` |
