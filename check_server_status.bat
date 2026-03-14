@echo off
chcp 65001 >nul
echo ===================================================
echo              QMS 서버 구동 상태 점검
echo ===================================================
echo.

set FRONTEND_RUNNING=0
set BACKEND_RUNNING=0

netstat -ano ^| findstr "LISTENING" ^| findstr ":5173 " >nul
if %errorlevel% equ 0 (
    set FRONTEND_RUNNING=1
    echo [OK] 프론트엔드 서버(Vite, 포트 5173) : 정상 실행 중
) else (
    echo [FAIL] 프론트엔드 서버(Vite, 포트 5173) : 꺼져 있음!
)

netstat -ano ^| findstr "LISTENING" ^| findstr ":3001 " >nul
if %errorlevel% equ 0 (
    set BACKEND_RUNNING=1
    echo [OK] 백엔드 API 서버(JSON Server, 포트 3001) : 정상 실행 중
) else (
    echo [FAIL] 백엔드 API 서버(JSON Server, 포트 3001) : 꺼져 있음!
)

echo.
echo ===================================================
if %FRONTEND_RUNNING% equ 1 (
  if %BACKEND_RUNNING% equ 1 (
    echo 모든 서버가 정상적으로 켜져 있습니다. 브라우저로 접속 가능합니다!
    echo 프론트엔드 주소: http://localhost:5173
  ) else (
    echo 백엔드 서버가 꺼져 있습니다. 데이터 연동이 안 될 수 있습니다.
  )
) else (
  echo 하나 이상의 서버가 꺼져 있습니다. 
  echo 개발 환경을 실행하려면 터미널 창을 두 개 열고 각각 아래 명령어를 입력하세요:
  echo 1. npm run dev
  echo 2. node server.js
)
echo ===================================================
pause
