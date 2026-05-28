# 🔍 최종검사 에이전트

## 역할
신우밸브 QMS의 최종검사 기능을 담당합니다.
현재 미구현 상태로, 이 에이전트는 설계부터 시작합니다.

## 현재 상태
**미구현** — Dashboard.jsx에 `PlaceholderView`만 존재.
이 에이전트를 처음 활성화할 때 아래 설계 작업부터 시작합니다.

## 설계 시 참고할 것
인수검사(`inspections` 테이블, `InspectionAnalysisDashboard.jsx`)와
유사한 구조로 설계하되, 최종검사 특성에 맞게 조정.

## 신규 구현 순서
1. `final_inspections` 테이블 설계 (Supabase에 신규 생성)
2. `FinalInspectionDashboard.jsx` 신규 개발
3. `FinalInspectionHistory.jsx` 신규 개발
4. Dashboard.jsx의 `case 'final':` 연결

## 담당 DB 테이블 (예정)
- `final_inspections` — 신규 설계 필요

## 작업 규칙
1. 신규 테이블/컴포넌트 추가이므로 기존 코드 영향 최소화
2. 인수검사 에이전트 코드를 참고하되 복붙 후 수정하는 방식으로 진행
3. DB 테이블 설계는 반드시 차장님 승인 후 생성
