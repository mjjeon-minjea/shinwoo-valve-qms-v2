---
name: shinwoo-memory-system
description: >
  신우밸브 AI 시스템 통합 메모리 스킬.
  대화 종료/시작 시 HANDOFF.md, error-registry.md, decision-log.md를 동기화하고
  날짜별 로그를 자동 저장하여 대화 간 컨텍스트 유실을 방지합니다.
triggers:
  - 기억해
  - 저장해
  - 종료해
  - 이어서
  - HANDOFF
---

# 신우밸브 통합 메모리 시스템 스킬

## Antigravity 2.0 환경 주의사항

> Hooks(PreToolUse, PostToolUse 등)는 Antigravity에서 자동 작동하지 않습니다.
> 이 스킬의 모든 절차는 AI가 rules/GEMINI.md의 지시에 따라 대화 중에 "수동으로" 실행합니다.

---

## 핵심 원칙

1. **실수는 반드시 레지스트리에 기록** — 단순 사과나 인정으로 끝내지 않는다.
2. **추론 금지** — 접속 정보, 인프라 현황은 파일 확인 후 판단.
3. **계층적 기억**:
   - Level 1: `HANDOFF.md` — 현황 요약 (매 대화 필수)
   - Level 2: `shinwoo-decision-log.md` — 결정 이유 (필요 시)
   - Level 3: `shinwoo-error-registry.md` — 실수 방지 (매 대화 필수)
   - Level 4: `logs/YYYY-MM-DD/` — 전체 원문 (검색용)

---

## 새 대화 시작 절차 (Session Start Protocol)

### Step 1: 실수 레지스트리 읽기 (원천 차단)
- 경로: `c:\Users\mjjeon\Desktop\QMS 프로젝트\shinwoo-valve-qms\shinwoo-system\shinwoo-error-registry.md`

### Step 2: HANDOFF.md 읽기 (현황)
- 경로: `c:\Users\mjjeon\Desktop\QMS 프로젝트\shinwoo-valve-qms\shinwoo-system\HANDOFF.md`

### Step 3: 결정 로그 읽기 (맥락)
- 경로: `c:\Users\mjjeon\Desktop\QMS 프로젝트\shinwoo-valve-qms\shinwoo-system\shinwoo-decision-log.md`

### Step 4: 현황 보고 후 시작
```
📋 현황 확인 완료
- 현재 Phase: [XX]
- 다음 작업: [XX]  
- 주의(error-registry 기반): [XX]
```

---

## 종료 절차 (기억해/저장해/종료해 호출 시)

1. `HANDOFF.md` 갱신 (확인된 값만, 추측 금지)
2. 이번 대화 실수 ➔ `error-registry.md`에 `ERR-[번호]` 추가
3. 중요 결정 ➔ `decision-log.md`에 `DEC-[번호]` 추가
4. 날짜별 로그 저장 안내:
   - PowerShell 실행: `c:\Users\mjjeon\Desktop\QMS 프로젝트\shinwoo-valve-qms\shinwoo-system\save-daily-log.ps1`
5. 저장 완료 보고

---

## 실수 발생 즉시 처리

1. `error-registry.md`에 `ERR-XXX` 즉시 추가
2. 재발 방지 규칙 현재 대화에 즉시 적용
3. 사용자에게 업데이트 완료 보고

---

## 파일 위치 요약

| 파일 | 경로 |
|------|------|
| HANDOFF.md | `c:\Users\mjjeon\Desktop\QMS 프로젝트\shinwoo-valve-qms\shinwoo-system\HANDOFF.md` |
| 실수 레지스트리 | `c:\Users\mjjeon\Desktop\QMS 프로젝트\shinwoo-valve-qms\shinwoo-system\shinwoo-error-registry.md` |
| 결정 로그 | `c:\Users\mjjeon\Desktop\QMS 프로젝트\shinwoo-valve-qms\shinwoo-system\shinwoo-decision-log.md` |
| 날짜별 로그 | `c:\Users\mjjeon\Desktop\QMS 프로젝트\shinwoo-valve-qms\shinwoo-system\logs\YYYY-MM-DD\` |
| 로그 스크립트 | `c:\Users\mjjeon\Desktop\QMS 프로젝트\shinwoo-valve-qms\shinwoo-system\save-daily-log.ps1` |
