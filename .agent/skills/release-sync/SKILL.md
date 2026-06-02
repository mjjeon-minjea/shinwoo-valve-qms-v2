---
name: release-sync
description: >
  QMS 과업 완료 시 차장님의 DNAS [P12] 프로토콜을 수행하여
  완료 보고서 핵심 요약을 docs/ 정식 폴더로 이관하고, 로컬 SQLite DB(release_log 테이블)에
  단순 데이터 쓰기(DML INSERT/UPDATE)를 자동 위임 수행해 주는 동기화 스킬.
triggers:
  - 동기화
  - sync
  - release
  - 개발자노트
  - P12
---

# Skill: Release Sync (release-sync)

## 1. 동작 원리
본 스킬은 차장님의 DNAS [P12] 개발자 노트 릴리즈 프로토콜을 수행하여, 완료 보고서를 SQLite DB 및 인트라넷 정식 문서로 비동기 동기화하는 도구입니다.

## 2. 세부 실행 프로토콜
1. 에이전트가 완성한 완료 보고서(Walkthrough)의 핵심 내용(원인, 대책, 결과)을 구조화하여 발췌합니다.
2. 정식 릴리즈 폴더(`docs/`) 하위에 해당 문서를 이식 확정합니다.
3. 로컬 `shinwoo.db` 내 `release_log` 테이블에 DML 비동기 갱신 작업을 직접 수행합니다.
4. 실서버 동기화 상태 및 노출 URL 결과를 크로스체크하여 차장님께 최종 릴리즈를 서면 보고합니다.
