# 📦 인수검사 에이전트 — 작업 메모리

---

## 알려진 버그 / 주의사항

### ⚠️ Excel Serial Date 변환 필수
`inspections.date` 필드는 Excel에서 가져온 숫자형 날짜(Serial Date)가 섞여 있음.
반드시 `formatDate()` 헬퍼 함수를 통해 변환 후 사용. 직접 날짜 비교 금지.

---

## 교훈 기록

_(작업 완료 후 채워집니다)_
