---
title: "Dashboard 컴포넌트 분리 및 최적화 기획안"
type: "구현 계획서 (Implementation Plan)"
source_folder: "안티그래비티/plan"
source_file: "2026-05-28_Dashboard_컴포넌트_분리_및_최적화_기획안_R0.md"
date: "2026-05-28"
revision: "R0"
author: "AI (Antigravity)"
wiki_status: done
tags: [antigravity, plan, history, qms]
---

# Dashboard 컴포넌트 분리 및 최적화 기획안

본 기획안은 차장님의 지시에 따라 `src/components/Dashboard.jsx` 내에 하드코딩된 대형 컴포넌트들을 개별 파일로 분리하고 중복 선언을 제거하여 유지보수성을 극대화하기 위해 작성되었습니다.

## User Review Required
> [!IMPORTANT]
> - `Dashboard.jsx` 내부 구조 파악 중, 현재 `Home` 컴포넌트의 선언부는 단 1개(1370번째 줄 부근)만 존재하는 것으로 검색되었습니다. 혹시 과거에 발생했던 중복 선언이 이미 해결된 상태일 수 있으므로, 실제 작업 시 정밀 스캔 후 두 번째 선언이 발견될 경우에만 삭제 처리하겠습니다.
> - 작업 1 완료 후 렌더링 확인, 작업 2 완료 후 렌더링 확인 등 **단계적 검증 절차**를 철저히 이행할 계획입니다.

## Proposed Changes

### Component Extraction & Optimization

#### [MODIFY] [Dashboard.jsx](file:///c:/Users/mjjeon/Desktop/QMS%20%ED%94%84%EB%A1%9C%EC%A0%9D%ED%8A%B8/shinwoo-valve-qms/src/components/Dashboard.jsx)
- `[[history/2026-04-12_v0_24_0_[개발_노트]_v0.24.0_(P13)_-_Dashboard.jsx_컴포넌트_분리|InboundAnalysis]]` 컴포넌트 블록(약 64번째 줄 시작)을 절취선 삭제하고, 파일 최상단에 `import [[history/2026-04-12_v0_24_0_[개발_노트]_v0.24.0_(P13)_-_Dashboard.jsx_컴포넌트_분리|InboundAnalysis]] from './[[history/2026-04-12_v0_24_0_[개발_노트]_v0.24.0_(P13)_-_Dashboard.jsx_컴포넌트_분리|InboundAnalysis]]';` 구문 삽입.
- `[[history/2026-04-12_v0_24_0_[개발_노트]_v0.24.0_(P13)_-_Dashboard.jsx_컴포넌트_분리|InboundHistory]]` 컴포넌트 블록(약 458번째 줄 시작)을 절취선 삭제하고, 파일 최상단에 `import [[history/2026-04-12_v0_24_0_[개발_노트]_v0.24.0_(P13)_-_Dashboard.jsx_컴포넌트_분리|InboundHistory]] from './[[history/2026-04-12_v0_24_0_[개발_노트]_v0.24.0_(P13)_-_Dashboard.jsx_컴포넌트_분리|InboundHistory]]';` 구문 삽입.
- (발견 시) `Home` 컴포넌트 2번째 중복 선언부 완전 삭제.

#### [NEW] [InboundAnalysis.jsx](file:///c:/Users/mjjeon/Desktop/QMS%20%ED%94%84%EB%A1%9C%EC%A0%9D%ED%8A%B8/shinwoo-valve-qms/src/components/InboundAnalysis.jsx)
- `Dashboard.jsx`에서 추출한 `[[history/2026-04-12_v0_24_0_[개발_노트]_v0.24.0_(P13)_-_Dashboard.jsx_컴포넌트_분리|InboundAnalysis]]` 컴포넌트 소스코드 전면 이식.
- 컴포넌트 구동에 필요한 의존성(`recharts`, `lucide-react`, `../lib/api`, 포맷팅 헬퍼 함수 등) import 선언 추가.

#### [NEW] [InboundHistory.jsx](file:///c:/Users/mjjeon/Desktop/QMS%20%ED%94%84%EB%A1%9C%EC%A0%9D%ED%8A%B8/shinwoo-valve-qms/src/components/InboundHistory.jsx)
- `Dashboard.jsx`에서 추출한 `[[history/2026-04-12_v0_24_0_[개발_노트]_v0.24.0_(P13)_-_Dashboard.jsx_컴포넌트_분리|InboundHistory]]` 컴포넌트 소스코드 전면 이식.
- 엑셀 업로드 처리를 위한 `xlsx` 및 기타 필수 아이콘/API 모듈 import 선언 추가.

## Verification Plan

### Manual Verification
1. [작업 1 수행] 추출 후 로컬 서버(`npm run dev`)에서 **인수검사 대시보드 화면** 정상 렌더링 및 기능 오류 검증. (성공 시 커밋)
2. [작업 2 수행] 추출 후 로컬 서버에서 **인수검사 이력 조회 화면** 정상 렌더링 검증. (성공 시 커밋)
3. 전체 분리 후 애플리케이션 무결성 점검. 이후 차장님의 테스트웹 배포 승인 시 깃 푸시(git push) 단계를 진행합니다.
