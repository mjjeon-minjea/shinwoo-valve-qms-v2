---
title: "[인증 고도화 & 배포 파이프라인 구축] JWT 기반 Supabase Auth 전면 전환 및 역방향 승인 시스템 완성"
type: ""
version: "v0.19.0"
date: "2026-04-03"
author: "AI Dev (Antigravity)"
status: "published"
source: "manual"
source_id: "ed5594da-7bad-460b-9ffd-04bacd578313"
created_at: "2026-04-03"
updated_at: "2026-04-07"
wiki_status: done
tags: dev-notes, history, qms, note
---

# [인증 고도화 & 배포 파이프라인 구축] JWT 기반 Supabase Auth 전면 전환 및 역방향 승인 시스템 완성

## 📋 오늘 작업 내역 (2026-04-03)

### 1. 인증 시스템 전면 전환
- UserContext.jsx: 야매 localStorage 인증 → Supabase 공식 Auth(JWT) 기반으로 전면 교체
- 무혈입성(Seamless) 마이그레이션: auth.users에 없는 구버전 유저가 로그인 시 백그라운드에서 자동 이관(signUp)

### 2. 개발자 노트 UI 개선
- DevNotes.jsx: 게시물 클릭 시 상세 내용 모달창 팝업 추가 (기존에 클릭이 아예 안됐음)
- status='published' 필터링 적용 (차장님 승인된 것만 표시)
- 타이틀 버전 표기 v1.0.X → v2.0.X 교정 후 다시 v0.x.y 대원칙으로 롤백

### 3. 배포 환경 변수 격리 구축
- .env.local (Staging용) / .env.production (Live용) 분리
- 기존 .env → .env.backup으로 격리
- Vercel 상용 배포 완료

### 4. 게시물 승인 시스템 역방향 재설계
- PostApproval.jsx: 건의사항 기반 → 개발자 노트(dev_notes) 기반 역방향 승인 시스템으로 전면 재작성
- 승인 대기열 / 승인 완료 탭, 내용 보기 모달, 승인/반려 액션 버튼 구현

### 5. AI 룰 문서 영구 각인
- AI_INTERACTION_RULES.md: 시맨틱 버저닝 대원칙(v1.0.0은 정식 오픈 시에만) 추가
- v0.x.y 체계 강제 원칙 명문화

### 6. RLS 보안
- suggestions 및 dev_notes 테이블 RLS 정책 적용
- USING + WITH CHECK 분리 적용으로 데이터 무결성 확보
