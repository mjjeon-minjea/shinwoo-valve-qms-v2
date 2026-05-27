# [ADR-001] React Router Dom v7 useNavigate 캐싱 및 Supabase 실시간 Fetching 전략

## 1. 맥락 (Context)
* **상황:** QMS v2 프로젝트는 비동기 서버 상태 관리를 돕는 `React Query` 또는 `RTK Query`가 `package.json`에 포함되지 않은 순수 React Hook 및 REST API 호출 기반 프로젝트입니다.
- **요구사항:** 복잡한 주간 업무 현황 통합 보고 및 공정 불량 이력을 여러 컴포넌트 간 이동하며 끊김 없이 표시해야 합니다.
- **도전 과제:** 페이지 전환 시마다 발생하는 Supabase REST API의 불필요한 중복 Network Fetching을 최소화하고, 그렇다고 해서 오래된 상태(Stale State)를 사용자에게 보여주지 않기 위한 절충안이 절실합니다.

## 2. 기술 결정 (Decision)
**"React Router Dom v7의 useNavigate / useLocation 상태 전달 기능을 활용한 1차 로컬 캐싱 전달 및 컴포넌트 마운트 시 Supabase 실시간 Fetching 교차 병합 전략"**을 채택합니다.

* **상태 전달 메커니즘:**
  ```javascript
  // 발신 컴포넌트
  navigate('/weekly-status', { state: { cachedReports: reportsData } });

  // 수신 컴포넌트
  const location = useLocation();
  const [reports, setReports] = useState(location.state?.cachedReports || []);
  ```
* **동적 갱신 메커니즘:**
  - 캐시된 상태(`location.state?.cachedReports`)가 존재하면 화면을 지연 없이 **우선 렌더링**하여 UX 반응성을 비약적으로 높입니다.
  - 컴포넌트의 `useEffect` 마운트 라이프사이클에서 비동기로 원격 Supabase REST API(`api.fetch('/weekly_reports')`)를 재조회하여 배경에서 데이터를 최신화(Stale-While-Revalidate 유사 기법)하고 상태를 갱신합니다.

## 3. 결정 근거 (Rationales)
1. **의존성 경량화:** 라이브러리 추가 없이 `react-router-dom`의 기본 기능을 최대로 활용하여 프로젝트 복잡도를 제어합니다.
2. **첫 인상 성능 개선 (WOW UX):** 사용자가 탭이나 페이지를 이동할 때 데이터 로딩 표시("로딩 중...")가 아닌, 이전 데이터를 즉각 렌더링하여 Premium App 느낌을 극대화합니다.
3. **데이터 정합성 보장:** 우선 로드 후 백그라운드 재조회를 통해 최종적으로 실시간 DB 상태와 화면이 반드시 일치하게 보장합니다.

## 4. 대안 및 비교 (Alternatives)
* **대안 A (순수 실시간 Fetching):** 페이지 이동 시마다 로딩 바를 띄우고 데이터가 수신될 때까지 렌더링을 차단합니다. ➔ UX가 투박해져 Premium 디자인 철학에 어긋납니다.
* **대안 B (전역 Redux/Recoil 상태 저장소):** 상태 관리 툴을 전면 도입합니다. ➔ 단기 개발 요건 대비 환경 설정 비대화 및 번들 사이즈 증가 이슈가 발생합니다.

## 5. 결과 및 트레이드오프 (Consequences)
* **장점:** 페이지 이동 반응 속도 0ms 수준 체감 UX 확보, Supabase 트래픽 중복 요청 일부 완화.
* **단점:** 발신부와 수신부 간의 state 구조가 암묵적으로 커플링되므로 변경 사항 발생 시 수동 동기화가 필요합니다. (해당 정보는 지식 아이템에 백업하여 관리합니다).

---
* **상태:** 확정 (Accepted)
* **날짜:** 2026-05-27
* **작성자:** 품질보증부 안티그래비티
