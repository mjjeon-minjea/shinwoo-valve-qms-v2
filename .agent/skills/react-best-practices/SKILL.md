---
name: react-best-practices
description: Vercel 엔지니어링의 React 및 Next.js 성능 최적화 가이드라인입니다. React 컴포넌트, Next.js 페이지, 데이터 패칭, 번들 최적화, 또는 성능 개선 작업 시 최적의 코딩 패턴을 적용하기 위해 이 스킬을 활용합니다.
license: MIT
metadata:
  author: vercel
  version: "1.0.0"
---

# Vercel React 모범 사례 (Vercel React Best Practices)

Vercel에서 관리하는 React 및 Next.js 애플리케이션의 종합 성능 최적화 가이드입니다. 8개 카테고리에 걸쳐 70개의 규칙을 포함하고 있으며, 자동 리팩토링 및 코드 생성 시 우선순위를 결정하는 데 도움을 주기 위해 영향도에 따라 정렬되어 있습니다.

## 적용 시점 (When to Apply)

다음 작업 시 본 가이드를 참조하십시오:
- 새로운 React 컴포넌트 또는 Next.js 페이지를 작성할 때
- 데이터 패칭(클라이언트 또는 서버 사이드)을 구현할 때
- 성능 문제 해결을 위해 코드를 검토할 때
- 기존 React/Next.js 코드를 리팩토링할 때
- 번들 크기 또는 로딩 시간을 최적화할 때

## 우선순위별 규칙 카테고리 (Rule Categories by Priority)

| 우선순위 | 카테고리 | 영향도 | 접두사 |
|----------|----------|--------|--------|
| 1 | 워터폴(Waterfall) 현상 제거 | 심각 (CRITICAL) | `async-` |
| 2 | 번들 크기 최적화 | 심각 (CRITICAL) | `bundle-` |
| 3 | 서버 사이드 성능 최적화 | 높음 (HIGH) | `server-` |
| 4 | 클라이언트 데이터 패칭 | 중간-높음 (MEDIUM-HIGH) | `client-` |
| 5 | 리렌더링 최적화 | 중간 (MEDIUM) | `rerender-` |
| 6 | 렌더링 성능 최적화 | 중간 (MEDIUM) | `rendering-` |
| 7 | JavaScript 성능 최적화 | 낮음-중간 (LOW-MEDIUM) | `js-` |
| 8 | 고급 패턴 적용 | 낮음 (LOW) | `advanced-` |

## 핵심 요약 (Quick Reference)

### 1. 워터폴 현상 제거 (CRITICAL)

- `async-cheap-condition-before-await` - 비싼 비동기 연산(await) 전에 비용이 적게 드는 동기식 조건을 먼저 검사하십시오.
- `async-defer-await` - await 호출을 실제로 값이 사용되는 분기(branch) 내부로 연기하십시오.
- `async-parallel` - 서로 의존성 없는 독립적인 연산은 `Promise.all()`을 사용하여 병렬 처리하십시오.
- `async-dependencies` - 일부 종속성이 있는 경우 부분적 병렬화를 구성하십시오.
- `async-api-routes` - API 라우트에서는 Promise를 가능한 일찍 시작하고, 대기는 늦게 수행하십시오.
- `async-suspense-boundaries` - Suspense를 사용하여 콘텐츠를 스트리밍하십시오.

### 2. 번들 크기 최적화 (CRITICAL)

- `bundle-barrel-imports` - 배럴 파일(barrel files, `index.ts`)을 거치지 말고 직접 모듈을 임포트하십시오.
- `bundle-analyzable-paths` - 정적 분석이 가능한 임포트 및 파일 시스템 경로를 선호하여 불필요한 번들 포함을 방지하십시오.
- `bundle-dynamic-imports` - 무거운 컴포넌트는 `next/dynamic`을 사용하여 지연 로딩하십시오.
- `bundle-defer-third-party` - 분석/로깅 등 서드파티 스크립트는 하이드레이션(hydration) 이후에 로드하십시오.
- `bundle-conditional` - 특정 기능이 활성화되었을 때만 관련 모듈을 로드하십시오.
- `bundle-preload` - 체감 속도를 높이기 위해 호버(hover)나 포커스(focus) 시점에 프리로드(preload)하십시오.

### 3. 서버 사이드 성능 최적화 (HIGH)

- `server-auth-actions` - API 라우트와 마찬가지로 서버 액션(Server Actions)에서도 반드시 사용자 인증을 확인하십시오.
- `server-cache-react` - 요청별 중복 호출 제거를 위해 `React.cache()`를 활용하십시오.
- `server-cache-lru` - 다중 요청 간 캐싱을 위해 LRU 캐시를 사용하십시오.
- `server-dedup-props` - RSC(React Server Component) 프로퍼티 전달 시 중복 직렬화를 방지하십시오.
- `server-hoist-static-io` - 정적 I/O(폰트, 로고 등)는 모듈 수준으로 호이스팅(hoist)하십시오.
- `server-no-shared-module-state` - RSC/SSR 환경에서 모듈 수준의 가변(mutable) 요청 상태를 공유하지 마십시오.
- `server-serialization` - 클라이언트 컴포넌트로 전달되는 데이터 전송량을 최소화하십시오.
- `server-parallel-fetching` - 병렬 패칭이 가능하도록 컴포넌트 구조를 재배치하십시오.
- `server-parallel-nested-fetching` - 아이템별 중첩 패칭은 `Promise.all` 내에서 체이닝하십시오.
- `server-after-nonblocking` - 비차단(non-blocking) 보조 작업에는 `after()` API를 사용하십시오.

### 4. 클라이언트 데이터 패칭 (MEDIUM-HIGH)

- `client-swr-dedup` - 자동 중복 제거를 위해 SWR 또는 React Query 같은 데이터 패칭 라이브러리를 사용하십시오.
- `client-event-listeners` - 전역 이벤트 리스너가 중복 등록되지 않도록 관리하십시오.
- `client-passive-event-listeners` - 스크롤 성능 향상을 위해 passive 리스너를 사용하십시오.
- `client-localstorage-schema` - localStorage 데이터를 최소화하고 스키마 버전을 관리하십시오.

### 5. 리렌더링 최적화 (MEDIUM)

- `rerender-defer-reads` - 콜백 함수 내부에서만 사용되는 상태(state)는 컴포넌트 렌더링 단계에서 구독하지 마십시오.
- `rerender-memo` - 비용이 많이 드는 작업은 `React.memo` 등으로 메모이제이션된 컴포넌트로 분리하십시오.
- `rerender-memo-with-default-value` - 기본값으로 비원시값(객체, 배열 등)을 사용할 때는 참조 유지를 위해 외부로 호이스팅하십시오.
- `rerender-dependencies` - Effect의 의존성 배열에는 가능한 원시 타입 값들을 사용하십시오.
- `rerender-derived-state` - 원시 상태값 대신 계산된(derived) boolean 값 등을 구독하십시오.
- `rerender-derived-state-no-effect` - 계산된 상태는 useEffect 대신 렌더링 과정에서 직접 계산하십시오.
- `rerender-functional-setstate` - 콜백 참조를 안정적으로 유지하기 위해 함수형 setState(`prev => ...`)를 사용하십시오.
- `rerender-lazy-state-init` - useState 초기값으로 비싼 연산이 들어갈 경우 초기화 함수(`() => value`)를 전달하십시오.
- `rerender-simple-expression-in-memo` - 단순 원시값에는 굳이 memo를 남용하지 마십시오.
- `rerender-split-combined-hooks` - 의존성이 독립적인 경우 결합된 커스텀 훅을 분리하십시오.
- `rerender-move-effect-to-event` - 사용자 상호작용 관련 로직은 useEffect가 아닌 이벤트 핸들러에 배치하십시오.
- `rerender-transitions` - 긴급하지 않은 상태 업데이트에는 `startTransition`을 사용하십시오.
- `rerender-use-deferred-value` - 입력 반응성을 유지하기 위해 무거운 렌더링 처리를 지연(defer)시키십시오.
- `rerender-use-ref-transient-values` - 렌더링을 유발하지 않고 잦은 값 변경을 추적할 때는 Ref를 사용하십시오.
- `rerender-no-inline-components` - 컴포넌트 내부에 다른 컴포넌트를 선언하지 마십시오.

### 6. 렌더링 성능 최적화 (MEDIUM)

- `rendering-animate-svg-wrapper` - SVG 엘리먼트 자체보다 감싸고 있는 div 래퍼에 애니메이션을 적용하십시오.
- `rendering-content-visibility` - 긴 목록 아이템에는 `content-visibility` CSS 속성을 사용하십시오.
- `rendering-hoist-jsx` - 컴포넌트 외부로 정적 JSX를 추출(hoist)하십시오.
- `rendering-svg-precision` - SVG 좌표 정밀도(소수점 자리수)를 줄여 데이터 용량을 최적화하십시오.
- `rendering-hydration-no-flicker` - 클라이언트 전용 데이터를 사용할 때 깜빡임을 방지하기 위해 인라인 스크립트를 활용하십시오.
- `rendering-hydration-suppress-warning` - 서버/클라이언트 차이가 예상되는 경우 경고를 억제(`suppressHydrationWarning`)하십시오.
- `rendering-activity` - 요소의 표시/숨김 처리에 Activity 컴포넌트 스타일을 활용하십시오.
- `rendering-conditional-render` - 조건부 렌더링 시 `&&` 연산자 대신 삼항 연산자(`? :`)를 사용하여 예기치 않은 숫자 0 출력을 방지하십시오.
- `rendering-usetransition-loading` - 로딩 상태 표시에 `useTransition`을 우선적으로 사용하십시오.
- `rendering-resource-hints` - 리소스를 미리 로드하려면 React DOM 리소스 힌트(dns-prefetch, preconnect 등)를 사용하십시오.
- `rendering-script-defer-async` - script 태그에 `defer` 또는 `async` 속성을 지정하십시오.

### 7. JavaScript 성능 최적화 (LOW-MEDIUM)

- `js-batch-dom-css` - CSS 변경 사항은 클래스나 `cssText`를 사용하여 한 번에 배치(batch) 처리하십시오.
- `js-index-maps` - 반복적인 조회를 수행할 때는 배열 대신 Map 인덱스를 구축하십시오.
- `js-cache-property-access` - 루프 내부에서 자주 호출되는 객체 프로퍼티 접근 결과를 변수에 캐싱하십시오.
- `js-cache-function-results` - 순수 함수의 결과값은 모듈 수준의 Map을 이용해 캐싱(Memoization)하십시오.
- `js-cache-storage` - localStorage/sessionStorage 조회 결과를 변수에 캐싱해 반복 접근을 방지하십시오.
- `js-combine-iterations` - 동일 배열에 대한 여러 단계의 filter/map을 하나의 루프로 병합하십시오.
- `js-length-check-first` - 복잡한 연산 전에 배열의 길이(`length`)를 먼저 검사하여 조기 종료하십시오.
- `js-early-exit` - 조건이 일치하지 않는 경우 함수에서 일찍 리턴(early exit)하십시오.
- `js-hoist-regexp` - 루프 내부에서 매번 RegExp 객체를 생성하지 말고 외부로 호이스팅하십시오.
- `js-min-max-loop` - 정렬(sort) 후 첫/마지막 요소를 가져오기보다 단일 루프를 통해 최솟값/최댓값을 구하십시오.
- `js-set-map-lookups` - O(1) 조회를 위해 Set/Map을 적극 활용하십시오.
- `js-tosorted-immutable` - 불변 객체 유지를 위해 `toSorted()`를 사용하십시오.
- `js-flatmap-filter` - 맵과 필터를 단일 루프로 처리할 때 `flatMap`을 사용하십시오.
- `js-request-idle-callback` - 중요하지 않은 작업은 브라우저의 유휴 시간(`requestIdleCallback`)으로 연기하십시오.

### 8. 고급 패턴 적용 (LOW)

- `advanced-effect-event-deps` - `useEffectEvent`로 작성된 이벤트 함수를 useEffect의 의존성 배열에 넣지 마십시오.
- `advanced-event-handler-refs` - 빈번히 바뀌는 이벤트 핸들러는 Ref에 보관하여 렌더링을 방지하십시오.
- `advanced-init-once` - 애플리케이션 초기화 작업은 전체 로드 시 단 한 번만 실행되도록 보호 장치를 마련하십시오.
- `advanced-use-latest` - 안정적인 콜백 참조 유지를 위해 `useLatest` 패턴을 사용하십시오.

## 사용 방법 (How to Use)

세부 규칙 설명과 코드 예제는 개별 규칙 파일을 참조하십시오:

```
rules/async-parallel.md
rules/bundle-barrel-imports.md
```

각 규칙 파일은 다음으로 구성되어 있습니다:
- 해당 규칙이 중요한 이유에 대한 간략한 설명
- 잘못된 코드 예시와 그에 대한 설명
- 올바른 코드 예시와 그에 대한 설명
- 추가적인 컨텍스트 및 참고 자료 링크

## 전체 컴파일 문서 (Full Compiled Document)

모든 규칙이 상세히 설명된 컴파일본은 `AGENTS.md`에서 확인하실 수 있습니다.
