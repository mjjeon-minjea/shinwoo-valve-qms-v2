# 대화 내용 및 작업 요약 (2026-03-14)

## 주요 진행 사항
- **Process Inspection History (공정 검사 이력)** 피처 구현
  - `ProcessHistory.jsx` 및 `ProcessInspectionDashboard.jsx` 추가
  - MES 엑셀 데이터를 파싱하기 위한 스크립트 작성 (`parse_mes_data.cjs`, `read_excel_temp.cjs`, `read_process_excel.cjs` 등)
  - 공정 데이터 업로드 및 초기화 스크립트 (`upload_process_data.cjs`, `seed_process.js`, `scripts/seed_full_process.js` 등)
- **API 및 서버 수정**
  - `server.js`, `src/lib/api.js` 수정 및 백엔드 연동
- **기타 스크립트 및 위젯**
  - 서버 상태 확인용 스크립트 및 바탕화면 바로가기 관련 파일 추가 (`scripts/QMS_Widget.ps1`, `server-status.bat` 등)

## 현재 상태
위 작업 내용들을 포함하여 모든 변경 사항을 스테이징하고 저장소에 커밋 및 푸시합니다.
