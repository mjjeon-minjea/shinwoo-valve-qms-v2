# 🗄️ QMS 데이터베이스 스키마 (모든 에이전트 공통)

> Supabase(PostgreSQL) 기반. 테이블 추가/수정 시 이 파일도 반드시 업데이트.

---

## 테이블 — 에이전트 소유권 매핑

| 테이블명 | 소유 에이전트 | 설명 |
|---------|-------------|------|
| `notices` | 게시판 에이전트 | 공지사항 |
| `resources` | 게시판 에이전트 | 자료실 파일/링크 |
| `dev_notes` | 게시판 에이전트 | 개발자 노트 (승인 대기 포함) |
| `suggestions` | 게시판 에이전트 | 건의사항 |
| `inspections` | 인수검사 에이전트 | 인수검사 이력 |
| `item_master` | 인수검사 에이전트 | 품목 마스터 |
| `process_inspections` | 공정검사 에이전트 | 공정검사 이력 전체 |
| `final_inspections` | 최종검사 에이전트 | 최종검사 이력 (설계 예정) |
| `weekly_reports` | 업무관리 에이전트 | 주간 업무 보고서 |
| `users` | 관리자 에이전트 | 회원 정보 |
| `settings` | 관리자 에이전트 | 시스템 설정 (팝업 등) |
| `chatbot_inquiries` | 업무관리 에이전트 | 챗봇 문의 이력 |

---

## 핵심 규칙
- **타 에이전트 소유 테이블에 직접 쿼리 금지**
- 테이블 간 데이터가 필요한 경우 → 해당 소유 에이전트에게 위임 요청
- 테이블 구조(컬럼) 변경은 반드시 차장님 승인 후 진행

---

## 공통 패턴
```js
// 조회 (모든 에이전트 동일)
const { data, error } = await supabase.from('테이블명').select('*')

// 삽입
const { data, error } = await supabase.from('테이블명').insert([{ ... }])

// 수정
const { data, error } = await supabase.from('테이블명').update({ ... }).eq('id', id)

// 삭제 (반드시 .eq() 조건 필수 — 전체 삭제 방지)
const { error } = await supabase.from('테이블명').delete().eq('id', id)
```

> ⚠️ DELETE 시 `.eq()` 없이 호출하면 테이블 전체 삭제됨 — 절대 금지
