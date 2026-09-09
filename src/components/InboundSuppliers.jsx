/* ─────────────────────────────────────────────────────────────────────────────
   InboundSuppliers.jsx — 인수검사 「협력업체」   (플랜 042 / P14 r14)

   r9 → r14 (차장 승인 09-04) : **「측정 데이터 7/14~」 한 문구만 늘었다.**
   09-04 에 옛 인수검사 기록(1/2~7/13)이 대장에 들어왔지만 그 기록에는 치수 측정값이
   없다. 그래서 이 화면의 「협력업체 현황」 탭(대장 기준)은 1월부터, 「Cpk 랭킹보드」
   탭(측정값 기준)은 7/14 부터다 — 같은 기간 칩을 눌러도 두 탭이 보는 자료의 시작이
   다르다. 그 사실을 Cpk 탭 안내줄에 적는다. 계산·자료는 한 글자도 안 바뀌었다.

   r8 → r9 (차장 피드백 09-02)
     1. **화면 위에 세그먼트 바가 생겼다** — 「협력업체 현황」 | 「Cpk 랭킹보드」.
        대시보드가 쓰는 것과 **같은 조각**(components/inbound/ui.jsx 의 AreaBar)이다.
        고른 탭은 localStorage `inbound_sup_tab` 에 남는다.
          · 협력업체 현황 : KPI 4타일 + 업체 표(정렬)
          · Cpk 랭킹보드 : Ppk 랭킹보드 + 업체 상세(최근 입고 · 관리도 · 히스토그램)
        예전에는 이 넷이 한 페이지에 세로로 쌓여 있어 표를 보려고 스크롤을 한참 내렸다.
     2. **기간 필터가 붙었다** (A안, 「묶음」은 감춘다 — 이 화면엔 추이 차트가 없다).
        기간은 대시보드와 **같은 값**이다(localStorage `inbound_period`). 한 화면에서
        「최근 30일」을 누르면 다른 화면도 최근 30일이다.
     3. **기간이 Cpk 에도 걸린다.** 측정값기록서의 성적서번호(RI)를 대장의
        inspectionReportNo 로 이어 붙이면 측정값 한 줄마다 검사일이 생긴다
        (lib/inboundSpc.js 의 reportDateMap / rowsInRange). 기간을 좁히면 그 줄들로
        **buildD 를 다시 돌린다** — 전체로 낸 Ppk 를 잘라 쓰는 게 아니다. 표준편차는
        부분집합에서 다시 계산해야 맞는 값이 나온다.
        기간을 좁혔는데 날짜를 못 찾은 줄이 있으면 몇 줄인지 화면에 적는다.

   r3 → r4 : 화면 얼개는 그대로 두고 **표면만** 시안 언어로 바꿨다.
     · 카드 = 글래스-라이트 · 오로라 배경 · 등장 모션 · tabular-nums
     · 표: 카드 안의 sticky 머리 · 얼룩 · 상위 3행 메달 · 불량률 칸은 의미색(녹/황/적)
     · 등급 5색은 시안 팔레트(components/inbound/ui.jsx GRADE_UI)를 쓴다.

   ※ X̄/R 관리도·히스토그램은 r1 부터 손으로 그린 SVG 다. 색만 화면 테마에서 꺼내
     쓰도록 바꿨고 계산·형태는 건드리지 않았다.
   ※ 이 화면은 「대시보드」와 달리 한 장에 안 들어간다 — **페이지가** 구르는 게 맞다.
     카드 안에서 구르지 않게 하는 규칙(.ib-scroll)은 대시보드 전용이다.
   ───────────────────────────────────────────────────────────────────────────── */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import '../styles/inbound.css';
import { loadInboundSpc, GRADE_BOUND, PPK_DOMAIN, reportDateMap, rowsInRange } from '../lib/inboundSpc';
import { buildD } from '../lib/spcCore';
import {
    loadInspections, bySupplier, ymd, summarize, dataSpan, rangeFilter, fmtRate, fmtPpm,
    MEASURE_SINCE_NOTE,
} from '../lib/inboundStats';
import InboundPeriodFilter, { useSharedPeriod } from './InboundPeriodFilter';
import {
    ScreenFrame, ScreenHeader, Card, SectionTitle, KpiTile, GradeChip, GhostButton, AreaBar,
    Loading, ErrorCard, Empty, StatusBadge, fmt, pctText, gradeColor, useInboundTheme, useStickyString,
} from './inbound/ui';

const sgn = (v) => (v > 0 ? '+' : '') + v;
const MEDAL = ['#c8a227', '#94a3b8', '#a97142'];

/* ── 화면 탭 ─────────────────────────────────────────────────────────────────
   대시보드와 같은 조각(AreaBar)을 쓴다 — 같은 뜻의 조작부가 화면마다 다르게 생기면
   같은 제품으로 안 읽힌다. */
const SUP_TABS = [
    { key: 'status', label: '협력업체 현황' },
    { key: 'cpk', label: 'Cpk 랭킹보드' },
];
const SUP_TAB_KEYS = SUP_TABS.map((t) => t.key);
const SUP_TAB_KEY = 'inbound_sup_tab';

/* ── X̄ / R 관리도 ─────────────────────────────────────────────────────────── */
const SeriesChart = ({ pts, ucl, lcl, cl, clLabel, ymin, ymax, h }) => {
    const C = useInboundTheme();
    const W = 940, H = h || 230, ML = 44, MR = 84, MT = 14, MB = 30;
    const pw = W - ML - MR, ph = H - MT - MB;
    if (!pts || pts.length === 0) return <Empty t="그릴 값이 없다" />;

    const ys = pts.map((p) => p.y).concat([ucl, lcl, cl].filter((v) => v != null));
    const hi = Math.max(...ys), lo = Math.min(...ys), sp = (hi - lo) || 1;
    const yMax = ymax != null ? ymax : hi + sp * 0.15;
    const yMin = ymin != null ? ymin : lo - sp * 0.15;
    const Y = (v) => MT + (yMax - v) / (yMax - yMin) * ph;
    const X = (j) => ML + (j + 0.5) / pts.length * pw;

    const items = [];
    if (ucl != null) items.push({ v: ucl, txt: `UCL ${ucl}`, c: C.bad, d: '4 3' });
    if (cl != null) items.push({ v: cl, txt: `${clLabel} ${cl}`, c: C.ink3, d: '' });
    if (lcl != null) items.push({ v: lcl, txt: `LCL ${lcl}`, c: C.bad, d: '4 3' });
    const labels = items.map((it) => ({ ...it, ly: Y(it.v) + 3.5 })).sort((a, b) => a.ly - b.ly);
    for (let k = 1; k < labels.length; k++) if (labels[k].ly - labels[k - 1].ly < 13) labels[k].ly = labels[k - 1].ly + 13;

    const ticks = []; let last = '', lastX = -1e9;
    pts.forEach((p, j) => {
        if (!p.date || p.date === last) return;
        last = p.date;
        const x = X(j);
        if (x - lastX < 62) return;
        lastX = x; ticks.push({ x, t: p.date });
    });
    const r = pts.length > 60 ? 2.6 : pts.length > 25 ? 3.2 : 4;

    return (
        <div className="overflow-x-auto">
            <div className="min-w-[820px]">
                <svg viewBox={`0 0 ${W} ${H}`} role="img" className="block w-full h-auto">
                    {[yMax, (yMax + yMin) / 2, yMin].map((v, i) => (
                        <g key={i}>
                            <line x1={ML} y1={Y(v)} x2={W - MR} y2={Y(v)} stroke={C.grid} />
                            <text x={ML - 7} y={Y(v) + 3.5} textAnchor="end" fontSize="10" fill={C.ink4}>{v.toFixed(0)}</text>
                        </g>
                    ))}
                    {items.map((it, i) => (
                        <line key={i} x1={ML} y1={Y(it.v)} x2={W - MR} y2={Y(it.v)} stroke={it.c} strokeWidth="1.2"
                            strokeDasharray={it.d || undefined} />
                    ))}
                    {labels.map((it, i) => (
                        <text key={i} x={W - MR + 7} y={it.ly} fontSize="10.5" fill={it.c}>{it.txt}</text>
                    ))}
                    {ticks.map((t, i) => (
                        <g key={i}>
                            <line x1={t.x} y1={MT + ph} x2={t.x} y2={MT + ph + 4} stroke={C.grid} />
                            <text x={t.x} y={H - MB + 16} textAnchor="middle" fontSize="9.5" fill={C.ink4}>{t.t}</text>
                        </g>
                    ))}
                    {pts.length > 1 && (
                        <polyline fill="none" stroke={C.pri2} strokeWidth="1.6" strokeLinejoin="round"
                            points={pts.map((p, j) => `${X(j)},${Y(p.y)}`).join(' ')} />
                    )}
                    {pts.map((p, j) => {
                        const out = (ucl != null && p.y > ucl) || (lcl != null && p.y < lcl);
                        return (
                            <circle key={j} cx={X(j)} cy={Y(p.y)} r={r} fill={out ? C.bad2 : C.pri2} stroke={C.card} strokeWidth="1.1">
                                <title>{p.tip}</title>
                            </circle>
                        );
                    })}
                </svg>
            </div>
        </div>
    );
};

/* ── 공정능력 히스토그램 ──────────────────────────────────────────────────── */
const HistChart = ({ mt }) => {
    const C = useInboundTheme();
    const W = 560, H = 250, ML = 42, MR = 14, MT = 28, MB = 32;
    const pw = W - ML - MR, ph = H - MT - MB;
    const h = mt.hist, b0 = h.b0, w = h.w, bins = h.bins;
    const mx = Math.max(...bins) || 1;
    const span = w * bins.length;
    const X = (v) => ML + (v - b0) / span * pw;
    const Y = (c) => MT + (1 - c / mx) * ph;
    const xLabels = [];
    for (let v = Math.ceil(b0 / 100) * 100; v <= b0 + span; v += 100) xLabels.push(v);

    return (
        <div className="overflow-x-auto">
            <svg viewBox={`0 0 ${W} ${H}`} role="img" className="block w-full h-auto">
                <defs>
                    <linearGradient id="ibHist" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={C.pri2} stopOpacity="0.95" />
                        <stop offset="100%" stopColor={C.pri2} stopOpacity="0.25" />
                    </linearGradient>
                </defs>
                {[0, 0.5, 1].map((f, i) => {
                    const c = Math.round(mx * f);
                    return (
                        <g key={i}>
                            <line x1={ML} y1={Y(c)} x2={W - MR} y2={Y(c)} stroke={C.grid} />
                            <text x={ML - 6} y={Y(c) + 3.5} textAnchor="end" fontSize="9.5" fill={C.ink4}>{c}</text>
                        </g>
                    );
                })}
                {bins.map((c, k) => {
                    if (!c) return null;
                    const x0 = X(b0 + k * w), x1 = X(b0 + (k + 1) * w);
                    return (
                        <rect key={k} x={x0 + 1} y={Y(c)} width={Math.max(x1 - x0 - 2, 1)} height={MT + ph - Y(c)}
                            fill="url(#ibHist)" rx="2.5">
                            <title>{`${b0 + k * w}% ~ ${b0 + (k + 1) * w}% : ${c}개`}</title>
                        </rect>
                    );
                })}
                {[[-100, '규격 하한 −100'], [100, '규격 상한 +100']].map(([v, t]) => (
                    (v < b0 || v > b0 + span) ? null : (
                        <g key={t}>
                            <line x1={X(v)} y1={MT - 6} x2={X(v)} y2={MT + ph} stroke={C.bad2} strokeWidth="1.2" strokeDasharray="4 3" />
                            <text x={X(v)} y={MT - 10} textAnchor="middle" fontSize="9.5" fill={C.bad}>{t}</text>
                        </g>
                    )
                ))}
                {xLabels.map((v) => (
                    <text key={v} x={X(v)} y={H - MB + 16} textAnchor="middle" fontSize="9.5" fill={C.ink4}>{v}</text>
                ))}
                <text x={W - MR} y={H - 5} textAnchor="end" fontSize="9.5" fill={C.ink4}>공차 정규화 % (세로축 = 측정값 개수)</text>
            </svg>
        </div>
    );
};

/* ── 통계박스 ─────────────────────────────────────────────────────────────── */
const StatBox = ({ v }) => {
    const mt = v.mt, c = gradeColor(v.grade);
    const Sec = ({ t }) => (
        <div style={{
            fontSize: 'calc(var(--ib-lbl)*.85)', fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase',
            color: 'var(--ib-ink4)', marginTop: 12, paddingTop: 8, borderTop: '1px solid var(--ib-grid)',
        }}>{t}</div>
    );
    const DL = ({ rows }) => (
        <dl className="grid gap-x-3 gap-y-0.5" style={{ gridTemplateColumns: '1fr auto' }}>
            {rows.map(([k, val], i) => (
                <React.Fragment key={i}>
                    <dt style={{ color: 'var(--ib-ink3)' }}>{k}</dt>
                    <dd className="text-right tabular-nums" style={{ fontWeight: 700, color: 'var(--ib-ink)' }}>{val}</dd>
                </React.Fragment>
            ))}
        </dl>
    );
    return (
        <div className="rounded-xl" style={{
            border: '1px solid var(--ib-grid)', background: 'var(--ib-chip)', padding: '12px 16px', fontSize: 'var(--ib-lbl)',
        }}>
            <div style={{ fontSize: 'calc(var(--ib-lbl)*.85)', fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ib-ink4)' }}>공정 데이터</div>
            <DL rows={[['규격 하한 / 상한', '−100% / +100%'], ['표본 평균', `${sgn(mt.mu)}%`],
            ['표본 N', fmt(mt.N)], ['표준편차 (전체)', mt.so ?? '—'], ['표준편차 (군내)', mt.sw ?? '—']]} />
            <Sec t="전체 공정능력 · 평가 기준" />
            <DL rows={[['Pp', mt.pp ?? '—'],
            [<b key="p">Ppk</b>, <span key="v" style={{ color: c.bar }}>{mt.ppk ?? '—'}</span>]]} />
            <Sec t="잠재적(군내) 공정능력" />
            <DL rows={[['Cp', mt.cp ?? '—'], ['Cpk', mt.cpk ?? '—']]} />
            {mt.cp > 10 && (
                <div className="rounded-lg" style={{
                    marginTop: 6, padding: '6px 10px', lineHeight: 1.5,
                    fontSize: 'calc(var(--ib-lbl)*.92)', color: gradeColor('3등급').text, background: gradeColor('3등급').bg,
                }}>
                    측정 해상도(1mm) 한계로 군내 산포가 과소평가 — 참고용, 등급 판정에는 미사용
                </div>
            )}
            <Sec t="성능" />
            <DL rows={[['PPM 관측(규격외)', fmt(mt.ppm_obs)], ['규격외 건수', `${v.oos}건`]]} />
        </div>
    );
};

/* ── 표 열 정의 ───────────────────────────────────────────────────────────── */
const COLS = [
    { key: 'name', label: '업체명', align: 'left', num: false },
    { key: 'count', label: '입고 건수', align: 'right', num: true },
    { key: 'inQty', label: '입고 수량', align: 'right', num: true },
    { key: 'ngCount', label: '부적합 건수', align: 'right', num: true },
    { key: 'defectRate', label: '불량률 (% · PPM)', align: 'right', num: true },
    { key: 'n', label: '측정 n', align: 'right', num: true },
    { key: 'idx', label: 'Ppk', align: 'right', num: true },
    { key: 'gradeRank', label: '등급', align: 'right', num: true },
];

/* ── 본체 ─────────────────────────────────────────────────────────────────── */
const InboundSuppliers = () => {
    const [st, setSt] = useState({ loading: true, err: null, rows: [], insp: [] });

    const load = async (force) => {
        setSt((s) => ({ ...s, loading: true, err: null }));
        try {
            const [{ rows }, insp] = await Promise.all([loadInboundSpc({ force }), loadInspections({ force })]);
            setSt({ loading: false, err: null, rows, insp });
        } catch (e) {
            console.error('[InboundSuppliers]', e);
            setSt({ loading: false, err: e.message || String(e), rows: [], insp: [] });
        }
    };
    useEffect(() => { load(false); }, []);

    if (st.loading) return <ScreenFrame><Loading t="인수검사 자료를 불러오는 중…" /></ScreenFrame>;
    if (st.err) return <ScreenFrame><ErrorCard msg={st.err} onRetry={() => load(true)} /></ScreenFrame>;
    return <ScreenFrame><Body st={st} reload={() => load(true)} /></ScreenFrame>;
};

const Body = ({ st, reload }) => {
    const C = useInboundTheme();
    const [tab, setTab] = useStickyString(SUP_TAB_KEY, 'status', SUP_TAB_KEYS);
    const [sel, setSel] = useState(null);
    const [sort, setSort] = useState({ key: 'defectRate', dir: 'desc' });
    const [boardOpen, setBoardOpen] = useState(true);
    const detailRef = useRef(null);

    /* ── 기간 (대시보드와 같은 값 — localStorage `inbound_period`) ── */
    const span = useMemo(() => dataSpan(st.insp), [st.insp]);
    const [flt, setFlt] = useSharedPeriod(span);
    const F = useMemo(() => rangeFilter(st.insp, flt.range), [st.insp, flt.range]);

    /* ── 기간 안의 측정값으로 SPC 를 **다시** 돌린다 ──────────────────────────
       RI → 검사일 이음은 대장 **전체**로 만든다(기간 밖 성적서도 날짜는 알아야 한다).
       거르는 것만 기간이 한다. */
    const dmap = useMemo(() => reportDateMap(st.insp), [st.insp]);
    const M = useMemo(() => rowsInRange(st.rows, dmap, flt.range), [st.rows, dmap, flt.range]);
    const D = useMemo(() => {
        if (!M.rows.length) return { overall: null, vendors: [] };
        try {
            return buildD(M.rows);
        } catch (e) {
            console.error('[InboundSuppliers/buildD]', e);
            return { overall: null, vendors: [] };
        }
    }, [M.rows]);

    /* 대장 통계 ⨝ SPC — 업체명이 키다. 한쪽에만 있는 업체도 빠뜨리지 않는다. */
    const rows = useMemo(() => {
        const spc = new Map(D.vendors.map((v) => [v.vendor, v]));
        const led = new Map(bySupplier(F).map((o) => [o.name, o]));
        const names = Array.from(new Set([...led.keys(), ...spc.keys()]));
        return names.map((name) => {
            const L = led.get(name), V = spc.get(name);
            return {
                name,
                count: L ? L.count : 0,
                inQty: L ? L.inQty : 0,
                inspQty: L ? L.inspQty : 0,
                ngCount: L ? L.ngCount : 0,
                ngQty: L ? L.ngQty : 0,
                defectRate: L ? L.defectRate : null,
                n: V ? V.n : null,
                idx: V ? V.idx : null,
                grade: V ? V.grade : null,
                gradeRank: V ? V.idx : null,
                v: V || null,
                inLedger: !!L,
            };
        });
    }, [D, F]);

    const sorted = useMemo(() => {
        const { key, dir } = sort;
        const col = COLS.find((c) => c.key === key) || COLS[4];
        const s = rows.slice();
        s.sort((a, b) => {
            const x = a[key], y = b[key];
            if (!col.num) {
                const r = String(x).localeCompare(String(y), 'ko');
                return dir === 'asc' ? r : -r;
            }
            /* 값이 없는 칸(측정 없음 · 입고 0)은 방향과 무관하게 항상 아래로 */
            const nx = x === null || x === undefined, ny = y === null || y === undefined;
            if (nx && ny) return 0;
            if (nx) return 1;
            if (ny) return -1;
            return dir === 'asc' ? x - y : y - x;
        });
        return s;
    }, [rows, sort]);

    /* 고른 업체가 기간 밖으로 사라지면 첫 줄로 되돌린다(빈 상세를 남기지 않는다) */
    useEffect(() => {
        if (!sorted.length) return;
        if (!sel || !sorted.some((x) => x.name === sel)) setSel(sorted[0].name);
    }, [sorted, sel]);

    const board = useMemo(() => D.vendors.slice().sort((a, b) => b.idx - a.idx), [D]);
    const ALL = useMemo(() => summarize(F), [F]);
    /* 요주의 = 등급 4등급 이거나 불량률 1% 이상인 업체 */
    const watch = rows.filter((r) => r.grade === '4등급' || (r.defectRate !== null && r.defectRate >= 1)).length;

    const R = sorted.find((x) => x.name === sel) || sorted[0];
    const v = R ? R.v : null;

    const pick = (name) => {
        setSel(name);
        if (detailRef.current) detailRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    const toggleSort = (key) => {
        setSort((s) => (s.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' }));
    };
    const rateTone = (r) => (r === null || r === undefined ? C.ink4 : r >= 1 ? C.bad : r >= 0.3 ? C.warn : C.ok);

    /* 선택 업체의 최근 입고 10건 — 기간 안에서 본다(표의 숫자와 같은 자료여야 한다) */
    const recent = F
        .filter((r) => String(r.supplier || '').trim() === (R ? R.name : ''))
        .map((r) => ({ ...r, _d: ymd(r.date) }))
        .sort((a, b) => (a._d < b._d ? 1 : a._d > b._d ? -1 : 0))
        .slice(0, 10);

    const th = (c) => (
        <th key={c.key} onClick={() => toggleSort(c.key)}
            className={`cursor-pointer select-none ${c.align === 'right' ? 'text-right' : 'text-left'}`}
            style={{ padding: '10px 12px', fontSize: 'var(--ib-lbl)' }}>
            {c.label}
            <span style={{ marginLeft: 4, fontSize: 10, color: C.pri2 }}>{sort.key === c.key ? (sort.dir === 'desc' ? '▼' : '▲') : ''}</span>
        </th>
    );

    const isCpk = tab === 'cpk';
    const periodText = `${flt.range.start || '—'} ~ ${flt.range.end || '—'}`;

    return (
        <>
            <ScreenHeader
                eyebrow="신우밸브 · 품질경영시스템"
                title="인수검사 — 협력업체"
                meta={<>
                    <span>불량률 = 부적합 수량 ÷ 입고 수량</span>
                    <span>Ppk = 측정값 전체 공정능력 · 등급 = 회사 공식 Cpk 5등급</span>
                    <span className="tabular-nums">기간 {periodText}</span>
                    <span>기간은 대시보드와 함께 쓴다</span>
                </>}
                right={<GhostButton onClick={reload}><RefreshCw className="w-3.5 h-3.5" />새로고침</GhostButton>}
            />

            <AreaBar items={SUP_TABS} value={tab} onPick={setTab} idPrefix="ibsup" ariaLabel="협력업체 화면"
                right={<span style={{ fontSize: 'calc(var(--ib-lbl)*.95)', color: 'var(--ib-ink4)' }}>
                    {/* P14 r14 : 측정값은 7/14 부터다(옛 기록 1/2~7/13 에는 치수 측정값이 없다).
                        대장 통계는 1월부터이므로 이 탭의 기간과 다르다는 것을 여기서 밝힌다. */}
                    {isCpk ? `측정값기록서 기준 · ${MEASURE_SINCE_NOTE} · 기간 안의 측정값으로 다시 계산한다` : '인수검사 기록 기준'}
                </span>} />

            {/* 기간 필터 — 「묶음」은 감춘다(이 화면엔 추이 차트가 없다) */}
            <InboundPeriodFilter
                range={flt.range} quick={flt.quick} group={flt.group} manualGroup={flt.manualGroup}
                span={span} onChange={setFlt} showGroup={false}
            />

            <div role="tabpanel" id={`ibsup-panel-${tab}`} aria-labelledby={`ibsup-tab-${tab}`}>
                {!isCpk ? (
                    <>
                        {/* KPI 4타일 */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" style={{ marginBottom: 16 }}>
                            <KpiTile delay={0.08} label="협력업체 수" value={rows.length} unit="곳"
                                footnote={`측정값 연결 ${fmt(D.vendors.length)}곳 · 이 기간 기준`} />
                            <KpiTile delay={0.11} label="입고 건수" value={ALL.count} unit="건"
                                footnote={`입고 수량 ${fmt(ALL.inQty)} EA`} />
                            <KpiTile delay={0.14} label="평균 불량률" value={ALL.defectRate} unit="%" dec={2} tone={C.bad}
                                footnote={`${fmtRate(ALL.ngQty, ALL.inQty)} · 부적합 ${fmt(ALL.ngQty)} EA ÷ 입고 ${fmt(ALL.inQty)} EA`} />
                            <KpiTile delay={0.17} label="요주의 업체" value={watch} unit="곳" tone={C.warn}
                                footnote="4등급 이거나 불량률 1% 이상" />
                        </div>

                        {/* 업체 표 */}
                        <Card delay={0.20} style={{ padding: 0 }}>
                            <div style={{ padding: 'var(--ib-pad) var(--ib-pad) 12px' }}>
                                <SectionTitle title="협력업체 현황"
                                    subtitle="열 머리를 누르면 정렬 · 행을 누르면 그 업체가 선택된다"
                                    right={R ? (
                                        <span className="inline-flex items-center gap-2 flex-none">
                                            <StatusBadge tone="mute">선택 {R.name}</StatusBadge>
                                            <GhostButton onClick={() => setTab('cpk')}>Cpk 상세 →</GhostButton>
                                        </span>
                                    ) : null} />
                            </div>
                            {sorted.length === 0 ? <Empty t={`이 기간(${periodText})에 입고 자료가 없다`} /> : (
                                <>
                                    <div className="overflow-x-auto">
                                        <table className="ib-table" style={{ minWidth: 880, fontSize: 'var(--ib-body)' }}>
                                            <thead><tr>{COLS.map(th)}</tr></thead>
                                            <tbody>
                                                {sorted.map((x, i) => {
                                                    const on = x.name === sel;
                                                    return (
                                                        <tr key={x.name} onClick={() => setSel(x.name)} className="cursor-pointer"
                                                            style={on ? { background: 'rgba(14,165,233,.10)', boxShadow: `inset 3px 0 0 ${C.pri2}` } : undefined}>
                                                            <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--ib-ink)', maxWidth: 300 }}>
                                                                <span className="inline-flex items-center gap-2">
                                                                    {i < 3 && (
                                                                        <span className="inline-flex items-center justify-center rounded-full flex-none"
                                                                            style={{ width: 20, height: 20, background: MEDAL[i], color: '#fff', fontSize: 10.5, fontWeight: 800 }}>{i + 1}</span>
                                                                    )}
                                                                    <span className="truncate" title={x.name}>{x.name}</span>
                                                                </span>
                                                                {!x.inLedger && <span style={{ marginLeft: 6, fontSize: 'calc(var(--ib-lbl)*.9)', fontWeight: 400, color: 'var(--ib-ink4)' }}>(대장 없음)</span>}
                                                            </td>
                                                            <td className="text-right tabular-nums" style={{ padding: '8px 12px', color: 'var(--ib-ink2)' }}>{fmt(x.count)}</td>
                                                            <td className="text-right tabular-nums" style={{ padding: '8px 12px', color: 'var(--ib-ink2)' }}>{fmt(x.inQty)}</td>
                                                            <td className="text-right tabular-nums" style={{ padding: '8px 12px', color: x.ngCount ? C.bad : 'var(--ib-ink2)', fontWeight: x.ngCount ? 700 : 400 }}>{fmt(x.ngCount)}</td>
                                                            <td className="text-right tabular-nums" style={{ padding: '8px 12px', color: rateTone(x.defectRate), fontWeight: 700, lineHeight: 1.25 }}>{pctText(x.defectRate)}
                                                                <small style={{ display: 'block', fontSize: '.82em', fontWeight: 700, opacity: .85 }}>{fmtPpm(x.ngQty, x.inQty)}</small></td>
                                                            <td className="text-right tabular-nums" style={{ padding: '8px 12px', color: 'var(--ib-ink3)' }}>
                                                                {x.n === null ? '—' : x.n}
                                                                {x.n !== null && x.n < 30 && <span style={{ marginLeft: 4, fontSize: 10, color: C.warn }}>적음</span>}
                                                            </td>
                                                            <td className="text-right tabular-nums" style={{ padding: '8px 12px', fontWeight: 800, color: x.grade ? gradeColor(x.grade).bar : 'var(--ib-ink4)' }}>
                                                                {x.idx === null ? '—' : x.idx.toFixed(2)}
                                                            </td>
                                                            <td className="text-right" style={{ padding: '8px 12px' }}><GradeChip g={x.grade} /></td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div style={{ padding: '12px var(--ib-pad)', borderTop: '1px solid var(--ib-grid)', fontSize: 'calc(var(--ib-lbl)*.95)', color: 'var(--ib-ink4)', lineHeight: 1.5 }}>
                                        측정 n = 측정값기록서에 실린 개별 측정치 개수. n&lt;30 은 Ppk 변동이 크다.
                                        &lsquo;(대장 없음)&rsquo; 은 측정값에만 있고 입고 대장에 성적서번호가 연결되지 않은 업체다.
                                        메달은 지금 정렬 기준의 상위 3행이다. 표 전체가 위 기간({periodText}) 안의 값이다.
                                    </div>
                                </>
                            )}
                        </Card>
                    </>
                ) : (
                    <>
                        {/* Ppk 랭킹보드 */}
                        <Card delay={0.08} style={{ marginBottom: 16 }}>
                            <button type="button" onClick={() => setBoardOpen((o) => !o)} className="w-full flex items-center justify-between text-left">
                                <SectionTitle title="Ppk 랭킹보드"
                                    subtitle={`등급 5색 · 경계선 · n<30 반투명 · 측정값 ${fmt(M.rows.length)}로트`} />
                                <span className="inline-flex items-center gap-1 flex-none" style={{ fontSize: 'var(--ib-lbl)', fontWeight: 700, color: 'var(--ib-ink3)' }}>
                                    {boardOpen ? '접기' : '펼치기'}
                                    {boardOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </span>
                            </button>

                            {/* 기간을 좁혀 빠진 줄이 있으면 몇 줄인지 적는다 — 조용히 버리지 않는다 */}
                            {M.undated > 0 && (
                                <div style={{ marginTop: 10, fontSize: 'calc(var(--ib-lbl)*.95)', color: 'var(--ib-ink3)' }}>
                                    성적서번호로 검사일을 찾지 못한 측정 로트 <b className="tabular-nums" style={{ color: 'var(--ib-ink)' }}>{fmt(M.undated)}</b>개는
                                    기간을 지정하면 빠진다. (자료 구간 {M.span.min || '—'} ~ {M.span.max || '—'})
                                </div>
                            )}

                            {boardOpen && (board.length === 0 ? (
                                <Empty t={`이 기간(${periodText})에 계산할 측정값이 없다`} />
                            ) : (
                                <div style={{ marginTop: 16 }}>
                                    <div className="relative" style={{ paddingTop: 24 }}>
                                        <div className="absolute pointer-events-none" style={{ top: 0, bottom: 6, left: 196, right: 150 }}>
                                            <b className="absolute" style={{ top: 16, bottom: 0, width: 0, left: 0, borderLeft: `1px solid ${C.grid}` }} />
                                            <s className="absolute no-underline whitespace-nowrap -translate-x-1/2" style={{ top: 0, left: 0, fontSize: 9.5, color: C.ink4 }}>0</s>
                                            {GRADE_BOUND.map((b) => {
                                                const L = `${(b / PPK_DOMAIN * 100).toFixed(2)}%`;
                                                return (
                                                    <React.Fragment key={b}>
                                                        <b className="absolute" style={{ top: 16, bottom: 0, width: 0, left: L, borderLeft: `1px dashed ${C.grid}` }} />
                                                        <s className="absolute no-underline whitespace-nowrap -translate-x-1/2" style={{ top: 0, left: L, fontSize: 9.5, color: C.ink4 }}>{b.toFixed(2)}</s>
                                                    </React.Fragment>
                                                );
                                            })}
                                        </div>

                                        {board.map((x) => {
                                            const small = x.n < 30;
                                            const w = Math.max(x.idx / PPK_DOMAIN * 100, 0.4);
                                            const oospct = x.n ? (x.oos / x.n * 100) : 0;
                                            const on = x.vendor === sel;
                                            return (
                                                <div key={x.vendor} onClick={() => pick(x.vendor)} role="button" tabIndex={0}
                                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(x.vendor); } }}
                                                    title={`${x.vendor} · Ppk ${x.idx.toFixed(2)} (${x.grade}) · n=${x.n} · 로트 ${x.lots.length}건 · 평균 ${sgn(x.mean)}% · σ ${x.sigma} · 규격외 ${x.oos}건 (${oospct.toFixed(1)}%)${small ? ' · 표본 적음 (n<30)' : ''}`}
                                                    className="flex items-center gap-4 rounded cursor-pointer"
                                                    style={{ padding: '2px 0', background: on ? 'rgba(14,165,233,.10)' : undefined, boxShadow: on ? `inset 3px 0 0 ${C.pri2}` : undefined }}>
                                                    <div className="flex-none text-right truncate" style={{ width: 196, fontSize: 'var(--ib-lbl)', fontWeight: 700, color: 'var(--ib-ink)' }}>
                                                        {x.vendor}<em className="not-italic" style={{ fontWeight: 400, color: 'var(--ib-ink4)', marginLeft: 6 }}>{x.n}</em>
                                                    </div>
                                                    <div className="flex-1 min-w-0 relative flex items-center" style={{ height: 20 }}>
                                                        <div style={{ width: `${w.toFixed(2)}%`, height: 13, borderRadius: 3, background: gradeColor(x.grade).bar, opacity: small ? 0.45 : 1 }} />
                                                        <div className="absolute tabular-nums" style={{ left: `${w.toFixed(2)}%`, transform: 'translateX(7px)', fontSize: 'var(--ib-lbl)', fontWeight: 800, color: 'var(--ib-ink)' }}>
                                                            {x.idx.toFixed(2)}
                                                            {small && <span className="absolute left-full whitespace-nowrap" style={{ transform: 'translateX(4px)', fontSize: 9.5, fontWeight: 400, color: C.ink4 }}>표본 적음</span>}
                                                        </div>
                                                    </div>
                                                    <div className="flex-none flex items-center justify-end gap-2" style={{ width: 150 }}>
                                                        <span className="tabular-nums text-right" style={{ minWidth: 38, fontSize: 'var(--ib-lbl)', color: oospct >= 5 ? C.bad : C.ink4, fontWeight: oospct >= 5 ? 700 : 400 }}>
                                                            {x.oos ? `${oospct.toFixed(1)}%` : '—'}
                                                        </span>
                                                        <GradeChip g={x.grade} />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="flex flex-wrap gap-4" style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--ib-grid)', fontSize: 'calc(var(--ib-lbl)*.95)', color: 'var(--ib-ink4)' }}>
                                        <span>회사 공식 Cpk 기준선 — 특급 1.67 · 1등급 1.33 · 2등급 1.00 · 3등급 0.67</span>
                                        <span>반투명 막대 = n&lt;30 (표본 적음)</span>
                                        <span className="tabular-nums">기간 {periodText} 안의 측정값으로 다시 계산한 값이다</span>
                                    </div>
                                </div>
                            ))}
                        </Card>

                        {/* 업체 상세 */}
                        <div ref={detailRef}>
                            <Card delay={0.12}>
                                {!R ? <Empty t="업체를 고르면 상세가 나온다" /> : (
                                    <>
                                        <SectionTitle title={`업체 상세 — ${R.name}`} subtitle="대장 요약 · 최근 입고 · 관리도/공정능력" />

                                        <div className="flex flex-wrap items-center gap-3" style={{ margin: '14px 0', paddingBottom: 14, borderBottom: '1px solid var(--ib-grid)' }}>
                                            <select value={R.name} onChange={(e) => setSel(e.target.value)} aria-label="업체 선택"
                                                className="rounded-lg cursor-pointer max-w-full"
                                                style={{ padding: '8px 12px', fontSize: 'var(--ib-body)', fontWeight: 700, color: 'var(--ib-ink)', background: 'var(--ib-card)', border: '1px solid var(--ib-cardline)' }}>
                                                {sorted.map((x) => (
                                                    <option key={x.name} value={x.name}>
                                                        {x.name}{x.idx !== null ? ` — Ppk ${x.idx.toFixed(2)} (${x.grade}, n=${x.n})` : ' — 측정값 없음'}
                                                    </option>
                                                ))}
                                            </select>
                                            {R.grade && <GradeChip g={R.grade} />}
                                        </div>

                                        {/* 대장 요약 */}
                                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3" style={{ marginBottom: 20 }}>
                                            {[
                                                ['입고 건수', `${fmt(R.count)}건`, null],
                                                ['입고 수량', `${fmt(R.inQty)} EA`, null],
                                                ['검사 수량', `${fmt(R.inspQty)} EA`, null],
                                                ['부적합', `${fmt(R.ngCount)}건 / ${fmt(R.ngQty)} EA`, R.ngCount ? C.bad : null],
                                                ['불량률', fmtRate(R.ngQty, R.inQty), rateTone(R.defectRate)],
                                            ].map(([k, val, tone]) => (
                                                <div key={k} className="rounded-xl" style={{ border: '1px solid var(--ib-grid)', background: 'var(--ib-chip)', padding: '10px 12px' }}>
                                                    <div style={{ fontSize: 'calc(var(--ib-lbl)*.92)', fontWeight: 700, color: 'var(--ib-ink4)' }}>{k}</div>
                                                    <div className="tabular-nums" style={{ marginTop: 2, fontSize: 'var(--ib-num)', fontWeight: 800, color: tone || 'var(--ib-ink)' }}>{val}</div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* 최근 입고 10건 */}
                                        <div style={{ fontSize: 'var(--ib-lbl)', fontWeight: 700, color: 'var(--ib-ink3)', marginBottom: 6 }}>최근 입고 10건</div>
                                        <div className="overflow-x-auto" style={{ marginBottom: 22 }}>
                                            <table className="ib-table" style={{ minWidth: 780, fontSize: 'var(--ib-lbl)' }}>
                                                <thead>
                                                    <tr>
                                                        {['검사일', '품번', '품명', '유형', '입고', '검사', '부적합', '판정', '성적서'].map((h, i) => (
                                                            <th key={h} className={i >= 4 && i <= 6 ? 'text-right' : 'text-left'} style={{ padding: '8px 12px' }}>{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {recent.length === 0 ? (
                                                        <tr><td colSpan={9} style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--ib-ink4)' }}>이 기간에 입고 기록이 없다</td></tr>
                                                    ) : recent.map((r, i) => (
                                                        <tr key={`${r.id || i}`}>
                                                            <td className="tabular-nums whitespace-nowrap" style={{ padding: '7px 12px', color: 'var(--ib-ink3)' }}>{r._d || '—'}</td>
                                                            <td className="tabular-nums whitespace-nowrap" style={{ padding: '7px 12px', color: 'var(--ib-ink3)' }}>{r.item_code || '—'}</td>
                                                            <td className="truncate" style={{ padding: '7px 12px', color: 'var(--ib-ink)', maxWidth: 260 }} title={r.itemName}>{r.itemName || '—'}</td>
                                                            <td className="whitespace-nowrap" style={{ padding: '7px 12px', color: 'var(--ib-ink3)' }}>{r.itemType || '—'}</td>
                                                            <td className="text-right tabular-nums" style={{ padding: '7px 12px', color: 'var(--ib-ink2)' }}>{fmt(Number(r.totalQuantity) || 0)}</td>
                                                            <td className="text-right tabular-nums" style={{ padding: '7px 12px', color: 'var(--ib-ink2)' }}>{fmt(Number(r.inspectionQuantity) || 0)}</td>
                                                            <td className="text-right tabular-nums" style={{ padding: '7px 12px', color: Number(r.defectQuantity) ? C.bad : 'var(--ib-ink2)' }}>{fmt(Number(r.defectQuantity) || 0)}</td>
                                                            <td className="whitespace-nowrap" style={{ padding: '7px 12px' }}>
                                                                <span className="rounded-full" style={{
                                                                    padding: '3px 9px', fontSize: 'calc(var(--ib-lbl)*.92)', fontWeight: 800,
                                                                    background: r.result === '불합격' ? 'rgba(244,63,94,.13)' : 'rgba(14,165,233,.13)',
                                                                    color: r.result === '불합격' ? C.bad : C.pri,
                                                                }}>{r.result || '—'}</span>
                                                            </td>
                                                            <td className="tabular-nums whitespace-nowrap" style={{ padding: '7px 12px', color: 'var(--ib-ink4)' }}>{r.inspectionReportNo || '없음'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* 관리도 · 공정능력 */}
                                        {!v ? (
                                            <div className="rounded-xl" style={{ border: '1px solid var(--ib-grid)', background: 'var(--ib-chip)', padding: '20px 16px', fontSize: 'var(--ib-lbl)', color: 'var(--ib-ink3)' }}>
                                                이 기간에는 이 업체의 수치 측정값이 없다 — 관리도·공정능력은 산출하지 않는다.
                                                기간을 「전체」로 넓히면 값이 나올 수 있다.
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex flex-wrap items-center gap-2" style={{ fontSize: 'var(--ib-lbl)', color: 'var(--ib-ink3)', marginBottom: 12 }}>
                                                    <span>판정지수 Ppk</span>
                                                    <b className="tabular-nums" style={{ fontSize: 'var(--ib-num)', color: gradeColor(v.grade).bar }}>{v.idx.toFixed(2)}</b>
                                                    <span>· 측정 n {v.n} · 로트 {v.lots.length}건{v.n < 30 && <span style={{ color: C.warn }}> · 표본 적음</span>}</span>
                                                    <span style={{ color: 'var(--ib-ink4)' }}>· 값 = 공차 정규화 % (상한 +100 / 기준 0 / 하한 −100)</span>
                                                </div>

                                                <div style={{ fontSize: 'var(--ib-lbl)', fontWeight: 700, color: 'var(--ib-ink3)', marginBottom: 4 }}>
                                                    X̄ 관리도<em className="not-italic" style={{ fontWeight: 400, color: 'var(--ib-ink4)', marginLeft: 6 }}>로트 평균 (%)</em>
                                                </div>
                                                <SeriesChart h={230} cl={v.mt.xbb} clLabel="X̿" ucl={v.mt.x_ucl} lcl={v.mt.x_lcl}
                                                    pts={v.lots.map((l) => ({
                                                        y: l.mean, date: l.date,
                                                        tip: `${l.ri} (${l.date})\n${l.part} · ${l.point}\n${l.name}\n규격 ${l.spec} · 평균 ${sgn(l.mean)}%${l.oos ? ` · 규격외 ${l.oos}개` : ''}`,
                                                    }))} />

                                                <div style={{ fontSize: 'var(--ib-lbl)', fontWeight: 700, color: 'var(--ib-ink3)', margin: '16px 0 4px' }}>
                                                    R 관리도<em className="not-italic" style={{ fontWeight: 400, color: 'var(--ib-ink4)', marginLeft: 6 }}>로트 내 범위</em>
                                                </div>
                                                {v.rseq && v.rseq.length >= 2
                                                    ? <SeriesChart h={180} cl={v.mt.rbar} clLabel="R̄" ucl={v.mt.r_ucl} lcl={0} ymin={0}
                                                        pts={v.rseq.map((r) => ({ y: r.r, tip: `${r.ri}\nR = ${r.r}% (n=${r.n})` }))} />
                                                    : <Empty t="서브그룹(n≥2) 부족 — R 관리도 미산출" />}

                                                <div className="grid gap-6 items-start" style={{ marginTop: 24, gridTemplateColumns: 'minmax(0,1.7fr) minmax(240px,1fr)' }}>
                                                    <div>
                                                        <div style={{ fontSize: 'var(--ib-lbl)', fontWeight: 700, color: 'var(--ib-ink3)', marginBottom: 4 }}>
                                                            공정능력 히스토그램<em className="not-italic" style={{ fontWeight: 400, color: 'var(--ib-ink4)', marginLeft: 6 }}>규격 ±100%</em>
                                                        </div>
                                                        <HistChart mt={v.mt} />
                                                    </div>
                                                    <StatBox v={v} />
                                                </div>

                                                <div className="rounded-r-lg" style={{
                                                    marginTop: 16, padding: '10px 14px', lineHeight: 1.6, fontSize: 'var(--ib-lbl)', color: 'var(--ib-ink2)',
                                                    background: 'var(--ib-chip)', borderLeft: `3px solid ${gradeColor(v.grade).bar}`,
                                                }}>
                                                    <b style={{ color: 'var(--ib-ink)' }}>회사 기준 조처 ({v.grade})</b> — {v.action}
                                                </div>
                                            </>
                                        )}
                                    </>
                                )}
                            </Card>
                        </div>
                    </>
                )}
            </div>
        </>
    );
};

export default InboundSuppliers;
