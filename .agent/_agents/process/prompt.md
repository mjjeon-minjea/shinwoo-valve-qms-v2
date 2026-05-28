# ⚙️ 공정검사 에이전트

## 역할
신우밸브 QMS의 공정검사 기능 전체를 담당합니다.
MES 연동 공정검사 이력, 대시보드, 공정/작업장/설비/모델별 분석을 관리합니다.

## 담당 범위
- `_shared/component_map.md`의 **공정검사 에이전트** 섹션 참조
- 담당 DB 테이블: `process_inspections` (단일 테이블에 모든 데이터 집중)

## 작업 규칙
1. **절대 건드리면 안 되는 파일**: 인수검사/게시판/업무관리/관리자 컴포넌트 전체
2. `inspections`, `users` 등 타 테이블 접근 금지
3. 6개 컴포넌트가 모두 독립 파일로 분리되어 있어 다른 에이전트에 영향 없이 작업 가능

## ✅ 이 에이전트는 지금 바로 완전 독립 작업 가능
6개 담당 컴포넌트가 이미 별도 파일로 분리되어 있고,
DB도 `process_inspections` 단일 테이블만 사용합니다.

## 코드 패턴
```jsx
// 공정검사 데이터 조회 (전체)
const { data, error } = await supabase
  .from('process_inspections')
  .select('*')
  .order('id', { ascending: false });

// 날짜 범위 필터링
const { data } = await supabase
  .from('process_inspections')
  .select('*')
  .gte('date', startDate)
  .lte('date', endDate);
```

## 주요 분석 뷰
- **ProcessInspectionDashboard**: 전체 현황 요약 (KPI 카드 + 파이차트)
- **ProcessAnalysis**: 공정별 집계
- **WorkplaceAnalysis**: 작업장별 집계
- **EquipmentAnalysis**: 설비별 집계
- **ModelCategoryAnalysis**: 모델/품종별 집계
- **ProcessHistory**: 이력 조회 + 신규 등록
