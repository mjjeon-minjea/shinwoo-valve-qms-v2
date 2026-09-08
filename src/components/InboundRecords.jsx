/* ─────────────────────────────────────────────────────────────────────────────
   InboundRecords.jsx — 인수검사 「기록·기준」   (플랜 042 / P4 r4)

   탭 2개 (r2 부터 같다)
     · 입고 대장        — inspections. 검색 · 업체 · 기간 · 페이지.  **읽기 전용이다.**
     · 측정값기록서      — inspection_measurements. RI·품번·포인트·기준·공차·X1~X5·판정.
   아래로 항상 붙는 것: 등급 기준표 · 정직 딱지 · 동기화 상태(마지막 synced_at)

   r3 → r4 : 기능은 그대로, 표면만 시안 언어로 바꿨다.
     · 유리 카드 · 오로라 배경 · 표 머리 고정(sticky) · 얼룩(zebra) · 숫자 자리맞춤
     · 판정은 알약(합격/불합격 · OK/NG)으로, 색은 의미 고정색(녹/적)을 쓴다.
   ───────────────────────────────────────────────────────────────────────────── */
import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import '../styles/inbound.css';
import { loadInspections, loadMeasurements, ymd, lastSyncedAt } from '../lib/inboundStats';
import {
    ScreenFrame, ScreenHeader, Card, SectionTitle, GhostButton, Loading, ErrorCard,
    fmt, gradeColor, GRADE_ORDER5, useInboundTheme,
} from './inbound/ui';

const PER = 20;

const txt = (v) => {
    const s = v === null || v === undefined ? '' : String(v).trim();
    return s === '' ? '—' : s;
};
const numOrDash = (v) => {
    if (v === null || v === undefined || String(v).trim() === '') return '—';
    const n = Number(v);
    return Number.isFinite(n) ? String(n) : String(v);
};

const GRADE_TABLE = [
    ['특급', 'Ppk ≥ 1.67', '매우 충분 — 현 수준 유지, 관리 간소화 검토'],
    ['1등급', '1.33 ≤ Ppk < 1.67', '충분 — 이상적, 현 수준 유지'],
    ['2등급', '1.00 ≤ Ppk < 1.33', '보통 — 관리 강화, 산포 축소 필요'],
    ['3등급', '0.67 ≤ Ppk < 1.00', '부족 — 공정 개선 필요, 선별 검토'],
    ['4등급', 'Ppk < 0.67', '대단히 부족 — 긴급 대책·원인 추구·규격 재검토, 전수선별 병행'],
];

const HONEST = [
    '축적 초기(약 2.5주) — n<30 업체는 수치 변동이 크다.',
    '측정 해상도 1mm — 군내(로트 내) 산포가 과소평가될 수 있다. Cp/Cpk(군내)가 과대해지므로 업체 평가는 전체 능력(Pp/Ppk)으로 한다.',
    '서브그룹 크기(1~5EA)가 로트마다 달라 관리한계는 평균 계수 근사치다(군크기 1인 로트는 R 관리도에서 제외).',
    '등급은 신우밸브 공식 Cpk 기준([신우밸브]cpk 기준.pdf)을 Ppk(전체)에 적용한 것이다.',
    '품목별 관리도는 1년 축적 후다. 지금 화면은 업체 단위 스냅샷이다.',
];

const inputStyle = {
    padding: '7px 11px', borderRadius: 10, border: '1px solid rgba(15,23,42,.14)',
    background: 'rgba(255,255,255,.72)', fontSize: 'var(--ib-body)', color: 'var(--ib-ink2)', fontFamily: 'inherit',
};

const Pill = ({ tone, children }) => (
    <span className="rounded-full whitespace-nowrap" style={{
        padding: '3px 10px', fontSize: 'calc(var(--ib-lbl)*.92)', fontWeight: 800,
        background: tone.bg, color: tone.fg,
    }}>{children}</span>
);

const Pager = ({ page, total, onPage, unit }) => {
    const pages = Math.max(Math.ceil(total / PER), 1);
    const from = total === 0 ? 0 : (page - 1) * PER + 1;
    const to = Math.min(page * PER, total);
    const btn = {
        padding: '5px 11px', borderRadius: 8, border: '1px solid var(--ib-grid)',
        background: 'var(--ib-card)', fontWeight: 700, color: 'var(--ib-ink2)',
    };
    return (
        <div className="flex flex-wrap items-center justify-between gap-3"
            style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--ib-grid)', fontSize: 'var(--ib-lbl)', color: 'var(--ib-ink3)' }}>
            <span className="tabular-nums">총 {fmt(total)}{unit} 중 {fmt(from)}–{fmt(to)} 표시</span>
            <span className="flex items-center gap-2">
                <button type="button" onClick={() => onPage(Math.max(1, page - 1))} disabled={page <= 1}
                    style={{ ...btn, opacity: page <= 1 ? 0.4 : 1 }}>이전</button>
                <span className="tabular-nums" style={{ fontWeight: 700, color: 'var(--ib-ink)' }}>{page} / {pages}</span>
                <button type="button" onClick={() => onPage(Math.min(pages, page + 1))} disabled={page >= pages}
                    style={{ ...btn, opacity: page >= pages ? 0.4 : 1 }}>다음</button>
            </span>
        </div>
    );
};

const InboundRecords = () => {
    const [st, setSt] = useState({ loading: true, err: null, insp: [], meas: [] });

    const load = async (force) => {
        setSt((s) => ({ ...s, loading: true, err: null }));
        try {
            const [insp, meas] = await Promise.all([loadInspections({ force }), loadMeasurements({ force })]);
            setSt({ loading: false, err: null, insp, meas });
        } catch (e) {
            console.error('[InboundRecords]', e);
            setSt({ loading: false, err: e.message || String(e), insp: [], meas: [] });
        }
    };
    useEffect(() => { load(false); }, []);

    if (st.loading) return <ScreenFrame><Loading t="인수검사 기록을 불러오는 중…" /></ScreenFrame>;
    if (st.err) return <ScreenFrame><ErrorCard msg={st.err} onRetry={() => load(true)} /></ScreenFrame>;
    return <ScreenFrame><Body st={st} reload={() => load(true)} /></ScreenFrame>;
};

const Body = ({ st, reload }) => {
    const C = useInboundTheme();
    const [tab, setTab] = useState('ledger');

    /* 대장 필터 */
    const [q, setQ] = useState('');
    const [sup, setSup] = useState('all');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [page, setPage] = useState(1);

    /* 측정값 필터 */
    const [mq, setMq] = useState('');
    const [mpage, setMpage] = useState(1);

    useEffect(() => { setPage(1); }, [q, sup, from, to]);
    useEffect(() => { setMpage(1); }, [mq]);

    const suppliers = useMemo(
        () => Array.from(new Set(st.insp.map((r) => String(r.supplier || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ko')),
        [st.insp],
    );

    const ledger = useMemo(() => {
        const s = q.trim().toLowerCase();
        return st.insp
            .map((r) => ({ ...r, _d: ymd(r.date) }))
            .filter((r) => {
                if (sup !== 'all' && String(r.supplier || '').trim() !== sup) return false;
                if (from && (!r._d || r._d < from)) return false;
                if (to && (!r._d || r._d > to)) return false;
                if (s === '') return true;
                return [r.supplier, r.itemName, r.item_code, r.inspectionReportNo, r.defectType]
                    .some((f) => String(f || '').toLowerCase().includes(s));
            })
            .sort((a, b) => (a._d < b._d ? 1 : a._d > b._d ? -1 : 0));
    }, [st.insp, q, sup, from, to]);

    const measures = useMemo(() => {
        const s = mq.trim().toLowerCase();
        const src = st.meas.slice().sort((a, b) => {
            const x = Number(a && a.source_row), y = Number(b && b.source_row);
            if (Number.isFinite(x) && Number.isFinite(y)) return x - y;
            return 0;
        });
        if (s === '') return src;
        return src.filter((r) => [r.ri_no, r.part_no, r.item_name, r.inspect_point, r.judgment]
            .some((f) => String(f || '').toLowerCase().includes(s)));
    }, [st.meas, mq]);

    const synced = useMemo(() => lastSyncedAt(st.meas), [st.meas]);
    const pageRows = ledger.slice((page - 1) * PER, page * PER);
    const mRows = measures.slice((mpage - 1) * PER, mpage * PER);

    const TONE_OK = { bg: 'rgba(16,185,129,.14)', fg: C.ok };
    const TONE_NG = { bg: 'rgba(244,63,94,.13)', fg: C.bad };

    const TabBtn = ({ id, label, n }) => {
        const on = tab === id;
        return (
            <button type="button" onClick={() => setTab(id)}
                style={{
                    padding: '9px 16px', fontSize: 'var(--ib-ttl)', fontWeight: 800, marginBottom: -1,
                    borderBottom: on ? '2px solid var(--ib-pri2)' : '2px solid transparent',
                    color: on ? 'var(--ib-ink)' : 'var(--ib-ink4)',
                }}>
                {label}<span className="tabular-nums" style={{ marginLeft: 6, fontSize: 'var(--ib-lbl)', fontWeight: 700, color: 'var(--ib-ink4)' }}>{fmt(n)}</span>
            </button>
        );
    };

    return (
        <>
            <ScreenHeader
                eyebrow="신우밸브 · 품질경영시스템"
                title="인수검사 — 기록·기준"
                meta={<>
                    <span>원본 기록을 그대로 보는 화면이다 — <b style={{ color: 'var(--ib-ink2)' }}>읽기 전용</b></span>
                    <span className="tabular-nums">대장 {fmt(st.insp.length)}건 · 측정값 {fmt(st.meas.length)}행</span>
                </>}
                right={<GhostButton onClick={reload}><RefreshCw className="w-3.5 h-3.5" />새로고침</GhostButton>}
            />

            <Card delay={0.08} style={{ marginBottom: 16, padding: 0 }}>
                <div className="flex items-center gap-1" style={{ padding: '0 var(--ib-pad)', borderBottom: '1px solid var(--ib-grid)' }}>
                    <TabBtn id="ledger" label="입고 대장" n={st.insp.length} />
                    <TabBtn id="meas" label="측정값기록서" n={st.meas.length} />
                </div>

                {tab === 'ledger' ? (
                    <>
                        <div className="flex flex-wrap items-center gap-2" style={{ padding: 'var(--ib-pad) var(--ib-pad) 12px' }}>
                            <span className="relative">
                                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.ink4 }} />
                                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="업체 · 품명 · 품번 · 성적서번호"
                                    style={{ ...inputStyle, width: 270, paddingLeft: 32 }} />
                            </span>
                            <select value={sup} onChange={(e) => setSup(e.target.value)} aria-label="업체" style={{ ...inputStyle, maxWidth: 240 }}>
                                <option value="all">업체 전체</option>
                                {suppliers.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="시작일" style={inputStyle} />
                            <span style={{ color: 'var(--ib-ink4)' }}>~</span>
                            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="종료일" style={inputStyle} />
                            {(q || sup !== 'all' || from || to) && (
                                <button type="button" onClick={() => { setQ(''); setSup('all'); setFrom(''); setTo(''); }}
                                    style={{ ...inputStyle, fontWeight: 700, cursor: 'pointer' }}>조건 지우기</button>
                            )}
                        </div>

                        <div className="overflow-x-auto" style={{ maxHeight: 640, overflowY: 'auto' }}>
                            <table className="ib-table" style={{ minWidth: 1080, fontSize: 'var(--ib-body)' }}>
                                <thead>
                                    <tr>
                                        {[['검사일', 'l'], ['업체', 'l'], ['품번', 'l'], ['품명', 'l'], ['유형', 'l'],
                                        ['입고 수량', 'r'], ['검사 수량', 'r'], ['부적합 수량', 'r'], ['판정', 'l'], ['부적합 유형', 'l'], ['성적서번호', 'l']]
                                            .map(([h, a]) => (
                                                <th key={h} className={a === 'r' ? 'text-right' : 'text-left'} style={{ padding: '9px 12px' }}>{h}</th>
                                            ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {pageRows.length === 0 ? (
                                        <tr><td colSpan={11} style={{ padding: '40px 12px', textAlign: 'center', color: 'var(--ib-ink4)' }}>조건에 맞는 기록이 없다</td></tr>
                                    ) : pageRows.map((r, i) => (
                                        <tr key={r.id || `${r.inspectionReportNo}-${i}`}>
                                            <td className="tabular-nums whitespace-nowrap" style={{ padding: '7px 12px', color: 'var(--ib-ink3)' }}>{r._d || '—'}</td>
                                            <td className="truncate" style={{ padding: '7px 12px', color: 'var(--ib-ink)', maxWidth: 190 }} title={r.supplier}>{txt(r.supplier)}</td>
                                            <td className="tabular-nums whitespace-nowrap" style={{ padding: '7px 12px', color: 'var(--ib-ink3)' }}>{txt(r.item_code)}</td>
                                            <td className="truncate" style={{ padding: '7px 12px', color: 'var(--ib-ink)', maxWidth: 260 }} title={r.itemName}>{txt(r.itemName)}</td>
                                            <td className="whitespace-nowrap" style={{ padding: '7px 12px', color: 'var(--ib-ink3)' }}>{txt(r.itemType)}</td>
                                            <td className="text-right tabular-nums" style={{ padding: '7px 12px', color: 'var(--ib-ink2)' }}>{fmt(Number(r.totalQuantity) || 0)}</td>
                                            <td className="text-right tabular-nums" style={{ padding: '7px 12px', color: 'var(--ib-ink2)' }}>{fmt(Number(r.inspectionQuantity) || 0)}</td>
                                            <td className="text-right tabular-nums" style={{ padding: '7px 12px', color: Number(r.defectQuantity) ? C.bad : 'var(--ib-ink2)', fontWeight: Number(r.defectQuantity) ? 700 : 400 }}>
                                                {fmt(Number(r.defectQuantity) || 0)}
                                            </td>
                                            <td className="whitespace-nowrap" style={{ padding: '7px 12px' }}>
                                                <Pill tone={r.result === '불합격' ? TONE_NG : TONE_OK}>{txt(r.result)}</Pill>
                                            </td>
                                            <td className="truncate" style={{ padding: '7px 12px', color: 'var(--ib-ink2)', maxWidth: 150 }} title={r.defectType}>{txt(r.defectType)}</td>
                                            <td className="tabular-nums whitespace-nowrap" style={{ padding: '7px 12px', color: 'var(--ib-ink4)' }}>{r.inspectionReportNo || '없음'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div style={{ padding: '0 var(--ib-pad) var(--ib-pad)' }}>
                            <Pager page={page} total={ledger.length} onPage={setPage} unit="건" />
                        </div>
                    </>
                ) : (
                    <>
                        <div className="flex flex-wrap items-center gap-2" style={{ padding: 'var(--ib-pad) var(--ib-pad) 12px' }}>
                            <span className="relative">
                                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.ink4 }} />
                                <input value={mq} onChange={(e) => setMq(e.target.value)} placeholder="RI · 품번 · 품명 · 측정 포인트"
                                    style={{ ...inputStyle, width: 290, paddingLeft: 32 }} />
                            </span>
                            {mq && (
                                <button type="button" onClick={() => setMq('')} style={{ ...inputStyle, fontWeight: 700, cursor: 'pointer' }}>지우기</button>
                            )}
                        </div>

                        <div className="overflow-x-auto" style={{ maxHeight: 640, overflowY: 'auto' }}>
                            <table className="ib-table" style={{ minWidth: 1100, fontSize: 'var(--ib-body)' }}>
                                <thead>
                                    <tr>
                                        {[['성적서번호(RI)', 'l'], ['품번', 'l'], ['측정 포인트', 'l'], ['구분', 'l'], ['기준', 'r'], ['공차', 'r'],
                                        ['X1', 'r'], ['X2', 'r'], ['X3', 'r'], ['X4', 'r'], ['X5', 'r'], ['판정', 'l']]
                                            .map(([h, a]) => (
                                                <th key={h} className={a === 'r' ? 'text-right' : 'text-left'} style={{ padding: '9px 12px' }}>{h}</th>
                                            ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {mRows.length === 0 ? (
                                        <tr><td colSpan={12} style={{ padding: '40px 12px', textAlign: 'center', color: 'var(--ib-ink4)' }}>조건에 맞는 기록이 없다</td></tr>
                                    ) : mRows.map((r, i) => {
                                        const ng = String(r.judgment || '').toUpperCase() === 'NG';
                                        const tu = r.tol_upper, tl = r.tol_lower;
                                        const tol = (tu === null || tu === undefined) && (tl === null || tl === undefined)
                                            ? '—'
                                            : `${Number(tu) >= 0 ? '+' : ''}${numOrDash(tu)} / ${Number(tl) >= 0 ? '+' : ''}${numOrDash(tl)}`;
                                        return (
                                            <tr key={r.content_hash || `${r.ri_no}-${r.source_row}-${i}`}>
                                                <td className="tabular-nums whitespace-nowrap" style={{ padding: '7px 12px', color: 'var(--ib-ink3)' }}>{txt(r.ri_no)}</td>
                                                <td className="tabular-nums whitespace-nowrap" style={{ padding: '7px 12px', color: 'var(--ib-ink3)' }}>{txt(r.part_no)}</td>
                                                <td className="whitespace-nowrap" style={{ padding: '7px 12px', color: 'var(--ib-ink)' }} title={r.item_name}>{txt(r.inspect_point)}</td>
                                                <td className="whitespace-nowrap" style={{ padding: '7px 12px', color: 'var(--ib-ink3)' }}>{txt(r.kind)}</td>
                                                <td className="text-right tabular-nums" style={{ padding: '7px 12px', color: 'var(--ib-ink)' }}>{numOrDash(r.nominal)}</td>
                                                <td className="text-right tabular-nums whitespace-nowrap" style={{ padding: '7px 12px', color: 'var(--ib-ink2)' }}>{tol}</td>
                                                {['x1', 'x2', 'x3', 'x4', 'x5'].map((k) => (
                                                    <td key={k} className="text-right tabular-nums" style={{ padding: '7px 12px', color: 'var(--ib-ink2)' }}>{numOrDash(r[k])}</td>
                                                ))}
                                                <td className="whitespace-nowrap" style={{ padding: '7px 12px' }}>
                                                    <Pill tone={ng ? TONE_NG : TONE_OK}>{txt(r.judgment)}</Pill>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div style={{ padding: '0 var(--ib-pad) var(--ib-pad)' }}>
                            <Pager page={mpage} total={measures.length} onPage={setMpage} unit="행" />
                            <div style={{ marginTop: 8, fontSize: 'calc(var(--ib-lbl)*.95)', color: 'var(--ib-ink4)', lineHeight: 1.5 }}>
                                공차는 기준값 대비 상·하 편차다. 규격 상한 = 기준 + max(상,하), 하한 = 기준 + min(상,하).
                                구분이 &lsquo;수치&rsquo;가 아니거나 기준·공차가 비어 있는 행은 공정능력 계산에서 제외된다.
                            </div>
                        </div>
                    </>
                )}
            </Card>

            {/* 등급 기준표 */}
            <Card delay={0.12} style={{ marginBottom: 16 }}>
                <SectionTitle title="공정능력 등급 기준" subtitle="신우밸브 공식 Cpk 기준 · 지수는 Ppk(전체 공정능력) 적용" />
                <div className="overflow-x-auto" style={{ marginTop: 12 }}>
                    <table className="ib-table" style={{ minWidth: 620, fontSize: 'var(--ib-body)' }}>
                        <thead>
                            <tr>
                                <th className="text-left" style={{ padding: '9px 12px', width: 110 }}>등급</th>
                                <th className="text-left" style={{ padding: '9px 12px', width: 190 }}>지수 범위</th>
                                <th className="text-left" style={{ padding: '9px 12px' }}>판정 · 조처</th>
                            </tr>
                        </thead>
                        <tbody>
                            {GRADE_TABLE.map(([g, range, act]) => {
                                const c = gradeColor(g);
                                return (
                                    <tr key={g}>
                                        <td style={{ padding: '9px 12px' }}>
                                            <span className="inline-flex items-center gap-1 rounded-full whitespace-nowrap"
                                                style={{ padding: '3px 9px', fontSize: 'calc(var(--ib-lbl)*.92)', fontWeight: 800, background: c.bg, color: c.text }}>
                                                <i className="rounded-sm" style={{ width: 6, height: 6, background: c.bar }} />{g}
                                            </span>
                                        </td>
                                        <td className="tabular-nums whitespace-nowrap" style={{ padding: '9px 12px', color: 'var(--ib-ink2)' }}>{range}</td>
                                        <td style={{ padding: '9px 12px', color: 'var(--ib-ink2)' }}>{act}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <div style={{ marginTop: 8, fontSize: 'calc(var(--ib-lbl)*.95)', color: 'var(--ib-ink4)' }}>등급 순서: {GRADE_ORDER5.join(' · ')}</div>
            </Card>

            {/* 정직 딱지 + 동기화 상태 */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <Card className="xl:col-span-2" delay={0.16}>
                    <SectionTitle title="정직 딱지 — 이 수치의 한계" subtitle="지금 화면이 못 하는 것을 먼저 적는다" />
                    <ul className="list-none p-0" style={{ margin: '10px 0 0', fontSize: 'var(--ib-lbl)', color: 'var(--ib-ink2)', lineHeight: 1.85 }}>
                        {HONEST.map((t, i) => (
                            <li key={i} className="relative" style={{ paddingLeft: 14 }}>
                                <span className="absolute left-0" style={{ color: 'var(--ib-ink4)' }}>·</span>{t}
                            </li>
                        ))}
                    </ul>
                </Card>

                <Card delay={0.20}>
                    <SectionTitle title="동기화 상태" subtitle="측정값 표의 synced_at 기준" />
                    <dl className="grid gap-x-3 gap-y-1.5" style={{ marginTop: 12, gridTemplateColumns: '1fr auto', fontSize: 'var(--ib-body)' }}>
                        <dt style={{ color: 'var(--ib-ink3)' }}>입고 대장</dt>
                        <dd className="text-right tabular-nums" style={{ fontWeight: 700, color: 'var(--ib-ink)' }}>{fmt(st.insp.length)}건</dd>
                        <dt style={{ color: 'var(--ib-ink3)' }}>측정값기록서</dt>
                        <dd className="text-right tabular-nums" style={{ fontWeight: 700, color: 'var(--ib-ink)' }}>{fmt(st.meas.length)}행</dd>
                        <dt style={{ color: 'var(--ib-ink3)' }}>마지막 동기화</dt>
                        <dd className="text-right" style={{ fontWeight: 700, color: 'var(--ib-ink)' }}>{synced ? String(synced).slice(0, 19).replace('T', ' ') : '기록 없음'}</dd>
                    </dl>
                    {!synced && (
                        <p style={{ marginTop: 10, fontSize: 'calc(var(--ib-lbl)*.95)', color: 'var(--ib-ink4)', lineHeight: 1.55 }}>
                            측정값기록서에 synced_at 이 채워진 행이 없다. 값을 지어내지 않고 &lsquo;기록 없음&rsquo;으로 둔다.
                        </p>
                    )}
                </Card>
            </div>
        </>
    );
};

export default InboundRecords;
