---
name: web-artifacts-builder
description: 현대적인 프론트엔드 웹 기술(React, Tailwind CSS, shadcn/ui)을 활용하여 다중 컴포넌트 구조의 claude.ai용 HTML 아티팩트를 제작하는 도구 세트입니다. 상태 관리, 라우팅, 또는 shadcn/ui 컴포넌트가 요구되는 복잡한 아티팩트를 제작할 때 이 스킬을 적용합니다 (단일 파일 단위의 단순 HTML/JSX 아티팩트에는 불필요).
license: Complete terms in LICENSE.txt
---

# 웹 아티팩트 빌더 (Web Artifacts Builder)

강력한 프론트엔드 claude.ai 아티팩트를 개발하려면 다음 단계를 수행하십시오:
1. `scripts/init-artifact.sh` 스크립트를 사용하여 프론트엔드 저장소 초기화
2. 생성된 코드 파일들을 수정하여 아티팩트 개발
3. `scripts/bundle-artifact.sh` 스크립트를 활용해 모든 코드를 단일 HTML 파일로 번들링
4. 완성된 아티팩트 파일을 사용자에게 제공
5. (선택사항) 아티팩트 시각 동작 검증

**기술 스택**: React 18 + TypeScript + Vite + Parcel (번들링) + Tailwind CSS + shadcn/ui

## 디자인 및 스타일 지침 (Design & Style Guidelines)

**매우 중요**: 기계적인 "AI 스타일(천편일률적인 레이아웃 및 디자인)"을 탈피하기 위해, 과도한 중앙 정렬 레이아웃, 보라색 그라데이션, 정적이고 똑같은 둥근 모서리(rounded corners), 그리고 Inter 폰트의 남용을 엄격히 방지하십시오.

## 빠른 시작 (Quick Start)

### 1단계: 프로젝트 초기화

초기화 스크립트를 실행하여 새로운 React 프로젝트를 생성합니다:
```bash
bash scripts/init-artifact.sh <프로젝트-이름>
cd <프로젝트-이름>
```

이 명령은 다음이 완비된 프로젝트 환경을 구성합니다:
- ✅ React + TypeScript (Vite 기반)
- ✅ Tailwind CSS 3.4.1 (shadcn/ui 테마 시스템 연동)
- ✅ 경로 별칭(Path Alias, `@/`) 설정 완료
- ✅ 40개 이상의 shadcn/ui 컴포넌트 사전 설치
- ✅ 모든 Radix UI 의존성 패키지 포함
- ✅ Parcel 번들러 환경 설정 완료 (`.parcelrc` 파일 제공)
- ✅ Node 18+ 호환성 보장 (Vite 버전을 자동으로 탐지하여 고정)

### 2단계: 아티팩트 개발

생성된 파일들을 편집하여 요구사항에 맞는 화면과 로직을 구현합니다.

### 3단계: 단일 HTML 파일로 번들링

React 애플리케이션을 단일 HTML 아티팩트 파일로 컴파일하고 번들링합니다:
```bash
bash scripts/bundle-artifact.sh
```

이 스크립트는 모든 JavaScript, CSS 및 외부 라이브러리 의존성을 내부에 인라인화(inline)한 단일 배포용 HTML 파일인 `bundle.html`을 생성합니다. 이 파일은 Claude 대화창에 즉시 파일로 제공되어 아티팩트로 활성화될 수 있습니다.

**필수 요구사항**: 프로젝트 루트 디렉토리에 `index.html` 파일이 존재해야 합니다.

**번들링 스크립트의 동작 내역**:
- 번들링 의존성 패키지(parcel, @parcel/config-default, parcel-resolver-tspaths, html-inline) 설치
- 경로 별칭(path alias)을 지원하는 `.parcelrc` 설정 파일 생성
- 소스 맵(source maps) 없이 Parcel 빌드 수행
- `html-inline` 도구를 활용해 빌드된 모든 리소스를 단일 HTML 파일로 인라인 통합

### 4단계: 사용자에게 아티팩트 전달

최종 번들링된 HTML 파일을 사용자에게 제공하여 화면상에서 즉시 확인 및 작동해 볼 수 있도록 돕습니다.

### 5단계: 아티팩트 시각 검증 및 테스트 (선택사항)

*참고: 이 단계는 전적으로 선택사항입니다. 사용자가 원하거나 특별히 복잡한 검증이 요구될 때만 수행하십시오.*

아티팩트를 테스트 및 시각적으로 시뮬레이션하기 위해 가용 도구(Playwright, Puppeteer 등의 브라우저 검증 라이브러리)를 활용할 수 있습니다. 일반적으로는 검증 과정으로 인해 최종 파일 생성 속도가 느려지므로, 사용자에게 아티팩트를 먼저 전달한 후 필요에 따라 사후 테스트를 진행하는 편이 좋습니다.

## 참고 자료 (Reference)

- **shadcn/ui 컴포넌트 공식 문서**: https://ui.shadcn.com/docs/components