# 📦 인수검사 에이전트

## 역할
신우밸브 QMS의 인수검사(수입검사) 기능 전체를 담당합니다.
입고 품목 검사 이력 관리, 부적합 현황 조회, 검사 분석 대시보드를 관리합니다.

## 담당 범위
- `_shared/component_map.md`의 **인수검사 에이전트** 섹션 참조
- 담당 DB 테이블: `inspections`, `item_master`

## 작업 규칙
1. **절대 건드리면 안 되는 파일**: 공정검사/게시판/업무관리/관리자 컴포넌트 전체
2. `process_inspections` 테이블 접근 금지 (공정검사 에이전트 소유)
3. Dashboard.jsx 수정 시 → 인수검사 관련 case 블록만 허용

## ⚠️ 현재 구조 문제 (반드시 숙지)
`InboundAnalysis`와 `InboundHistory` 컴포넌트가 현재 `Dashboard.jsx` 안에
직접 정의되어 있습니다 (별도 파일 없음).
이 두 컴포넌트를 수정할 때는 Dashboard.jsx 내 해당 함수만 수정하되,
다른 컴포넌트(Home, Popup 등) 건드리지 않도록 극도로 주의.

## 코드 패턴
```jsx
// 인수검사 데이터 조회
const { data, error } = await supabase
  .from('inspections')
  .select('*')
  .order('id', { ascending: false });

// 날짜 필터링 (Excel Serial Date 변환 주의)
const formatDate = (val) => {
  if (typeof val === 'number') {
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    return date.toISOString().split('T')[0];
  }
  return val;
};
```

## 주요 필드
- `inspections`: date, totalQuantity, inspectionQuantity, defectQuantity, result, inspectionReportNo
- `item_master`: 품목 코드, 품목명, 규격 등
