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
    '특채요청 결재 대기': '처리방안-특채요청결재대기',
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

/* 처리방안 구용어는 저장값을 바꾸지 않고 화면·인쇄·CSV에서만 절차서 정본으로 표시한다. */
const LEGACY_DISPOSITION_LABELS = new Set(['반송', '불채용', '반품']);
export const dispositionLabel = (value) => {
    const s = value == null ? '' : String(value);
    return LEGACY_DISPOSITION_LABELS.has(s) ? '불채용(반송)' : s;
};

const blankReview = (roundNo, history, state) => ({
    round_no: roundNo,
    ...(history.length ? { review_rounds: history } : {}),
    state,
    staff_email: null,
    staff_name: null,
    opinion: null,
    staff_cmt: '',
    staff_at: null,
    head_name: null,
    head_cmt: '',
    head_at: null,
    deputy: false,
    remand_note: ''
});

/* 기존 회신을 부서 row 안에 보존하고 다음 회차만 비운다.
   기술문의 row는 본회람이 아니므로 그대로 둔다. */
export const startNextReviewRound = (reviews, selectedDepartments, allDepartments = []) => {
    const src = reviews || {};
    const selected = new Set(selectedDepartments || []);
    const depts = new Set([
        ...Object.keys(src).filter(d => d !== '응용기술팀'),
        ...(allDepartments || []),
        ...selected
    ]);
    const next = {};

    if (src['응용기술팀']) next['응용기술팀'] = src['응용기술팀'];

    depts.forEach(dept => {
        const row = src[dept] || {};
        const history = Array.isArray(row.review_rounds) ? [...row.review_rounds] : [];
        const storedRound = row.round_no;
        const snapshot = { ...row };
        delete snapshot.review_rounds;
        delete snapshot.round_no;
        const hasRound = Object.keys(snapshot).length > 0;
        const roundNo = hasRound ? Number(storedRound || 1) : 0;
        if (hasRound) history.push({ round_no: roundNo, ...snapshot });
        next[dept] = blankReview(roundNo + 1, history, selected.has(dept) ? 'wait' : 'skip');
    });

    return next;
};

/* 최종반려 때 최신 보존 회차의 처리방안 요청을 다시 미해결로 연다. */
export const reopenLatestDispositionRequests = (reviews) => {
    const next = { ...(reviews || {}) };
    let count = 0;

    Object.entries(next).forEach(([dept, row]) => {
        if (dept === '응용기술팀' || row?.disp_req) return;
        const history = Array.isArray(row?.review_rounds) ? row.review_rounds : [];
        const archived = [...history].reverse().find(x => x?.disp_req?.resolved);
        if (!archived) return;
        const request = { ...archived.disp_req };
        delete request.resolved;
        delete request.resolved_by;
        delete request.resolved_at;
        next[dept] = { ...row, disp_req: request };
        count += 1;
    });

    return { reviews: next, count };
};

const SPECIAL_REQUEST_DECISIONS = new Set([
    '특채요청 채택·기술검토',
    '특채요청 채택·품질판단',
    '특채요청 승인불가',
    '특채요청 반려·담당자 재검토',
    '특채요청 반려·요청부서 보완'
]);

/* 마지막 담당자 상신 뒤의 결재만 같은 회차 결재로 본다. */
export const latestSpecialRequestApprovalCycle = (history) => {
    const rows = Array.isArray(history) ? history : [];
    let submitIndex = -1;
    for (let i = rows.length - 1; i >= 0; i -= 1) {
        if (rows[i]?.action === '특채요청 검토 상신') { submitIndex = i; break; }
    }
    if (submitIndex < 0) return { submit: null, decision: null };
    let decision = null;
    for (let i = rows.length - 1; i > submitIndex; i -= 1) {
        if (SPECIAL_REQUEST_DECISIONS.has(rows[i]?.action)) { decision = rows[i]; break; }
    }
    return { submit: rows[submitIndex], decision };
};

/* 비관리 사용자에게 /users 목록이 비어도 기존 회람 부서를 잃지 않는다. */
export const reviewDepartmentOptions = (reviews, knownDepartments = []) => [...new Set([
    ...(knownDepartments || []),
    ...Object.keys(reviews || {}).filter(dept => dept !== '응용기술팀')
])].sort();

export const activeReviewDepartments = (reviews, options) => (options || [])
    .filter(dept => reviews?.[dept] && reviews[dept].state !== 'skip');

/* 저장값은 유지하고 사용자에게 보이는 특채 하위유형만 구분한다. */
export const concessionTypeLabel = (value) => value === '수리' ? '특채-수리' : (value || '');
