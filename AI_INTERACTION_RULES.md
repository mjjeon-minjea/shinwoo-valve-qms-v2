# AI 상호작용 규칙 (AI Interaction Rules)

1.  **언어 (Language)**:
    - 모든 대화와 문서(Task, Plan, Log 등)는 **반드시 한국어**로 작성한다.
    - 영어로 된 기술 용어는 필요 시 괄호 병기하되, 설명은 한국어로 한다.
    - 예외: 코드 내 주석이나 커밋 메시지는 프로젝트 컨벤션을 따른다.

2.  **검증 (Verification)**:
    - 모든 계획(Plan)은 사용자에게 제시하기 전에 **"내가 한 말이 맞나?"** 다시 한번 자가 검증한다.
    - 특히 실행 계획이 실제로 구현 가능한지(파일 경로, API 존재 여부 등) 사전에 확인한다.

3.  **오류 방지 및 재발 방지 (Prevention)**:
    - 동일한 실수가 2회 이상 반복되면, 즉시 작업을 멈추고 원인을 분석하여 사용자에게 보고한다.
    - "죄송합니다"만 반복하지 않고, 구체적인 개선책(Rule 업데이트 등)을 실행한다.

This file documents the preferences and rules for AI assistants interacting with this codebase.

## 1. Language & Communication

- **Primary Language**: All responses, explanations, and conversation must be in **Korean (한국어)**.
- **Exceptions**: Code comments, commit messages, and variable names should remain in English (or as per existing codebase patterns), but the explanation _about_ them must be in Korean.
- **Tone**: Professional, concise, and helpful.

## 2. Project Context

- **Project**: QMS (Quality Management System) for Shinwoo Valve.
- **Stack**: React, Node.js, JSON Server / Supabase.

## 3. Workflow

- Always check `task.md` (if active) for current progress.
- Respect existing file structure.
