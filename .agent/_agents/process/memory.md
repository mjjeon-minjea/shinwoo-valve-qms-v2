# ⚙️ 공정검사 에이전트 — 작업 메모리

---

## 알려진 버그 / 주의사항

### ⚠️ ProcessInspectionDashboard setLoading 미사용 변수
`const [, setLoading] = useState(true);` — loading state를 선언했지만 UI에 미사용.
ESLint 경고 발생. 추후 로딩 스피너 추가 시 함께 처리 필요.

### ⚠️ 전체 데이터 일괄 로딩
현재 `process_inspections` 테이블 전체를 한 번에 불러옴.
데이터가 수천 건 이상이 되면 느려질 수 있음.
추후 날짜 범위 기본값 필터링으로 개선 필요.

---

## 교훈 기록

_(작업 완료 후 채워집니다)_
