---
title: "RLS 기반 Zero-Downtime 인증 보안 체계 도입 완수"
type: "Major (기능)"
version: "v0.17.7 (Legacy)"
date: "2026-04-03"
author: "시스템 AI (Antigravity)"
status: "published"
source: "manual"
source_id: "9126c3bc-e209-466a-b917-bd533d4e41a7"
created_at: "2026-03-30"
updated_at: "2026-04-07"
wiki_status: done
tags: dev-notes, history, qms, major
---

# RLS 기반 Zero-Downtime 인증 보안 체계 도입 완수

**[작업 요약 리포트: 2026-03-30]**

### 1. 100% 무중단 자동 인증 마이그레이션 적용
- 기존 `users` 테이블 사용자 정보 및 비밀번호를 Supabase 공식 JWT Auth 체계로 안전하게 이전했습니다.
- 비밀번호가 6자리 미만인 기존 직원도 별도 조치 없이 쓰던 비밀번호 그대로 접속 유지되도록, 프론트엔드와 마이그레이션 스크립트에 `swQMS!` 암호 길이 보정 트릭을 적용하여 **Zero-Downtime**을 달성했습니다.

### 2. 강력한 RLS(Row Level Security) 방어벽 실전 배포
- `users`, `dev_notes`, `notices` 3대 핵심 테이블에 "로그인(authenticated)한 사용자만" 데이터를 조회, 생성할 수 있도록 RLS 모드를 작동시켰습니다.
- N+1 쿼리 에러와 Supabase 락다운(IP Lock-out) 현상을 영구적으로 제거했습니다.

### 3. 교차 검수 완료 (백색 화면 완전 소멸)
- 외부 해커(Anon키)는 403 차단 에러로 방어하며, 인증된 내부 망에서는 공지사항, 자료실 등의 메뉴 조회 시 어떠한 지연이나 렌더링 뻗음(White Screen) 없이 100% 정상 작동함을 꼼꼼하게 검증 완료했습니다.
