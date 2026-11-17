import { useState, useEffect } from 'react';
import { BookOpen, Download, Search } from 'lucide-react';
import { api } from '../lib/api';
import NCRDetail, { fetchNcrSettings, myTurnV101 } from './NCRDetail';
import { LegacyDetail } from './NCRLegacy';
import { pageList } from './inbound/ui.jsx';
import { mergeLedger, isPaper, inPeriod, ledgerYear } from '../lib/ncrLegacy';
import { concessionTypeLabel, costTotals, dispositionLabel, statusLabel } from '../lib/ncrFlow';
import { isNcrFinished, isNcrRelatedToUser } from '../lib/ncrRoles';
import * as XLSX from 'xlsx';

/* 부적합 대장 (FORM 933-08) — 탭 조회·검색·전수 엑셀·열람 전용 상세.
   새 보고서(ncr_reports)와 과거 종이 보고서(ncr_legacy)를 한 대장에서 본다. 종이 건은 「종이」 표시 · 종결된 종이는 완료/전체, 미종결 종이는 전체 탭에만 · 누르면 과거 상세. */
const THIS_YEAR = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 4);

const NCRLedger = ({ user, onProcess }) => {
    const [rows, setRows] = useState([]);
    const [q, setQ] = useState('');
    const [tab, setTab] = useState('mine');
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);
    const [year, setYear] = useState(THIS_YEAR);
    const [size, setSize] = useState(10);
    const [page, setPage] = useState(1);
    /* E영역 회귀 실측 — 배지 판정에 settings를 넘기지 않아 allow_deputy=false여도 차장에게 「내 차례」가 떴다.
       결재함(NCRInbox)·사이드바는 3개를 넘기는데 대장만 빠져 있었다. */
    const [settings, setSettings] = useState(null);
    const [loadErr, setLoadErr] = useState('');   // 조회 실패를 빈 목록으로 숨기지 않는다

    /* 두 표를 따로 받는다 — 과거 표를 못 읽어도 새 보고서 대장은 그대로 뜨되, 실패는 「불러오기 실패」로 알린다(null = 실패). */
    const get = (path) => api.fetch(path).then(r => r.json()).then(d => (Array.isArray(d) ? d : [])).catch(() => null);
    const load = () => {
        Promise.all([get('/ncr_reports'), get('/ncr_legacy')])
            .then(([reports, legacy]) => {
                setLoadErr([reports ? '' : '새 보고서', legacy ? '' : '과거 종이 보고서'].filter(Boolean).join('·'));
                setRows(mergeLedger(reports || [], legacy || []));
            })
            .finally(() => setLoading(false));
    };
    useEffect(() => { load(); fetchNcrSettings().then(setSettings).catch(() => setSettings(null)); }, []);

    /* I-① 상태 이름표 — 검색 대상에 「상태」를 넣는다.
       차장 요청: 사용자가 절차서 용어(「처리확인」·「회신완료」)로 대장을 찾을 수 있어야 한다.
       저장값(처리중·종합검토)도 같이 넣어 둔다 — 구 용어를 쓰던 사람도 그대로 찾을 수 있게(둘 다 통과). */
    const matchesQuery = r => !q.trim() ||
        [r.ncr_no, r.item_name, r.supplier, r.defect_desc, r.author_name, statusLabel(r.status), r.status]
            .join(' ').toLowerCase().includes(q.trim().toLowerCase());
    /* 기간(연도)은 완료·전체에만 건다 — 「내 진행중」은 작년에 시작한 건도 빠지면 안 된다. 종이 건은 결재가 없으니 완료 쪽. */
    const years = [...new Set(rows.map(ledgerYear).filter(Boolean))].sort().reverse();
    const periodRows = rows.filter(r => inPeriod(r, year));
    const mineRows = rows.filter(r => !isPaper(r) && !isNcrFinished(r) && isNcrRelatedToUser(user, r));
    const doneRows = periodRows.filter(isNcrFinished);   // 종이 줄 status 도 종결/미종결 — 미종결 종이(20-043 등)는 전체 탭에만
    const allFiltered = periodRows.filter(matchesQuery);
    const tabRows = tab === 'mine' ? mineRows : tab === 'done' ? doneRows : periodRows;
    const filtered = tabRows.filter(matchesQuery);
    const tabs = [
        { k: 'mine', label: `내 진행중 (${mineRows.length})` },
        { k: 'done', label: `완료 (${doneRows.length})` },
        { k: 'all', label: `전체 (${periodRows.length})` }
    ];
    useEffect(() => { setPage(1); }, [tab, q, year, size]);
    const last = Math.max(1, Math.ceil(filtered.length / size));
    const cur = Math.min(page, last);
    const shown = filtered.slice((cur - 1) * size, cur * size);
    const pbtn = (on) => `min-w-[30px] px-2 py-1 rounded-md text-xs font-semibold tabular-nums ${on ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'} disabled:opacity-40`;
    const codeName = (c) => (c ? `${c} ${settings?.codes?.[c] || ''}`.trim() : '');
    const ctLabel = (r) => (r.concession_type ? concessionTypeLabel(r.concession_type) + (r.paper_repair ? '(종이 수리)' : '') : '');

    /* B-20 — 처리방안이 폐기 ↔ 불채용(반송)으로 바뀐 문서는 대장에도 변경 전 값을 병기한다.
       단, 한 칸에 합쳐 넣으면 피벗·필터가 오염되므로 「처리방안변경」을 별도 열로 뺀다(값의 원자성 유지). */
    const dispCell = (r) => dispositionLabel(r.disposition);
    const dispChgCell = (r) => (r.disposition_prev ? `${dispositionLabel(r.disposition_prev)} → ${dispCell(r)}` : '');
    /* B-21 — 품질비용을 1차(처리방안 확정분)·2차(실제 처리 중 추가 발생분)로 나눠 함께 내보낸다.
       종결 전이라도 1차가 확정(cost_stage1)됐으면 대장에 나와야 한다 — 「최종승인 대기」·「처리중」 문서 누락 방지. */
    const costCells = (r) => {
        if (isPaper(r)) return [r.cost_total ?? '', '', ''];   // 종이는 품질비용 한 칸뿐
        const c = r.closed;
        if (!c) {
            const s1 = r.cost_stage1;
            if (!s1) return ['', '', ''];
            const t = Number(s1.total || 0);
            return [t, t, ''];
        }
        const total = Number(c.cost_total || 0);
        if (c.cost_stage1_total == null) return [total, '', ''];
        const s1 = Number(c.cost_stage1_total || 0);
        return [total, s1, total - s1];
    };

    /* 071 — 차장 요청(9/25): CSV 대신 엑셀(.xlsx). 범위는 CSV와 같음 = 탭과 상관없이 검색 결과 전체(066 결정). 수량·비용은 숫자 칸, 빈 값은 빈 칸. */
    const excel = () => {
        /* 기존 열 순서는 그대로 두고 뒤에만 붙인다(피벗·서식이 열 위치를 쓰고 있을 수 있다). */
        const head = ['NCR번호', '발생일', '업체', '품명', '도면번호', '전체수량', '부적합수량', '부적합내용', '처리방안', '처리방안변경', '특채유형', '상태', '작성자', '품질비용', '처리방안비용', '추가비용', '부적합코드', '출처', '종이 처리방안(원문)', '발견장소', '발견자', '고객/공사', '회수'];
        const data = allFiltered.map(r => [
            r.ncr_no, r.occur_date, r.supplier, r.item_name, r.drawing_no || '',
            r.qty_total == null ? (isPaper(r) ? '' : '파악중') : r.qty_total, /^\d+$/.test(String(r.qty_defect ?? '').trim()) ? Number(r.qty_defect) : r.qty_defect,
            r.defect_desc || '', dispCell(r), dispChgCell(r), ctLabel(r), statusLabel(r.status), r.author_name,
            ...costCells(r), codeName(r.code), isPaper(r) ? '종이' : 'QMS', r.paper_disposition || r.paper?.paper_disposition || '',   // 같은 번호로 합친 줄은 종이 원문이 r.paper 에
            ...['found_place', 'finder', 'customer_project'].map(k => r[k] || r.legacy?.[k] || r.paper?.legacy?.[k] || ''),
            isPaper(r) ? '' : r.closed ? (r.closed.recovery_total || 0) : r.cost_stage1 ? costTotals(r.cost_stage1.items).recovery : ''
        ].map(v => (v === '' ? null : v)));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([head, ...data]), '부적합대장');
        XLSX.writeFile(wb, `부적합대장_933-08_${new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })}.xlsx`);
    };

    return (
        <div className="max-w-6xl">
            <div className="flex items-center justify-between gap-2 mb-6">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center whitespace-nowrap">
                    <BookOpen className="mr-2 h-6 w-6 text-blue-600" /> 부적합 대장 <span className="ml-2 text-sm font-normal text-slate-400 hidden sm:inline">FORM 933-08</span>
                </h1>
                <button onClick={excel} className="px-3 sm:px-4 py-2 text-sm font-semibold rounded-lg bg-slate-700 text-white hover:bg-slate-800 flex items-center whitespace-nowrap shrink-0">
                    <Download className="w-4 h-4 mr-1.5" /> 엑셀 다운로드
                </button>
            </div>

            {loadErr && <div role="alert" className="mb-3 px-3 py-2 text-sm rounded-lg bg-red-50 border border-red-200 text-red-700">{loadErr} 불러오기 실패 — 목록이 빠져 있을 수 있습니다. 새로고침(F5) 해 주세요.</div>}
            <div className="flex gap-1.5 mb-4">
                {tabs.map(t => (
                    <button key={t.k} onClick={() => setTab(t.k)}
                        className={`px-4 py-2 text-sm font-semibold rounded-lg border transition-all ${tab === t.k ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'}`}>
                        {t.label}
                    </button>
                ))}
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
                <select value={year} onChange={e => setYear(e.target.value)} aria-label="기간" title="완료·전체 탭에 적용(내 진행중은 기간과 상관없이 전부)"
                    className="border border-slate-300 rounded-lg text-sm px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="all">전체 기간</option>
                    {[...new Set([THIS_YEAR, ...years])].sort().reverse().map(v => <option key={v} value={v}>{v}년</option>)}
                </select>
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder="번호·품명·업체·내용·작성자 검색"
                        className="w-full md:w-96 pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
                <table className="w-full text-sm whitespace-nowrap">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                            {['NCR 번호', '발생일', '업체', '품명', '부적합 코드', '수량(부적합/전체)', '처리방안', '처리방안변경', '상태', '작성자'].map(h =>
                                <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={10} className="px-4 py-10 text-left md:text-center text-slate-400">불러오는 중...</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan={10} className="px-4 py-10 text-left md:text-center text-slate-400">등록된 부적합보고서가 없습니다.</td></tr>
                        ) : shown.map(r => (
                            <tr key={r.id} onClick={() => setSelected(r)} className="border-b border-slate-100 hover:bg-blue-50/40 cursor-pointer">
                                <td className="px-4 py-3 font-mono font-semibold text-blue-700">{r.ncr_no}{isPaper(r) && <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-sans font-bold rounded bg-slate-100 text-slate-500 border border-slate-200" title="과거 종이 보고서">종이</span>}{r.paper && <button type="button" onClick={e => { e.stopPropagation(); setSelected(r.paper); }} className="ml-1.5 px-1.5 py-0.5 text-[10px] font-sans font-bold rounded bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100" title="같은 번호의 종이 보고서 원본(과거 상세) 보기">종이 원본</button>}</td>
                                <td className="px-4 py-3 text-slate-500">{r.occur_date}</td>
                                <td className="px-4 py-3 text-slate-600">{r.supplier}</td>
                                <td className="px-4 py-3 text-slate-800 max-w-[16rem] truncate">{r.item_name}</td>
                                <td className="px-4 py-3 text-slate-600" title={codeName(r.code)}>{r.code ? <><span className="font-mono font-semibold">{r.code}</span> <span className="text-xs text-slate-400">{settings?.codes?.[r.code] || ''}</span></> : '—'}</td>
                                <td className="px-4 py-3"><span className="text-red-600 font-semibold">{r.qty_defect}</span><span className="text-slate-400"> / {r.qty_total == null ? (isPaper(r) ? '—' : '파악중') : r.qty_total}</span></td>
                                <td className="px-4 py-3 text-slate-600" title={isPaper(r) ? `종이 원문: ${r.paper_disposition || '—'}` : undefined}>{dispCell(r) || '—'}{r.concession_type ? <span className="text-amber-700"> ({r.concession_type}{r.paper_repair ? '·종이' : ''})</span> : null}</td>
                                <td className="px-4 py-3 text-[11px] text-slate-400">{dispChgCell(r) || '—'}</td>
                                <td className="px-4 py-3 text-slate-600">{statusLabel(r.status)}{(() => { try { return !isPaper(r) && myTurnV101 && myTurnV101(user, r, settings) ? <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold rounded bg-red-500 text-white">내 차례</span> : null; } catch { return null; } })()}</td>
                                <td className="px-4 py-3 text-slate-600">{r.author_name || '—'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-slate-500">
                <span className="tabular-nums">{filtered.length === 0 ? '0건' : `${filtered.length}건 중 ${(cur - 1) * size + 1}–${Math.min(cur * size, filtered.length)}`}</span>
                <select value={size} onChange={e => setSize(Number(e.target.value))} aria-label="한 쪽에 보기" className="border border-slate-300 rounded-md text-xs px-2 py-1 bg-white">
                    <option value={10}>10개씩 보기</option>
                    <option value={50}>50개씩 보기</option>
                    <option value={100}>100개씩 보기</option>
                </select>
                <span className="flex-1" />
                {last > 1 && <>
                    <button type="button" onClick={() => setPage(cur - 1)} disabled={cur <= 1} aria-label="이전 쪽" className={pbtn(false)}>‹</button>
                    {pageList(cur, last).map((p, i) => (p === '…'
                        ? <span key={`d${i}`} className="px-0.5">…</span>
                        : <button key={p} type="button" onClick={() => setPage(p)} aria-current={p === cur ? 'page' : undefined} className={pbtn(p === cur)}>{p}</button>))}
                    <button type="button" onClick={() => setPage(cur + 1)} disabled={cur >= last} aria-label="다음 쪽" className={pbtn(false)}>›</button>
                </>}
            </div>
            <p className="mt-2 text-xs text-slate-400">현재 탭 {filtered.length}건 · {year === 'all' ? '전체 기간' : `${year}년`} {periodRows.length}건(새 보고서 {periodRows.filter(r => !isPaper(r)).length} · 종이 {periodRows.filter(isPaper).length}) · 전수 {rows.length}건 · 기간은 완료·전체 탭에 적용</p>

            {selected && isPaper(selected) && <LegacyDetail r={selected.legacy} onClose={() => setSelected(null)} />}
            {selected && !isPaper(selected) && (
                <NCRDetail report={selected} user={user}
                    readOnly
                    canProcess={myTurnV101(user, selected, settings)}
                    onProcess={(reportId) => { setSelected(null); onProcess?.(reportId); }}
                    onClose={() => setSelected(null)} />
            )}
        </div>
    );
};

export default NCRLedger;
