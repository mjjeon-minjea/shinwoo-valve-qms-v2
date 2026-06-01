# 🤝 통합 메모리 (HANDOFF) 이식 및 규칙 융합 작업 명세 (task.md)

* **상태 설명:**
  - `[ ]` 미완료 작업
  - `[/]` 진행 중 작업
  - `[x]` 완료된 작업

---

## 📋 세부 작업 체크리스트

- `[/]` **1단계: 이식 자산 물리 이동 및 사용자화 갱신**
  - `[ ]` `shinwoo-memory-system` 스킬 폴더 생성 및 `SKILL.md` 완제 코드로 이식 생성
  - `[ ]` `shinwoo-system` 프로젝트 폴더 생성 및 4개 자산 이식 (`error-registry.md`, `decision-log.md`, `HANDOFF.md`, `save-daily-log.ps1`)
  - `[ ]` `save-daily-log.ps1` 내부의 윈도우 사용자 `$brainBase` 경로 갱신

- `[ ]` **2단계: 단일 소스 원본(GEMINI.md) 전역 통합 및 소프트 링크 구조화**
  - `[ ]` 전역 `C:\Users\mjjeon\.gemini\GEMINI.md` 파일 하단에 융합 룰셋(사전 경보 장치, 코딩 고삐 등) 정밀 추가 병합
  - `[ ]` 로컬 `.agent/rules/GEMINI.md` 복사본 안전 백업 보관 후 물리적 삭제 (Human-Controlled 승인 획득 필)
  - `[ ]` PowerShell 명령어로 전역 원본을 가리키는 로컬 `SymbolicLink` (소프트 링크) 매핑 및 생성

- `[ ]` **3단계: 시동성 및 신뢰성 검증 (TDD식 실증 검사)**
  - `[ ]` 전역 스킬 라이브러리(`shinwoo-memory-system`) 감지 및 스캔 정상 여부 점검
  - `[ ]` 이식된 `HANDOFF.md`, `error-registry.md`, `decision-log.md` 정상 로드 및 파싱 대화 시연
  - `[ ]` 백업 스크립트(`save-daily-log.ps1`) 백그라운드 구동을 통한 오늘 자 로그 세션 무인 백업 완착 확인

- `[ ]` **4단계: 최종 완료 보고 및 리비전 아카이빙**
  - `[ ]` 3단계 `walkthrough.md` 최종 완료 보고서 발행 및 공식 폴더 이관 보관
