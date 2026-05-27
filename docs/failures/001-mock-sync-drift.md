# [Failure-001] 로컬 JSON 서버와 express Gateway 간의 동기화 지연 및 스키마 싱크 드리프트

## 1. 개요 (Background)
* **발생 일시:** 2026-04-07
- **현상:** 로컬 개발 환경에서 `concurrently`를 구동하여 `json-server`(포트 3001)와 `express Gateway`(포트 5000)를 병렬 실행할 때, 특정 UI 컴포넌트의 POST 요청이 성공했으나 실시간 테이블 목록 갱신에 실패하거나 이전 상태(Stale)가 그대로 조회되는 드리프트(Drift) 오작동이 반복 발생함.

## 2. 근본 원인 (Root Cause)
1. **비동기 파일 IO 지연:** `json-server`는 메모리 DB가 아닌 실물 로컬 `db.json` 파일에 쓰기(Write) 동작을 수행합니다. 
2. **동기화 병목:** `express Gateway` 프록시 레이어를 통해 우회 요청이 들어올 때, 게이트웨이가 응답(HTTP 200 OK)을 방출하는 속도가 `json-server`가 로컬 `db.json` 물리 파일 쓰기를 완료하고 OS 캐시를 플러시(Flush)하는 속도보다 빨랐습니다.
3. **드리프트 유발:** 결과적으로 UI 측에서 200 응답 수신 직후 곧바로 재조회(GET) 요청을 보냈을 때, 게이트웨이가 아직 파일 쓰기가 미완성된 Stale 상태의 `db.json`을 읽어 반환함으로써 화면에 신규 데이터가 보이지 않는 동기화 드리프트 현상이 발생한 것입니다.

## 3. 영구 방지 및 대책 (Remediation)
* **해결 조치 1 (Optimistic UI State Merge):**
  UI 컴포넌트에서 데이터 등록/수정 요청 성공 시, 단순히 재조회에만 의존하지 않고 서버 응답으로 리턴된 신규 생성 객체를 로컬 React State 배열에 **즉각 수동 병합(Push)**하여 렌더링하도록 뷰 구조를 개선하였습니다.
* **해결 조치 2 (Network Throttle & Debounce):**
  재조회 트리거 펑션에 최소 `150ms` 수준의 디바운스(Debounce) 윈도우를 확보하여 OS 파일 쓰기가 안전하게 완료된 후 게이트웨이가 조회하도록 보장하는 안전망을 추가하였습니다.

## 4. 성찰 및 예방
- 데이터베이스 트랜잭션과 실물 IO 간의 지연 편차는 로컬 개발 서버에서 흔히 간과하기 쉬운 단골 실패 패턴입니다.
- 이 대책은 하네스 룰셋 [.agent/rules/04_harness_constraints.md](file:///C:/Users/mjjeon/Desktop/QMS%20프로젝트/shinwoo-valve-qms/.agent/rules/04_harness_constraints.md)에 정식 등재되어 향후 비동기 동기화 로직 구현 시 에이전트의 망각을 원천 차단하게 됩니다.

---
* **최종 조치일:** 2026-04-07
* **기록자:** 품질보증부 안티그래비티
