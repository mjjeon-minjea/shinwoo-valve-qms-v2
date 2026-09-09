/* ─────────────────────────────────────────────────────────────────────────────
   InboundItems.jsx — 인수검사 「품목·부적합 관리」   (플랜 042 / P15 r15)

   r9 → r15 (차장 확정 09-09) — 바뀐 것 셋이다.

     1. **탭이 2개 → 5개**가 됐다. 예전엔 탭 하나에 카드가 넷씩 세로로 쌓여 있어
        「불합격 목록」을 보려면 화면을 세 번 굴려야 했다. 이제 **탭 하나가 한 화면**이다.

          품목 관리    KPI 4 · 품목유형별 현황 · 모델명 Top 10
          품목 검색    품목 검색 표          (품번·모델명·사이즈·품명·Ppk)
          측정치 검색  규격 밖 측정치 표     (예전 이름 「규격외 측정치」)
          부적합 관리  KPI 4 · 부적합 유형 Top 10 · 업체별 부적합 Top 10
          부적합 검색  불합격 목록 전체      (예전 이름 그대로의 표)

        고른 탭은 예전 열쇠 그대로 localStorage `inbound_item_tab` 에 남는다.
        예전 값('items' · 'nc')은 둘 다 새 탭에도 있으므로 그대로 살아난다.
        `initialTab="ncr"` 도 그대로다 — 구 `#inbound_status` 링크는 **「부적합 관리」**
        탭으로 간다(Dashboard.jsx 는 한 글자도 안 고쳤다).

     2. **「품번 Top 10」 → 「모델명 Top 10」.** 품번(55910308004)은 사람이 외우는
        이름이 아니다. 현업이 「많이 들어오는 것」을 셀 때 세는 단위는 모델명(TOV-12A)
        이고, 한 모델이 사이즈별로 품번 여러 개를 갖는다. 품번으로 세면 같은 모델이
        열 줄로 흩어져 Top 10 이 실제 물량 순서와 어긋난다.
        집계는 lib/inboundStats.js 의 byModel — 품명 첫 토큰(parseItem().model)이 키다.
        오른쪽 불량률(% · PPM)은 그대로고, 아래 회색 보조줄은
        「모델명 — 품번 N종 · 대표 품명」이다. r16 부터 그 대표 품명이 모델명으로
        시작하면 앞부분(같은 모델명)을 **표시할 때만** 지운다 — 한 줄에 같은 글자가
        두 번 나오지 않게 한다. 집계·건수는 그대로다(stripModelHead 참고).
        **품번 자체는 「품목 검색」 표에서만 보여 준다.**

     3. **쪽넘김이 한 쪽 10줄**이 됐고 조각을 ui.jsx 로 올렸다(Pager · usePaged).
        표 넷(품목 검색 · 측정치 검색 · 부적합 검색 · 협력업체 현황)이 **같은 것**을
        쓴다. 「N건 중 1–10」 + 「‹ 1 2 3 … ›」. 검색·정렬과 함께 돌고, 쪽 번호는
        저장하지 않는다(다시 열면 늘 1쪽이다).

   r9 에서 그대로인 것
     · 기간은 대시보드·협력업체와 **같은 값**이다(localStorage `inbound_period`).
       「묶음」은 감춘다 — 이 화면엔 추이 차트가 없어 눌러도 아무 일이 안 일어난다.
     · 모델명·사이즈는 품명 한 줄에서 뽑는다(parseItem). 원래 품명은 옆 칸과
       title 툴팁에 그대로 있다.
     · 숫자 정의는 전부 lib/inboundStats.js 다. 여기서 다시 세지 않는다.

   ※ 이 화면은 **보기 전용**이다. 자료를 고치는 칸은 하나도 없다.
   ※ 대장(inspections)과 측정값(inspection_measurements)은 출처가 다르다. 그래서
     "부적합 건수"와 "규격 밖 측정치 수"는 서로 맞지 않는다. 맞을 이유도 없다.
   ───────────────────────────────────────────────────────────────────────────── */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import '../styles/inbound.css';
import {
    loadInspections, byItemType, byItemCode, byModel, topDefectTypes, bySupplier, summarize,
    dataSpan, rangeFilter, recentFails, fmtRate, fmtPpm, ppm, PPM_TARGET,
} from '../lib/inboundStats';
import { loadInboundSpc, partGrades, reportDateMap, rowsInRange } from '../lib/inboundSpc';
import { normPct, pyRound } from '../lib/spcCore';
import InboundPeriodFilter, { useSharedPeriod } from './InboundPeriodFilter';
import {
    ScreenFrame, ScreenHeader, Card, SectionTitle, KpiTile, RankBar, StackStrip, LegendRow,
    GhostButton, AreaBar, GradeChip, Loading, ErrorCard, Empty, Pager, usePaged,
    fmt, fx, pctText, gradeColor, useInboundTheme, useStickyString,
} from './inbound/ui';

const TOP_N = 10;

/* ── 보조줄용 대표 품명 다듬기 (P15 r16) ─────────────────────────────────────
   「모델명 Top 10」 보조줄은 「모델명 — 품번 N종 · 대표 품명」인데, 대표 품명은
   거의 언제나 그 모델명으로 시작한다(NEXUS → 'NEXUS GUIDE FORGED BRASS 15A').
   줄 앞머리에 이미 모델명이 적혀 있으니 같은 글자가 두 번 나오는 셈이다 —
   그래서 **표시할 때만** 그 앞부분을 지운다.
     · 대소문자 무시하고 앞부분이 맞을 때만 지운다.
     · 지운 뒤 앞에 남는 공백·하이픈·언더바는 정리한다.
     · 지우면 빈 글자가 되는 품목(품명이 모델명뿐)은 **원본을 그대로** 둔다.
   집계(lib/inboundStats.js 의 byModel)는 한 글자도 건드리지 않았다 —
   o.topName 원본은 title 툴팁과 o.size 산출에 그대로 쓰인다. */
const stripModelHead = (model, name) => {
    const m = String(model || '').trim();
    const s = String(name || '').trim();
    if (m === '' || s === '') return s;
    if (s.slice(0, m.length).toLowerCase() !== m.toLowerCase()) return s;
    const rest = s.slice(m.length).replace(/^[\s\-_]+/, '');
    return rest === '' ? s : rest;
};

/* ── 탭 다섯 (P15 r15) ───────────────────────────────────────────────────────
   차례가 곧 읽는 차례다 — 품목을 보고(관리) 찾고(검색), 그 품목의 측정치를 찾고,
   부적합을 보고(관리) 찾는다(검색). 「관리」는 요약, 「검색」은 표다. */
const ITEM_TABS = [
    { key: 'items', label: '품목 관리' },
    { key: 'isearch', label: '품목 검색' },
    { key: 'msearch', label: '측정치 검색' },
    { key: 'nc', label: '부적합 관리' },
    { key: 'ncsearch', label: '부적합 검색' },
];
const ITEM_TAB_KEYS = ITEM_TABS.map((t) => t.key);
const ITEM_TAB_KEY = 'inbound_item_tab';

/* ── 검색칸 ───────────────────────────────────────────────────────────────── */
const SearchBox = ({ value, onChange, placeholder, hits, total }) => (
    <span className="inline-flex items-center gap-2 flex-none">
        <span className="inline-flex items-center gap-1.5 rounded-lg"
            style={{ padding: '6px 10px', background: 'var(--ib-chip)', border: '1px solid var(--ib-grid)' }}>
            <Search className="w-3.5 h-3.5" style={{ color: 'var(--ib-ink4)' }} />
            <input type="search" value={value} onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder} aria-label={placeholder}
                style={{
                    width: 220, border: 0, outline: 'none', background: 'transparent',
                    fontSize: 'var(--ib-lbl)', fontFamily: 'inherit', color: 'var(--ib-ink)',
                }} />
        </span>
        <span className="tabular-nums whitespace-nowrap" style={{ fontSize: 'calc(var(--ib-lbl)*.95)', color: 'var(--ib-ink4)' }}>
            {hits === total ? `${fmt(total)}줄` : `${fmt(hits)} / ${fmt(total)}줄`}
        </span>
    </span>
);

/* ═══════════════════════════════════════════════════════════════════════════ */
const InboundItems = ({ initialTab }) => {
    const [tab, setTab] = useStickyString(ITEM_TAB_KEY, 'items', ITEM_TAB_KEYS);
    const forced = useRef(false);
    /* 구 #inbound_status 링크로 들어오면 「부적합 관리」 탭으로. 저장값보다 이게 이긴다(한 번만). */
    useEffect(() => {
        if (initialTab === 'ncr' && !forced.current) { forced.current = true; setTab('nc'); }
    }, [initialTab, setTab]);

    const [st, setSt] = useState({ loading: true, err: null, insp: [], rows: null, spcErr: null });

    const load = async (force) => {
        setSt((s) => ({ ...s, loading: true, err: null }));
        try {
            const insp = await loadInspections({ force });
            /* SPC 는 실패해도 대장 통계는 살아 있어야 한다 — 별도로 잡는다 */
            let rows = null, spcErr = null;
            try {
                const r = await loadInboundSpc({ force });
                rows = r.rows;
            } catch (e) {
                console.error('[InboundItems/SPC]', e);
                spcErr = e.message || String(e);
            }
            setSt({ loading: false, err: null, insp, rows, spcErr });
        } catch (e) {
            console.error('[InboundItems]', e);
            setSt({ loading: false, err: e.message || String(e), insp: [], rows: null, spcErr: null });
        }
    };
    useEffect(() => { load(false); }, []);

    const bar = (
        <AreaBar items={ITEM_TABS} value={tab} onPick={setTab} idPrefix="ibitem" ariaLabel="품목·부적합 관리 화면"
            right={<span style={{ fontSize: 'calc(var(--ib-lbl)*.95)', color: 'var(--ib-ink4)' }}>
                보기 전용 · 자료를 고치는 칸은 없다
            </span>} />
    );
    const head = (
        <ScreenHeader
            eyebrow="신우밸브 · 품질경영시스템"
            title="인수검사 — 품목·부적합 관리"
            meta={<>
                <span className="tabular-nums">검사 기록 {fmt(st.insp.length)}건</span>
                <span>불량률 = 부적합 수량 ÷ 입고 수량 · 목표 {fmt(PPM_TARGET)} PPM</span>
                <span>모델명·사이즈는 품명에서 뽑은 값이다</span>
            </>}
            right={<GhostButton onClick={() => load(true)}><RefreshCw className="w-3.5 h-3.5" />새로고침</GhostButton>}
        />
    );

    if (st.loading) return <ScreenFrame>{head}{bar}<Loading t="인수검사 자료를 불러오는 중…" /></ScreenFrame>;
    if (st.err) return <ScreenFrame>{head}{bar}<ErrorCard msg={st.err} onRetry={() => load(true)} /></ScreenFrame>;

    return (
        <ScreenFrame>
            {head}
            {bar}
            <Body st={st} tab={tab} />
        </ScreenFrame>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════ */
const Body = ({ st, tab }) => {
    const C = useInboundTheme();

    /* ── 기간 (대시보드·협력업체와 같은 값) ── */
    const span = useMemo(() => dataSpan(st.insp), [st.insp]);
    const [flt, setFlt] = useSharedPeriod(span);
    const F = useMemo(() => rangeFilter(st.insp, flt.range), [st.insp, flt.range]);
    const periodText = `${flt.range.start || '—'} ~ ${flt.range.end || '—'}`;

    /* ── 기간 안의 측정값 (Ppk 등급 · 규격 밖 표가 쓴다) ── */
    const dmap = useMemo(() => reportDateMap(st.insp), [st.insp]);
    const M = useMemo(() => rowsInRange(st.rows || [], dmap, flt.range), [st.rows, dmap, flt.range]);
    const grades = useMemo(() => {
        const m = new Map();
        for (const g of partGrades(M.rows)) m.set(g.key, g);
        return m;
    }, [M.rows]);

    /* ── 대장 파생값 ── */
    const ALL = useMemo(() => summarize(F), [F]);
    const TY = useMemo(() => byItemType(F).sort((a, b) => b.count - a.count), [F]);
    const ITEMS = useMemo(() => byItemCode(F), [F]);
    /* P15 r15 — Top 10 은 **모델명**으로 센다(품번이 아니다). */
    const MODELS = useMemo(() => byModel(F), [F]);
    const TOPMODEL = useMemo(
        () => MODELS.slice().sort((a, b) => b.count - a.count || b.inQty - a.inQty).slice(0, TOP_N),
        [MODELS],
    );
    const DT = useMemo(() => topDefectTypes(F, TOP_N), [F]);
    const NGSUP = useMemo(
        () => bySupplier(F).filter((o) => o.ngCount > 0)
            .sort((a, b) => b.ngCount - a.ngCount || b.ngQty - a.ngQty).slice(0, TOP_N),
        [F],
    );
    const FAILS = useMemo(() => recentFails(F), [F]);
    const ngSupCount = useMemo(() => bySupplier(F).filter((o) => o.ngCount > 0).length, [F]);

    /* 규격 밖 로트 — buildD 와 같은 규칙으로 센다.
       · 공차 한쪽이 0이라 %가 무한이 되는 행은 D 가 통째로 버린다. 여기서도 버린다.
       · pct 는 소수 1자리로 반올림한 뒤 |pct| > 100 으로 판정한다 (D 의 oos 와 같은 셈). */
    const OOS = useMemo(() => {
        const out = [];
        for (const r of M.rows) {
            const raw = r.xs.map((x) => normPct(x, r.T, r.usl, r.lsl));
            if (!raw.every((p) => -1e308 < p && p < 1e308)) continue;
            raw.forEach((p, i) => {
                const pct = pyRound(p, 1);
                if (Math.abs(pct) > 100) {
                    out.push({ ri: r.ri, vendor: r.vendor, part: r.part, name: r.name, point: r.point, x: r.xs[i], pct, k: i + 1 });
                }
            });
        }
        return out.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
    }, [M.rows]);

    /* ── 검색 + 쪽넘김 (한 쪽 10줄 · ui.jsx 의 공용 조각) ── */
    const [qItem, setQItem] = useState('');
    const [sortItem, setSortItem] = useState({ key: 'count', dir: 'desc' });
    const itemRows = useMemo(() => {
        const s = ITEMS.map((o) => {
            const g = grades.get(o.key);
            return { ...o, ppk: g && g.idx !== null && g.idx !== undefined ? g.idx : null, grade: g ? g.grade : null, mn: g ? g.n : null };
        });
        const { key, dir } = sortItem;
        s.sort((a, b) => {
            const x = a[key], y = b[key];
            if (key === 'key' || key === 'model' || key === 'size' || key === 'itemName') {
                const r = String(x || '').localeCompare(String(y || ''), 'ko');
                return dir === 'asc' ? r : -r;
            }
            const nx = x === null || x === undefined, ny = y === null || y === undefined;
            if (nx && ny) return 0;
            if (nx) return 1;
            if (ny) return -1;
            return dir === 'asc' ? x - y : y - x;
        });
        return s;
    }, [ITEMS, grades, sortItem]);
    const P1 = usePaged(itemRows, qItem, (x, s) => (
        String(x.key).toLowerCase().includes(s) || String(x.itemName).toLowerCase().includes(s)
        || String(x.model).toLowerCase().includes(s) || String(x.size).toLowerCase().includes(s)
    ));

    const [qFail, setQFail] = useState('');
    const P2 = usePaged(FAILS, qFail, (x, s) => (
        String(x.supplier).toLowerCase().includes(s) || String(x.itemName).toLowerCase().includes(s)
        || String(x.model).toLowerCase().includes(s) || String(x.size).toLowerCase().includes(s)
        || String(x.defectType).toLowerCase().includes(s) || String(x.reportNo).toLowerCase().includes(s)
    ));

    const [qOos, setQOos] = useState('');
    const P3 = usePaged(OOS, qOos, (x, s) => (
        String(x.ri).toLowerCase().includes(s) || String(x.vendor).toLowerCase().includes(s)
        || String(x.part).toLowerCase().includes(s) || String(x.point).toLowerCase().includes(s)
    ));

    const typeColors = [C.pri, C.ok2, C.warn2, C.pri3, '#a78bfa', '#94a3b8'];
    /* P8 r8 부터 색 기준은 관리선 하나다 — 100 PPM 이내 초록 / 넘으면 빨강 */
    const rateTone = (o) => {
        const p = ppm(o.ngQty, o.inQty);
        return p === null ? C.ink4 : (p > PPM_TARGET ? C.bad : C.ok);
    };
    const worstType = TY.slice().sort((a, b) => (b.defectRate || 0) - (a.defectRate || 0))[0];

    const sortTh = (key, label, align) => (
        <th key={key} onClick={() => setSortItem((s) => (s.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' }))}
            className={`cursor-pointer select-none ${align === 'r' ? 'text-right' : 'text-left'}`}
            style={{ padding: '9px 12px' }}>
            {label}
            <span style={{ marginLeft: 4, fontSize: 10, color: C.pri2 }}>
                {sortItem.key === key ? (sortItem.dir === 'desc' ? '▼' : '▲') : ''}
            </span>
        </th>
    );

    /* ══ 탭 1 · 품목 관리 — KPI · 품목유형 · 모델명 Top 10 ═══════════════════ */
    const paneItems = (
        <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" style={{ marginBottom: 16 }}>
                <KpiTile delay={0.08} label="품목유형" value={TY.length} unit="종" footnote="대분류 기준" />
                <KpiTile delay={0.11} label="모델명" value={MODELS.length} unit="종"
                    footnote={`품번 ${fmt(ITEMS.length)}개 · 부적합이 있던 품번 ${fmt(ITEMS.filter((o) => o.ngCount > 0).length)}개`} />
                <KpiTile delay={0.14} label="검사 건수" value={ALL.count} unit="건"
                    footnote={`입고 수량 ${fmt(ALL.inQty)} EA`} />
                <KpiTile delay={0.17} label="Ppk 산출 품번" value={grades.size} unit="개"
                    footnote={`측정값 ${fmt(M.rows.length)}로트가 이 기간에 걸린다`} />
            </div>

            <div className="grid grid-cols-12 gap-4">
                {/* A. 품목유형 구성 */}
                <Card className="col-span-12 xl:col-span-7" delay={0.20}>
                    <SectionTitle title="품목유형별 현황" subtitle="띠 길이 = 입고 건수 비중 · 우측은 유형별 불량률" />
                    <div style={{ marginTop: 14 }}>
                        {TY.length === 0 ? <Empty t="품목유형 자료가 없다" /> : (
                            <>
                                <StackStrip rows={TY} valueKey="count" colors={typeColors} />
                                <div className="overflow-x-auto" style={{ marginTop: 14 }}>
                                    <table className="ib-table" style={{ minWidth: 760, fontSize: 'var(--ib-body)' }}>
                                        <thead>
                                            <tr>
                                                <th className="text-left" style={{ padding: '9px 12px' }}>품목유형</th>
                                                {['입고 건수', '입고 수량', '검사 수량', '부적합 건수', '부적합 수량', '불량률 (% · PPM)'].map((h) => (
                                                    <th key={h} className="text-right" style={{ padding: '9px 12px' }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {TY.map((o, i) => (
                                                <tr key={o.key}>
                                                    <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--ib-ink)' }}>
                                                        <span className="inline-flex items-center gap-2">
                                                            <i className="rounded-sm flex-none" style={{ width: 10, height: 10, background: typeColors[i % typeColors.length] }} />
                                                            {o.name}
                                                        </span>
                                                    </td>
                                                    <td className="text-right tabular-nums" style={{ padding: '8px 12px', color: 'var(--ib-ink2)' }}>{fmt(o.count)}</td>
                                                    <td className="text-right tabular-nums" style={{ padding: '8px 12px', color: 'var(--ib-ink2)' }}>{fmt(o.inQty)}</td>
                                                    <td className="text-right tabular-nums" style={{ padding: '8px 12px', color: 'var(--ib-ink2)' }}>{fmt(o.inspQty)}</td>
                                                    <td className="text-right tabular-nums" style={{ padding: '8px 12px', color: o.ngCount ? C.bad : 'var(--ib-ink2)', fontWeight: o.ngCount ? 700 : 400 }}>{fmt(o.ngCount)}</td>
                                                    <td className="text-right tabular-nums" style={{ padding: '8px 12px', color: o.ngQty ? C.bad : 'var(--ib-ink2)' }}>{fmt(o.ngQty)}</td>
                                                    <td className="text-right tabular-nums" style={{ padding: '8px 12px', fontWeight: 700, color: rateTone(o), lineHeight: 1.25 }}>{pctText(o.defectRate)}
                                                        <small style={{ display: 'block', fontSize: '.82em', fontWeight: 700, opacity: .85 }}>{fmtPpm(o.ngQty, o.inQty)}</small></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {worstType && (
                                    <div style={{ marginTop: 10, fontSize: 'calc(var(--ib-lbl)*.98)', color: 'var(--ib-ink3)', lineHeight: 1.5 }}>
                                        불량률이 가장 높은 유형은 <b style={{ color: 'var(--ib-ink)' }}>{worstType.name}</b> ({fmtRate(worstType.ngQty, worstType.inQty)}) 이다.
                                        색은 위 띠와 같은 순서다.
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </Card>

                {/* B. 모델명 Top 10 (검사 건수) — P15 r15 : 품번이 아니라 모델명이다 */}
                <Card className="col-span-12 xl:col-span-5" delay={0.24}>
                    <SectionTitle title={`모델명 Top ${TOP_N}`} subtitle="검사 건수 순 · 우측은 그 모델의 불량률(% · PPM)" />
                    <div style={{ marginTop: 12 }}>
                        {TOPMODEL.length === 0 ? <Empty t="이 기간에 입고된 품목이 없다" /> : (
                            <RankBar rows={TOPMODEL} valueKey="count" valueUnit="건"
                                nameWidth={150}
                                rightOf={(r) => (
                                    <span className="tabular-nums" style={{ color: rateTone(r), display: 'inline-block', textAlign: 'right', lineHeight: 1.2 }}>
                                        {pctText(r.defectRate)}
                                        <small style={{ display: 'block', fontSize: '.8em', fontWeight: 700, opacity: .85 }}>{fmtPpm(r.ngQty, r.inQty)}</small>
                                    </span>
                                )} />
                        )}
                    </div>
                    {/* 보조줄 — 모델명 하나에 품번이 몇 종 걸려 있는지와 대표 품명.
                        품번 **번호 자체**는 여기 적지 않는다. 그건 「품목 검색」 표가 할 일이다. */}
                    <ul className="list-none m-0 p-0" style={{ marginTop: 10, fontSize: 'calc(var(--ib-lbl)*.95)', color: 'var(--ib-ink4)' }}>
                        {TOPMODEL.slice(0, 3).map((o) => (
                            <li key={o.key} className="truncate" title={o.topName}>
                                {o.name} — 품번 {fmt(o.codes)}종 · {stripModelHead(o.name, o.topName) || '(품명 없음)'}
                            </li>
                        ))}
                    </ul>
                </Card>
            </div>
        </>
    );

    /* ══ 탭 2 · 품목 검색 ══════════════════════════════════════════════════ */
    const paneISearch = (
        <Card delay={0.10} style={{ padding: 0 }}>
            <div style={{ padding: 'var(--ib-pad) var(--ib-pad) 12px' }}>
                <SectionTitle title="품목 검색" subtitle="열 머리를 누르면 정렬 · 품번·모델명·사이즈·품명으로 찾는다"
                    right={<SearchBox value={qItem} onChange={setQItem} placeholder="품번 · 모델명 · 사이즈 · 품명"
                        hits={P1.hits.length} total={itemRows.length} />} />
            </div>
            {P1.hits.length === 0 ? <Empty t="찾는 품목이 없다" /> : (
                <>
                    <div className="overflow-x-auto">
                        <table className="ib-table" style={{ minWidth: 1020, fontSize: 'var(--ib-body)' }}>
                            <thead>
                                <tr>
                                    {sortTh('key', '품번', 'l')}
                                    {sortTh('model', '모델명', 'l')}
                                    {sortTh('size', '사이즈', 'l')}
                                    {sortTh('itemName', '품명', 'l')}
                                    {sortTh('count', '검사 건수', 'r')}
                                    {sortTh('inQty', '입고 수량', 'r')}
                                    {sortTh('defectRate', '불량률 (% · PPM)', 'r')}
                                    {sortTh('ppk', 'Ppk 등급', 'r')}
                                </tr>
                            </thead>
                            <tbody>
                                {P1.rows.map((o) => (
                                    <tr key={o.key}>
                                        <td className="tabular-nums whitespace-nowrap" style={{ padding: '8px 12px', color: 'var(--ib-ink3)' }}>{o.key}</td>
                                        <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--ib-ink)', maxWidth: 160 }}>
                                            <span className="block truncate" title={o.itemName}>{o.model}</span>
                                        </td>
                                        <td className="tabular-nums whitespace-nowrap" style={{ padding: '8px 12px', color: 'var(--ib-ink2)' }} title={o.itemName}>{o.size}</td>
                                        <td style={{ padding: '8px 12px', color: 'var(--ib-ink2)', maxWidth: 300 }}>
                                            <span className="block truncate" title={o.itemName}>{o.itemName || '—'}</span>
                                        </td>
                                        <td className="text-right tabular-nums" style={{ padding: '8px 12px', color: 'var(--ib-ink2)' }}>{fmt(o.count)}</td>
                                        <td className="text-right tabular-nums" style={{ padding: '8px 12px', color: 'var(--ib-ink2)' }}>{fmt(o.inQty)}</td>
                                        <td className="text-right tabular-nums" style={{ padding: '8px 12px', fontWeight: 700, color: rateTone(o), lineHeight: 1.25 }}>{pctText(o.defectRate)}
                                            <small style={{ display: 'block', fontSize: '.82em', fontWeight: 700, opacity: .85 }}>{fmtPpm(o.ngQty, o.inQty)}</small></td>
                                        <td className="text-right whitespace-nowrap" style={{ padding: '8px 12px' }}>
                                            {o.ppk === null ? (
                                                <span style={{ color: 'var(--ib-ink4)' }}>—</span>
                                            ) : (
                                                <span className="inline-flex items-center gap-2">
                                                    <b className="tabular-nums" style={{ color: gradeColor(o.grade).bar }}>{o.ppk.toFixed(2)}</b>
                                                    <GradeChip g={o.grade} />
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <Pager page={P1.page} last={P1.last} onGo={P1.go} from={P1.from} to={P1.to} total={P1.hits.length} unit="개" />
                    <div style={{ padding: '0 var(--ib-pad) 14px', fontSize: 'calc(var(--ib-lbl)*.95)', color: 'var(--ib-ink4)', lineHeight: 1.5 }}>
                        모델명·사이즈는 품명 한 줄에서 뽑은 값이다(못 뽑으면 「—」). 원래 품명은 옆 칸과 마우스 툴팁에 그대로 있다.
                        Ppk 등급은 그 품번의 측정값으로 낸 값이라 측정이 없는 품번은 「—」다.
                    </div>
                </>
            )}
        </Card>
    );

    /* ══ 탭 3 · 측정치 검색 (예전 「규격외 측정치」) ═════════════════════════ */
    const paneMSearch = (
        <Card delay={0.10} style={{ padding: 0 }}>
            <div style={{ padding: 'var(--ib-pad) var(--ib-pad) 12px' }}>
                <SectionTitle title="측정치 검색"
                    subtitle="측정값기록서에서 |공차 정규화 %| > 100 인 개별 측정치 · 상한 +100 / 기준 0 / 하한 −100"
                    right={OOS.length ? <SearchBox value={qOos} onChange={setQOos} placeholder="성적서 · 업체 · 품번 · 포인트"
                        hits={P3.hits.length} total={OOS.length} /> : null} />
            </div>
            {st.spcErr ? (
                <div style={{ padding: '0 var(--ib-pad) var(--ib-pad)', fontSize: 'var(--ib-lbl)', color: 'var(--ib-ink3)' }}>
                    <span style={{ color: C.bad }}>⚠</span> 측정값을 불러오지 못했다 — {st.spcErr}
                </div>
            ) : P3.hits.length === 0 ? <Empty t={OOS.length ? '찾는 측정치가 없다' : '이 기간에는 규격을 벗어난 측정치가 없다'} /> : (
                <>
                    <div className="overflow-x-auto">
                        <table className="ib-table" style={{ minWidth: 860, fontSize: 'var(--ib-body)' }}>
                            <thead>
                                <tr>
                                    {[['성적서번호(RI)', 'l'], ['업체', 'l'], ['품번', 'l'], ['측정 포인트', 'l'], ['측정값', 'r'], ['공차 정규화 %', 'r']].map(([h, a]) => (
                                        <th key={h} className={a === 'r' ? 'text-right' : 'text-left'} style={{ padding: '9px 12px' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {P3.rows.map((o, i) => (
                                    <tr key={`${o.ri}-${o.part}-${o.point}-${o.k}-${i}`}>
                                        <td className="tabular-nums whitespace-nowrap" style={{ padding: '7px 12px', color: 'var(--ib-ink3)' }}>{o.ri || '—'}</td>
                                        <td className="truncate" style={{ padding: '7px 12px', color: 'var(--ib-ink)', maxWidth: 220 }} title={o.vendor}>{o.vendor}</td>
                                        <td className="tabular-nums whitespace-nowrap" style={{ padding: '7px 12px', color: 'var(--ib-ink3)' }}>{o.part || '—'}</td>
                                        <td className="whitespace-nowrap" style={{ padding: '7px 12px', color: 'var(--ib-ink2)' }}>
                                            {o.point || '—'}<em className="not-italic" style={{ color: 'var(--ib-ink4)', marginLeft: 6 }}>X{o.k}</em>
                                        </td>
                                        <td className="text-right tabular-nums" style={{ padding: '7px 12px', color: 'var(--ib-ink)' }}>{o.x}</td>
                                        <td className="text-right tabular-nums" style={{ padding: '7px 12px', fontWeight: 800, color: C.bad }}>
                                            {o.pct > 0 ? '+' : ''}{fx(o.pct, 1)}%
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <Pager page={P3.page} last={P3.last} onGo={P3.go} from={P3.from} to={P3.to} total={P3.hits.length} unit="개" />
                    <div style={{ padding: '0 var(--ib-pad) 14px', fontSize: 'calc(var(--ib-lbl)*.95)', color: 'var(--ib-ink4)', lineHeight: 1.5 }}>
                        |%| 큰 순서. 100% 를 넘으면 공차를 벗어났다는 뜻이다(+ 는 상한 초과, − 는 하한 미달).
                        인수검사 기록의 &lsquo;부적합 건수&rsquo;와는 세는 단위가 다르다 — 이쪽은 측정치 하나하나다.
                    </div>
                </>
            )}
        </Card>
    );

    /* ══ 탭 4 · 부적합 관리 — KPI · 유형 Top · 업체별 ═══════════════════════ */
    const paneNc = (
        <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" style={{ marginBottom: 16 }}>
                <KpiTile delay={0.08} label="불합격 건수" value={ALL.ngCount} unit="건" tone={ALL.ngCount ? C.bad : undefined}
                    footnote={`검사 ${fmt(ALL.count)}건 중 · 합격률 ${fx(ALL.passRate, 2)}%`} />
                <KpiTile delay={0.11} label="부적합 수량" value={ALL.ngQty} unit="EA" tone={C.bad}
                    footnote={`입고 ${fmt(ALL.inQty)} EA 중`} />
                <KpiTile delay={0.14} label="PPM" value={ALL.ppm} unit="PPM" dec={0}
                    tone={ALL.ppm !== null && ALL.ppm > PPM_TARGET ? C.bad : C.ok}
                    footnote={`${fmtRate(ALL.ngQty, ALL.inQty)} · 목표 ${fmt(PPM_TARGET)} PPM ${ALL.ppm !== null && ALL.ppm > PPM_TARGET ? '초과' : '이내'}`} />
                <KpiTile delay={0.17} label="부적합 발생 업체" value={ngSupCount} unit="곳" tone={C.warn}
                    footnote={`이 기간 입고 업체 ${fmt(bySupplier(F).length)}곳 중`} />
            </div>

            <div className="grid grid-cols-12 gap-4">
                {/* 부적합 유형 Top 10 */}
                <Card className="col-span-12 xl:col-span-6" delay={0.20}>
                    <SectionTitle title={`부적합 유형 Top ${TOP_N}`} subtitle="건수 순 · 유형이 적힌 행만 · 우측은 부적합 수량" />
                    <div style={{ marginTop: 12 }}>
                        {DT.length === 0 ? <Empty t="이 기간에 기록된 부적합 유형이 없다" /> : (
                            <RankBar rows={DT} valueKey="count" valueUnit="건" nameWidth={180}
                                rightOf={(r) => <span className="tabular-nums" style={{ color: C.bad }}>{fmt(r.ngQty)} EA</span>} />
                        )}
                    </div>
                    <ul className="list-none m-0 p-0" style={{ marginTop: 10, fontSize: 'calc(var(--ib-lbl)*.95)' }}>
                        {DT.slice(0, 3).map((o) => {
                            const sup = Object.keys(o.suppliers).sort((a, b) => o.suppliers[b] - o.suppliers[a]);
                            const label = sup.slice(0, 2).map((s) => `${s} ${o.suppliers[s]}`).join(' · ') + (sup.length > 2 ? ` 외 ${sup.length - 2}` : '');
                            return <LegendRow key={o.name} color={C.bad2} name={o.name} value={`${fmt(o.count)}건`} extra={<span className="truncate">{label}</span>} />;
                        })}
                    </ul>
                </Card>

                {/* 업체별 부적합 Top 10 */}
                <Card className="col-span-12 xl:col-span-6" delay={0.24}>
                    <SectionTitle title={`업체별 부적합 Top ${TOP_N}`} subtitle="불합격 건수 순 · 우측은 그 업체의 불량률(% · PPM)" />
                    <div style={{ marginTop: 12 }}>
                        {NGSUP.length === 0 ? <Empty t="이 기간에 부적합 판정을 받은 업체가 없다" /> : (
                            <RankBar rows={NGSUP} valueKey="ngCount" valueUnit="건" nameWidth={180}
                                rightOf={(r) => (
                                    <span className="tabular-nums" style={{ color: rateTone(r), display: 'inline-block', textAlign: 'right', lineHeight: 1.2 }}>
                                        {pctText(r.defectRate)}
                                        <small style={{ display: 'block', fontSize: '.8em', fontWeight: 700, opacity: .85 }}>{fmtPpm(r.ngQty, r.inQty)}</small>
                                    </span>
                                )} />
                        )}
                    </div>
                </Card>
            </div>
        </>
    );

    /* ══ 탭 5 · 부적합 검색 (예전 「불합격 목록 전체」) ══════════════════════ */
    const paneNcSearch = (
        <Card delay={0.10} style={{ padding: 0 }}>
            <div style={{ padding: 'var(--ib-pad) var(--ib-pad) 12px' }}>
                <SectionTitle title="부적합 검색"
                    subtitle={`이 기간(${periodText}) 판정 불합격 전체 · 최신순 · 보기 전용`}
                    right={<SearchBox value={qFail} onChange={setQFail} placeholder="업체 · 모델명 · 사이즈 · 품명 · 유형 · 보고서"
                        hits={P2.hits.length} total={FAILS.length} />} />
            </div>
            {P2.hits.length === 0 ? <Empty t={FAILS.length ? '찾는 불합격 건이 없다' : '이 기간에는 불합격이 없다'} /> : (
                <>
                    <div className="overflow-x-auto">
                        <table className="ib-table" style={{ minWidth: 1040, fontSize: 'var(--ib-body)' }}>
                            <thead>
                                <tr>
                                    {[['일자', 'l'], ['업체', 'l'], ['모델명', 'l'], ['사이즈', 'l'], ['품명', 'l'],
                                    ['부적합수량', 'r'], ['부적합유형', 'l'], ['보고서번호', 'l']].map(([h, a]) => (
                                        <th key={h} className={a === 'r' ? 'text-right' : 'text-left'} style={{ padding: '9px 12px' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {P2.rows.map((r) => (
                                    <tr key={r.key}>
                                        <td className="tabular-nums whitespace-nowrap" style={{ padding: '8px 12px', color: 'var(--ib-ink3)' }}>{r.date}</td>
                                        <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--ib-ink)', maxWidth: 200 }}>
                                            <span className="block truncate" title={r.supplier}>{r.supplier}</span>
                                        </td>
                                        <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--ib-ink)', maxWidth: 150 }}>
                                            <span className="block truncate" title={r.itemName}>{r.model}</span>
                                        </td>
                                        <td className="tabular-nums whitespace-nowrap" style={{ padding: '8px 12px', color: 'var(--ib-ink2)' }} title={r.itemName}>{r.size}</td>
                                        <td style={{ padding: '8px 12px', color: 'var(--ib-ink2)', maxWidth: 280 }}>
                                            <span className="block truncate" title={r.itemName}>{r.itemName}</span>
                                        </td>
                                        <td className="text-right tabular-nums" style={{ padding: '8px 12px', fontWeight: 800, color: C.bad }}>{fmt(r.ngQty)}</td>
                                        <td style={{ padding: '8px 12px', color: r.defectType ? 'var(--ib-ink2)' : 'var(--ib-ink4)', maxWidth: 200 }}>
                                            <span className="block truncate" title={r.defectType}>{r.defectType || '(미기재)'}</span>
                                        </td>
                                        <td className="tabular-nums whitespace-nowrap" style={{ padding: '8px 12px', color: r.reportNo === '없음' ? 'var(--ib-ink4)' : 'var(--ib-ink3)' }}>{r.reportNo}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <Pager page={P2.page} last={P2.last} onGo={P2.go} from={P2.from} to={P2.to} total={P2.hits.length} />
                    <div style={{ padding: '0 var(--ib-pad) 14px', fontSize: 'calc(var(--ib-lbl)*.95)', color: 'var(--ib-ink4)', lineHeight: 1.5 }}>
                        모델명·사이즈는 품명 한 줄에서 뽑은 값이다 — 품명 칸에 원문이 그대로 있다.
                        보고서번호가 「없음」인 줄은 대장에 성적서번호가 안 적힌 건이다(빈칸으로 두면 &lsquo;안 봤다&rsquo;로 읽힌다).
                    </div>
                </>
            )}
        </Card>
    );

    const PANES = {
        items: paneItems,
        isearch: paneISearch,
        msearch: paneMSearch,
        nc: paneNc,
        ncsearch: paneNcSearch,
    };

    return (
        <div role="tabpanel" id={`ibitem-panel-${tab}`} aria-labelledby={`ibitem-tab-${tab}`}>
            {/* 기간 필터 — 「묶음」은 감춘다(추이 차트가 없다) */}
            <InboundPeriodFilter
                range={flt.range} quick={flt.quick} group={flt.group} manualGroup={flt.manualGroup}
                span={span} rows={st.insp} onChange={setFlt} showGroup={false}
            />

            {F.length === 0 ? (
                <Card><Empty t={`선택한 기간(${periodText})에 입고 자료가 없다. '전체'로 보면 ${fmt(st.insp.length)}건이 있다.`} /></Card>
            ) : (PANES[tab] || paneItems)}
        </div>
    );
};

export default InboundItems;
