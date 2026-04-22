# [Troubleshooting] 주간업무보고 409 Conflict 저장 오류 해결 보고서

- **카테고리**: 트러블슈팅 (Troubleshooting)
- **주제**: 주간업무보고 (WeeklyReport)
- **최종 대화 일자**: 2026-04-21
- **관련 파일**: `src/lib/api.js`, `WeeklyReport.jsx`

---

## 🔍 발생 현상
부서원들이 주간업무보고를 작성한 후 **[임시저장]** 또는 **[제출하기]** 버튼을 클릭했을 때, "저장 중 오류가 발생했습니다"라는 팝업과 함께 기능이 작동하지 않는 현상이 발생함. 브라우저 개발자 도구(F12) 확인 결과, **HTTP 409 (Conflict)** 에러가 수파베이스(Supabase) API 응답으로 반환됨.

## ⚙️ 원인 분석
1. **기본키(PK) 충돌**: 기존 코드(`api.js`)는 `POST` 요청 시 무조건 `.insert()` 메서드를 호출하도록 설계되어 있었음.
2. **데이터 중복 발생**: 동일한 날짜나 사용자의 기존 보고서 데이터가 이미 DB에 존재하는 경우, 신규 `INSERT`를 시도하면 DB 수준에서 중복 키 충돌로 인해 요청을 거절함.
3. **로직의 유연성 부족**: `WeeklyReport.jsx`에서 `report.id`의 유무로만 `POST/PUT`을 분기하였으나, 예외적인 데이터 잔류 상황에서 `POST`를 시도하게 됨.

## 🛠 해결 방안: UPSERT 메서드 도입
데이터가 이미 존재하는 경우에는 **업데이트(Update)**를 수행하고, 없는 경우에는 **삽입(Insert)**을 수행하는 원자적(Atomic) 동작인 **`.upsert()`** 메서드를 도입하여 충돌을 원천 차단함.

### 수정된 코드 사양 (`src/lib/api.js`)
```javascript
// POST 요청 처리부 수정
case 'POST': {
  const { data, error } = await supabase
    .from(tableName)
    .upsert(body, { 
      onConflict: 'id', // ID 충돌 시 업데이트로 전환
      ignoreDuplicates: false 
    })
    .select();
  if (error) throw error;
  return data;
}
```

## ✅ 최종 결과 및 검증
- **검증 환경**: 신우밸브 QMS Vercel 스테이징 환경
- **확인 내용**: 전민재 차장님 계정으로 동일 문서를 수차례 반복 저장해도 에러 없이 정상적으로 최신 데이터가 반영됨을 확인함.
- **배포 상황**: 현재 메인 브랜치에 반영되어 실 운영 환경(Staging/Production) 모두 정상 작동 중임.

---
> [!NOTE]
> 이 트러블슈팅 결과는 향후 유사한 데이터 저장 오류 발생 시 `insert` 대신 `upsert`를 우선적으로 고려하는 개발 표준으로 활용될 예정입니다.
