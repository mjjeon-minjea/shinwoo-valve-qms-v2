import { useState, useEffect, useRef } from 'react';
import { FileText, Save, Send, AlertTriangle, ChevronDown, ChevronRight, Plus, Trash2, ImagePlus, File as FileIcon, FilePlus2, RotateCcw, Info, Users } from 'lucide-react';
import { api, supabase } from '../lib/api';
import { isNcrRouteStaff } from '../lib/ncrRoles';
/* v10.2 H-① 캡처 붙여넣기 복원 — 축소·용량제한·붙여넣기 규칙은 lib/attach.jsx 한 곳에만 둔다(중복 정의 금지).
   결재화면(NCRDetail 처리확인 증빙)이 같은 함수를 쓰므로 이 파일에 다시 정의하지 않는다. */
import { shrinkImage, processAnyFile, isImageAtt, useCapturePaste, PasteZone, attUrl, uploadAtt, withAttUrls } from '../lib/attach.jsx';

/* 부적합보고서(NCR) 작성 — v10.1 정통 복원 (v10.0 + Phase 3 첨부 + Phase 4 이어쓰기 전부 보존)
   v9.3 검증 로직 이관: 수량 분리(전체/부적합) + 파악중 + 대소 가드, NCR 번호 자동채번
   Phase 3: 첨부 3종(#1 사진대지 대비표 쌍 · #2 도면 · #3 관련자료) — canvas 축소 dataURL 보관
   Phase 4: 내 작성중·반려 문서 이어쓰기(같은 id UPSERT + 첨부 재등록), #2·#3 모든 파일 허용(비이미지 5MB 이하)
   v10.1: ① 부적합 코드 select(ncr_settings.codes — 그룹 optgroup) ② 기술 문의 필요 체크박스(특채 선택 시 자동+잠금)
          ③ 회람대상 부서·담당자 지정(ncr_settings.routing 기본값) → reviews 생성(wait/skip)
          ④ 발행 → '발행승인 요청(품질부서장)' = status '발행승인 대기' · flow_ver 'v10.1' · ncr_approvals action '발행요청'
          하드코딩 금지: 코드·처리방안·기본 회람부서는 전부 ncr_settings에서 로드 */

const ISSUE_STATUS = '발행승인 대기';   // v10.1 발행요청 착지 상태
const FLOW_VER = 'v10.1';
const CODE_GROUPS = [                   // 코드 접두 → optgroup 라벨 (코드 본문은 settings에서 로드)
    { key: 'A', label: 'A 주물' }, { key: 'B', label: 'B 가공' },
    { key: 'C', label: 'C 조립' }, { key: 'D', label: 'D 기타' }
];
/* 회람 담당자 판정 실측 결함(260829) — 직급 문자열로 걸렀더니 실제 명단에서 뒤집혔다.
   목록에 '이사'가 없어 최용석·황사빈 부서장이 담당자로 떴고,
   목록에 '차장'이 있어 정준길·황경빈 실무자가 빠졌다.
   판정은 role로만 한다(ncrRoles.isNcrRouteStaff — 스테이징과 동일 정본). */
const ROUTE_EXCLUDE = ['품질보증부', '응용기술팀'];      // 회람 지정 대상에서 제외(주관·선행회람 부서)
const QA_DEPT = '품질보증부';                             // 처리방안 마련 전속 부서
const CONCESSION = '특채(Concession)';                   // v9.3 onDispChange 규칙 대상 처리방안

/* 규약의 reviews 항목 1건 — 미선택 부서는 state:'skip'(회람 제외 행으로 인쇄) */
const makeReview = (state, staff) => ({
    state,
    staff_email: staff?.staff_email || null,
    staff_name: staff?.staff_name || null,
    opinion: null, staff_cmt: '', staff_at: null,
    head_name: null, head_cmt: '', head_at: null,
    deputy: false, remand_note: ''
});



/* 접이식 첨부 섹션 헤더 — 기본 접힘 + 건수 배지 */
const AttSectionHead = ({ open, onToggle, title, badge }) => (
    <button type="button" onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 rounded-t-lg">
        <span className="flex items-center gap-2">
            {open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
            {title}
        </span>
        <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">{badge}</span>
    </button>
);

/* 업로드 칸(썸네일 4:3 가로형 · object-cover) — 사진대지 쌍의 한쪽
   H-①: 칸마다 pastezone을 달아 마우스를 올린 칸이 Ctrl+V 대상이 된다(시뮬레이터 v9.2 'pair:i:side'). */
const PairSlot = ({ att, kind, onPick, onClear, pasteKey, pz }) => (
    <div>
        <div className={`text-center text-xs font-bold tracking-widest py-1 mb-1.5 rounded border ${kind === '정상' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-red-700 bg-red-50 border-red-200'}`}>
            {kind === '정상' ? '정상 (양품)' : '불량 (부적합)'}
        </div>
        {att ? (
            <div className="relative group">
                <img src={attUrl(att)} alt={att.name} className="w-full aspect-[4/3] object-cover rounded-lg border border-slate-200 bg-slate-50" />
                <button type="button" onClick={onClear}
                    className="absolute top-1.5 right-1.5 p-1 rounded-full bg-white/90 border border-slate-300 text-slate-500 hover:text-red-600 hover:border-red-300">
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
                <div className="text-[10px] text-slate-400 font-mono truncate mt-1">{att.name}</div>
            </div>
        ) : (
            <label className="flex flex-col items-center justify-center aspect-[4/3] rounded-lg border-2 border-dashed border-slate-300 text-slate-400 text-xs cursor-pointer hover:border-blue-400 hover:text-blue-500 bg-slate-50">
                <ImagePlus className="w-6 h-6 mb-1" />
                사진 업로드
                <input type="file" accept="image/*" className="hidden" onChange={onPick} />
            </label>
        )}
        <PasteZone {...pz} target={pasteKey} tail="(또는 위 칸을 눌러 파일 선택)" className="mt-1.5" />
    </div>
);

/* #2 도면 · #3 관련자료 — 다중 파일 목록 (Phase 4: 모든 파일 허용, 비이미지는 아이콘+파일명)
   H-①: 목록 아래 pastezone — 마우스를 올리고 Ctrl+V 하면 이 목록에 캡처가 추가된다. */
const SimpleAttList = ({ list, onAdd, onRemove, pasteKey, pz }) => (
    <div className="px-4 pb-4 space-y-3">
        {list.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {list.map((a, i) => (
                    <div key={i} className="relative">
                        {isImageAtt(a) ? (
                            <img src={attUrl(a)} alt={a.name} className="w-full aspect-[4/3] object-cover rounded-lg border border-slate-200 bg-slate-50" />
                        ) : (
                            <div className="w-full aspect-[4/3] flex flex-col items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2">
                                <FileIcon className="w-7 h-7 text-slate-400" />
                                <span className="text-[10px] text-slate-500 font-mono truncate max-w-full">{a.name}</span>
                            </div>
                        )}
                        <button type="button" onClick={() => onRemove(i)}
                            className="absolute top-1.5 right-1.5 p-1 rounded-full bg-white/90 border border-slate-300 text-slate-500 hover:text-red-600 hover:border-red-300">
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <div className="text-[10px] text-slate-400 font-mono truncate mt-1">{a.name}</div>
                    </div>
                ))}
            </div>
        )}
        <PasteZone {...pz} target={pasteKey} />
        <label className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 cursor-pointer">
            <Plus className="w-3.5 h-3.5" /> 파일 추가
            <input type="file" multiple className="hidden" onChange={onAdd} />
        </label>
        <p className="text-[11px] text-slate-400">이미지는 자동 축소 저장, 이미지 외 파일은 5MB 이하만 첨부됩니다.</p>
    </div>
);

/* MES 연동 검색 선택 — 띄엄띄엄(공백 AND) 검색, %없이. 2글자↑ 입력 시 상위 20건.
   목록 선택 → onPick(행) / 직접 타이핑도 허용(onText) — "검색은 관대하게, 저장은 엄격하게" */
const SearchPick = ({ value, onText, onPick, table, placeholder, inputCls, badge }) => {
    const [open, setOpen] = useState(false);
    const [list, setList] = useState([]);
    const timer = useRef(null);
    const search = (q) => {
        const tokens = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
        if (!tokens.length || q.trim().length < 2) { setList([]); setOpen(false); return; }
        /* api.fetch는 전표 동기화용(전체 재귀 수집)이라 검색엔 부적합 — supabase 클라이언트로 단발 질의 */
        let sq = supabase.from(table).select('*');
        tokens.forEach(t => { sq = sq.ilike('search_text', `%${t}%`); });
        sq.limit(20).then(({ data, error }) => {
            if (error) { setList([]); setOpen(false); return; }
            setList(Array.isArray(data) ? data : []); setOpen(true);
        });
    };
    const onChange = (v) => {
        onText(v);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => search(v), 250);
    };
    return (
        <div className="relative">
            <input type="text" className={inputCls} placeholder={placeholder} value={value}
                onChange={e => onChange(e.target.value)}
                onFocus={() => { if (list.length) setOpen(true); }}
                onBlur={() => setTimeout(() => setOpen(false), 150)} />
            {badge && <div className="mt-1 text-[11px] text-emerald-600 font-mono">✓ 코드 {badge} 연결됨</div>}
            {open && (
                <div className="absolute z-30 mt-1 w-full max-h-72 overflow-y-auto bg-white border border-slate-300 rounded-lg shadow-lg">
                    {list.length === 0 ? (
                        <div className="px-3 py-2.5 text-xs text-slate-400">검색 결과 없음 — 직접 입력한 값 그대로 저장됩니다</div>
                    ) : list.map(row => (
                        <button key={row.id} type="button"
                            onMouseDown={e => { e.preventDefault(); onPick(row); setOpen(false); }}
                            className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-slate-100 last:border-0">
                            <span className="font-mono text-[11px] text-slate-400 mr-2">{row.id}</span>
                            <span className="text-sm text-slate-700">{row.name}</span>
                            {row.cls && <span className="ml-2 inline-block px-1.5 py-0.5 text-[10px] rounded bg-slate-100 text-slate-500">{row.cls}</span>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

/* v10.1 폼 초기값 — 신규 필드: code · tech_flag · routing_depts */
const blankForm = () => ({
    occur_date: new Date().toISOString().split('T')[0],
    supplier: '', supplier_code: '', item_name: '', item_code: '', item_cls: '', drawing_no: '',
    qty_total: '', qty_unknown: false, qty_defect: '',
    defect_desc: '', disposition: '', dept: '',
    code: '', tech_flag: false, routing_depts: [], concession_type: '',
    /* 933-07 「Recommended by」 — 처리방안 마련자. 발행 시점에 확정해야 회람 부서가 문의처를 안다. */
    disposition_by: ''
});

const NCRCreate = ({ user }) => {
    const [form, setForm] = useState(blankForm);
    const [depts, setDepts] = useState([]);
    const [nextNo, setNextNo] = useState('...');
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState(null);
    const [confirmOn, setConfirmOn] = useState(false);   // H-② 발행승인 요청 확인창(화면 안 모달)

    /* v10.1: ncr_settings(codes·dispositions·routing) + users 원본(부서별 담당자 select용) */
    const [codeMap, setCodeMap] = useState({});
    const [dispList, setDispList] = useState([]);
    const [routingCfg, setRoutingCfg] = useState({ default_depts: [], reply_hours: 24 });
    const [concTypes, setConcTypes] = useState([]);   // v10.2 특채 하위유형(절차서 5.3.4·5.3.7)
    const [staffAll, setStaffAll] = useState([]);
    const [settingsReady, setSettingsReady] = useState(false);
    const routeSeeded = useRef(false); // 기본 회람부서 1회만 주입(사용자 선택·이어쓰기 값 보호)

    /* Phase 3 첨부 상태 — 폼 입력과 독립(삭제해도 다른 입력값 영향 없음) */
    const [pairs, setPairs] = useState([]);          // #1 사진대지: [{good:{name,dataurl}|null, bad:...}]
    const [drawings, setDrawings] = useState([]);    // #2 해당 도면
    const [refDocs, setRefDocs] = useState([]);      // #3 관련자료
    const [attOpen, setAttOpen] = useState({ 1: false, 2: false, 3: false }); // 기본 접힘

    /* Phase 4: 이어쓰기 — 내 작성중·반려 문서 목록 + 편집 모드 */
    const [drafts, setDrafts] = useState([]);
    const [draftOpen, setDraftOpen] = useState(false);
    const [editDoc, setEditDoc] = useState(null); // {id, ncr_no, status} — null이면 새 문서
    /* v10.2 G-⑤ — 이어쓰기로 연 시점의 처리방안 원본값.
       설정 목록에 없는 구용어(예: '특채(그대로 사용)')를 다른 값으로 한 번 바꾸면
       선택지에서 사라져 되돌릴 수 없었다(F #34 실측 — 영구 소실).
       원본값을 따로 기억해 두고 select 옵션에 계속 남긴다. */
    const [origDisp, setOrigDisp] = useState('');

    const toggleAtt = (n) => setAttOpen(o => ({ ...o, [n]: !o[n] }));

    const pickPairImage = async (idx, kind, e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        try {
            const att = await shrinkImage(file);
            setPairs(ps => ps.map((p, i) => i === idx ? { ...p, [kind]: att } : p));
        } catch (err) { setMsg({ t: 'err', s: '이미지 처리 실패: ' + (err.message || err) }); }
    };

    const addSimpleFiles = async (setter, e) => {
        const files = [...(e.target.files || [])];
        e.target.value = '';
        if (!files.length) return;
        try {
            const atts = await Promise.all(files.map(processAnyFile));
            setter(list => [...list, ...atts]);
        } catch (err) { setMsg({ t: 'err', s: '파일 처리 실패: ' + (err.message || err) }); }
    };

    /* ── H-① 캡처 붙여넣기(Ctrl+V) — 시뮬레이터 v7.1~v9.3 기능 복원 ──
       대상 3곳: 'pair:{쌍번호}:{good|bad}' · 'draw'(#2 도면) · 'ref'(#3 관련자료).
       ※ 붙여넣기도 파일 선택과 똑같이 processAnyFile을 통과시킨다 —
         붙여넣기만 다른 길로 새면 축소 없이 원본이 들어가 DB가 비대해진다. */
    const onCapturePaste = async (target, file) => {
        try {
            const att = await processAnyFile(file);
            if (target === 'draw') setDrawings(l => [...l, att]);
            else if (target === 'ref') setRefDocs(l => [...l, att]);
            else if (String(target).startsWith('pair:')) {
                const [, i, side] = String(target).split(':');
                setPairs(ps => ps.map((p, j) => j === Number(i) ? { ...p, [side]: att } : p));
            } else return;
            setMsg({ t: 'ok', s: `📸 캡처 첨부됨: ${att.name}` });
        } catch (err) { setMsg({ t: 'err', s: '캡처 처리 실패: ' + (err.message || err) }); }
    };
    const pz = useCapturePaste(onCapturePaste, (s) => setMsg({ t: 'err', s }));

    const pairCount = pairs.length;

    const yy = String(new Date().getFullYear()).slice(2);

    const loadNextNo = async () => {
        try {
            const res = await api.fetch('/ncr_reports');
            const rows = await res.json();
            const seqs = (rows || [])
                .map(r => /^NCR (\d{2})-(\d+)$/.exec(r.ncr_no || ''))
                .filter(m => m && m[1] === yy)
                .map(m => parseInt(m[2], 10));
            const next = (seqs.length ? Math.max(...seqs) : 0) + 1;
            setNextNo(`NCR ${yy}-${String(next).padStart(3, '0')}`);
        } catch { setNextNo(`NCR ${yy}-001`); }
    };

    /* Phase 4: 내(author_email) 문서 중 작성중·반려 — 이어쓰기 후보 */
    const loadDrafts = async () => {
        try {
            const res = await api.fetch('/ncr_reports');
            const rows = await res.json();
            setDrafts((rows || [])
                /* v10.1: 레거시 '반려' + 신규 '발행반려' 문서도 이어쓰기 후보로 유지 */
                .filter(r => r.author_email === user?.email && ['작성중', '반려', '발행반려'].includes(r.status))
                .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')));
        } catch { setDrafts([]); }
    };

    /* v10.1: ncr_settings 로드 — codes.map(30종) · dispositions.list(8종) · routing.default_depts */
    const loadSettings = async () => {
        try {
            const res = await api.fetch('/ncr_settings');
            const rows = (await res.json()) || [];
            const pick = (id) => rows.find(s => s.id === id) || {};
            setCodeMap(pick('codes').map || {});
            setDispList(Array.isArray(pick('dispositions').list) ? pick('dispositions').list : []);
            setConcTypes(Array.isArray(pick('dispositions').concession_types) ? pick('dispositions').concession_types : []);
            const rt = pick('routing');
            setRoutingCfg({
                default_depts: Array.isArray(rt.default_depts) ? rt.default_depts : [],
                reply_hours: rt.reply_hours || 24
            });
        } catch { /* 설정 로드 실패 — 코드·처리방안 미선택 상태로 진행(발행 필수값 아님) */ }
        finally { setSettingsReady(true); }
    };

    useEffect(() => {
        loadNextNo();
        loadDrafts();
        loadSettings();
        api.fetch('/users').then(r => r.json()).then(d => {
            const rows = d || [];
            setStaffAll(rows);
            setDepts([...new Set(rows.map(u => u.company).filter(Boolean))].sort());
        }).catch(() => {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    /* v10.1 회람 지정 대상 부서 — users.company 중 품질보증부·응용기술팀 제외 */
    const routeDepts = depts.filter(d => !ROUTE_EXCLUDE.includes(d));
    const staffOf = (dept) => staffAll.filter(u => u.company === dept && isNcrRouteStaff(u));
    /* 처리방안 마련자는 품질보증부 전속(차장 확정) — 직급 제한 없음. 부서장도 마련자가 될 수 있다. */
    const qaStaff = staffAll.filter(u => u.company === QA_DEPT);
    const isRouted = (dept) => form.routing_depts.some(x => x.dept === dept);
    const routeOf = (dept) => form.routing_depts.find(x => x.dept === dept);

    /* 기본 회람부서(settings routing.default_depts) — 실제 존재하는 부서만 */
    const defaultRouting = () => routeDepts
        .filter(d => (routingCfg.default_depts || []).includes(d))
        .map(d => {
            const only = staffOf(d);
            return { dept: d, staff_email: only.length === 1 ? only[0].email : '', staff_name: only.length === 1 ? only[0].name : '' };
        });

    /* 설정·부서 목록이 모두 도착한 뒤 기본 회람부서 1회 주입 (편집 모드·사용자 선택은 건드리지 않음) */
    useEffect(() => {
        if (routeSeeded.current || !settingsReady || !routeDepts.length) return;
        routeSeeded.current = true;
        if (editDoc) return;
        setForm(f => (f.routing_depts.length ? f : { ...f, routing_depts: defaultRouting() }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [settingsReady, depts, routingCfg]);

    const emptyForm = () => ({ ...blankForm(), routing_depts: defaultRouting() });

    /* 부서 체크 토글 — 담당자가 1명뿐이면 자동 지정 */
    const toggleRouteDept = (dept, on) => setForm(f => {
        const rest = f.routing_depts.filter(x => x.dept !== dept);
        if (!on) return { ...f, routing_depts: rest };
        const cand = staffOf(dept);
        const auto = cand.length === 1 ? { staff_email: cand[0].email, staff_name: cand[0].name } : { staff_email: '', staff_name: '' };
        return { ...f, routing_depts: [...rest, { dept, ...auto }] };
    });

    const setRouteStaff = (dept, email) => setForm(f => {
        const u = staffAll.find(s => s.email === email);
        return {
            ...f,
            routing_depts: f.routing_depts.map(x => x.dept === dept
                ? { ...x, staff_email: email || '', staff_name: email ? (u?.name || '') : '' } : x)
        };
    });

    /* v9.3 onDispChange 규칙: 특채(Concession) 선택 → 기술 문의 자동 체크 + 잠금 */
    /* v10.2 D-05 — 특채 판정 기준을 상세·인쇄와 동일하게 부분일치로 통일.
       레거시 '특채(그대로 사용)' 문서도 기술문의 트랙이 잠기도록 한다. */
    const techLocked = String(form.disposition || '').startsWith('특채');
    const onDispChange = (v) => { const isC = String(v || '').startsWith('특채'); setForm(f => ({ ...f, disposition: v, concession_type: isC ? f.concession_type : '', tech_flag: isC ? true : f.tech_flag })); };
    const onTechChange = (on) => { if (!techLocked) set('tech_flag', on); };

    /* Phase 4: 편집 이탈 → 새 문서 모드 */
    const resetToNew = () => {
        setEditDoc(null);
        setForm(emptyForm());
        setOrigDisp('');
        setPairs([]); setDrawings([]); setRefDocs([]);
        setAttOpen({ 1: false, 2: false, 3: false });
        setMsg(null);
        loadNextNo();
    };

    /* Phase 4: 이어쓰기 — 문서 + 첨부를 폼에 로드 (ncr_no·id 유지) */
    const loadDraft = async (r) => {
        try {
            setEditDoc({ id: r.id, ncr_no: r.ncr_no, status: r.status, reject_note: r.reject_note || '' });
            setOrigDisp(r.disposition || '');   // G-⑤ 목록 밖 값 보존용 원본 기억
            routeSeeded.current = true; // 복원값 보호 — 기본 회람부서 주입 금지
            /* v10.1: reviews에서 회람 지정 복원. 레거시(reviews 비어있음 — v10.0 발행·반려 문서)는
               기본 회람부서 + 기존 처리부서로 씨딩해 재발행 경로가 막히지 않게 한다. */
            const restored = Object.entries(r.reviews || {})
                .filter(([, v]) => v && v.state !== 'skip')
                .map(([dept, v]) => ({ dept, staff_email: v.staff_email || '', staff_name: v.staff_name || '' }))
                .filter(x => routeDepts.length === 0 || routeDepts.includes(x.dept));
            let routing = restored;
            if (!routing.length && !r.tech_flag) {
                routing = defaultRouting();
                if (r.dept && routeDepts.includes(r.dept) && !routing.some(x => x.dept === r.dept)) {
                    const cand = staffOf(r.dept);
                    routing = [...routing, { dept: r.dept, staff_email: cand.length === 1 ? cand[0].email : '', staff_name: cand.length === 1 ? cand[0].name : '' }];
                }
            }
            setForm({
                occur_date: r.occur_date || new Date().toISOString().split('T')[0],
                supplier: r.supplier || '', supplier_code: r.supplier_code || '', item_name: r.item_name || '', item_code: r.item_code || '', item_cls: r.item_cls || '', drawing_no: r.drawing_no || '',
                qty_total: r.qty_total == null ? '' : String(r.qty_total),
                qty_unknown: !!r.qty_unknown,
                qty_defect: r.qty_defect == null ? '' : String(r.qty_defect),
                defect_desc: r.defect_desc || '', disposition: r.disposition || '', concession_type: r.concession_type || '', dept: r.dept || '',
                disposition_by: r.disposition_by || '',
                code: r.code || '',
                /* A영역 회귀 실측(08-22) — 레거시 특채 문서(tech_flag=false)를 이어쓰기로 열면
                   techLocked는 켜지는데 체크는 꺼진 채라 「꺼진 상태로 잠김」이 됐다.
                   화면은 「특채 → 기술 문의 트랙 필수(잠금)」라고 말하면서 실제로는 켤 수도 끌 수도 없고,
                   그대로 발행하면 응용기술팀 선행회람을 건너뛰고 일반 회람으로 들어갔다.
                   잠금 판정(techLocked)과 값 설정이 서로 다른 경로여서 생긴 어긋남 —
                   불러오는 시점에도 같은 규칙(startsWith('특채'))을 적용해 맞춘다. */
                tech_flag: String(r.disposition || '').startsWith('특채') ? true : !!r.tech_flag,
                routing_depts: routing
            });
            const res = await api.fetch(`/ncr_attachments?report_id=eq.${encodeURIComponent(r.id)}`);
            /* v10.2 — 버킷에 있는 첨부는 서명 주소를 받아 화면에 건다.
               legacy=true 는 「예전 방식(dataurl)으로 이미 저장된 행」이라는 표시다.
               저장할 때 이 표시가 있으면 다시 올리지 않고 그대로 둔다. */
            const all = await withAttUrls(((await res.json()) || []).filter(a => a.report_id === r.id));
            const asForm = (a) => ({ id: a.id, name: a.name, path: a.path || null, url: a.url || '', dataurl: a.dataurl || '', legacy: !!a.dataurl });
            const map = new Map();
            all.filter(a => a.category === 1).forEach(a => {
                const no = a.pair_no || 1;
                if (!map.has(no)) map.set(no, { good: null, bad: null });
                /* G-⑥ — 기존 행의 id를 폼까지 들고 온다. 저장 때 「그대로인 첨부」를 알아보고 손대지 않기 위함. */
                map.get(no)[a.kind === '정상' ? 'good' : 'bad'] = asForm(a);
            });
            const loadedPairs = [...map.entries()].sort((x, y) => x[0] - y[0]).map(([, v]) => v);
            const loadedDrawings = all.filter(a => a.category === 2).map(asForm);
            const loadedRefs = all.filter(a => a.category === 3).map(asForm);
            setPairs(loadedPairs); setDrawings(loadedDrawings); setRefDocs(loadedRefs);
            setAttOpen({ 1: loadedPairs.length > 0, 2: loadedDrawings.length > 0, 3: loadedRefs.length > 0 });
            setDraftOpen(false);
            setMsg(null);
        } catch (e) {
            setMsg({ t: 'err', s: '문서 불러오기 실패: ' + (e.message || e) });
        }
    };

    /* v9.3 수량 가드: 파악중이면 전체수량 비활성 / 확정이면 전체 필수 + 부적합 ≤ 전체 */
    const qtyError = (() => {
        const d = parseInt(form.qty_defect, 10);
        if (form.qty_defect === '' ) return null;
        if (isNaN(d) || d < 0) return '부적합 수량은 0 이상의 숫자여야 합니다.';
        if (!form.qty_unknown && form.qty_total !== '') {
            const t = parseInt(form.qty_total, 10);
            if (isNaN(t) || t < 0) return '전체 수량은 0 이상의 숫자여야 합니다.';
            if (d > t) return '부적합 수량이 전체 수량보다 클 수 없습니다.';
        }
        return null;
    })();

    /* v10.1: 선택 부서 wait · 미선택 부서 skip (규약 reviews 구조).
       기술트랙은 본회람 대상을 특채판단 단계에서 지정하므로 빈 객체로 둔다.
       임시저장('작성중')에도 같은 구조로 보관 — 이어쓰기 시 회람 지정 복원용(회람 활성 판정은 status로만 한다). */
    const buildReviews = () => {
        if (form.tech_flag) return {};
        const rv = {};
        routeDepts.forEach(d => { rv[d] = makeReview(isRouted(d) ? 'wait' : 'skip', routeOf(d)); });
        return rv;
    };

    /* H-②: 필수값 검증을 submit에서 분리한다.
       확인창은 「검증을 다 통과했을 때만」 떠야 하므로(검증 실패인데 확인창부터 뜨면 안 된다)
       발행 버튼이 저장 전에 같은 규칙을 먼저 돌려볼 수 있어야 한다.
       실패 사유 문자열 반환 / 통과면 null — 규칙은 여기 한 곳에만 둔다(검증 중복 금지). */
    const validationError = (status) => {
        const issuing = status !== '작성중';
        if (!form.supplier.trim() || !form.item_name.trim()) return '업체와 품명은 필수입니다.';
        if (form.qty_defect === '') return '부적합 수량은 필수입니다.';
        if (!form.qty_unknown && form.qty_total === '') return '전체 수량을 입력하거나 [파악중]을 체크하세요.';
        if (qtyError) return qtyError;
        /* P1-4: 부적합 내용은 발행 필수값 */
        if (issuing && !form.defect_desc.trim()) return '발행승인을 요청하려면 부적합 내용을 입력하세요.';
        /* v10.1: 회람 대상 1곳 이상 (기술트랙은 특채판단 단계에서 지정 — 검사 제외) */
        if (issuing && !form.tech_flag && form.routing_depts.length === 0) return '회람 대상 부서를 1곳 이상 선택하세요.';
        /* 처리방안 마련자는 발행 필수 — 회람 부서가 문의할 상대가 없으면 회신이 겉돈다. */
        if (issuing && !String(form.disposition_by || '').trim()) return '처리방안 마련자를 지정하세요 (품질보증부).';
        return null;
    };

    /* H-② 발행/재발행 버튼 → ①검증 먼저 ②통과했을 때만 확인창. 임시저장은 되돌릴 수 있으므로 확인창 없음. */
    const askIssue = () => {
        const e = validationError(ISSUE_STATUS);
        if (e) { setMsg({ t: 'err', s: e }); setConfirmOn(false); return; }
        setMsg(null);
        setConfirmOn(true);
    };

    const submit = async (status) => {
        const vErr = validationError(status);
        if (vErr) { setMsg({ t: 'err', s: vErr }); return; }
        const issuing = status !== '작성중';
        setSaving(true);
        const docNo = editDoc ? editDoc.ncr_no : nextNo;
        try {
            /* ── 첨부 업로드는 문서 저장보다 먼저 한다 ──────────────────────────
               실측 결함(예림 050 V-4 · 2026-08-30): 종전 순서는 「문서 저장 → 첨부 업로드」였다.
               그래서 사진 업로드가 실패해도 문서 상태는 이미 다음 단계(발행승인 대기)로 넘어가 있었다.
               사진 없이 결재만 끝난 문서는 품질기록으로 성립하지 않는다.
               → 업로드를 먼저 끝낸다. 하나라도 실패하면 예외가 올라가 문서에는 손도 대지 않는다.

               세 갈래 — ①이미 경로가 있는 것: 그대로 ②예전 방식(legacy): 손대지 않음(재업로드 금지)
                          ③이번에 새로 고른 것: 지금 올리고 경로를 받는다

               저장 경로 앞자리는 편집이면 문서 id, 신규면 '_draft'다. 신규는 저장 전이라 id가 없다.
               문서와의 연결은 경로가 아니라 ncr_attachments.report_id 가 담당한다(경로는 사람이 찾아보기 위한 것).

               남는 위험 — 여러 첨부 중 일부만 올라간 뒤 실패하면 버킷에 참조 없는 파일이 남는다.
               문서·표는 전혀 바뀌지 않으므로 기록은 온전하다. 지우려면 삭제 권한이 필요한데,
               품질기록 보존을 위해 앱에 삭제 권한을 주지 않기로 했으므로 남겨 둔다. */
            const now = new Date().toISOString();
            const attKeyBase = editDoc?.id ?? '_draft';
            const toAttRow = async (a, extra) => {
                if (a.path) return { id: a.id, name: a.name, path: a.path, ...extra };
                if (a.legacy) return { id: a.id, name: a.name, dataurl: a.dataurl, ...extra };
                return { id: a.id, name: a.name, path: await uploadAtt(attKeyBase, a.name, a.dataurl), ...extra };
            };
            const attRows = [
                ...(await Promise.all(pairs.flatMap((p, i) => [
                    p.good && toAttRow(p.good, { category: 1, pair_no: i + 1, kind: '정상' }),
                    p.bad && toAttRow(p.bad, { category: 1, pair_no: i + 1, kind: '불량' })
                ].filter(Boolean)))),
                ...(await Promise.all(drawings.map(d => toAttRow(d, { category: 2 })))),
                ...(await Promise.all(refDocs.map(d => toAttRow(d, { category: 3 }))))
            ];

            /* Phase 4: 편집 모드면 같은 id로 POST(UPSERT→UPDATE) — ncr_no·id 유지 */
            const formCols = { ...form };
            delete formCols.routing_depts; // routing_depts는 UI 전용 상태 — reviews로 환산해 저장
            const body = {
                ncr_no: docNo, status,
                ...formCols,
                qty_total: form.qty_unknown ? null : parseInt(form.qty_total, 10),
                qty_defect: parseInt(form.qty_defect, 10),
                /* v9.3 규칙: 기술트랙이면 처리방안은 특채판단 단계에서 확정 → 저장 시 초기화 */
                disposition: form.tech_flag ? '' : form.disposition,
                concession_type: form.tech_flag ? '' : (form.disposition === CONCESSION ? form.concession_type : ''),
                code: form.code || '',
                tech_flag: !!form.tech_flag,
                dept: form.dept || (form.tech_flag ? '' : (form.routing_depts[0]?.dept || '')),
                reviews: buildReviews(),
                flow_ver: FLOW_VER,
                author_name: user?.name || '', author_email: user?.email || '', author_company: user?.company || ''
            };
            if (editDoc) body.id = editDoc.id;
            else body.created_at = new Date().toISOString();
            const res = await api.fetch('/ncr_reports', { method: 'POST', body });
            const saved = await res.json();
            const reportId = saved?.id ?? editDoc?.id;

            /* Phase 3: 첨부 저장 — report_id 연결하여 ncr_attachments에 건별 POST.
               v10.2 G-⑥ — 종전에는 편집 저장 때마다 그 문서의 첨부 행을 전부 DELETE하고 다시 INSERT했다.
               첨부를 하나도 건드리지 않은 저장에서도 4행의 id가 전부 새 값으로 바뀌는 것이 실측됐다(F #65, 2회 재현).
               결재이력(ncr_approvals)은 누적 보존인데 첨부만 계보가 매번 끊겨, 첨부를 참조하는 링크·감사 추적이 무의미해진다.
               → 「변한 것만 반영」으로 바꾼다: 폼에서 빠진 것만 DELETE, 새로 추가된 것만 INSERT,
                 그대로인 것은 아예 손대지 않고(id·at 유지), 자리(pair_no)만 바뀐 것은 같은 id로 갱신한다. */
            const exMap = new Map();
            if (editDoc) {
                const exRes = await api.fetch(`/ncr_attachments?report_id=eq.${encodeURIComponent(editDoc.id)}`);
                const exRows = ((await exRes.json()) || []).filter(a => a.report_id === editDoc.id);
                exRows.forEach(a => exMap.set(String(a.id), a));
                /* 폼에 남아 있는 id만 살린다 — 사용자가 화면에서 뺀 것만 지워진다 */
                const keep = new Set(attRows.map(r => r.id).filter(v => v != null).map(String));
                for (const a of exRows) {
                    if (!keep.has(String(a.id))) await api.fetch(`/ncr_attachments/${a.id}`, { method: 'DELETE' });
                }
            }
            /* 내용이 같으면 쓰기 자체를 하지 않는다(id·at 그대로) — 같은 저장을 여러 번 해도 중복이 쌓이지 않는다 */
            const attSame = (prev, row) =>
                Number(prev.category) === Number(row.category) &&
                (prev.pair_no ?? null) === (row.pair_no ?? null) &&
                (prev.kind ?? null) === (row.kind ?? null) &&
                (prev.name ?? '') === (row.name ?? '') &&
                (prev.path ?? '') === (row.path ?? '') &&
                (prev.dataurl ?? '') === (row.dataurl ?? '') &&
                String(prev.report_id) === String(reportId);
            for (const row of attRows) {
                const prev = row.id != null ? exMap.get(String(row.id)) : null;
                if (prev && attSame(prev, row)) continue;                       // 변한 것 없음 → 손대지 않음
                if (prev) {
                    /* 자리·내용이 바뀐 기존 첨부: 같은 id로 갱신(UPSERT) — 계보 유지. at은 원본 등록 시각 그대로 둔다 */
                    await api.fetch('/ncr_attachments', { method: 'POST', body: { ...row, report_id: reportId } });
                } else {
                    const { id: _drop, ...ins } = row;                          // 새 첨부: id는 서버가 발급
                    await api.fetch('/ncr_attachments', { method: 'POST', body: { report_id: reportId, ...ins, at: now } });
                }
            }
            /* P1-2 계보 보존: 반려 후 임시저장(작성중)을 경유해도 이력에 반려가 있으면 '재발행' 요청으로 표기.
               v10.1 — ncr_approvals.action은 '발행요청' 고정, 재발행 여부는 comment로 남긴다. */
            let redo = false;
            if (editDoc) {
                if (editDoc.status === '반려' || editDoc.status === '발행반려') redo = true;
                else {
                    try {
                        const hRes = await api.fetch('/ncr_approvals');
                        const hist = ((await hRes.json()) || []).filter(h => h.report_id === editDoc.id);
                        if (hist.some(h => ['반려', '발행반려'].includes(h.action))) redo = true;
                    } catch { /* 이력 조회 실패 시 신규 발행요청으로 간주 */ }
                }
            }
            if (issuing) {
                await api.fetch('/ncr_approvals', {
                    method: 'POST',
                    body: {
                        report_id: reportId, action: '발행요청',
                        actor_name: user?.name || '', actor_company: user?.company || '',
                        comment: [redo ? '반려 문서 수정 후 재발행 요청' : '', form.tech_flag ? '기술 문의 필요 — 응용기술팀 단독 선행회람' : '']
                            .filter(Boolean).join(' / '),
                        at: new Date().toISOString()
                    }
                });
            }
            const doneLabel = status === '작성중'
                ? (editDoc ? '수정 저장' : '임시저장')
                : (redo ? '재발행 승인 요청' : '발행승인 요청');
            setMsg({ t: 'ok', s: `${docNo} ${doneLabel} 완료` });
            setConfirmOn(false);           // H-② 저장이 끝났으면 확인창은 닫는다(실패 시엔 열어둔 채 오류만 표시)
            setEditDoc(null);
            setForm(emptyForm());
            setOrigDisp('');
            setPairs([]); setDrawings([]); setRefDocs([]); setAttOpen({ 1: false, 2: false, 3: false });
            loadNextNo();
            loadDrafts();
        } catch (e) {
            setMsg({ t: 'err', s: '저장 실패: ' + (e.message || e) });
        } finally { setSaving(false); }
    };

    const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400';

    /* v10.1 코드 select — settings codes.map을 A주물/B가공/C조립/D기타 그룹으로 분류(번호 오름차순) */
    const codeEntries = Object.entries(codeMap || {});
    const codeNo = (k) => parseInt(String(k).slice(1), 10) || 0;
    const groupedCodes = CODE_GROUPS.map(g => ({
        ...g,
        items: codeEntries.filter(([k]) => k.startsWith(g.key)).sort((a, b) => codeNo(a[0]) - codeNo(b[0]))
    }));
    const ungroupedCodes = codeEntries.filter(([k]) => !CODE_GROUPS.some(g => k.startsWith(g.key)));
    /* 처리방안 — v10.2: 4종(재작업·폐기·불채용(반송)·특채).
       G-⑤: 설정 목록 밖 값은 「(설정 외)」 라벨을 달아 계속 남긴다 — 부적합 코드 select와 같은 방식(일관성).
       현재 값뿐 아니라 「이어쓰기로 열었을 때의 원래 값(origDisp)」도 함께 남겨야
       다른 값으로 바꿨다가 원래대로 되돌릴 수 있다(종전에는 한 번 바꾸면 옵션에서 사라졌다). */
    const outOfListDisps = [...new Set([origDisp, form.disposition].filter(d => d && !dispList.includes(d)))];
    /* H-② 확인창 제목용 — 반려 문서를 이어쓰는 중이면 「재발행승인 요청」으로 부른다(버튼 분기와 같은 판정) */
    const isRedoDoc = ['반려', '발행반려'].includes(editDoc?.status) || !!editDoc?.reject_note;

    return (
        <div className="max-w-4xl">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-slate-800 flex items-center">
                    <FileText className="mr-2 h-6 w-6 text-blue-600" /> 부적합보고서 작성
                </h1>
                <div className="flex items-center gap-2">
                    {editDoc && (
                        <>
                            <span className="text-sm font-semibold text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-300">
                                수정 중: {editDoc.ncr_no}
                            </span>
                            <button type="button" onClick={resetToNew}
                                className="flex items-center px-3 py-1.5 text-sm font-semibold rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50">
                                <FilePlus2 className="w-4 h-4 mr-1.5" /> 새 문서
                            </button>
                        </>
                    )}
                    {!editDoc && (
                        <span className="text-sm font-mono font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">{nextNo}</span>
                    )}
                </div>
            </div>

            {/* ── Phase 4: 이어쓰기 — 내 작성중·반려 문서 (접이식) ── */}
            {drafts.length > 0 && (
                <div className="mb-4 bg-white rounded-xl shadow-sm border border-slate-200">
                    <button type="button" onClick={() => setDraftOpen(o => !o)}
                        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 rounded-xl">
                        <span className="flex items-center gap-2">
                            {draftOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                            이어쓰기 — 내 작성중·반려 문서
                        </span>
                        <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">{drafts.length}건</span>
                    </button>
                    {draftOpen && (
                        <ul className="border-t border-slate-100 divide-y divide-slate-100">
                            {drafts.map(d => (
                                <li key={d.id}>
                                    <button type="button" onClick={() => loadDraft(d)}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-blue-50/40">
                                        <span className="font-mono text-sm font-semibold text-blue-700 shrink-0">{d.ncr_no}</span>
                                        <span className={`shrink-0 px-2 py-0.5 text-[11px] font-semibold rounded-full border ${['반려', '발행반려'].includes(d.status) ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-100 text-slate-600 border-slate-300'}`}>{d.status}</span>
                                        <span className="text-sm text-slate-700 truncate">{d.item_name || '(품명 미입력)'}</span>
                                        <span className="ml-auto text-xs text-slate-400 shrink-0">{d.occur_date}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">발생일 *</label>
                        <input type="date" className={inputCls} value={form.occur_date} onChange={e => set('occur_date', e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">업체(발생처) *</label>
                        <SearchPick table="vendors" inputCls={inputCls} value={form.supplier}
                            placeholder="업체명·코드 검색 (예: 창대)" badge={form.supplier_code}
                            onText={v => setForm(f => ({ ...f, supplier: v, supplier_code: '' }))}
                            onPick={row => setForm(f => ({ ...f, supplier: row.name, supplier_code: row.id }))} />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">도면번호</label>
                        <input type="text" className={inputCls} placeholder="예: C902001" value={form.drawing_no} onChange={e => set('drawing_no', e.target.value)} />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">품명 *</label>
                    <SearchPick table="item_master" inputCls={inputCls} value={form.item_name}
                        placeholder="띄엄띄엄 검색 — 예: SFP NP22 SCPH2 80A (%불필요)" badge={form.item_code}
                        onText={v => setForm(f => ({ ...f, item_name: v, item_code: '', item_cls: '' }))}
                        onPick={row => setForm(f => ({ ...f, item_name: row.name, item_code: row.id, item_cls: row.cls || '' }))} />
                </div>

                {/* 수량 블록 — v9.3 로직 이관 */}
                <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5">전체 수량 {form.qty_unknown ? '' : '*'}</label>
                            <input type="number" min="0" className={inputCls} disabled={form.qty_unknown} placeholder={form.qty_unknown ? '파악중' : '예: 100'} value={form.qty_unknown ? '' : form.qty_total} onChange={e => set('qty_total', e.target.value)} />
                        </div>
                        <label className="flex items-center gap-2 text-sm text-slate-700 pb-2.5 cursor-pointer select-none">
                            <input type="checkbox" className="w-4 h-4 accent-blue-600" checked={form.qty_unknown} onChange={e => set('qty_unknown', e.target.checked)} />
                            파악중 <span className="text-xs text-slate-400">(전체 수량 미정)</span>
                        </label>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5">부적합 수량 *</label>
                            <input type="number" min="0" className={inputCls} placeholder="예: 6" value={form.qty_defect} onChange={e => set('qty_defect', e.target.value)} />
                        </div>
                    </div>
                    {qtyError && (
                        <p className="mt-2 text-xs text-red-600 flex items-center"><AlertTriangle className="w-3.5 h-3.5 mr-1" />{qtyError}</p>
                    )}
                </div>

                <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">부적합 내용 *</label>
                    <textarea rows={4} className={inputCls} placeholder="예: SEAT RING 내경 치수 상한 이탈 6EA" value={form.defect_desc} onChange={e => set('defect_desc', e.target.value)} />
                </div>

                {/* ── v10.1: 부적합 코드(설정 30종) + 기술 문의 필요 ── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">부적합 코드 <span className="text-slate-400 font-normal">(권장 — 발행 필수 아님)</span></label>
                        <select className={inputCls} value={form.code} onChange={e => set('code', e.target.value)}>
                            <option value="">— 미분류 —</option>
                            {groupedCodes.map(g => g.items.length > 0 && (
                                <optgroup key={g.key} label={g.label}>
                                    {g.items.map(([k, v]) => <option key={k} value={k}>{`${k} — ${v}`}</option>)}
                                </optgroup>
                            ))}
                            {ungroupedCodes.length > 0 && (
                                <optgroup label="기타 코드">
                                    {ungroupedCodes.map(([k, v]) => <option key={k} value={k}>{`${k} — ${v}`}</option>)}
                                </optgroup>
                            )}
                            {/* 이어쓰기 시 설정에서 사라진 레거시 코드도 값 보존 */}
                            {form.code && !codeMap[form.code] && <option value={form.code}>{form.code} (설정 외)</option>}
                        </select>
                    </div>
                    <div className="flex items-end">
                        <label className={`w-full flex items-start gap-2 px-3 py-2 rounded-lg border text-sm select-none ${form.tech_flag ? 'bg-violet-50 border-violet-300 text-violet-800' : 'bg-white border-slate-300 text-slate-700'} ${techLocked ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                            <input type="checkbox" className="w-4 h-4 mt-0.5 accent-violet-600" checked={form.tech_flag}
                                disabled={techLocked} onChange={e => onTechChange(e.target.checked)} />
                            <span>
                                기술 문의 필요
                                <span className="block text-[11px] text-slate-400">특채 검토 대상 — 응용기술팀 단독 선행회람</span>
                                {techLocked && <span className="block text-[11px] font-semibold text-violet-700">처리방안 특채 선택 → 기술 문의 트랙 필수(잠금)</span>}
                            </span>
                        </label>
                    </div>
                </div>

                {form.tech_flag && (
                    <div className="flex items-start gap-2 text-sm px-4 py-3 rounded-lg bg-violet-50 border border-violet-200 text-violet-800">
                        <Info className="w-4 h-4 mt-0.5 shrink-0" />
                        <span>발행승인 후 응용기술팀 단독 선행회람 → 특채 판단 경로로 진행됩니다.
                            <span className="block text-[11px] text-violet-600">처리방안·본회람 대상 부서는 특채판단 단계에서 확정되므로 작성 단계에서는 지정하지 않습니다.</span>
                        </span>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">처리방안 (결재 과정에서 확정 가능)</label>
                        <select className={inputCls} value={form.disposition} onChange={e => onDispChange(e.target.value)}>
                            <option value="">— 미정 —</option>
                            {/* G-⑤ 설정 목록 밖 값(구용어 등)은 라벨을 달아 맨 앞에 계속 노출 — 바꿔도 되돌릴 수 있다 */}
                            {outOfListDisps.map(d => <option key={d} value={d}>{d} (설정 외)</option>)}
                            {dispList.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                        {form.tech_flag && <p className="mt-1 text-[11px] text-violet-600">기술트랙 — 처리방안과 특채 유형은 특채판단 단계에서 확정됩니다(저장 시 미정으로 기록).</p>}
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">주관 처리부서 <span className="text-slate-400 font-normal">(선택 — 미지정 시 첫 회람부서)</span></label>
                        <select className={inputCls} value={form.dept} onChange={e => set('dept', e.target.value)}>
                            <option value="">— 선택 —</option>
                            {depts.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>
                </div>

                {/* ── 처리방안 마련자 (933-07 Recommended by) ── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">처리방안 마련자 <span className="text-red-500">*</span> <span className="text-slate-400 font-normal">(품질보증부 — 발행 필수)</span></label>
                        <select className={inputCls} value={form.disposition_by} onChange={e => set('disposition_by', e.target.value)}>
                            <option value="">— 선택 —</option>
                            {qaStaff.map(u => <option key={u.email} value={u.name}>{u.name} {u.rank}</option>)}
                        </select>
                        <p className="mt-1 text-[11px] text-slate-500">회람 부서가 처리방안을 문의할 상대입니다. 처리방안이 특채로 바뀌어도 마련자는 그대로 유지됩니다.</p>
                    </div>
                </div>

                {/* ── v10.1: 회람대상 지정 (기술트랙이면 숨김 — 특채판단 단계에서 지정) ── */}
                {!form.tech_flag && (
                    <div className="rounded-lg border border-slate-200">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                            <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                <Users className="w-4 h-4 text-slate-400" /> 회람 대상 부서·담당자 선택
                                <span className="text-[11px] font-normal text-slate-400">(문제 성격 따라 제외 — 미선택 부서는 회람 제외로 인쇄)</span>
                            </span>
                            <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">{form.routing_depts.length}개 부서</span>
                        </div>
                        <div className="p-4 space-y-2">
                            {routeDepts.length === 0 ? (
                                <p className="text-xs text-slate-400">부서 목록을 불러오는 중입니다.</p>
                            ) : routeDepts.map(d => {
                                const on = isRouted(d);
                                const cand = staffOf(d);
                                const cur = routeOf(d);
                                return (
                                    <div key={d} className={`grid grid-cols-1 md:grid-cols-2 gap-2 items-center px-3 py-2 rounded-lg border ${on ? 'bg-blue-50/40 border-blue-200' : 'bg-slate-50 border-slate-200'}`}>
                                        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
                                            <input type="checkbox" className="w-4 h-4 accent-blue-600" checked={on} onChange={e => toggleRouteDept(d, e.target.checked)} />
                                            <span className="font-semibold">{d}</span>
                                            {(routingCfg.default_depts || []).includes(d) && <span className="text-[10px] text-slate-400">기본</span>}
                                        </label>
                                        <select className={inputCls} disabled={!on} value={cur?.staff_email || ''}
                                            onChange={e => setRouteStaff(d, e.target.value)}>
                                            <option value="">{cand.length ? '— 담당자 미지정 —' : '— 등록된 담당자 없음 —'}</option>
                                            {cand.map(u => <option key={u.email} value={u.email}>{`${u.name}${u.rank ? ` (${u.rank})` : ''}`}</option>)}
                                        </select>
                                    </div>
                                );
                            })}
                            <p className="text-[11px] text-slate-400">회신 기한 기준 {routingCfg.reply_hours}시간 — 발행승인 시점부터 기산됩니다.</p>
                        </div>
                    </div>
                )}

                {/* ── Phase 3: 첨부 3블록 (기본 접힘) ── */}
                <div className="space-y-3">
                    {/* #1 사진대지 — 대비표 쌍(정상|불량) */}
                    <div className="rounded-lg border border-slate-200">
                        <AttSectionHead open={attOpen[1]} onToggle={() => toggleAtt(1)}
                            title="첨부#1 — 사진대지 (정상·불량 대비표)" badge={`${pairCount}쌍`} />
                        {attOpen[1] && (
                            <div className="px-4 pb-4 space-y-4">
                                {pairs.map((p, i) => (
                                    <div key={i} className="relative rounded-lg border border-dashed border-slate-300 p-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-bold text-slate-500">쌍 {i + 1}</span>
                                            <button type="button" onClick={() => setPairs(ps => ps.filter((_, j) => j !== i))}
                                                className="text-xs font-semibold text-red-500 hover:text-red-700 flex items-center gap-1">
                                                <Trash2 className="w-3.5 h-3.5" /> 삭제
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <PairSlot att={p.good} kind="정상"
                                                onPick={e => pickPairImage(i, 'good', e)}
                                                onClear={() => setPairs(ps => ps.map((q, j) => j === i ? { ...q, good: null } : q))}
                                                pasteKey={`pair:${i}:good`} pz={pz} />
                                            <PairSlot att={p.bad} kind="불량"
                                                onPick={e => pickPairImage(i, 'bad', e)}
                                                onClear={() => setPairs(ps => ps.map((q, j) => j === i ? { ...q, bad: null } : q))}
                                                pasteKey={`pair:${i}:bad`} pz={pz} />
                                        </div>
                                    </div>
                                ))}
                                <button type="button" onClick={() => setPairs(ps => [...ps, { good: null, bad: null }])}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50">
                                    <Plus className="w-3.5 h-3.5" /> 쌍 추가 (정상·불량)
                                </button>
                                <p className="text-[11px] text-slate-400">쌍 단위 관리 — 인쇄 시 1쪽에 2쌍(사진 4장)씩 출력됩니다.</p>
                            </div>
                        )}
                    </div>
                    {/* #2 해당 도면 */}
                    <div className="rounded-lg border border-slate-200">
                        <AttSectionHead open={attOpen[2]} onToggle={() => toggleAtt(2)}
                            title="첨부#2 — 해당 도면" badge={`${drawings.length}건`} />
                        {attOpen[2] && (
                            <SimpleAttList list={drawings}
                                onAdd={e => addSimpleFiles(setDrawings, e)}
                                onRemove={i => setDrawings(l => l.filter((_, j) => j !== i))}
                                pasteKey="draw" pz={pz} />
                        )}
                    </div>
                    {/* #3 관련자료 */}
                    <div className="rounded-lg border border-slate-200">
                        <AttSectionHead open={attOpen[3]} onToggle={() => toggleAtt(3)}
                            title="첨부#3 — 관련자료" badge={`${refDocs.length}건`} />
                        {attOpen[3] && (
                            <SimpleAttList list={refDocs}
                                onAdd={e => addSimpleFiles(setRefDocs, e)}
                                onRemove={i => setRefDocs(l => l.filter((_, j) => j !== i))}
                                pasteKey="ref" pz={pz} />
                        )}
                    </div>
                </div>

                {msg && (
                    <div className={`text-sm px-4 py-2.5 rounded-lg ${msg.t === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg.s}</div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                    {(['반려', '발행반려'].includes(editDoc?.status) || !!editDoc?.reject_note) ? (
                        /* Phase 4: 반려 문서 편집 — 수정 저장(작성중 유지) / 재발행 (v10.1: 발행승인 대기로 재진입) */
                        <>
                            <button onClick={() => submit('작성중')} disabled={saving}
                                className="px-4 py-2.5 text-sm font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 flex items-center disabled:opacity-50">
                                <Save className="w-4 h-4 mr-1.5" /> 수정 저장 (작성중 유지)
                            </button>
                            {/* H-②: 바로 보내지 않고 검증 통과 후 확인창을 띄운다 */}
                            <button onClick={askIssue} disabled={saving}
                                className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 flex items-center disabled:opacity-50">
                                <RotateCcw className="w-4 h-4 mr-1.5" /> 재발행승인 요청 (품질부서장)
                            </button>
                        </>
                    ) : (
                        <>
                            <button onClick={() => submit('작성중')} disabled={saving}
                                className="px-4 py-2.5 text-sm font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 flex items-center disabled:opacity-50">
                                <Save className="w-4 h-4 mr-1.5" /> {editDoc ? '수정 저장' : '임시저장'}
                            </button>
                            {/* H-②: 바로 보내지 않고 검증 통과 후 확인창을 띄운다 */}
                            <button onClick={askIssue} disabled={saving}
                                className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 flex items-center disabled:opacity-50">
                                <Send className="w-4 h-4 mr-1.5" /> 발행승인 요청 (품질부서장)
                            </button>
                        </>
                    )}
                </div>
            </div>
            <p className="mt-3 text-xs text-slate-400">작성자: {user?.name} ({user?.company}) · 첨부 이미지는 최대 1280px JPEG로 자동 축소되어 저장됩니다.</p>

            {/* ── H-② 발행승인 요청 확인창 ──
                window.confirm이 아니라 화면 안 모달로 만든다(브라우저 확인창은 내용 요약을 못 보여준다).
                디자인은 결재 패널(NCRDetail Panel)과 맞춘다 — 회색 카드 + 우측 [취소][확정] 2버튼.
                취소하면 폼은 그대로 남는다(상태를 아무것도 건드리지 않음). */}
            {confirmOn && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setConfirmOn(false)}>
                    <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg max-h-[88vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="p-5">
                            <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 space-y-3">
                                <div className="text-sm font-bold text-slate-700">
                                    {isRedoDoc ? '재발행승인 요청' : '발행승인 요청'} — 이대로 승인요청 하시겠습니까?
                                </div>
                                <div className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-100 text-sm">
                                    {[
                                        ['NCR 번호', <span key="no" className="font-mono font-semibold text-slate-700">{editDoc ? editDoc.ncr_no : nextNo}</span>],
                                        ['업체', form.supplier || '—'],
                                        ['품명', form.item_name || '—'],
                                        ['부적합수량 / 전체', `${form.qty_defect || '—'} / ${form.qty_unknown ? '파악중' : (form.qty_total || '—')}`],
                                        ['처리방안', form.tech_flag
                                            ? '기술 문의 필요 — 특채판단 단계에서 확정'
                                            : (form.disposition || '미지정') + (form.disposition === CONCESSION && form.concession_type ? ` · ${form.concession_type}` : '')],
                                        ['회람 대상 부서', form.tech_flag
                                            ? '응용기술팀 (단독 선행회람)'
                                            : (form.routing_depts.length
                                                ? form.routing_depts.map(x => x.dept + (x.staff_name ? `(${x.staff_name})` : '')).join(' · ')
                                                : '없음')]
                                    ].map(([k, v]) => (
                                        <div key={k} className="flex gap-3 px-3 py-2">
                                            <span className="w-28 shrink-0 text-xs font-semibold text-slate-500 pt-0.5">{k}</span>
                                            <span className="flex-1 text-slate-700 break-words">{v}</span>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-[11px] text-slate-500">
                                    승인요청하면 문서 상태가 <b>{ISSUE_STATUS}</b>가 되어 품질부서장 결재함으로 넘어갑니다. 첨부 {pairCount}쌍 · 도면 {drawings.length}건 · 관련자료 {refDocs.length}건이 함께 저장됩니다.
                                </p>
                                {msg && msg.t === 'err' && (
                                    <div className="text-sm px-3 py-2 rounded-lg bg-red-50 text-red-700 border border-red-200">{msg.s}</div>
                                )}
                                <div className="flex justify-end gap-2">
                                    <button onClick={() => setConfirmOn(false)} disabled={saving}
                                        className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-50">취소</button>
                                    <button onClick={() => submit(ISSUE_STATUS)} disabled={saving}
                                        className="px-4 py-2 text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
                                        {saving ? '전송 중…' : '승인요청'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NCRCreate;
