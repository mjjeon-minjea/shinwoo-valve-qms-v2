import { useState, useEffect } from 'react';
import { X, CheckCircle2, XCircle, Printer, Undo2, Stamp, FlaskConical, Users, ClipboardCheck, Ban, Coins, Plus, Trash2, File as FileIcon } from 'lucide-react';
import { api } from '../lib/api';
import { isLegacyFlow, isNewFlow, statusLabel } from '../lib/ncrFlow';
import { roleOf, canApprove, techApprovalDecision } from '../lib/ncrRoles';
/* v10.2 H-③ 처리확인 증빙 첨부 — 작성화면과 「같은 규칙」(1280px 축소 · 비이미지 5MB)을 쓰려고
   lib/attach.jsx의 공용 함수를 그대로 가져다 쓴다(NCRCreate에 있던 것을 lib로 옮긴 것). */
import { ATT_CAT, processAnyFile, isImageAtt, useCapturePaste, PasteZone, attUrl, uploadAtt, withAttUrls } from '../lib/attach.jsx';
import NCRPrint from './NCRPrint';

/* v10.2 G-⑦ — 흐름 세대 판정은 lib/ncrFlow.js 한 곳에만 있다(중복 정의 금지).
   기존 호출부 관례(NCRInbox·NCRLedger·Dashboard가 './NCRDetail'에서 가져오는 형태)를 위해 여기서 re-export한다. */
export { isLegacyFlow, isNewFlow, statusLabel };

/* NCR 상세·결재 모달 — v10.1 정통 복원 (플랜 039)
   v9.3 결재 골격 이식: 발행승인 → [기술문의 → 특채판단 → 특채승인] → 부서회람(담당 의견 → 부서장 결재)
                        → 종합검토 → 최종승인 → 처리중(완료확인·품질비용·CAR) → 종결승인 → 종결 / 무효(상신→승인 2단)
   레거시(flow_ver v10.0) 문서는 구 게이트(canApprove 단선 결재) 그대로 열람·처리 — 새 흐름 강제 금지
   규약: qms-dev-tools/V10.1_규약.md · 사양 원본: v9.3 (audit/D_v9.2-9.3.md) */

/* I-① 상태 이름표: 이 맵의 키는 「저장값」 그대로다 — 색은 안 바뀐다.
   화면에 찍는 글자만 statusLabel()로 갈아끼운다(lib/ncrFlow.js).
   ACTION_DOT의 키는 status가 아니라 「이력 액션명」이라 이름표와 무관하다 — 건드리지 않는다. */
const STATUS_BADGE = {
    '작성중': 'bg-slate-100 text-slate-600 border-slate-300',
    '발행승인 대기': 'bg-sky-50 text-sky-700 border-sky-200',
    '기술문의': 'bg-violet-50 text-violet-700 border-violet-200',
    '특채판단': 'bg-amber-100 text-amber-800 border-amber-300',
    '특채승인 대기': 'bg-amber-50 text-amber-700 border-amber-200',
    '회람중': 'bg-blue-50 text-blue-700 border-blue-200',
    '종합검토': 'bg-indigo-50 text-indigo-700 border-indigo-200',
    '최종승인 대기': 'bg-purple-50 text-purple-700 border-purple-200',
    '처리중': 'bg-teal-50 text-teal-700 border-teal-200',
    '종결승인 대기': 'bg-emerald-50 text-emerald-800 border-emerald-300',
    '종결': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    '무효승인 대기': 'bg-slate-100 text-slate-700 border-slate-400',
    '무효': 'bg-slate-200 text-slate-500 border-slate-300',
    /* 레거시 v10.0 */
    '발행': 'bg-blue-50 text-blue-700 border-blue-200',
    '특채 판단': 'bg-amber-100 text-amber-800 border-amber-300',
    '반려': 'bg-red-50 text-red-700 border-red-200'
};

const ACTION_DOT = {
    '발행요청': 'bg-sky-500', '발행승인': 'bg-blue-500', '발행반려': 'bg-red-500',
    '기술회신': 'bg-violet-500', '특채판단 상신': 'bg-amber-500', '특채승인': 'bg-amber-600', '특채반려': 'bg-red-500',
    '회람회신': 'bg-blue-400', '부서승인': 'bg-blue-600', '부서내 재검토': 'bg-orange-400', '품질반려': 'bg-red-500',
    '재질의': 'bg-orange-500', '종합검토 상신': 'bg-indigo-500', '최종승인': 'bg-purple-600', '최종반려': 'bg-red-500',
    '처분방안 변경': 'bg-amber-500', '요청 반송': 'bg-orange-500',
    '완료확인': 'bg-teal-600', '종결승인': 'bg-emerald-600', '종결반려': 'bg-red-500',
    '회수': 'bg-slate-500', '무효상신': 'bg-slate-500', '무효승인': 'bg-slate-700', '무효반려': 'bg-red-500', '무효': 'bg-slate-600',
    /* 레거시 */
    '발행': 'bg-blue-500', '승인': 'bg-emerald-500', '재발행': 'bg-blue-500',
    '특채 상신': 'bg-amber-500', '특채 승인': 'bg-emerald-500', '특채 불가': 'bg-red-500'
};

/* ── 설정 로드 ──
   결재 권한(allow_deputy)은 「명시적으로 true일 때만 허용」한다.
   C영역 회귀 재검증 실측(08-22): 로딩 중은 막았는데 ①조회 실패 ②approval 행 부재 두 경로에서
   폴백이 true라 allow_deputy=false를 우회해 차장이 부서장 결재를 완주했다.
   권한은 「모르면 막는다」가 맞다 — 반면 dispositions·codes 같은 표시용 값은
   폴백을 그대로 써야 화면이 비지 않으므로 둘을 분리한다.
   loaded/approval_row는 화면에 「설정을 못 읽었다」를 드러내기 위한 진단 플래그다(조용한 마비 방지). */
const SETTINGS_FALLBACK = {
    routing: { default_depts: ['생산부'], reply_hours: 24 }, codes: {},
    dispositions: ['재작업', '폐기', '불채용(반송)', '특채(Concession)'],
    concession_types: ['현상태 사용', '수리', '재등급 부여', '관련부품 수정']
};
export const fetchNcrSettings = async () => {
    try {
        const res = await api.fetch('/ncr_settings');
        const rows = (await res.json()) || [];
        if (!Array.isArray(rows)) throw new Error('ncr_settings 응답이 배열이 아닙니다');
        const by = {}; rows.forEach(r => { by[r.id] = r; });
        return {
            loaded: true,
            approval_row: !!by.approval,
            allow_deputy: by.approval?.allow_deputy === true,
            routing: by.routing || { default_depts: ['생산부'], reply_hours: 24 },
            codes: by.codes?.map || {},
            dispositions: by.dispositions?.list || ['재작업', '폐기', '불채용(반송)', '특채(Concession)'],
            concession_types: by.dispositions?.concession_types || ['현상태 사용', '수리', '재등급 부여', '관련부품 수정']
        };
    } catch {
        return { loaded: false, approval_row: false, allow_deputy: false, ...SETTINGS_FALLBACK };
    }
};

/* ── 역할 판정 ──
   판정 정본은 src/lib/ncrRoles.js 한 곳이다(스테이징 staging@4553aa5과 동일 원문).
   과거 이 자리에 있던 직급(rank) 문자열 비교는 두 가지로 깨져 제거했다.
     ① 부서장이 '부장'이 아닌 경우(최용석 이사·황사빈 이사) 결재자가 사라짐
     ② 실무자가 '차장'인 경우(정준길) 결재자로 오인됨
   기존 import 호환을 위해 여기서 그대로 재export 한다. */
export { roleOf, canApprove };

/* ── 내 차례 판정 (결재함 공용) — 레거시는 단선 결재 규칙으로, 그 외는 v10.1 게이트로 ── */
export const myTurnV101 = (user, r, settings) => {
    if (isLegacyFlow(r)) return canApprove(user, r, settings) || (r.status === '반려' && r.author_email === user?.email);
    const ro = roleOf(user, settings);
    const rv = r.reviews || {};
    switch (r.status) {
        case '작성중': return r.author_email === user?.email && !!r.reject_note;
        case '발행승인 대기': case '특채승인 대기': case '최종승인 대기': case '종결승인 대기': case '무효승인 대기': return ro.isQaApprover;
        case '기술문의': {
            const t = rv['응용기술팀'];
            if (!t || t.state === 'skip') return false;
            return (t.state === 'wait' && ro.isTechStaff) || (t.state === 'staffDone' && ro.isTechApprover);
        }
        case '특채판단': case '종합검토': case '처리중': return ro.isQaStaff;
        case '회람중': {
            const mine = rv[ro.company];
            if (!mine || ['skip', 'done'].includes(mine.state)) return false;
            if (mine.state === 'wait') return ro.isDeptStaff(ro.company);
            if (mine.state === 'staffDone') return ro.isDeptHead(ro.company) || ro.isDeptDeputy(ro.company);
            return false;
        }
        default: return false;
    }
};

/* 되돌림 표기 — 「부서장 재검토 지시」(부서 내·품질 미경유)와 「품질 반송」(특채요청 심사 결과)은
   담당자가 취해야 할 조치가 다르다. 접두어로 구분해 라벨을 분리한다(실측 결함 260829). */
/* 처분방안 변경 여부는 disposition_prev의 참·거짓이 아니라 「값이 있는가」로 본다.
   실측 결함(260829, 예림 독립검토): 처리방안 미정('')인 문서가 특채로 바뀌면 disposition_prev=''가 되는데,
   ''는 거짓값이라 최종반려해도 원복이 안 되고 요청만 다시 열려 상태가 어긋났다.
   개발웹 25건 중 미정 문서가 11건이라 실제로 자주 닿는 경로다. */
const hasDispChange = (r) => r?.disposition_prev !== null && r?.disposition_prev !== undefined;
const dispPrevLabel = (r) => r?.disposition_prev || '미정';
const QA_REMAND = '[품질 반송]';
const remandLabel = (note) => String(note || '').startsWith(QA_REMAND) ? '품질 반송' : '부서장 재검토 지시';
const remandBody = (note) => String(note || '').replace(QA_REMAND, '').trim();
const nowIso = () => new Date().toISOString();
const fmtWon = (n) => '₩' + Number(n || 0).toLocaleString();

/* ── B-20 처분방안 변경 (안 쓰는 처리끼리만) ──
   폐기 ↔ 불채용(반송)만 허용한다. 둘 다 「물건을 안 쓰는」 처리라 변경해도 위험이 늘지 않는다.
   수리·현상태 사용 등 「쓰는 처리」로는 기술 검토가 선행되어야 하므로 기존대로 회수 → 특채 트랙. */
const UNUSED_DISPS = ['폐기', '불채용(반송)'];
const CONCESSION = '특채(Concession)';
/* 특채 전환(차장 확정 260829) — 회수·재발행 없이 같은 문서에 이력으로 남긴다.
   위험이 큰 「쓰는 처리」이므로 안전장치를 둘로 둔다.
     ① 수락 시 특채 유형을 반드시 고른다 (절차서 5.3.4·5.3.7)
     ② 수락한 문서는 기존 흐름대로 최종승인 대기로 올라가 품질부서장 결재를 받는다
   마련 주체는 트랙과 무관하게 품질보증부다(disposition_by는 바뀌지 않는다). */
const dispChangeTargets = (cur) => {
    const t = UNUSED_DISPS.includes(cur) ? UNUSED_DISPS.filter(d => d !== cur) : [];
    if (cur !== CONCESSION) t.push(CONCESSION);
    return t;
};

/* ── B-21 품질비용 공통 검증(1차·2차 공용) ──
   기존 doCloseSubmit의 금액 검증 3종을 함수로 분리해 회람 검토 회신·종합검토·완료확인이 모두 같은 규칙을 쓴다. */
/* ── 금액 입력 정제 (차장 확정 08-22) ──
   금액칸 4곳(회람 검토 회신 · 종합검토 1차 · 완료확인 2차 · 1차 수정칸)이 같은 규칙을 쓴다.
   타이핑은 물론 「붙여넣기」까지 한 규칙으로 처리하는 것이 요점 —
   전에는 숫자가 아닌 글자만 지우고 나머지를 이어붙여 `1234.56` → `123456`(100배)이 됐다.
     ① 앞뒤 공백 · ₩ · + 제거, 끝의 「원」 제거   ② 천단위 쉼표 제거(붙여넣기 편의는 유지)
     ③ 맨 앞부터 연속된 숫자만 취함(첫 비숫자에서 중단)  ④ 선행 0 제거(전체가 0이면 "0" 유지)
     ⑤ 9자리 절삭 — 최대 999,999,999원              ⑥ 표시용 쉼표는 fmtAmt가 붙인다 */
const MAX_AMOUNT_DIGITS = 9;
const MAX_AMOUNT_TOTAL = 999999999;                        // 합계 상한 — 실무 최대 실적 5천만원의 20배 여유(차장 확인 08-22)
const MAX_AMOUNT_LABEL = '999,999,999';
const sanitizeAmount = (raw) => {
    const src = String(raw ?? '');
    let s = src.trim().replace(/^[₩\\+]+/, '').replace(/\s*원\s*$/, '').trim().replace(/,/g, '');
    let digits = (s.match(/^\d*/) || [''])[0];
    const cut = digits.length < s.length;                    // 숫자 뒤에 다른 글자가 있었다 = 잘렸다
    digits = digits.replace(/^0+(?=\d)/, '');                // 000123 → 123
    const over = digits.length > MAX_AMOUNT_DIGITS;
    if (over) digits = digits.slice(0, MAX_AMOUNT_DIGITS);
    const note = over ? `최대 ${MAX_AMOUNT_LABEL}원까지 입력할 수 있습니다.`
        : (cut && src.trim() ? '숫자만 입력됩니다 — 입력값의 숫자 앞부분만 반영했습니다.' : '');
    return { digits, note };
};
const fmtAmt = (d) => (String(d ?? '') === '' ? '' : Number(String(d).replace(/[^0-9]/g, '') || 0).toLocaleString());
const numOf = (v) => Number(String(v ?? '').replace(/[^0-9]/g, '').slice(0, MAX_AMOUNT_DIGITS) || 0);
const cleanCosts = (arr) => (arr || []).filter(c => String(c?.label ?? '').trim() || String(c?.amount ?? '').trim());
const validateCosts = (arr) => {
    for (const c of cleanCosts(arr)) {
        if (String(c.amount ?? '').trim() && !String(c.label ?? '').trim()) return '금액을 입력한 항목엔 항목명도 입력하세요.';
        if (String(c.label ?? '').trim() && !String(c.amount ?? '').trim()) return '항목명을 입력한 항목엔 금액도 입력하세요 (0원이면 0 입력).';
        if (/[^0-9]/.test(String(c.amount ?? '').replace(/[,\s]/g, ''))) return '금액은 숫자만 입력하세요 (소수점·음수 불가).';
        if (String(c.amount ?? '').replace(/[^0-9]/g, '').length > MAX_AMOUNT_DIGITS) return `금액은 항목당 최대 ${MAX_AMOUNT_LABEL}원까지 입력할 수 있습니다.`;
    }
    return null;
};
const sumCosts = (arr) => cleanCosts(arr).reduce((a, c) => a + numOf(c.amount), 0);

/* 비용 항목 입력 줄 (회람 검토 회신 · 종합검토 1차 공용) — Panel과 같은 이유로 모듈 스코프 */
const CostRows = ({ rows, setRows, addLabel, placeholder, showDept, inputCls }) => (<>
    {rows.map((c, i) => (
        <div key={i} className="flex gap-2 items-center">
            {showDept && <span className="text-[11px] text-slate-400 w-16 shrink-0 truncate" title={c.dept || ''}>{c.dept || '직접입력'}</span>}
            <input className={inputCls} placeholder={placeholder} value={c.label}
                onChange={e => setRows(p => p.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
            <input className={inputCls + ' max-w-[150px] text-right'} placeholder="금액" inputMode="numeric" value={fmtAmt(c.amount)}
                onChange={e => setRows(p => p.map((x, j) => {
                    if (j !== i) return x;
                    const { digits, note } = sanitizeAmount(e.target.value);
                    return { ...x, amount: digits, note };
                }))} />
            <button type="button" onClick={() => setRows(p => p.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500 px-1">✕</button>
        </div>
    ))}
    {rows.some(c => c.note) && <div className="text-[11px] text-amber-600">⚠ {rows.find(c => c.note).note}</div>}
    <div className="flex items-center justify-between">
        <button type="button" onClick={() => setRows(p => [...p, { label: '', amount: '', dept: '' }])} className="text-xs font-semibold text-blue-600">{addLabel}</button>
        <div className="text-sm font-bold text-slate-700">합계 {fmtWon(sumCosts(rows))}</div>
    </div>
    <div className="text-[11px] text-slate-400">숫자만 입력됩니다 · 항목당 최대 {MAX_AMOUNT_LABEL}원</div>
</>);

/* 결재 패널 공통 틀.
   ※ 모듈 스코프에 둔다 — 컴포넌트 본문 안에서 정의하면 렌더마다 함수 신원이 바뀌어 React가 패널을
     통째로 언마운트·재마운트하고, 그 결과 입력 한 글자마다 포커스가 날아가 한 글자만 남는다(실측). */
const Panel = ({ title, children, footer, onSubmit, submitLabel, color, needComment, commentLabel,
    comment, setComment, saving, onCancel, inputCls, btnO, btnP }) => (
    <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 space-y-3">
        <div className="text-sm font-bold text-slate-700">{title}</div>
        {children}
        <label className="block text-xs font-semibold text-slate-600">의견 {commentLabel || (needComment ? '(필수)' : '(선택)')}</label>
        <textarea rows={3} value={comment} onChange={e => setComment(e.target.value)} className={inputCls}
            placeholder={needComment ? '사유를 입력하세요 (필수)' : '의견을 입력하세요 (생략 가능)'} />
        {footer}
        <div className="flex justify-end gap-2">
            <button onClick={onCancel} disabled={saving} className={btnO}>취소</button>
            <button onClick={onSubmit} disabled={saving} className={`${btnP} ${color || 'bg-blue-600 hover:bg-blue-700'}`}>{submitLabel}</button>
        </div>
    </div>
);

const NCRDetail = ({ report, user, onClose, onChanged }) => {
    const [history, setHistory] = useState([]);
    const [atts, setAtts] = useState([]);
    const [settings, setSettings] = useState(null);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState(null);
    const [mode, setMode] = useState(null);
    const [comment, setComment] = useState('');
    const [showPrint, setShowPrint] = useState(false);
    const [opinion, setOpinion] = useState('approve');
    const [judgeKind, setJudgeKind] = useState('special');
    const [judgeDisp, setJudgeDisp] = useState('');
    const [judgeConc, setJudgeConc] = useState('');   // v10.2 특채 하위유형
    const [okConc, setOkConc] = useState('');        // v10.2 특채승인 시 유형 보정(구 상신분 대비)
    const [voidKind, setVoidKind] = useState('');    // v10.2 D-08 무효 구분
    const [judgeDepts, setJudgeDepts] = useState([]);
    const [requeryDept, setRequeryDept] = useState('');
    const [costItems, setCostItems] = useState([{ label: '', amount: '' }]);
    const [zeroWhy, setZeroWhy] = useState('');
    const [car, setCar] = useState('무');
    const [carNo, setCarNo] = useState('');
    const [allDepts, setAllDepts] = useState([]);
    const [dispo, setDispo] = useState('');
    /* B-20 처분방안 변경 요청 */
    const [dispReqOn, setDispReqOn] = useState(false);      // 회람 담당: 변경 요청 체크
    const [dispReqTo, setDispReqTo] = useState('');         // 변경 목표 처리방안
    const [dispDecisions, setDispDecisions] = useState({}); // 종합검토: { [부서]: '수락'|'거절'|'반송' }
    const [concPick, setConcPick] = useState('');          // 특채 수락 시 특채 유형
    /* B-21 품질비용 2단 산출 */
    const [deptCostOn, setDeptCostOn] = useState(false);                       // 회람 담당: 품질비용 있음 체크
    const [deptCosts, setDeptCosts] = useState([{ label: '', amount: '' }]);   // 회람 담당 입력 항목
    const [stage1Items, setStage1Items] = useState([]);                        // 종합검토 1차 항목 [{label, amount, dept}]
    const [s1Edits, setS1Edits] = useState({});                                // 완료확인 1차 수정 { [idx]: {on, amount, why} }
    /* H-③ 처리확인 증빙(첨부#4) — 완료확인 상신 때 함께 올리는 증거 파일. 선택(필수 아님) */
    const [closedAtts, setClosedAtts] = useState([]);                          // [{name, dataurl}] — 아직 저장 전(상신 시 POST)
    const [attErr, setAttErr] = useState(null);                                // 파일 처리 실패 안내(패널 안에서만 표시)

    useEffect(() => {
        fetchNcrSettings().then(setSettings);
        /* v10.2 (260829) — 조건을 서버로 넘겨 이 문서 것만 받는다. 화면 필터는 그대로 두어
           (조건을 못 쓰는 환경에서도) 결과가 달라지지 않게 한다. */
        const rid = encodeURIComponent(report.id);
        api.fetch(`/ncr_approvals?report_id=eq.${rid}`).then(r => r.json())
            .then(d => setHistory((d || []).filter(h => h.report_id === report.id).sort((a, b) => (a.at || '').localeCompare(b.at || ''))))
            .catch(() => setHistory([]));
        api.fetch(`/ncr_attachments?report_id=eq.${rid}`).then(r => r.json())
            /* v10.2 — 버킷에 있는 첨부(path)는 비공개라 서명 주소를 받아야 화면에 걸린다.
               예전 방식(dataurl)으로 저장된 행은 그대로 쓴다. */
            .then(d => withAttUrls((d || []).filter(a => a.report_id === report.id)))
            .then(setAtts)
            .catch(() => setAtts([]));
        api.fetch('/users').then(r => r.json())
            .then(d => setAllDepts([...new Set((d || []).map(u => u.company).filter(c => c && !['품질보증부', '응용기술팀'].includes(c)))].sort()))
            .catch(() => setAllDepts([]));
    }, [report.id]);

    /* v10.2 G-⑦ — 「v10.1인가」가 아니라 「레거시가 아닌가」로 판정한다(lib/ncrFlow.js 단일 정의).
       flow_ver가 v10.2·v10.3으로 올라가도 정상 문서가 레거시로 재분류되지 않는다. */
    const newFlow = isNewFlow(report);
    const ro = roleOf(user, settings);
    const reviews = report.reviews || {};
    const isAuthor = !!report.author_email && report.author_email === user?.email;

    /* extra: 같은 처리에서 별도 이력 1건을 더 남겨야 할 때(B-20 '처분방안 변경') — [{action, comment}]
       pre : 본 처리 직전에 끝내야 하는 부수 작업(H-③ 처리확인 증빙 첨부 저장) — 실패하면 상신 자체를 하지 않는다.
             (첨부만 빠진 채 상태가 넘어가면 되돌릴 방법이 없다) */
    const act = async (action, patch, cmt, extra, pre) => {
        setSaving(true); setErr(null);
        try {
            if (pre) await pre();
            await api.fetch(`/ncr_reports/${report.id}`, { method: 'PATCH', body: patch });
            for (const x of (extra || [])) {
                await api.fetch('/ncr_approvals', {
                    method: 'POST',
                    body: { report_id: report.id, action: x.action, actor_name: user?.name || '', actor_company: user?.company || '', comment: x.comment || '', at: nowIso() }
                });
            }
            await api.fetch('/ncr_approvals', {
                method: 'POST',
                body: { report_id: report.id, action, actor_name: user?.name || '', actor_company: user?.company || '', comment: cmt || '', at: nowIso() }
            });
            onChanged?.(); onClose?.();
        } catch (e) { setErr('처리 실패: ' + (e.message || e)); setSaving(false); }
    };

    /* ── B-20/B-21 파생값 ── */
    const dispTargets = dispChangeTargets(report.disposition || '');          // 변경 가능한 처리방안(없으면 UI 자체를 렌더하지 않음)
    const pendingDispReqs = Object.entries(reviews)                            // 종합검토에서 판단해야 할 미해결 변경 요청
        .filter(([, rv]) => rv?.disp_req && !rv.disp_req.resolved)
        .map(([dept, rv]) => ({ dept, req: rv.disp_req }));
    const dispRemandOn = pendingDispReqs.some(({ dept }) => dispDecisions[dept] === '반송');
    const dispConcOn = pendingDispReqs.some(({ dept, req }) => dispDecisions[dept] === '수락' && req.to === CONCESSION);
    const collectDeptCosts = () => Object.entries(reviews)                     // 부서가 회람에서 올린 비용 항목 → 1차 미리채움
        .flatMap(([dept, rv]) => (rv?.cost_items || []).map(c => ({ label: c.label || '', amount: String(c.amount ?? ''), dept })));
    const seedStage1 = () => {
        const saved = report.cost_stage1?.items;                               // 최종반려로 되돌아온 경우 직전 1차 입력을 되살린다
        /* 「0원으로 확정」한 판단도 저장된 판단이다 — 빈 배열이 falsy라 부서 입력이 되살아나던 것을 막는다 */
        if (Array.isArray(saved)) return saved.map(c => ({ label: c.label || '', amount: String(c.amount ?? ''), dept: c.dept || '' }));
        return collectDeptCosts();
    };
    const hasStage1 = !!report.cost_stage1;                                    // 없으면(기존 문서) 완료확인은 종전 검증 그대로
    const stage1Locked = (report.cost_stage1?.items || []).map(c => ({ label: c.label || '', amount: Number(c.amount || 0), dept: c.dept || '' }));
    const s1Amount = (i) => (s1Edits[i]?.on ? numOf(s1Edits[i].amount) : Number(stage1Locked[i]?.amount || 0));
    const s1Sum = stage1Locked.reduce((a, _c, i) => a + s1Amount(i), 0);
    const addSum = sumCosts(costItems);

    /* ── v10.1 게이트 핸들러 (v9.3 이식) ── */

    /* v10.2 D-1 — 품질 결재도 「차석이 대결했는가」를 이력에 남긴다.
       실측 결함(260829 스테이징 044 검증): 대결 표기가 부서승인·기술회신 2곳에만 있고
       품질 결재에는 없어, 차석이 부서장 대신 결재해도 이력에 그 사실이 남지 않았다.
       결재 기록은 「누가 어떤 자격으로 처리했는가」가 남아야 하므로 승인·반려 모두에 붙인다.
       판정 규칙은 deptHeadGate와 같다 — 부서장은 설정과 무관, 차석은 allow_deputy=true일 때만(fail-closed). */
    const qaGate = () => {
        if (ro.isQaHead) return { ok: true, deputy: false };
        if (!settings) return { ok: false, msg: '결재 설정을 불러오는 중입니다 — 잠시 후 다시 시도해 주십시오.' };
        if (ro.isQaDeputy) return { ok: true, deputy: true };
        return { ok: false, msg: '품질 결재 권한이 없습니다 — 이 시스템은 차석 대결을 허용하지 않도록 설정돼 있습니다.' };
    };
    const dTag = (deputy) => (deputy ? ' (차석 대결)' : '');

    const doIssueApprove = () => {
        const g = qaGate();
        if (!g.ok) return setErr(g.msg);
        if (report.tech_flag) {
            if (report.tech_reply) return act('발행승인', { status: '특채판단' }, `${comment || '(기존 기술 회신 재사용 — 재문의 생략)'}${dTag(g.deputy)}`.trim());
            const rv = { ...reviews, '응용기술팀': { state: 'wait', staff_email: null, staff_name: null, opinion: null, staff_cmt: '', staff_at: null, head_name: null, head_cmt: '', head_at: null, deputy: false, remand_note: '' } };
            return act('발행승인', { status: '기술문의', reviews: rv }, `${comment}${dTag(g.deputy)}`.trim());
        }
        act('발행승인', { status: '회람중' }, `${comment}${dTag(g.deputy)}`.trim());
    };
    const doIssueReject = () => {
        const g = qaGate();
        if (!g.ok) return setErr(g.msg);
        if (!comment.trim()) return setErr('반려 사유는 필수입니다.');
        act('발행반려', { status: '작성중', reject_note: `[발행반려 · ${user?.name}] ${comment.trim()}` }, `${comment}${dTag(g.deputy)}`);
    };
    const doTechStaff = () => {
        if (!comment.trim()) return setErr('검토 의견은 필수입니다.');
        const t = { ...(reviews['응용기술팀'] || {}), state: 'staffDone', staff_email: user?.email, staff_name: user?.name, opinion, staff_cmt: comment.trim(), staff_at: nowIso() };
        act('회람회신', { reviews: { ...reviews, '응용기술팀': t } }, `[기술 검토·${opinion === 'approve' ? '승인 의견' : '반려 의견'}] ${comment.trim()}`);
    };
    /* 기술 회신 확정 자격 — 부서장 결재(deptHeadGate)와 같은 원칙으로 쓰기 직전 다시 판정한다.
       렌더 가드만 두면 화면이 잘못 뜨는 순간에 확정이 실제로 완주된다. 설정을 못 읽었으면 대결은 막는다. */
    const doTechHead = () => {
        const g = techApprovalDecision(user, settings);
        if (!g.allowed) return setErr(settings
            ? '기술 회신을 확정할 권한이 없습니다 — 이 시스템은 차석 대결을 허용하지 않도록 설정돼 있습니다.'
            : '결재 설정을 불러오는 중입니다 — 잠시 후 다시 시도해 주십시오.');
        const t = reviews['응용기술팀'] || {};
        const upd = { ...t, state: 'done', head_name: user?.name, head_cmt: comment.trim(), head_at: nowIso(), deputy: g.deputy };
        act('기술회신', { status: '특채판단', reviews: { ...reviews, '응용기술팀': upd }, tech_reply: { summary: t.staff_cmt || comment.trim(), at: nowIso() } }, `${comment || '기술 회신 확정'}${g.deputy ? ' (차석 대결)' : ''}`);
    };
    const doJudgeSubmit = () => {
        if (!comment.trim()) return setErr('판단 사유는 필수입니다.');
        if (judgeKind === 'normal' && !judgeDisp) return setErr('일반 전환 시 처리방안을 선택하세요.');
        if (judgeKind === 'special' && !judgeConc) return setErr('특채 유형을 선택하세요 (현상태 사용·수리·재등급 부여·관련부품 수정).');
        if (judgeDepts.length === 0) return setErr('본회람 대상 부서를 1곳 이상 선택하세요.');
        act('특채판단 상신', { status: '특채승인 대기', judge_plan: { kind: judgeKind, disp: judgeKind === 'special' ? '특채(Concession)' : judgeDisp, conc: judgeKind === 'special' ? judgeConc : '', note: comment.trim(), depts: judgeDepts } }, comment);
    };
    const doSpecialApprove = () => {
        const g = qaGate();
        if (!g.ok) return setErr(g.msg);
        const p = report.judge_plan || { depts: [], disp: '특채(Concession)', conc: '' };
        /* v10.2 가드 — 특채는 유형(현상태 사용·수리·재등급 부여·관련부품 수정) 없이 확정될 수 없다 (절차서 5.3.4·5.3.7).
           구 버전에서 상신되어 conc가 없는 문서는 승인 패널에서 보정 선택을 받는다. */
        const conc = p.conc || okConc;
        if (String(p.disp || '').startsWith('특채') && !conc) return setErr('특채 유형을 선택하세요 — 유형 없이는 특채를 확정할 수 없습니다.');
        const rv = { ...reviews };
        allDepts.forEach(d => { if (!p.depts.includes(d)) rv[d] = { ...(rv[d] || {}), state: 'skip' }; });
        p.depts.forEach(d => { rv[d] = { state: 'wait', staff_email: null, staff_name: null, opinion: null, staff_cmt: '', staff_at: null, head_name: null, head_cmt: '', head_at: null, deputy: false, remand_note: '' }; });
        const base = comment || `특채 판단 승인 — 본회람 발사 (${p.depts.join('·')})`;
        act('특채승인', { status: '회람중', reviews: rv, disposition: p.disp, concession_type: conc }, `${base}${dTag(g.deputy)}`);
    };
    const doSpecialReject = () => {
        const g = qaGate();
        if (!g.ok) return setErr(g.msg);
        if (!comment.trim()) return setErr('반려 사유는 필수입니다.');
        act('특채반려', { status: '특채판단' }, `${comment}${dTag(g.deputy)}`);
    };
    const doDeptStaff = () => {
        if (!comment.trim()) return setErr('검토 의견은 필수입니다.');
        /* B-20 처분방안 변경 요청 (선택) — 안 쓰는 처리끼리만 열려 있으므로 목표값 검증만 한다 */
        if (dispReqOn && !dispTargets.includes(dispReqTo)) return setErr('변경할 처분방안을 선택하세요.');
        /* B-21 품질비용 (선택) — 금액 검증은 완료확인과 동일 규칙 */
        if (deptCostOn) { const e = validateCosts(deptCosts); if (e) return setErr(e); }
        const items = deptCostOn ? cleanCosts(deptCosts).map(c => ({ label: String(c.label).trim(), amount: numOf(c.amount) })) : null;
        /* 재질의·부서 내 재검토로 다시 회신할 때: 아직 판단 전인 요청은 이번 회신으로 갈아끼우되,
           이미 종합검토에서 수락/거절된 요청 기록은 절대 지우지 않는다(감사 근거 보존). */
        const prevReq = reviews[ro.company]?.disp_req;
        /* 이미 수락·거절이 끝난 요청 위에 새 요청을 덮어쓰면 결재 근거가 통째로 사라진다.
           과거 기록은 disp_req_prev로 밀어 보존하고, 현재 요청 칸에는 새 요청만 담는다(화면·인쇄는 현재 요청만 표시). */
        const prevArchive = reviews[ro.company]?.disp_req_prev;
        const archive = (dispReqOn && prevReq?.resolved) ? [...(prevArchive || []), prevReq] : prevArchive;
        const mine = {
            ...(reviews[ro.company] || {}), state: 'staffDone', staff_email: user?.email, staff_name: user?.name,
            opinion, staff_cmt: comment.trim(), staff_at: nowIso(), remand_note: '',
            disp_req: dispReqOn ? { to: dispReqTo, note: comment.trim(), by: user?.name || '', at: nowIso() } : (prevReq?.resolved ? prevReq : null),
            ...(archive && archive.length ? { disp_req_prev: archive } : {}),
            cost_items: items && items.length ? items : null
        };
        const tag = dispReqOn ? `[처분방안 변경 요청 → ${dispReqTo}] ` : '';
        act('회람회신', { reviews: { ...reviews, [ro.company]: mine } }, `${tag}[${ro.company} 검토·${opinion === 'approve' ? '승인 의견' : '반려 의견'}] ${comment.trim()}`);
    };
    /* 부서장 결재 자격 — 쓰기 직전 다시 판정한다.
       B-20 #1의 교훈: 렌더 가드만 두면 화면이 잠깐 잘못 뜨는 순간에 결재가 실제로 완주된다.
       설정을 아직 못 읽었으면 「모른다」이므로 통과시키지 않는다(director는 설정과 무관하므로 그대로 통과). */
    const deptHeadGate = () => {
        if (ro.isDeptHead(ro.company)) return { ok: true, deputy: false };
        if (!settings) return { ok: false, msg: '결재 설정을 불러오는 중입니다 — 잠시 후 다시 시도해 주십시오.' };
        if (ro.isDeptDeputy(ro.company)) return { ok: true, deputy: true };
        return { ok: false, msg: '부서장 결재 권한이 없습니다 — 이 시스템은 차석 대결을 허용하지 않도록 설정돼 있습니다.' };
    };
    const doDeptHead = () => {
        const g = deptHeadGate();
        if (!g.ok) return setErr(g.msg);
        const deputy = g.deputy;
        /* B-20: 담당이 올린 처분방안 변경 요청은 그대로 보존한다 — 부서 공식 의견으로 확정되는 지점 */
        const mine = { ...(reviews[ro.company] || {}), state: 'done', head_name: user?.name, head_cmt: comment.trim() || '승인.', head_at: nowIso(), deputy };
        const rv = { ...reviews, [ro.company]: mine };
        const allDone = Object.values(rv).every(v => ['done', 'skip'].includes(v.state));
        const dispTag = (mine.disp_req && !mine.disp_req.resolved) ? ' (처분방안 변경 요청 포함)' : '';
        act('부서승인', { reviews: rv, ...(allDone ? { status: '종합검토' } : {}) }, `${comment.trim() || '승인.'}${deputy ? ' (차석 대결)' : ''}${dispTag}`);
    };
    const doDeptRemand = () => {
        const g = deptHeadGate();
        if (!g.ok) return setErr(g.msg);
        if (!comment.trim()) return setErr('재검토 지시 사유는 필수입니다.');
        const mine = { ...(reviews[ro.company] || {}), state: 'wait', remand_note: comment.trim() };
        act('부서내 재검토', { reviews: { ...reviews, [ro.company]: mine } }, `${comment.trim()} (품질 미경유)`);
    };
    const doDeptRejectQa = () => {
        const g = deptHeadGate();
        if (!g.ok) return setErr(g.msg);
        if (!comment.trim()) return setErr('반려 사유는 필수입니다 — 문서 자체 문제일 때만 사용하세요.');
        act('품질반려', { status: '작성중', reject_note: `[품질 반려 · ${ro.company} ${user?.name}] ${comment.trim()}` }, comment);
    };
    const doQaSubmit = () => {
        if (!comment.trim()) return setErr('종합검토 의견은 필수입니다 (부서 회신 요약 + 처리방안 확정 사유).');
        /* B-20 — 미해결 변경 요청은 수락·거절·반송 중 하나를 반드시 정하고 넘어간다 */
        for (const p of pendingDispReqs) {
            if (!dispDecisions[p.dept]) return setErr(`처분방안 변경 요청(${p.dept})에 대해 수락·거절·반송 중 하나를 선택하세요.`);
        }
        /* 반송(차장 확정 260829) — 요청을 판단하지 않고 요청 부서로 되돌린다.
           문서는 회람중으로 돌아가고 해당 부서만 다시 회신한다. 다른 부서 회신은 그대로 둔다.
           상신이 아니므로 비용 확정 절차를 타지 않는다. */
        const remandList = pendingDispReqs.filter(({ dept }) => dispDecisions[dept] === '반송');
        if (remandList.length) {
            if (remandList.length !== pendingDispReqs.length) return setErr('반송은 다른 판단과 섞을 수 없습니다 — 전부 반송하거나, 반송을 빼고 수락·거절로 정하세요.');
            const rvR = { ...reviews };
            remandList.forEach(({ dept, req }) => {
                rvR[dept] = { ...(rvR[dept] || {}), state: 'wait', remand_note: `${QA_REMAND} ${comment.trim()}`, disp_req: { ...req, remanded_by: user?.name || '', remanded_at: nowIso() } };
            });
            act('요청 반송', { status: '회람중', reviews: rvR }, `[처분방안 변경 요청 반송 → ${remandList.map(r => r.dept).join('·')}] ${comment.trim()}`);
            return;
        }
        /* B-21 1차 — 처리방안 비용 확정 (합계 0원이면 사유 필수) */
        const cerr = validateCosts(stage1Items); if (cerr) return setErr(cerr);
        const items = cleanCosts(stage1Items).map(c => ({ label: String(c.label).trim(), amount: numOf(c.amount), dept: c.dept || '' }));
        const total = items.reduce((a, c) => a + c.amount, 0);
        if (total === 0 && !zeroWhy.trim()) return setErr('처리방안 비용 합계 0원은 사유를 기입해야 합니다.');
        /* 합계 상한 — 실무 최대 실적이 5천만원이라 10억은 20배 여유. 0을 하나 더 찍는 실수를 거른다(차장 확인 08-22). */
        if (total > MAX_AMOUNT_TOTAL) return setErr(`처리방안 비용 합계가 ${MAX_AMOUNT_LABEL}원을 넘을 수 없습니다 (현재 ${fmtWon(total)}). 금액을 확인해 주십시오.`);

        /* B-20 — 수락 측 범위 재검증. 쓰기 측(doDeptStaff)만 막으면 구버전·외부 주입 요청이 그대로 통과한다.
           「쓰는 처리」로의 전환은 기술 검토가 선행되어야 하므로 수락 처리 직전에 한 번 더 막는다. */
        const cur = report.disposition || '';
        const allowedTo = dispChangeTargets(cur);
        const acceptList = pendingDispReqs.filter(({ dept }) => dispDecisions[dept] === '수락');
        for (const { req } of acceptList) {
            if (!allowedTo.includes(req.to)) return setErr(`허용되지 않는 처리방안 전환입니다 (${cur} → ${req.to}).`);
        }
        /* 특채 수락 — 유형 선택을 강제한다(절차서 5.3.4·5.3.7). 유형 없는 특채는 인쇄물·이력에서 근거가 비게 된다. */
        const concAccepted = acceptList.some(({ req }) => req.to === CONCESSION);
        if (concAccepted && !concPick) return setErr('특채로 전환하려면 특채 유형을 선택하세요 (현상태 사용·수리·재등급 부여·관련부품 수정).');
        /* B-20 — 처리방안 변경은 1회만 적용한다. 서로 다른 목표를 동시에 수락하면 마지막 것만 남고
           disposition_prev가 중간값으로 오염되므로 아예 막는다. */
        const acceptTargets = [...new Set(acceptList.map(({ req }) => req.to))];
        if (acceptTargets.length > 1) return setErr(`서로 다른 처리방안 변경 요청(${acceptTargets.join(' · ')})을 동시에 수락할 수 없습니다 — 하나만 수락하고 나머지는 거절하세요.`);

        const rv = { ...reviews };
        const accepted = acceptTargets.length === 1;
        const disp = accepted ? acceptTargets[0] : cur;                        // 변경은 1회만
        const prev = accepted ? cur : (report.disposition_prev || '');         // 최초 값 1회만 기록
        const extra = [];
        const acceptedDepts = [];
        pendingDispReqs.forEach(({ dept, req }) => {
            /* 같은 변경을 요청한 부서는 전부 「수락」으로 남긴다 — 변경이 실제로 적용된 이상 거절 기록은 사실과 다르다 */
            const dec = (accepted && req.to === disp) ? '수락' : dispDecisions[dept];
            if (dec === '수락') acceptedDepts.push(`${dept}${req.by ? ' ' + req.by : ''}`);
            /* 수락·거절 어느 쪽이든 요청 기록은 지우지 않고 resolved로 마킹해 남긴다 */
            rv[dept] = { ...(rv[dept] || {}), disp_req: { ...req, resolved: dec, resolved_by: user?.name || '', resolved_at: nowIso() } };
        });
        /* 이력도 1건만 — 요청 부서는 나열한다 */
        if (accepted) extra.push({ action: '처분방안 변경', comment: `${prev} → ${disp} · 요청 ${acceptedDepts.join('·')} · 수락 품질담당 ${user?.name || ''}` });
        const patch = {
            status: '최종승인 대기',
            qa_summary: { text: comment.trim(), at: nowIso(), by: user?.name },
            reviews: rv,
            cost_stage1: { items, total, zero_why: total === 0 ? zeroWhy.trim() : '', at: nowIso(), by: user?.name || '' }
        };
        if (accepted) {
            patch.disposition = disp;
            patch.disposition_prev = prev;
            /* 특채로 바뀐 경우에만 유형을 쓴다. 특채가 아닌 전환은 기존 유형을 지운다. */
            patch.concession_type = disp === CONCESSION ? concPick : '';
        }
        act('종합검토 상신', patch, comment, extra);
    };
    const doRequery = () => {
        if (!requeryDept) return setErr('재질의할 부서를 선택하세요.');
        if (!comment.trim()) return setErr('재질의 사유는 필수입니다.');
        /* C영역 회귀 실측(08-22) — 드롭다운이 state==='done'만 걸러 「부서」를 안 걸렀다.
           그 결과 기술문의 트랙의 응용기술팀이 재질의 후보로 떴고, 선택하면 회신이 회람 트랙으로 들어가
           tech_reply.summary가 갱신되지 않아 상세 카드·인쇄물(FORM 933-07)이 낡은 기술 회신을 계속 표시했다.
           기술 회신을 다시 받으려면 회수 후 발행 승인을 새로 받아 선행회람을 재발사해야 한다. */
        if (requeryDept === '응용기술팀') return setErr('응용기술팀은 이 기능으로 재질의할 수 없습니다 — 기술 회신을 다시 받으려면 회수 후 발행 승인을 새로 받으십시오.');
        const cur = reviews[requeryDept];
        if (!cur || cur.state !== 'done') return setErr('회신이 끝난 부서만 재질의할 수 있습니다.');
        const mine = { ...cur, state: 'wait', remand_note: '' };
        act('재질의', { status: '회람중', reviews: { ...reviews, [requeryDept]: mine } }, `[재질의 → ${requeryDept}] ${comment.trim()}`);
    };
    const doFinalApprove = () => {
        const g = qaGate();
        if (!g.ok) return setErr(g.msg);
        const base = comment || (g.deputy ? '최종 승인' : '최종 승인 (품질부서장 전결)');
        act('최종승인', { status: '처리중' }, `${base}${dTag(g.deputy)}`);
    };
    /* 최종반려 = 「종합검토를 다시 하라」.
       실측 결함(260829): 종합검토 상신 시점에 처분방안 변경이 이미 적용되므로, 부서장이
       「특채 근거 불충분」으로 반려해도 처리방안은 특채인 채로 남고 요청은 수락 처리된 상태라
       담당이 되돌릴 수단이 없었다. 특채인 채로 재상신하는 것 말고는 길이 없다.
       그래서 반려 시 ①변경된 처분방안을 원래 값으로 되돌리고 ②판단이 끝난 요청을 다시 미해결로 열어
       담당이 처음부터 다시 판단하게 한다. 폐기↔불채용 변경(B-20)에도 같은 규칙이 적용된다. */
    const doFinalReject = () => {
        const g = qaGate();
        if (!g.ok) return setErr(g.msg);
        if (!comment.trim()) return setErr('반려 사유는 필수입니다.');
        const patch = { status: '종합검토', qa_summary: null };
        if (hasDispChange(report)) {
            patch.disposition = report.disposition_prev;
            patch.disposition_prev = null;
            patch.concession_type = '';
        }
        const rv = { ...reviews };
        let reopened = 0;
        Object.keys(rv).forEach(k => {
            const q = rv[k]?.disp_req;
            if (q && q.resolved) {
                const { resolved, resolved_by, resolved_at, ...rest } = q;
                rv[k] = { ...rv[k], disp_req: rest };
                reopened += 1;
            }
        });
        if (reopened) patch.reviews = rv;
        const tag = patch.disposition ? ` (처리방안 ${report.disposition} → ${patch.disposition} 원복)` : '';
        act('최종반려', patch, `${comment}${tag}${dTag(g.deputy)}`);
    };
    const doCloseSubmit = () => {
        const items = cleanCosts(costItems);
        /* B-21 — 「1건 이상 필수」는 1차(종합검토)로 이동. 1차가 있으면 추가분 0건도 허용한다.
           1차가 없는 기존 문서는 종전 검증(1건 이상 + 0원 사유)을 그대로 유지한다. */
        if (!hasStage1 && items.length === 0) return setErr('품질비용 항목을 1건 이상 입력하세요 (없으면 0원 + 사유).');
        const cerr = validateCosts(costItems); if (cerr) return setErr(cerr);
        /* 1차 확정분 수정 — 금액 검증 + 수정 사유 필수 */
        for (let i = 0; i < stage1Locked.length; i++) {
            const e = s1Edits[i];
            if (!e?.on) continue;
            if (!String(e.amount ?? '').trim()) return setErr('수정한 처리방안 비용 항목의 금액을 입력하세요 (0원이면 0 입력).');
            if (/[^0-9]/.test(String(e.amount).replace(/[,\s]/g, ''))) return setErr('금액은 숫자만 입력하세요 (소수점·음수 불가).');
            if (!String(e.why ?? '').trim()) return setErr('처리방안 비용을 수정하려면 수정 사유가 필요합니다.');
        }
        const s1Rows = stage1Locked.map((c, i) => s1Edits[i]?.on
            ? { label: c.label, amount: numOf(s1Edits[i].amount), dept: c.dept, stage: '수정', edit_why: String(s1Edits[i].why).trim() }
            : { label: c.label, amount: Number(c.amount || 0), dept: c.dept, stage: '처리방안' });
        const addRows = items.map(c => ({ label: String(c.label).trim(), amount: numOf(c.amount), stage: '완료확인' }));
        const s1Total = s1Rows.reduce((a, c) => a + c.amount, 0);
        const total = s1Total + addRows.reduce((a, c) => a + c.amount, 0);
        /* 2차(추가 발생분)는 0원이어도 사유가 필요 없다 — 0원 사유는 1차 없는 기존 문서에서만 유지 */
        if (!hasStage1 && total === 0 && !zeroWhy.trim()) return setErr('품질비용 0원은 사유를 기입해야 합니다.');
        if (total > MAX_AMOUNT_TOTAL) return setErr(`품질비용 합계가 ${MAX_AMOUNT_LABEL}원을 넘을 수 없습니다 (현재 ${fmtWon(total)}). 금액을 확인해 주십시오.`);
        if (car === '유' && !carNo.trim()) return setErr('시정조치 유 선택 시 CAR 번호는 필수입니다.');
        const closed = {
            note: comment.trim() || '부적합품 처리 결과 확인 완료.',
            cost_items: [...s1Rows, ...addRows], cost_total: total,
            zero_why: (!hasStage1 && total === 0) ? zeroWhy.trim() : '',
            car, car_no: car === '유' ? carNo.trim() : '', at: nowIso(), by: user?.name
        };
        if (hasStage1) closed.cost_stage1_total = s1Total;
        /* H-③ 처리확인 증빙 — 기존 첨부와 같은 저장소(ncr_attachments), category 4로 구분해 건별 INSERT.
           작성화면 첨부(1·2·3)와 겹치지 않으므로 기존 화면·인쇄 로직이 영향받지 않는다.
           by(올린 사람)는 여기서만 남긴다 — 1~3은 작성자가 올린 것이라 인쇄 목록에서 author_name으로 대신한다. */
        const saveEvid = closedAtts.length === 0 ? null : async () => {
            const at = nowIso();
            for (const a of closedAtts) {
                /* v10.2 — 실파일은 버킷에 올리고 표에는 경로만 남긴다.
                   업로드가 실패하면 예외가 올라가 act()의 pre 단계에서 상신이 중단된다. */
                const p = await uploadAtt(report.id, a.name, a.dataurl);
                await api.fetch('/ncr_attachments', {
                    method: 'POST',
                    body: { report_id: report.id, category: ATT_CAT.CLOSED, name: a.name, path: p, at, by: user?.name || '' }
                });
            }
        };
        act('완료확인', { status: '종결승인 대기', closed },
            `완료확인 · 품질비용 ${fmtWon(total)}${car === '유' ? ' · CAR ' + carNo : ''}${closedAtts.length ? ` · 증빙 ${closedAtts.length}건` : ''}`,
            undefined, saveEvid);
    };
    const doCloseApprove = () => {
        const g = qaGate();
        if (!g.ok) return setErr(g.msg);
        act('종결승인', { status: '종결' }, `${comment || '종결 승인'}${dTag(g.deputy)}`);
    };
    const doCloseReject = () => {
        const g = qaGate();
        if (!g.ok) return setErr(g.msg);
        if (!comment.trim()) return setErr('반려 사유는 필수입니다 (예: 품질비용 재산정).');
        act('종결반려', { status: '처리중', closed: null }, `${comment}${dTag(g.deputy)}`);
    };
    const doVoidApprove = () => {
        const g = qaGate();
        if (!g.ok) return setErr(g.msg);
        const q = report.void_req || {};
        const base = comment || `무효 승인 — ${q.kind || ''}`;
        act('무효승인', { status: '무효', void_note: `[${q.kind || '기타'}] ${q.note || ''}`.trim() }, `${base}${dTag(g.deputy)}`);
    };
    const doVoidReject = () => {
        const g = qaGate();
        if (!g.ok) return setErr(g.msg);
        if (!comment.trim()) return setErr('무효 반려 사유는 필수입니다.');
        act('무효반려', { status: '작성중', void_req: null }, `${comment}${dTag(g.deputy)}`);
    };
    /* v10.2 D-06 — 회수 시 이전 회차 회람 기록도 초기화(재발행 시 오염 방지) */
    const doWithdraw = () => act('회수', { status: '작성중', tech_reply: null, judge_plan: null, reviews: {} }, comment || '회수');
    /* v10.2 D-08 — 무효 2단 결재: 품질담당 상신 → 품질부서장 승인.
       절차서 5.5.1(품질보증부서장 승인으로 완결) 정신 적용. 무효는 되돌릴 수 없고 통계에서 제외되므로
       상신자·승인자·구분·사유를 모두 실명으로 남긴다. */
    const doVoid = () => {
        if (!voidKind) return setErr('무효 구분을 선택하세요 (중복 발행 · 오기재/착오 발행 · 부적합 아님으로 판명 · 기타).');
        if (!comment.trim()) return setErr('즉시종결(무효) 사유는 필수입니다.');
        act('무효상신', { status: '무효승인 대기', void_req: { kind: voidKind, note: comment.trim(), by: user?.name, company: ro.company, at: nowIso() } }, `[${voidKind}] ${comment.trim()}`);
    };

    /* ── 레거시(v10.0) 단선 결재 — 기존 로직 보존 ── */
    /* v10.2 D-04 — 레거시 문서도 절차서 5.3.4 용어로 통일. 구 용어(반품·특채(그대로 사용))는
       기존 문서 값 표시용으로만 남기고 신규 선택지에서는 제외한다. */
    const DISPS_LEGACY = ['재작업', '수리', '폐기', '불채용(반송)', '특채(Concession)'];
    const legacyApprovable = !newFlow && canApprove(user, report, settings);
    /* v10.2 G-① 미아 문서 방지 — 작성자 회수 판정을 「이력 기반」에서 「현재 상태 기반」으로 바꾼다.
       종전: 이력에 '승인'·'특채 상신'·'특채 승인'·'특채 불가' 중 하나라도 있으면 영구 false.
       F영역 실측(08-22 #23·#49): 레거시 특채 문서가 [특채 불가]로 '발행'에 떨어지면
       ─ 그 문서의 dept(구매부)에 결재 자격자(부장·차장·admin)가 0명이라 아무도 결재할 수 없고
       ─ 이력에 '특채 상신'이 남아 있어 작성자 회수도 영구 차단 → DB를 직접 고치는 것 외에 복구 경로가 없었다.
       「과거에 무슨 일이 있었나」가 아니라 「지금 어떤 상태인가」로 판정한다(신규-1과 같은 원칙).
       진행 중 상태(발행·특채 판단)면 작성자는 언제든 회수해 작성중으로 되돌릴 수 있고,
       이미 끝난 문서(종결·무효·반려)는 목록에 없으므로 되살아나지 않는다. */
    const LEGACY_WITHDRAWABLE = ['발행', '특채 판단'];
    const legacyWithdraw = !newFlow && isAuthor && LEGACY_WITHDRAWABLE.includes(report.status);
    const doLegacy = (action, nextStatus, cmt, patch) => act(action, { status: nextStatus, ...(patch || {}) }, cmt);
    const submitLegacy = () => {
        /* 레거시(v10.0) 단선 결재도 쓰기 직전 재판정한다 — 현재는 canApprove가 fail-closed라
           버튼이 뜨지 않지만, 렌더 가드 하나에만 의존하지 않는다(B-20 #1의 교훈). */
        /* 회수는 작성자 권한이라 결재 설정과 무관하다 — 게이트 두 줄 모두에서 면제해야 한다.
           재검증 실측(08-22): 첫 줄에서 면제를 빠뜨려 설정 지연창에 회수가 거부됐다(v10.1 회수는 정상). */
        if (mode !== 'lg_withdraw') {
            if (!settings) return setErr('결재 설정을 불러오는 중입니다 — 잠시 후 다시 시도해 주십시오.');
            if (!canApprove(user, report, settings)) return setErr('이 문서를 결재할 권한이 없습니다.');
        }
        const cmt = comment.trim();
        if (mode === 'lg_approve') {
            if (!dispo) { setErr('처리방안을 선택하세요.'); return; }
            if (dispo.startsWith('특채')) doLegacy('특채 상신', '특채 판단', cmt, { disposition: dispo });
            else doLegacy('승인', '종결', cmt, { disposition: dispo });
        }
        else if (mode === 'lg_reject') { if (!cmt) return setErr('반려 시 의견은 필수입니다.'); doLegacy('반려', '반려', cmt); }
        /* v10.2 G-③ — 레거시 특채 승인에도 유형 가드를 건다.
           종전에는 이 경로만 유형 없이 '종결'로 직행해, v10.1 경로(doSpecialApprove)에는 있는
           「유형 없는 특채 확정 금지」(절차서 5.3.4·5.3.7) 기준이 레거시에서만 뚫려 있었다.
           에러 문구·유형 목록(settings.concession_types)은 v10.1 경로와 같은 것을 쓴다.
           ※ 이미 유형 없이 종결된 과거 문서는 건드리지 않는다(소급 수정 금지) — 이 가드는 새 확정에만 적용된다. */
        else if (mode === 'lg_tokOk') {
            if (!okConc) return setErr('특채 유형을 선택하세요 — 유형 없이는 특채를 확정할 수 없습니다.');
            doLegacy('특채 승인', '종결', cmt, { concession_type: okConc });
        }
        else if (mode === 'lg_tokNo') { if (!cmt) return setErr('특채 불가 시 사유는 필수입니다.'); doLegacy('특채 불가', '발행', cmt); }
        /* G-① — 회수는 이력에 「어느 상태에서 되돌렸는지」가 남아야 나중에 경위를 읽을 수 있다 */
        else if (mode === 'lg_withdraw') doLegacy('회수', '작성중', cmt || `작성자 회수 — ${report.status} → 작성중 (내용 보완 후 재발행)`);
    };

    const myTurn = myTurnV101(user, report, settings);
    /* 설정 미로딩·조회실패로 차석 대결이 잠겼고, 하필 manager의 대결 차례인 경우에만 안내한다. */
    const deputyLockNotice = ro.role === 'manager' && settings && (!settings.loaded || !settings.approval_row) && (
        newFlow
            ? (report.status === '회람중' && reviews[ro.company]?.state === 'staffDone')
            : ((report.status === '발행' && ro.company === report.dept) || (report.status === '특채 판단' && ro.isQa))
    );
    const canWithdrawV101 = newFlow && isAuthor && ['발행승인 대기', '기술문의', '특채판단', '특채승인 대기', '회람중'].includes(report.status);
    const canVoid = newFlow && ro.isQaStaff && report.status === '작성중';

    const pairs = (() => { const m = new Map(); atts.filter(a => a.category === 1).forEach(a => { const k = a.pair_no || 1; if (!m.has(k)) m.set(k, {}); m.get(k)[a.kind === '정상' ? 'good' : 'bad'] = a; }); return [...m.entries()].sort((x, y) => x[0] - y[0]).map(e => e[1]); })();
    const drawings = atts.filter(a => a.category === 2);
    const refDocs = atts.filter(a => a.category === 3);
    const closedEvid = atts.filter(a => Number(a.category) === ATT_CAT.CLOSED);   // H-③ 첨부#4 처리확인 증빙

    /* ── H-③ 처리확인 증빙 담기 (완료확인 패널 전용) ──
       사진·파일 둘 다 받는다. 작성화면과 같은 processAnyFile을 통과시켜
       이미지는 1280px JPEG로 축소되고, 비이미지는 5MB를 넘으면 거절된다. */
    const addClosedFiles = async (e) => {
        const files = [...(e.target.files || [])];
        e.target.value = '';
        if (!files.length) return;
        setAttErr(null);
        try {
            const rows = await Promise.all(files.map(processAnyFile));
            setClosedAtts(l => [...l, ...rows]);
        } catch (er) { setAttErr('파일 처리 실패: ' + (er.message || er)); }
    };
    /* H-① 캡처 붙여넣기 — 대상은 'closed' 한 곳(시뮬레이터 pendClosed와 같은 자리) */
    const pz = useCapturePaste(async (target, file) => {
        if (target !== 'closed') return;
        setAttErr(null);
        try {
            const row = await processAnyFile(file);
            setClosedAtts(l => [...l, row]);
        } catch (er) { setAttErr('캡처 처리 실패: ' + (er.message || er)); }
    });

    const openPanel = (m) => {
        setMode(m); setComment(''); setErr(null);
        /* G-③ — 레거시 특채 승인 패널은 열 때마다 유형 선택을 비운다(직전 문서 값이 남아 잘못 확정되는 것 방지) */
        if (m === 'lg_tokOk') setOkConc('');
        /* B-20/B-21 패널 상태 시딩 — 새 필드가 없는 기존 문서에서도 안전한 기본값으로 시작한다 */
        if (m === 'deptStaff') {
            /* 부서 내 재검토·재질의로 다시 회신할 때 직전 회신의 비용·변경 요청을 되살린다.
               담당이 의도적으로 지우면 지워지고, 방치하면 그대로 유지된다(소리 없는 유실 방지). */
            const mineRv = reviews[ro.company] || {};
            const prevItems = Array.isArray(mineRv.cost_items) ? mineRv.cost_items : [];
            setDeptCostOn(prevItems.length > 0);
            setDeptCosts(prevItems.length > 0 ? prevItems.map(c => ({ label: c.label || '', amount: String(c.amount ?? '') })) : [{ label: '', amount: '' }]);
            const openReq = (mineRv.disp_req && !mineRv.disp_req.resolved) ? mineRv.disp_req : null;   // 미해결분만
            setDispReqOn(!!openReq && dispTargets.length > 0);
            setDispReqTo(openReq && dispTargets.includes(openReq.to) ? openReq.to : (dispTargets[0] || ''));
        }
        if (m === 'qaSubmit') { setDispDecisions({}); setConcPick(''); setStage1Items(seedStage1()); setZeroWhy(report.cost_stage1?.zero_why || ''); }
        /* H-③: 패널을 열 때 증빙 담아둔 것도 비운다 — 직전에 열었다 닫은 문서의 사진이 남아 잘못 올라가는 것 방지 */
        if (m === 'close') { setS1Edits({}); setCostItems([{ label: '', amount: '' }]); setZeroWhy(''); setClosedAtts([]); setAttErr(null); pz.setHover(null); pz.pin(null); }
    };
    const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
    const btnP = 'px-4 py-2 text-sm font-semibold rounded-lg text-white disabled:opacity-50';
    const btnO = 'px-4 py-2 text-sm font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-50';

    /* 모듈 스코프 Panel에 넘길 공통 props — 렌더마다 값만 바뀌고 컴포넌트 신원은 고정된다(포커스 유지) */
    const panelBase = {
        comment, setComment, saving, inputCls, btnO, btnP,
        onCancel: () => { setMode(null); setComment(''); setErr(null); }
    };

    /* ── B-20/B-21 · 회람 검토 회신 패널 하단 (검토 의견 입력칸 아래) ── */
    const deptStaffExtra = (
        <div className="space-y-3">
            {dispTargets.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 space-y-2">
                    <label className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                        <input type="checkbox" checked={dispReqOn}
                            onChange={e => { setDispReqOn(e.target.checked); if (e.target.checked && !dispReqTo) setDispReqTo(dispTargets[0]); }} />
                        처분방안 변경 · 특채 요청
                    </label>
                    {dispReqOn && (<>
                        <select value={dispReqTo} onChange={e => setDispReqTo(e.target.value)} className={inputCls} aria-label="변경할 처분방안">
                            <option value="">— 선택 —</option>
                            {dispTargets.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                        <p className="text-[11px] text-amber-700">현재 <b>{report.disposition || '미정'}</b> → 변경 요청. 위 검토 의견이 변경 사유로 함께 전달됩니다.</p>
                        {dispReqTo === CONCESSION && <p className="text-[11px] font-semibold text-violet-700">특채 요청입니다 — 특채 유형은 품질보증부가 수락하면서 정합니다. 요청 사유(불량 정도·사용 가능 판단 근거)를 검토 의견에 구체적으로 적어 주십시오.</p>}
                    </>)}
                    <p className="text-[11px] text-slate-500">부서장이 승인하면 부서 공식 의견으로 품질보증부에 전달됩니다. 품질보증부는 <b>수락 · 거절 · 반송</b> 중 하나로 판단하며, 특채로 수락된 건은 품질부서장 최종승인을 받습니다. 회수·재발행 없이 이 문서에 이력으로 남습니다.</p>
                </div>
            )}
            <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input type="checkbox" checked={deptCostOn} onChange={e => setDeptCostOn(e.target.checked)} />
                    품질비용 있음
                </label>
                <p className="text-[11px] text-slate-500">강제가 아닙니다 — 검토 의견에 적으셔도 됩니다</p>
                {deptCostOn && <CostRows rows={deptCosts} setRows={setDeptCosts} addLabel="＋ 항목 추가" placeholder="항목명 (예: 주물비)" inputCls={inputCls} />}
            </div>
        </div>
    );

    /* ── B-20/B-21 · 종합검토 패널 상단 ── */
    const qaExtra = (
        <div className="space-y-3">
            {pendingDispReqs.map(({ dept, req }) => (
                <div key={dept} className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-1.5">
                    <div className="text-sm font-bold text-amber-800">⚠ 처분방안 변경 요청 — {dept} {req.by}</div>
                    <div className="text-sm font-semibold text-slate-700">{report.disposition || '—'}&nbsp; → &nbsp;{req.to}</div>
                    <div className="text-sm text-slate-600">&ldquo;{req.note}&rdquo;</div>
                    <div className="flex gap-5 text-sm pt-0.5">
                        {['수락', '거절', '반송'].map(v => (
                            <label key={v} className="flex items-center gap-1.5">
                                <input type="radio" name={`dispdec-${dept}`} checked={dispDecisions[dept] === v}
                                    onChange={() => setDispDecisions(p => ({ ...p, [dept]: v }))} />{v}
                            </label>
                        ))}
                    </div>
                    {dispDecisions[dept] === '거절' && <p className="text-[11px] text-red-600">거절 — 처리방안은 그대로 두고 회람을 계속합니다. 거절 사유를 아래 종합검토 의견에 반드시 적어 주세요.</p>}
                    {dispDecisions[dept] === '반송' && <p className="text-[11px] text-orange-600">반송 — {dept}로 되돌려 다시 회신받습니다. 문서는 회람중으로 돌아가며 다른 부서 회신은 그대로 유지됩니다.</p>}
                </div>
            ))}
            {/* 특채 전환 — 유형 선택 강제 (절차서 5.3.4·5.3.7) */}
            {dispConcOn && (
                <div className="rounded-lg border border-violet-300 bg-violet-50 p-3 space-y-1.5">
                    <div className="text-sm font-bold text-violet-800">특채 전환 — 특채 유형 선택 (필수)</div>
                    <select value={concPick} onChange={e => setConcPick(e.target.value)} className={inputCls} aria-label="특채 유형">
                        <option value="">— 선택 —</option>
                        {(settings?.concession_types || []).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    {!report.tech_reply && <p className="text-[11px] font-semibold text-red-600">기술 회신 기록이 없습니다 — 절차서 5.3.6에 따라 수리·현상태 사용은 기술적 근거 서류가 필요합니다. 아래 종합검토 의견에 근거를 반드시 적으십시오.</p>}
                    <p className="text-[11px] text-violet-700">수락하면 처리방안이 특채로 바뀌고, 문서는 최종승인 대기로 올라가 품질부서장 결재를 받습니다. 회수·재발행은 없으며 이 문서에 이력으로 남습니다. 처리방안 마련자({report.disposition_by || '미지정'})는 그대로 유지됩니다.</p>
                </div>
            )}
            <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                <div className="text-xs font-bold text-slate-700">★ 1차 · 처리방안 비용 확정</div>
                <p className="text-[11px] text-slate-500">부서·항목별로 나눠 입력하면 합계가 자동 산출됩니다</p>
                <CostRows rows={stage1Items} setRows={setStage1Items} addLabel="＋ 항목 추가" placeholder="항목명 (예: 주물비)" showDept inputCls={inputCls} />
                {sumCosts(stage1Items) === 0 && (
                    <input className={inputCls} placeholder="0원 사유 (예: 반송 — 당사 비용 발생 없음) — 필수" value={zeroWhy} onChange={e => setZeroWhy(e.target.value)} />
                )}
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-3xl max-h-[88vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
                    <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-blue-700">{report.ncr_no}</span>
                        <span className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-full border ${STATUS_BADGE[report.status] || STATUS_BADGE['작성중']}`}>{statusLabel(report.status)}</span>
                        {report.tech_flag && <span className="inline-block px-2 py-0.5 text-[10px] font-bold rounded-full bg-violet-50 text-violet-700 border border-violet-200">기술문의</span>}
                        {report.status === '무효승인 대기' && report.void_req && <span className="inline-block px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-700 border border-slate-400">무효 상신 · {report.void_req.kind}</span>}
                        {(report.disposition || '').startsWith('특채') && <span className="inline-block px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-200">특채</span>}
                        {!newFlow && <span className="inline-block px-2 py-0.5 text-[10px] rounded-full bg-slate-100 text-slate-500 border border-slate-200">구 흐름 문서</span>}
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setShowPrint(true)} className="flex items-center px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50">
                            <Printer className="w-3.5 h-3.5 mr-1.5" /> 인쇄
                        </button>
                        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-5 h-5" /></button>
                    </div>
                </div>

                <div className="p-6 space-y-5">
                    {newFlow && report.reject_note && report.status === '작성중' && (
                        <div className="text-sm px-4 py-2.5 rounded-lg bg-red-50 text-red-700 border border-red-200">↩ {report.reject_note} — 작성 화면(이어쓰기)에서 보완 후 재상신하세요.</div>
                    )}
                    {/* v10.2 G-⑧ — 종전 문구는 「통계 제외」라고 단언했으나 무효를 빼는 집계 코드는 어디에도 없다.
                        결재함 「완료」 탭에도 그대로 포함된다(F #72 실측). 사실대로 「직접 걸러내야 한다」로 고친다. */}
                    {newFlow && report.status === '무효' && (
                        <div className="text-sm px-4 py-2.5 rounded-lg bg-slate-100 text-slate-600 border border-slate-300">
                            즉시종결(무효) — {report.void_note || '사유 미기재'} · 넘버링 유지
                            <span className="block text-[11px] text-slate-500">통계에서 자동으로 빠지지는 않습니다 — 집계할 때 부적합 대장(CSV)의 「상태」 열에서 <b>무효</b>를 직접 걸러내십시오.</span>
                        </div>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
                        <div><div className="text-xs text-slate-400 mb-0.5">발생일</div><div className="font-medium text-slate-700">{report.occur_date || report.date || '—'}</div></div>
                        <div><div className="text-xs text-slate-400 mb-0.5">업체(발생처)</div><div className="font-medium text-slate-700">{report.supplier}{report.supplier_code ? <span className="ml-1 text-[10px] font-mono text-slate-400">{report.supplier_code}</span> : null}</div></div>
                        <div><div className="text-xs text-slate-400 mb-0.5">도면번호</div><div className="font-medium text-slate-700">{report.drawing_no || '—'}</div></div>
                        <div className="col-span-2"><div className="text-xs text-slate-400 mb-0.5">품명</div><div className="font-medium text-slate-700">{report.item_name}{report.item_code ? <span className="ml-1 text-[10px] font-mono text-slate-400">{report.item_code}</span> : null}</div></div>
                        <div><div className="text-xs text-slate-400 mb-0.5">수량 (부적합/전체)</div><div className="font-medium"><span className="text-red-600 font-bold">{report.qty_defect}</span> / {report.qty_unknown ? '파악중' : report.qty_total}</div></div>
                        <div><div className="text-xs text-slate-400 mb-0.5">부적합 코드</div><div className="font-medium text-slate-700">{report.code ? `${report.code} — ${settings?.codes?.[report.code] || ''}` : '—'}</div></div>
                        <div><div className="text-xs text-slate-400 mb-0.5">처리방안</div><div className="font-medium text-slate-700">{report.disposition || '— 미정 —'}{report.concession_type ? ` (${report.concession_type})` : ''}{hasDispChange(report) ? <span className="ml-1 text-[11px] font-normal text-slate-400">({dispPrevLabel(report)}에서 변경)</span> : null}</div></div>
                        {/* 933-07 Recommended by — 회람 부서가 처리방안을 문의할 상대 */}
                        <div><div className="text-xs text-slate-400 mb-0.5">처리방안 마련자</div><div className="font-medium text-slate-700">{report.disposition_by || '— 미지정 —'}<span className="ml-1 text-[11px] font-normal text-slate-400">(품질보증부)</span></div></div>
                        <div><div className="text-xs text-slate-400 mb-0.5">작성자</div><div className="font-medium text-slate-700">{report.author_name} ({report.author_company})</div></div>
                    </div>
                    <div>
                        <div className="text-xs text-slate-400 mb-1">부적합 내용</div>
                        <div className="text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 whitespace-pre-wrap">{report.defect_desc || '—'}</div>
                    </div>

                    {newFlow && report.tech_reply && (
                        <div className="text-sm px-4 py-3 rounded-lg bg-violet-50 border border-violet-200">
                            <div className="text-xs font-bold text-violet-700 mb-1 flex items-center"><FlaskConical className="w-3.5 h-3.5 mr-1" /> 응용기술팀 회신 (자동 첨부)</div>
                            <div className="text-slate-700">{report.tech_reply.summary}</div>
                        </div>
                    )}
                    {newFlow && report.judge_plan && report.status === '특채승인 대기' && (
                        <div className="text-sm px-4 py-3 rounded-lg bg-amber-50 border border-amber-200">
                            <div className="text-xs font-bold text-amber-700 mb-1">특채 판단 상신 내용</div>
                            <div className="text-slate-700">{report.judge_plan.kind === 'special' ? `특채(Concession)로 진행${report.judge_plan.conc ? ` — ${report.judge_plan.conc}` : ''}` : `일반 처리로 전환 — ${report.judge_plan.disp}`} · 본회람: {(report.judge_plan.depts || []).join('·')}</div>
                            <div className="text-slate-600 mt-1">&ldquo;{report.judge_plan.note}&rdquo;</div>
                        </div>
                    )}

                    {newFlow && Object.keys(reviews).length > 0 && (
                        <div>
                            <div className="text-xs font-bold text-slate-500 mb-2 flex items-center"><Users className="w-3.5 h-3.5 mr-1" /> 부서 회람 현황</div>
                            <div className="border border-slate-200 rounded-lg overflow-hidden">
                                <table className="w-full text-xs">
                                    <thead><tr className="bg-slate-50 text-slate-500">
                                        <th className="px-3 py-2 text-left font-semibold">부서</th>
                                        <th className="px-3 py-2 text-left font-semibold">담당 검토</th>
                                        <th className="px-3 py-2 text-left font-semibold">부서장 결재</th>
                                    </tr></thead>
                                    <tbody>
                                        {Object.entries(reviews).map(([d, rv]) => (
                                            <tr key={d} className="border-t border-slate-100">
                                                <td className="px-3 py-2 font-semibold text-slate-700">{d}</td>
                                                <td className="px-3 py-2">
                                                    {rv.state === 'skip' ? <span className="text-slate-300 tracking-widest">회 람 제 외</span>
                                                        : rv.staff_at ? (<span>
                                                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold mr-1 ${rv.opinion === 'reject' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>{rv.opinion === 'reject' ? '반려 의견' : '승인 의견'}</span>
                                                            {/* B-20 — 처분방안 변경 요청 배지 (수락·거절 결과까지 표시) */}
                                                            {rv.disp_req && (
                                                                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold mr-1 border ${rv.disp_req.resolved === '수락' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : rv.disp_req.resolved === '거절' ? 'bg-slate-100 text-slate-500 border-slate-300' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                                                    {rv.disp_req.resolved === '수락' ? '변경 수락' : rv.disp_req.resolved === '거절' ? '변경 거절' : '처분방안 변경 요청'}
                                                                </span>
                                                            )}
                                                            {rv.staff_name} · {rv.staff_cmt}
                                                            {rv.remand_note ? <span className="text-orange-500 ml-1">({remandLabel(rv.remand_note)}: {remandBody(rv.remand_note)})</span> : null}
                                                            {/* B-21 — 부서가 올린 품질비용을 부서장이 보고 결재할 수 있게 표시 */}
                                                            {Array.isArray(rv.cost_items) && rv.cost_items.length > 0 && (
                                                                <span className="block mt-1 text-[11px] text-teal-700">
                                                                    <span className="inline-block px-1.5 py-0.5 rounded bg-teal-50 border border-teal-200 font-bold mr-1">품질비용</span>
                                                                    {rv.cost_items.map((c, i) => <span key={i} className="mr-2">{c.label} {fmtWon(numOf(c.amount))}</span>)}
                                                                    <b className="text-teal-800">소계 {fmtWon(sumCosts(rv.cost_items))}</b>
                                                                </span>
                                                            )}
                                                        </span>)
                                                            : rv.remand_note ? <span className="text-orange-500">{remandLabel(rv.remand_note)} — {remandBody(rv.remand_note)}</span>
                                                                : <span className="text-slate-400">미회신</span>}
                                                </td>
                                                <td className="px-3 py-2">
                                                    {rv.state === 'skip' ? <span className="text-slate-300">—</span>
                                                        : rv.state === 'done' ? <span className="text-blue-700 font-semibold">{rv.head_name}{rv.deputy ? ' (대결)' : ''} · {rv.head_cmt}</span>
                                                            : <span className="text-slate-400">대기</span>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {newFlow && report.qa_summary && (
                        <div className="text-sm px-4 py-3 rounded-lg bg-indigo-50 border border-indigo-200">
                            <div className="text-xs font-bold text-indigo-700 mb-1 flex items-center"><ClipboardCheck className="w-3.5 h-3.5 mr-1" /> 품질담당자 종합검토</div>
                            <div className="text-slate-700">{report.qa_summary.text}</div>
                            {/* B-21 1차 — 최종승인 시 확정되는 처리방안 비용 */}
                            {report.cost_stage1 && (
                                <div className="mt-1.5 text-[11px] text-slate-600">
                                    <span className="font-bold text-indigo-700">처리방안 비용</span>{' '}
                                    {(report.cost_stage1.items || []).map((c, i) => <span key={i} className="mr-2">{c.dept ? `${c.dept} · ` : ''}{c.label} {fmtWon(c.amount)}</span>)}
                                    <b className="text-slate-700">소계 {fmtWon(report.cost_stage1.total)}</b>
                                    {Number(report.cost_stage1.total || 0) === 0 && report.cost_stage1.zero_why ? ` (0원 사유: ${report.cost_stage1.zero_why})` : ''}
                                </div>
                            )}
                        </div>
                    )}
                    {newFlow && report.closed && (
                        <div className="text-sm px-4 py-3 rounded-lg bg-teal-50 border border-teal-200">
                            <div className="text-xs font-bold text-teal-700 mb-1 flex items-center"><Coins className="w-3.5 h-3.5 mr-1" /> 처리 완료확인 · 품질비용</div>
                            <div className="text-slate-700">{report.closed.note}</div>
                            <div className="mt-1 text-slate-600">
                                {(report.closed.cost_items || []).map((c, i) => (
                                    <span key={i} className="mr-3">
                                        {report.closed.cost_stage1_total != null && c.stage ? <span className="text-[10px] font-bold text-slate-400 mr-0.5">[{c.stage}]</span> : null}
                                        {c.label} {fmtWon(c.amount)}
                                        {c.edit_why ? <span className="text-[10px] text-slate-400"> (수정 사유: {c.edit_why})</span> : null}
                                    </span>
                                ))}
                                <b className="text-slate-800">합계 {fmtWon(report.closed.cost_total)}</b>{/* 2단 문서는 closed.zero_why가 비어 있으므로 1차 사유로 폴백(인쇄물과 동일) */}{Number(report.closed.cost_total || 0) === 0 && (report.closed.zero_why || report.cost_stage1?.zero_why) ? ` (0원 사유: ${report.closed.zero_why || report.cost_stage1?.zero_why})` : ''}
                            </div>
                            {report.closed.cost_stage1_total != null && (
                                <div className="mt-0.5 text-[11px] text-slate-500">
                                    처리방안 {fmtWon(report.closed.cost_stage1_total)} ＋ 추가 {fmtWon(Number(report.closed.cost_total || 0) - Number(report.closed.cost_stage1_total || 0))} ＝ 합계 {fmtWon(report.closed.cost_total)}
                                </div>
                            )}
                            <div className="text-slate-600 mt-0.5">시정조치 {report.closed.car}{report.closed.car === '유' ? ` · CAR ${report.closed.car_no}` : ''}</div>
                        </div>
                    )}

                    {pairs.length > 0 && (
                        <div>
                            <div className="text-xs font-bold text-slate-500 mb-2">첨부#1 — 사진대지 (정상·불량 대비표) {pairs.length}쌍</div>
                            <div className="space-y-3">{pairs.map((p, i) => (
                                <div key={i} className="grid grid-cols-2 gap-3">
                                    {['good', 'bad'].map(side => (
                                        <div key={side}>
                                            <div className={`text-center text-[10px] font-bold tracking-widest py-0.5 mb-1 rounded ${side === 'good' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{side === 'good' ? '정상 (양품)' : '불량 (부적합)'}</div>
                                            {p[side] ? <a href={attUrl(p[side])} target="_blank" rel="noreferrer"><img src={attUrl(p[side])} alt="" className="w-full aspect-[4/3] object-cover rounded-lg border border-slate-200" /></a> : <div className="w-full aspect-[4/3] rounded-lg border border-dashed border-slate-200 flex items-center justify-center text-xs text-slate-300">사진 없음</div>}
                                        </div>
                                    ))}
                                </div>
                            ))}</div>
                        </div>
                    )}
                    {/* H-③: 처리확인 증빙(#4)도 같은 방식으로 카드에 보여준다 — 올라간 증거를 상세에서 바로 확인 */}
                    {[[drawings, '첨부#2 — 해당 도면'], [refDocs, '첨부#3 — 관련자료'], [closedEvid, '첨부#4 — 처리확인 증빙']].map(([list, title]) => list.length > 0 && (
                        <div key={title}>
                            <div className="text-xs font-bold text-slate-500 mb-2">{title} {list.length}건</div>
                            <div className="grid grid-cols-3 md:grid-cols-4 gap-2">{list.map((a, i) => (
                                isImageAtt(a)
                                    ? <a key={i} href={attUrl(a)} target="_blank" rel="noreferrer"><img src={attUrl(a)} alt={a.name} className="w-full aspect-[4/3] object-cover rounded-lg border border-slate-200" /></a>
                                    : <a key={i} href={attUrl(a)} download={a.name} className="flex items-center justify-center aspect-[4/3] rounded-lg border border-slate-200 bg-slate-50 text-[10px] text-slate-500 font-mono px-2 text-center break-all">{a.name}</a>
                            ))}</div>
                        </div>
                    ))}

                    <div>
                        <div className="text-xs font-bold text-slate-500 mb-2">결재 이력</div>
                        {history.length === 0 ? <div className="text-xs text-slate-400">이력이 없습니다.</div> : (
                            <ol className="relative border-l border-slate-200 ml-1.5 space-y-3">
                                {history.map((h, i) => (
                                    <li key={i} className="ml-4">
                                        <span className={`absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full ${ACTION_DOT[h.action] || 'bg-slate-400'}`} />
                                        <div className="text-sm"><b className="text-slate-700">{h.action}</b> <span className="text-slate-500">{h.actor_name} ({h.actor_company})</span></div>
                                        {h.comment && <div className="text-xs text-slate-600 mt-0.5">“{h.comment}”</div>}
                                        <div className="text-xs text-slate-400 mt-0.5">{(h.at || '').replace('T', ' ').slice(0, 16)}</div>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </div>

                    {err && <div className="text-sm px-4 py-2.5 rounded-lg bg-red-50 text-red-700 border border-red-200">{err}</div>}

                    {mode ? (
                        mode === 'issueOk' ? <Panel {...panelBase} title={`발행 승인 — ${report.tech_flag ? (report.tech_reply ? '기존 기술 회신 재사용 → 특채 판단으로' : '응용기술팀 단독 선행회람 발사') : '부서 회람 발사'}`} onSubmit={doIssueApprove} submitLabel="발행 승인 확정" color="bg-blue-600 hover:bg-blue-700" /> :
                        mode === 'issueNo' ? <Panel {...panelBase} title="발행 반려 — 작성자에게 되돌립니다" onSubmit={doIssueReject} submitLabel="반려 확정" color="bg-red-600 hover:bg-red-700" needComment /> :
                        mode === 'techStaff' ? <Panel {...panelBase} title="기술 검토 회신" onSubmit={doTechStaff} submitLabel="검토 회신" color="bg-violet-600 hover:bg-violet-700" needComment commentLabel="(검토 의견 — 필수)">
                            <div className="flex gap-4 text-sm">{['approve', 'reject'].map(o => (
                                <label key={o} className="flex items-center gap-1.5"><input type="radio" name="opn" checked={opinion === o} onChange={() => setOpinion(o)} />{o === 'approve' ? '승인 의견' : '반려 의견'}</label>
                            ))}</div>
                        </Panel> :
                        mode === 'techHead' ? <Panel {...panelBase} title={`기술 회신 확정 (${ro.isTechDeputy && !ro.isTechHead ? '차석 대결' : '기술부서장'}) — 특채 판단으로 회신`} onSubmit={doTechHead} submitLabel="회신 확정" color="bg-violet-700 hover:bg-violet-800" /> :
                        mode === 'judge' ? <Panel {...panelBase} title="특채 여부 판단 상신 (품질부서장 승인 요청)" onSubmit={doJudgeSubmit} submitLabel="판단 상신" color="bg-amber-600 hover:bg-amber-700" needComment commentLabel="(판단 사유 — 필수)">
                            <div className="space-y-2 text-sm">
                                <div className="flex gap-4">{[['special', '특채(Concession)로 진행'], ['normal', '일반 처리로 전환']].map(([k, l]) => (
                                    <label key={k} className="flex items-center gap-1.5"><input type="radio" name="jk" checked={judgeKind === k} onChange={() => setJudgeKind(k)} />{l}</label>
                                ))}</div>
                                {judgeKind === 'special' && (
                                    <select value={judgeConc} onChange={e => setJudgeConc(e.target.value)} className={inputCls}>
                                        <option value="">— 특채 유형 선택 (필수) —</option>
                                        {(settings?.concession_types || ['현상태 사용', '수리', '재등급 부여', '관련부품 수정']).map(c => <option key={c}>{c}</option>)}
                                    </select>
                                )}
                                {judgeKind === 'normal' && (
                                    <select value={judgeDisp} onChange={e => setJudgeDisp(e.target.value)} className={inputCls}>
                                        <option value="">— 전환 처리방안 선택 —</option>
                                        {(settings?.dispositions || []).filter(d => !d.startsWith('특채')).map(d => <option key={d}>{d}</option>)}
                                    </select>
                                )}
                                <div>
                                    <div className="text-xs font-semibold text-slate-600 mb-1">본회람 대상 (응용기술팀 제외 고정 — 선행 문의 완료)</div>
                                    <div className="flex flex-wrap gap-3">{allDepts.map(d => (
                                        <label key={d} className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={judgeDepts.includes(d)} onChange={e => setJudgeDepts(p => e.target.checked ? [...p, d] : p.filter(x => x !== d))} />{d}</label>
                                    ))}</div>
                                </div>
                            </div>
                        </Panel> :
                        mode === 'specialOk' ? <Panel {...panelBase} title="특채 판단 승인 — 본회람 발사" onSubmit={doSpecialApprove} submitLabel="특채 승인 확정" color="bg-amber-600 hover:bg-amber-700">
                            {String(report.judge_plan?.disp || '').startsWith('특채') && !report.judge_plan?.conc && (
                                <div className="space-y-1">
                                    <div className="text-xs font-semibold text-amber-700">특채 유형 * <span className="font-normal text-slate-500">(구 버전 상신 문서 — 확정 전 지정 필요)</span></div>
                                    <select value={okConc} onChange={e => setOkConc(e.target.value)} className={inputCls}>
                                        <option value="">— 선택 —</option>
                                        {(settings?.concession_types || ['현상태 사용', '수리', '재등급 부여', '관련부품 수정']).map(c => <option key={c}>{c}</option>)}
                                    </select>
                                </div>
                            )}
                            {report.judge_plan?.conc && <div className="text-xs text-slate-600">특채 유형: <b className="text-amber-700">{report.judge_plan.conc}</b></div>}
                        </Panel> :
                        mode === 'specialNo' ? <Panel {...panelBase} title="특채 판단 반려 — 품질담당 재판단" onSubmit={doSpecialReject} submitLabel="반려 확정" color="bg-red-600 hover:bg-red-700" needComment /> :
                        mode === 'deptStaff' ? <Panel {...panelBase} footer={deptStaffExtra} title={`${ro.company} 담당 검토 회신 — 의견은 부서장이 검토 후 결정합니다`} onSubmit={doDeptStaff} submitLabel="검토 회신" color="bg-blue-600 hover:bg-blue-700" needComment commentLabel="(검토 의견 — 필수)">
                            <div className="flex gap-4 text-sm">{['approve', 'reject'].map(o => (
                                <label key={o} className="flex items-center gap-1.5"><input type="radio" name="opn2" checked={opinion === o} onChange={() => setOpinion(o)} />{o === 'approve' ? '승인 의견' : '반려 의견'}</label>
                            ))}</div>
                            {reviews[ro.company]?.remand_note && <div className="text-xs text-orange-600">{remandLabel(reviews[ro.company].remand_note)}: {remandBody(reviews[ro.company].remand_note)}</div>}
                        </Panel> :
                        mode === 'deptHead' ? <Panel {...panelBase} title={`${ro.company} 부서장 결재 — 승인${ro.isDeptDeputy(ro.company) && !ro.isDeptHead(ro.company) ? ' (차석 대결)' : ''}`} onSubmit={doDeptHead} submitLabel="부서 승인 확정" color="bg-blue-700 hover:bg-blue-800">
                            {reviews[ro.company]?.opinion === 'reject' && <div className="text-xs text-red-600">⚠ 담당자가 반려 의견입니다 — 검토 후 결정하세요 (승인 시 의견 기각으로 기록됩니다)</div>}
                        </Panel> :
                        mode === 'deptRemand' ? <Panel {...panelBase} title="담당자 재검토 지시 (부서 내 — 품질 미경유)" onSubmit={doDeptRemand} submitLabel="재검토 지시" color="bg-orange-500 hover:bg-orange-600" needComment /> :
                        mode === 'deptRejQa' ? <Panel {...panelBase} title="품질로 반려 — 문서 자체 문제일 때만" onSubmit={doDeptRejectQa} submitLabel="품질로 반려" color="bg-red-600 hover:bg-red-700" needComment /> :
                        mode === 'qaSubmit' ? <Panel {...panelBase}
                            title={dispRemandOn ? '처분방안 변경 요청 반송 — 요청 부서로 되돌립니다' : '종합검토 상신 — 품질부서장 최종승인 요청'}
                            onSubmit={doQaSubmit}
                            submitLabel={dispRemandOn ? '요청 부서로 반송' : '종합검토 상신'}
                            color={dispRemandOn ? 'bg-orange-500 hover:bg-orange-600' : 'bg-indigo-600 hover:bg-indigo-700'}
                            needComment commentLabel={dispRemandOn ? '(반송 사유 — 필수)' : '(부서 회신 요약 + 처리방안 확정 사유 — 필수)'}>{qaExtra}</Panel> :
                        mode === 'requery' ? <Panel {...panelBase} title="해당 부서만 재질의 — 그 부서만 회람으로 되돌립니다" onSubmit={doRequery} submitLabel="재질의" color="bg-orange-500 hover:bg-orange-600" needComment>
                            <select value={requeryDept} onChange={e => setRequeryDept(e.target.value)} className={inputCls}>
                                <option value="">— 재질의 부서 선택 —</option>
                                {Object.entries(reviews).filter(([d, v]) => v.state === 'done' && d !== '응용기술팀').map(([d]) => <option key={d}>{d}</option>)}
                            </select>
                        </Panel> :
                        mode === 'finalOk' ? <Panel {...panelBase} title="최종 승인 (품질부서장 전결) — 처리·마감 단계로" onSubmit={doFinalApprove} submitLabel="최종 승인 확정" color="bg-purple-600 hover:bg-purple-700" /> :
                        mode === 'finalNo' ? <Panel {...panelBase} title={`최종 반려 — ${statusLabel('종합검토')}로 되돌립니다`} onSubmit={doFinalReject} submitLabel="반려 확정" color="bg-red-600 hover:bg-red-700" needComment /> :
                        mode === 'close' ? <Panel {...panelBase} title="처리 완료확인 · 품질비용 마감 — 품질부서장 종결승인 요청" onSubmit={doCloseSubmit} submitLabel="완료확인 상신" color="bg-teal-600 hover:bg-teal-700" commentLabel="(완료확인 코멘트 — 생략 시 기본문구)">
                            <div className="space-y-2">
                                {/* B-21 ★ 2차 — 상단: 최종승인으로 확정된 1차(처리방안) 비용, 각 줄 수정 가능(사유 필수) */}
                                {hasStage1 && (
                                    <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-1.5">
                                        <div className="text-xs font-bold text-slate-700">처리방안 비용 (최종승인 확정)</div>
                                        {stage1Locked.length === 0 && <div className="text-xs text-slate-400">확정된 처리방안 비용 항목이 없습니다 (0원).</div>}
                                        {stage1Locked.map((c, i) => (
                                            <div key={i} className="space-y-1">
                                                <div className="flex gap-2 items-center text-sm">
                                                    <span className="text-[11px] text-slate-400 w-16 shrink-0 truncate" title={c.dept}>{c.dept || '—'}</span>
                                                    <span className="flex-1 text-slate-700 truncate">{c.label}</span>
                                                    {s1Edits[i]?.on
                                                        ? <input className={inputCls + ' max-w-[140px] text-right'} placeholder="금액" inputMode="numeric" value={fmtAmt(s1Edits[i].amount)}
                                                            onChange={e => setS1Edits(p => ({ ...p, [i]: { ...p[i], ...(({ digits, note }) => ({ amount: digits, note }))(sanitizeAmount(e.target.value)) } }))} />
                                                        : <span className="font-mono text-slate-700">{fmtWon(c.amount)}</span>}
                                                    <button type="button" className={`text-xs font-semibold px-1 ${s1Edits[i]?.on ? 'text-slate-500' : 'text-blue-600'}`}
                                                        onClick={() => setS1Edits(p => p[i]?.on ? { ...p, [i]: { on: false, amount: '', why: '' } } : { ...p, [i]: { on: true, amount: String(c.amount), why: '' } })}>
                                                        {s1Edits[i]?.on ? '되돌리기' : '수정'}
                                                    </button>
                                                </div>
                                                {s1Edits[i]?.on && (
                                                    <input className={inputCls} placeholder={`「${c.label}」 수정 사유 (필수)`} value={s1Edits[i].why}
                                                        onChange={e => setS1Edits(p => ({ ...p, [i]: { ...p[i], why: e.target.value } }))} />
                                                )}
                                            </div>
                                        ))}
                                        <div className="text-right text-sm font-bold text-slate-700">처리방안 소계 {fmtWon(s1Sum)}</div>
                                    </div>
                                )}
                                <div className="text-xs font-semibold text-slate-600">{hasStage1 ? '추가 발생 비용 (실제 처리 중 발생분 — 없으면 비워두셔도 됩니다)' : '품질비용 (항목별 입력 — 자동 합산)'}</div>
                                {costItems.map((c, i) => (
                                    <div key={i} className="flex gap-2">
                                        <input className={inputCls} placeholder="항목명 (예: 생산부 재작업비)" value={c.label} onChange={e => setCostItems(p => p.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
                                        <input className={inputCls + ' max-w-[150px] text-right'} placeholder="금액" inputMode="numeric" value={fmtAmt(c.amount)} onChange={e => setCostItems(p => p.map((x, j) => {
                                            if (j !== i) return x;
                                            const { digits, note } = sanitizeAmount(e.target.value);
                                            return { ...x, amount: digits, note };
                                        }))} />
                                        {costItems.length > 1 && <button type="button" onClick={() => setCostItems(p => p.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500 px-1">✕</button>}
                                    </div>
                                ))}
                                {(costItems.some(c => c.note) || Object.values(s1Edits).some(e => e?.note)) &&
                                    <div className="text-[11px] text-amber-600">⚠ {(costItems.find(c => c.note) || Object.values(s1Edits).find(e => e?.note)).note}</div>}
                                <div className="flex items-center justify-between">
                                    <button type="button" onClick={() => setCostItems(p => [...p, { label: '', amount: '' }])} className="text-xs font-semibold text-blue-600">＋ 비용 항목 추가</button>
                                    <div className="text-sm font-bold text-slate-700">{hasStage1 ? '추가 소계 ' : '합계 '}{fmtWon(addSum)}</div>
                                </div>
                                <div className="text-[11px] text-slate-400">숫자만 입력됩니다 · 항목당 최대 {MAX_AMOUNT_LABEL}원</div>
                                {/* 2차(추가 발생분)는 0원이어도 사유 불필요 — 0원 사유는 1차가 없는 기존 문서에서만 요구 */}
                                {!hasStage1 && addSum === 0 && (
                                    <input className={inputCls} placeholder="0원 사유 (예: 업체 전액 부담 / 협의 결과 무상 수리) — 필수" value={zeroWhy} onChange={e => setZeroWhy(e.target.value)} />
                                )}
                                {hasStage1 && (
                                    <div className="text-sm font-bold text-slate-800 border-t border-slate-200 pt-2 text-right">
                                        처리방안 {Number(s1Sum).toLocaleString()} ＋ 추가 {Number(addSum).toLocaleString()} ＝ 품질비용 합계 {Number(s1Sum + addSum).toLocaleString()}
                                    </div>
                                )}
                                <div className="flex items-center gap-4 text-sm">
                                    <span className="text-xs font-semibold text-slate-600">시정조치</span>
                                    {['무', '유'].map(v => <label key={v} className="flex items-center gap-1"><input type="radio" name="car" checked={car === v} onChange={() => setCar(v)} />{v}</label>)}
                                    {car === '유' && <input className={inputCls + ' max-w-[160px]'} placeholder="CAR 번호 (필수)" value={carNo} onChange={e => setCarNo(e.target.value)} />}
                                </div>

                                {/* ── H-③ 처리확인 증빙 (첨부#4) — 실제로 처리했다는 증거. 선택 사항 ──
                                    사상 처리 사진 · 재검사 성적서 · 반송 인수증 등. 사진·파일 둘 다 받는다.
                                    작성화면과 같은 저장소(ncr_attachments)에 category 4로 들어간다. */}
                                <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2" data-closed-att>
                                    <div className="text-xs font-bold text-slate-700">처리확인 증빙 첨부 <span className="font-normal text-slate-400">(선택 · 사진·파일 모두 가능)</span></div>
                                    {closedAtts.length > 0 && (
                                        <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                                            {closedAtts.map((a, i) => (
                                                <div key={i} className="relative">
                                                    {isImageAtt(a)
                                                        ? <img src={attUrl(a)} alt={a.name} className="w-full aspect-[4/3] object-cover rounded-lg border border-slate-200 bg-slate-50" />
                                                        : <div className="w-full aspect-[4/3] flex flex-col items-center justify-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-1">
                                                            <FileIcon className="w-6 h-6 text-slate-400" />
                                                            <span className="text-[9px] text-slate-500 font-mono truncate max-w-full">{a.name}</span>
                                                        </div>}
                                                    <button type="button" onClick={() => setClosedAtts(l => l.filter((_, j) => j !== i))}
                                                        className="absolute top-1 right-1 p-1 rounded-full bg-white/90 border border-slate-300 text-slate-500 hover:text-red-600 hover:border-red-300">
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                    <div className="text-[10px] text-slate-400 font-mono truncate mt-0.5">{a.name}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <PasteZone {...pz} target="closed" />
                                    <label className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 cursor-pointer">
                                        <Plus className="w-3.5 h-3.5" /> 파일 추가
                                        <input type="file" multiple className="hidden" onChange={addClosedFiles} />
                                    </label>
                                    <p className="text-[11px] text-slate-400">사상 처리 사진 · 재검사 성적서 · 반송 인수증 등 — 이미지는 자동 축소, 이미지 외 파일은 5MB 이하.</p>
                                    {attErr && <div className="text-[11px] text-red-600">{attErr}</div>}
                                </div>
                            </div>
                        </Panel> :
                        mode === 'closeOk' ? <Panel {...panelBase} title="종결 승인 — 문서를 종결합니다" onSubmit={doCloseApprove} submitLabel="종결 승인 확정" color="bg-emerald-600 hover:bg-emerald-700" /> :
                        mode === 'closeNo' ? <Panel {...panelBase} title="종결 반려 — 처리·마감으로 되돌립니다 (완료확인 재작성)" onSubmit={doCloseReject} submitLabel="반려 확정" color="bg-red-600 hover:bg-red-700" needComment /> :
                        mode === 'withdraw' ? <Panel {...panelBase} title="회수 — 문서가 작성중으로 되돌아갑니다 (기술 회신·판단 상신은 무효화)" onSubmit={doWithdraw} submitLabel="회수 확정" color="bg-slate-600 hover:bg-slate-700" /> :
                        mode === 'void' ? <Panel {...panelBase} title="즉시종결(무효) 상신 — 품질부서장 승인 요청" onSubmit={doVoid} submitLabel="무효 상신" color="bg-slate-700 hover:bg-slate-800" needComment commentLabel="(무효 사유 — 필수)">
                            <div className="space-y-1">
                                <div className="text-xs font-semibold text-slate-600">무효 구분 *</div>
                                <select value={voidKind} onChange={e => setVoidKind(e.target.value)} className={inputCls}>
                                    <option value="">— 선택 —</option>
                                    {['중복 발행', '오기재 · 착오 발행', '부적합 아님으로 판명', '기타'].map(k => <option key={k}>{k}</option>)}
                                </select>
                                {/* G-⑧ — 「통계에서만 제외됩니다」는 사실이 아니었다(자동 제외 코드 없음). 실제 절차대로 적는다. */}
                                <p className="text-[11px] text-slate-400">넘버링은 유지됩니다. 통계는 자동으로 제외되지 않으므로 집계 시 부적합 대장(CSV)의 「상태」 열에서 무효를 걸러내야 합니다. 승인 후에는 되돌릴 수 없습니다.</p>
                            </div>
                        </Panel> :
                        mode === 'voidOk' ? <Panel {...panelBase} title="무효 승인 — 되돌릴 수 없습니다" onSubmit={doVoidApprove} submitLabel="무효 승인 확정" color="bg-slate-800 hover:bg-slate-900">
                            <div className="text-xs text-slate-600 space-y-0.5">
                                <div>구분: <b>{report.void_req?.kind || '—'}</b></div>
                                <div>사유: {report.void_req?.note || '—'}</div>
                                <div className="text-slate-400">상신: {report.void_req?.by} ({report.void_req?.company}) · {(report.void_req?.at || '').replace('T', ' ').slice(0, 16)}</div>
                            </div>
                        </Panel> :
                        mode === 'voidNo' ? <Panel {...panelBase} title="무효 반려 — 작성중으로 되돌립니다" onSubmit={doVoidReject} submitLabel="반려 확정" color="bg-red-600 hover:bg-red-700" needComment /> :
                        ['lg_approve', 'lg_reject', 'lg_tokOk', 'lg_tokNo', 'lg_withdraw'].includes(mode) ? (
                            <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 space-y-3">
                                {mode === 'lg_withdraw' && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">회수하면 문서가 <b>작성중</b> 상태로 되돌아갑니다. 내용을 보완한 뒤 [보고서 작성] → 이어쓰기에서 다시 올리십시오.</p>}
                                {/* v10.2 G-③ — 레거시 특채 승인도 유형 없이 확정할 수 없다(v10.1 경로와 동일 기준) */}
                                {mode === 'lg_tokOk' && (
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">특채 유형 * <span className="font-normal text-slate-500">(구 흐름 문서 — 확정 전 지정 필요)</span></label>
                                        <select value={okConc} onChange={e => setOkConc(e.target.value)} className={inputCls}>
                                            <option value="">— 선택 —</option>
                                            {(settings?.concession_types || ['현상태 사용', '수리', '재등급 부여', '관련부품 수정']).map(c => <option key={c}>{c}</option>)}
                                        </select>
                                        {report.disposition && <p className="mt-1 text-[11px] text-slate-500">처리방안: <b className="text-amber-700">{report.disposition}</b> (그대로 유지됩니다)</p>}
                                    </div>
                                )}
                                {mode === 'lg_approve' && (
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">처리방안 확정 *</label>
                                        <select value={dispo} onChange={e => setDispo(e.target.value)} className={inputCls}>
                                            <option value="">— 선택 —</option>
                                            {(report.disposition && !DISPS_LEGACY.includes(report.disposition) ? [report.disposition, ...DISPS_LEGACY] : DISPS_LEGACY).map(d => <option key={d} value={d}>{d}</option>)}
                                        </select>
                                    </div>
                                )}
                                <label className="block text-xs font-semibold text-slate-600">의견</label>
                                <textarea rows={3} value={comment} onChange={e => setComment(e.target.value)} className={inputCls} />
                                <div className="flex justify-end gap-2">
                                    {/* v10.2 G-② — 종전에는 setErr(null)이 빠져 있어 [취소] 후에도 빨간 에러 배너가
                                        버튼 목록 화면에 그대로 남았다(F #25 실측). v10.1 Panel.onCancel과 같은 핸들러를 그대로 쓴다. */}
                                    <button onClick={panelBase.onCancel} disabled={saving} className={btnO}>취소</button>
                                    <button onClick={submitLegacy} disabled={saving} className={`${btnP} bg-blue-600 hover:bg-blue-700`}>확정</button>
                                </div>
                            </div>
                        ) : null
                    ) : (
                        <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-slate-100">
                            {/* 설정을 못 읽으면 차석 대결이 막힌다(fail-closed). 조용히 마비되면 원인을 못 찾으므로
                                해당되는 사람(차장)에게만 이유를 드러낸다 — 부장·담당자는 영향이 없어 표시하지 않는다.
                                재검증 지적: 「차장」만으로 걸면 종결·레거시 등 대결이 걸리지도 않는 문서에까지 떠서
                                경고가 흔해지고 무뎌진다 — 지금 이 문서에서 실제로 대결 차례일 때만 띄운다. */}
                            {deputyLockNotice && (
                                <div className="w-full mb-1 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
                                    ⚠ 결재 설정을 읽지 못했습니다{settings.loaded ? ' (차석 대결 설정 항목 없음)' : ' (설정 조회 실패)'} — 안전을 위해 <b>차석 대결이 잠겨</b> 있습니다. 새로고침 후에도 같으면 전산실에 문의하십시오.
                                </div>
                            )}
                            {canWithdrawV101 && <button onClick={() => openPanel('withdraw')} className={`${btnO} mr-auto flex items-center`}><Undo2 className="w-4 h-4 mr-1.5" /> 회수</button>}
                            {canVoid && <button onClick={() => openPanel('void')} className={`${btnO} mr-auto flex items-center`}><Ban className="w-4 h-4 mr-1.5" /> 즉시종결(무효)</button>}
                            {newFlow && myTurn && report.status === '무효승인 대기' && ro.isQaApprover && (<>
                                <button onClick={() => openPanel('voidNo')} className={`${btnO} text-red-600 border-red-200 hover:bg-red-50`}>반려</button>
                                <button onClick={() => openPanel('voidOk')} className={`${btnP} bg-slate-800 hover:bg-slate-900 flex items-center`}><Ban className="w-4 h-4 mr-1.5" /> 무효 승인</button>
                            </>)}
                            {newFlow && myTurn && report.status === '발행승인 대기' && ro.isQaApprover && (<>
                                <button onClick={() => openPanel('issueNo')} className={`${btnO} text-red-600 border-red-200 hover:bg-red-50`}>반려</button>
                                <button onClick={() => openPanel('issueOk')} className={`${btnP} bg-blue-600 hover:bg-blue-700 flex items-center`}><Stamp className="w-4 h-4 mr-1.5" /> 발행 승인</button>
                            </>)}
                            {newFlow && myTurn && report.status === '기술문의' && ro.isTechStaff && <button onClick={() => openPanel('techStaff')} className={`${btnP} bg-violet-600 hover:bg-violet-700`}>기술 검토 회신</button>}
                            {newFlow && myTurn && report.status === '기술문의' && ro.isTechApprover && <button onClick={() => openPanel('techHead')} className={`${btnP} bg-violet-700 hover:bg-violet-800`}>{`회신 확정 (${ro.isTechDeputy && !ro.isTechHead ? '차석 대결' : '기술부서장'})`}</button>}
                            {newFlow && myTurn && report.status === '특채판단' && (<button onClick={() => { openPanel('judge'); setJudgeDepts((settings?.routing?.default_depts || []).filter(d => allDepts.includes(d))); }} className={`${btnP} bg-amber-600 hover:bg-amber-700`}>특채 여부 판단 상신</button>)}
                            {newFlow && myTurn && report.status === '특채승인 대기' && ro.isQaApprover && (<>
                                <button onClick={() => openPanel('specialNo')} className={`${btnO} text-red-600 border-red-200 hover:bg-red-50`}>반려</button>
                                <button onClick={() => openPanel('specialOk')} className={`${btnP} bg-amber-600 hover:bg-amber-700 flex items-center`}><Stamp className="w-4 h-4 mr-1.5" /> 특채 승인 — 본회람 발사</button>
                            </>)}
                            {newFlow && myTurn && report.status === '회람중' && reviews[ro.company]?.state === 'wait' && <button onClick={() => openPanel('deptStaff')} className={`${btnP} bg-blue-600 hover:bg-blue-700`}>검토 회신 ({ro.company})</button>}
                            {newFlow && myTurn && report.status === '회람중' && reviews[ro.company]?.state === 'staffDone' && (<>
                                <button onClick={() => openPanel('deptRejQa')} className={`${btnO} text-red-600 border-red-200 hover:bg-red-50`}>품질로 반려</button>
                                <button onClick={() => openPanel('deptRemand')} className={`${btnO} text-orange-600 border-orange-200 hover:bg-orange-50`}>부서 내 재검토</button>
                                <button onClick={() => openPanel('deptHead')} className={`${btnP} bg-blue-700 hover:bg-blue-800 flex items-center`}><Stamp className="w-4 h-4 mr-1.5" /> 부서 승인</button>
                            </>)}
                            {newFlow && myTurn && report.status === '종합검토' && (<>
                                <button onClick={() => openPanel('requery')} className={`${btnO} text-orange-600 border-orange-200 hover:bg-orange-50`}>해당 부서만 재질의</button>
                                <button onClick={() => openPanel('qaSubmit')} className={`${btnP} bg-indigo-600 hover:bg-indigo-700`}>종합검토 상신</button>
                            </>)}
                            {newFlow && myTurn && report.status === '최종승인 대기' && ro.isQaApprover && (<>
                                <button onClick={() => openPanel('finalNo')} className={`${btnO} text-red-600 border-red-200 hover:bg-red-50`}>반려</button>
                                <button onClick={() => openPanel('finalOk')} className={`${btnP} bg-purple-600 hover:bg-purple-700 flex items-center`}><Stamp className="w-4 h-4 mr-1.5" /> 최종 승인 (전결)</button>
                            </>)}
                            {newFlow && myTurn && report.status === '처리중' && <button onClick={() => openPanel('close')} className={`${btnP} bg-teal-600 hover:bg-teal-700 flex items-center`}><Coins className="w-4 h-4 mr-1.5" /> 완료확인 · 비용 마감</button>}
                            {newFlow && myTurn && report.status === '종결승인 대기' && ro.isQaApprover && (<>
                                <button onClick={() => openPanel('closeNo')} className={`${btnO} text-red-600 border-red-200 hover:bg-red-50`}>반려</button>
                                <button onClick={() => openPanel('closeOk')} className={`${btnP} bg-emerald-600 hover:bg-emerald-700 flex items-center`}><CheckCircle2 className="w-4 h-4 mr-1.5" /> 종결 승인</button>
                            </>)}
                            {legacyWithdraw && <button onClick={() => openPanel('lg_withdraw')} className={`${btnO} mr-auto flex items-center`}><Undo2 className="w-4 h-4 mr-1.5" /> 회수</button>}
                            {legacyApprovable && report.status === '발행' && (<>
                                <button onClick={() => openPanel('lg_reject')} className={`${btnO} text-red-600 border-red-200 hover:bg-red-50 flex items-center`}><XCircle className="w-4 h-4 mr-1.5" /> 반려</button>
                                <button onClick={() => openPanel('lg_approve')} className={`${btnP} bg-emerald-600 hover:bg-emerald-700 flex items-center`}><CheckCircle2 className="w-4 h-4 mr-1.5" /> 승인</button>
                            </>)}
                            {legacyApprovable && report.status === '특채 판단' && (<>
                                <button onClick={() => openPanel('lg_tokNo')} className={`${btnO} text-red-600 border-red-200 hover:bg-red-50`}>특채 불가</button>
                                <button onClick={() => openPanel('lg_tokOk')} className={`${btnP} bg-emerald-600 hover:bg-emerald-700`}>특채 승인</button>
                            </>)}
                            {/* v10.2 G-④ — 상세의 [재발행] 버튼을 제거했다.
                                종전 동작: act('재발행', {status:'발행'}) — 내용을 한 글자도 못 고친 채 상태만 되돌리고
                                flow_ver도 'v10.0'에 머물렀다. 같은 문서·같은 작성자에게 이어쓰기 [재발행승인 요청]
                                (→ '발행승인 대기' · flow_ver 'v10.1' 승격 · 이력 '발행요청')이 동시에 열려 있어
                                어느 버튼을 눌렀는지에 따라 문서의 결재 흐름 버전 자체가 갈렸다(F #63·#66 실측).
                                ⓐ 반려 문서는 내용을 고쳐서 다시 올리는 것이 절차이고 ⓑ 경로가 둘이면 계보가 갈라지므로
                                재발행 경로를 이어쓰기 하나로 모으고, 여기에는 길 안내만 남긴다. */}
                            {!newFlow && isAuthor && report.status === '반려' && (
                                <div className="w-full text-sm px-4 py-2.5 rounded-lg bg-blue-50 text-blue-800 border border-blue-200">
                                    다시 올리려면 <b>[보고서 작성] → 이어쓰기</b>에서 이 문서를 열어 내용을 수정한 뒤 재발행하십시오.
                                    <span className="block text-[11px] text-blue-600">반려된 문서는 내용을 보완해 다시 올리는 것이 절차입니다 — 상세 화면의 즉시 재발행은 제거됐습니다.</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
            {showPrint && <NCRPrint report={report} history={history} attachments={atts} onClose={() => setShowPrint(false)} />}
        </div>
    );
};

export default NCRDetail;
