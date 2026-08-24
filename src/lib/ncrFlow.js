/* NCR 결재 흐름 세대 판정 — 단일 정의점 (v10.2 G-⑦)
   배경: `flow_ver === 'v10.1'` 정확일치가 NCRDetail·NCRPrint 두 곳에 독립 중복돼 있었다.
   F영역 회귀 실측(08-22, #44)에서 정상 문서의 flow_ver를 'v10.2'로 바꾸자
   ─ 상세: 「구 흐름 문서」로 재분류 → 5단계 게이트·부서 회람표·종합검토 블록 소실
   ─ 인쇄: 결재란 5칸 → 2칸, 「부적합 코드」 행 소실
   이 재현됐다. 즉 버전을 올리는 순간 정상 문서가 통째로 레거시로 떨어진다.

   그래서 판정 기준을 뒤집는다 — 「새 흐름을 열거」하지 않고 「레거시를 열거」한다.
   레거시 = flow_ver가 'v10.0' 이거나 값이 없는 문서(그 시절 문서는 값 자체가 없다).
   그 외(v10.1 · v10.2 · 앞으로 나올 v10.3 · v11 …)는 전부 새 흐름이다.
   앞으로 버전이 올라가도 이 파일을 고칠 필요가 없다.

   위치: NCRDetail은 NCRPrint를 import하므로(NCRDetail.jsx:4) 판정 함수를 NCRDetail에 두면
   NCRDetail↔NCRPrint 순환 import가 된다 — 이 코드베이스가 fetchPrintSettings에서
   이미 같은 이유로 피한 구조다(NCRPrint.jsx 주석). 그래서 의존이 없는 lib에 둔다.
   기존 호출 관례(`from './NCRDetail'`)를 위해 NCRDetail이 그대로 re-export한다. */

/* 레거시 흐름(v10.0 단선 결재) 문서인가 */
export const isLegacyFlow = (r) => {
    const v = String(r?.flow_ver ?? '').trim();
    return v === '' || v === 'v10.0';
};

/* 새 흐름(v10.1 이후 5단계 결재) 문서인가 */
export const isNewFlow = (r) => !isLegacyFlow(r);

/* ── v10.2 I-① 상태 이름표 (절차서 용어) ──
   차장 요청(08-23): 화면·인쇄물·대장·CSV에 절차서 용어가 보여야 한다.
   그런데 status 문자열은 NCRDetail·NCRPrint·NCRInbox·NCRLedger·NCRCreate 5개 파일에서
   60군데 넘게 === / includes() / switch-case로 비교된다(myTurnV101의 case 문이 대표적).
   저장값을 바꾸면 그 중 하나만 놓쳐도 그 문서는 「내 차례」에서 사라지고 결재 버튼이 영영 안 뜬다.
   → 저장값(status)은 그대로 두고 「보여줄 이름」만 이 표에서 갈아끼운다.
     비교·분기 로직은 저장값을 그대로 쓰므로 한 글자도 건드리지 않는다.

   배지 색상 맵(STATUS_BADGE)의 키도 저장값 그대로 둔다 — 색은 안 바뀌고 라벨만 바뀐다.

   ⚠ 이 표에 없는 값은 입력값을 그대로 돌려준다(폴백).
     새 상태가 생겨도, 레거시 값('발행'·'특채 판단')이 와도 화면이 비지 않는다. */
export const STATUS_LABEL = {
    '회람중': '처리방안-회람중',
    '종합검토': '처리방안-회신완료',
    '특채판단': '처리방안-특채판단',
    '특채승인 대기': '처리방안-특채승인대기',
    '최종승인 대기': '처리방안-최종승인대기',
    '처리중': '처리확인',                    // 절차서 5.5.1 「처리확인·부서장 승인」
    '종결승인 대기': '처리확인-종결승인대기'
};

/* 저장값 → 보여줄 이름. 표에 없으면 입력값 그대로(폴백) */
export const statusLabel = (status) => {
    const s = status == null ? '' : String(status);
    return STATUS_LABEL[s] || s;
};
