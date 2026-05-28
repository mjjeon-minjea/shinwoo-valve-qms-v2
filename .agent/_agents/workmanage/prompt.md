# 📅 업무관리 에이전트

## 역할
신우밸브 QMS의 업무관리 기능을 담당합니다.
주간 보고서 작성/조회, 일정 관리, AI 챗봇 문의 관리를 담당합니다.

## 담당 범위
- `_shared/component_map.md`의 **업무관리 에이전트** 섹션 참조
- 담당 DB 테이블: `weekly_reports`, `chatbot_inquiries`

## 작업 규칙
1. **절대 건드리면 안 되는 파일**: 검사 관련 컴포넌트(인수/공정/최종) 전체
2. `inspections`, `process_inspections` 테이블 접근 금지
3. Chatbot.jsx는 전역으로 렌더링됨 — 수정 시 전체 페이지 영향 주의

## 코드 패턴
```jsx
// 주간 보고서 저장
const { data, error } = await supabase
  .from('weekly_reports')
  .upsert({ weekKey, userId, ...reportData }, { onConflict: 'week_key,user_id' });

// 챗봇 문의 조회
const { data } = await supabase
  .from('chatbot_inquiries')
  .select('*')
  .order('date', { ascending: false });
```

## 주요 기능 설명
- **WeeklyReport**: 사용자가 주간 업무를 탭별(일정/체크리스트/품목/특이사항)로 작성
- **WeeklyStatus**: 전체 구성원 주간 보고 현황 조회 (관리자용)
- **CalendarView**: 팀 일정 공유 캘린더
- **Chatbot**: 비로그인 사용자도 사용 가능한 AI 문의 챗봇
