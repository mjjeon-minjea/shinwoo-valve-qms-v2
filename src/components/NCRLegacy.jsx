import { useState, useEffect } from 'react';
import { Archive, Search, X, Download } from 'lucide-react';
import { api } from '../lib/api';
import { signAtt } from '../lib/attach.jsx';
import { LEGACY_DISPOSITIONS, matchLegacy, excelCols, fmtCost, makeZip } from '../lib/ncrLegacy';
import { pageList } from './inbound/ui.jsx';

/* 과거 부적합 조회 — 종이 부적합보고서(원본 PDF)와 대조해 정리한 값. 보기 전용(고치기·지우기 없음).
   표 ncr_legacy · 원본 PDF 는 qms-files 버킷 ncr-legacy/<연도>/<번호>.pdf. 모양은 「부적합 대장」(NCRLedger)과 같게. */
const FIELDS = [
    ['발행일', 'issue_date'], ['고객/공사', 'customer_project'], ['도면번호', 'drawing_no'], ['발견자', 'finder'], ['발견장소', 'found_place'],
    ['원인제공처(업체)', 'supplier'], ['제품', 'product'], ['부품', 'part'], ['규격', 'spec'], ['부적합수량', 'qty_defect'],
    ['처리방안', 'disposition'], ['품질비용', 'quality_cost'], ['완료일', 'done_date']
];
/* 목록 칸 [제목, 기본 너비(px), 칸 그리기]. 너비는 제목 칸 오른쪽 경계를 끌어 바꾼다(이 PC 브라우저에만 기억). */
const COLS = [
    ['번호', 75, r => <span className="font-mono font-semibold text-blue-700">{r.ncr_no}</span>],
    ['발행일', 108, r => <span className="text-slate-500">{r.issue_date}</span>],
    ['제품', 110, r => <span className="text-slate-800">{r.product}</span>],
    ['부품', 100, r => <span className="text-slate-600">{r.part}</span>],
    ['규격', 115, r => <span className="text-slate-600">{r.spec}</span>],
    ['수량', 60, r => <span className="text-red-600 font-semibold">{r.qty_defect}</span>],
    ['업체', 95, r => <span className="text-slate-600">{r.supplier}</span>],
    ['부적합내용', 110, r => <span className="text-slate-700">{r.defect_desc}</span>],
    ['처리방안', 105, r => <span className="text-slate-600">{r.disposition || '—'}</span>],
    ['품질비용', 110, r => <span className="text-slate-700">{fmtCost(r.quality_cost) || '—'}</span>],
    ['완료', 65, r => <ClosedBadge closed={r.closed} />],
];
const MAX_DL = 50;   // 선택 다운로드 한 번 최대 개수(D4)
const W_KEY = 'ncr_legacy_colw4';   // 4 = 품질비용 7자리(1,964,500원)가 다 보이게 넓힌 판
const pdfName = (r) => `${r.ncr_no}_${String(r.product || '').replace(/[\\/:*?"<>|\s]+/g, '_')}.pdf`.replace(/_\.pdf$/, '.pdf');
const saveBlob = (blob, name) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};
const loadW = () => {
    try { const s = JSON.parse(localStorage.getItem(W_KEY)); if (Array.isArray(s) && s.length === COLS.length) return s; } catch { /* 저장소 막힘 → 기본 너비 */ }
    return COLS.map(c => c[1]);
};

const ClosedBadge = ({ closed }) => (closed
    ? <span className="inline-block px-2 py-0.5 text-[11px] font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">종결</span>
    : <span className="inline-block px-2 py-0.5 text-[11px] font-semibold rounded-full bg-amber-50 text-amber-700 border border-amber-200">미종결</span>);
const ExcelTag = () => <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-100 text-amber-800">엑셀값</span>;

/* 부적합 대장(NCRLedger)에서도 종이 건을 누르면 이 창을 연다. */
export const LegacyDetail = ({ r, onClose }) => {
    const [url, setUrl] = useState(null);
    const [codes, setCodes] = useState({});
    useEffect(() => { signAtt(r.pdf_path).then(setUrl); }, [r.pdf_path]);
    useEffect(() => {   // 부적합 코드 이름(ncr_settings.codes) — 못 읽으면 코드만 보인다
        api.fetch('/ncr_settings').then(x => x.json()).then(d => setCodes((Array.isArray(d) ? d : []).find(x => x.id === 'codes')?.map || {})).catch(() => {});
    }, []);
    /* 새 보고서 기준 값 — 종이 원문을 새 보고서와 같은 말로 바꾼 칸(tools_v2/map_legacy.py). 판단이 들어간 건 map_note 에 근거 */
    const NEW = [
        ['부적합 코드', r.code ? `${r.code} ${codes[r.code] || ''}`.trim() : ''],
        ['표준 처리방안', [r.disposition_std, r.concession_type].filter(Boolean).join(' · ') + (r.paper_repair ? ' (종이 「수리」)' : '')],
        ['업체 코드', r.supplier_code || (r.supplier_group && r.supplier_group !== '협력업체' ? r.supplier_group : '')],
        ['제품 분류', r.item_cls],
    ];
    const ex = excelCols(r.value_note);
    const val = (k) => (k === 'quality_cost' ? fmtCost(r[k]) : r[k]) || '—';
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-3xl max-h-[88vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
                    <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-blue-700">{r.ncr_no}</span>
                        <ClosedBadge closed={r.closed} />
                        <span className="inline-block px-2 py-0.5 text-[10px] rounded-full bg-slate-100 text-slate-500 border border-slate-200">종이 보고서 · {r.year}</span>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-6 space-y-5">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
                        {FIELDS.map(([label, k]) => (
                            <div key={k}><div className="text-xs text-slate-400 mb-0.5">{label}{ex.includes(label) && <ExcelTag />}</div>
                                <div className="font-medium text-slate-700 break-words">{val(k)}</div></div>
                        ))}
                        <div><div className="text-xs text-slate-400 mb-0.5">종결</div><div className="font-medium text-slate-700">{r.closed ? '종결' : '미종결'}</div></div>
                    </div>
                    <div>
                        <div className="text-xs text-slate-400 mb-1.5">새 보고서 기준 값</div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 text-sm rounded-lg border border-blue-100 bg-blue-50/40 px-4 py-3">
                            {NEW.map(([label, v]) => (
                                <div key={label}><div className="text-xs text-slate-400 mb-0.5">{label}</div><div className="font-medium text-slate-700 break-words">{v || '—'}</div></div>
                            ))}
                        </div>
                        {r.map_note && <div className="text-[11px] text-slate-500 mt-1">바꾼 근거 — {r.map_note}</div>}
                    </div>
                    <div>
                        <div className="text-xs text-slate-400 mb-1">부적합 내용{ex.includes('부적합내용') && <ExcelTag />}</div>
                        <div className="text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 whitespace-pre-wrap">{r.defect_desc || '—'}</div>
                    </div>
                    {r.value_note && (
                        <div className="text-xs px-4 py-2.5 rounded-lg bg-slate-50 text-slate-600 border border-slate-200">
                            값 메모 — {r.value_note}
                            {ex.length > 0 && <span className="block text-[11px] text-slate-500 mt-0.5"><b>엑셀값</b> 표시 칸은 원본 PDF에서 읽을 수 없어 부적합 관리대장(엑셀) 값을 넣은 칸입니다.</span>}
                        </div>
                    )}
                    <div>
                        <div className="text-xs text-slate-400 mb-1">원본 PDF</div>
                        {/* 첨부 보기(NCRDetail AttView)와 같은 방식 — 이름 링크(새 탭) + 화면 안 PDF(details·iframe). 주소가 비면 iframe 을 그리지 않는다 */}
                        {url ? (
                            <div>
                                <a href={url} target="_blank" rel="noreferrer" className="block text-[11px] text-blue-600 hover:underline font-mono truncate">{r.ncr_no}.pdf</a>
                                <details className="mt-1"><summary className="text-[11px] text-slate-500 cursor-pointer select-none">원본 PDF 보기</summary>
                                    <iframe src={`${url}#toolbar=0&navpanes=0&view=FitH`} title={`${r.ncr_no}.pdf`} className="w-full rounded border border-slate-200 bg-white" style={{ height: '70vh', minHeight: 480 }} /></details>
                            </div>
                        ) : <div className="text-[11px] text-slate-400">{url === null ? 'PDF 주소를 받는 중...' : '원본 PDF를 찾지 못했습니다.'}</div>}
                    </div>
                </div>
            </div>
        </div>
    );
};

const NCRLegacy = () => {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [year, setYear] = useState(null);
    const [q, setQ] = useState('');
    const [disp, setDisp] = useState('');
    const [selected, setSelected] = useState(null);
    const [size, setSize] = useState(10);
    const [page, setPage] = useState(1);
    const [w, setW] = useState(loadW);
    const [sel, setSel] = useState(() => new Set());
    const [busy, setBusy] = useState('');
    const [msg, setMsg] = useState('');   // 「⚠」로 시작하면 빨간 안내
    const [loadErr, setLoadErr] = useState(false);   // 조회 실패를 「없음」으로 숨기지 않는다
    // 사람이 끌거나 되돌렸을 때만 기억한다(처음 열 때 기본값을 저장해 두면 나중에 기본 너비를 고쳐도 안 바뀐다)
    const keepW = (v) => { try { localStorage.setItem(W_KEY, JSON.stringify(v)); } catch { /* 기억 못 해도 화면은 그대로 */ } return v; };
    useEffect(() => { setPage(1); }, [year, q, disp, size]);
    const drag = (i) => (e) => {
        e.preventDefault(); e.stopPropagation();
        const x0 = e.clientX, w0 = w[i];
        const move = (ev) => setW(p => keepW(p.map((v, j) => (j === i ? Math.max(48, w0 + ev.clientX - x0) : v))));
        const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
        window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    };
    /* 선택 다운로드 — 1개는 PDF 그대로, 2개 이상은 zip 하나. 못 받은 건 번호를 알려 준다(조용히 빠지지 않게).
       한 번에 최대 MAX_DL개 — 쪽을 넘겨 고른 것까지 합친 누적 선택 기준(브라우저 메모리에 zip 을 통째로 만든다). */
    const download = async () => {
        if (sel.size > MAX_DL) return setMsg(`⚠ 한 번에 최대 ${MAX_DL}개까지 받을 수 있습니다 — 지금 ${sel.size}개 선택(다른 쪽 포함). 선택을 줄여 주세요.`);
        const list = rows.filter(r => sel.has(r.id)).sort((a, b) => a.ncr_no.localeCompare(b.ncr_no));
        const got = [], miss = [];
        setMsg('');
        for (const [i, r] of list.entries()) {
            setBusy(`${i + 1}/${list.length}`);
            try {
                const u = await signAtt(r.pdf_path);
                const res = u ? await fetch(u) : null;
                if (!res?.ok) throw new Error();
                got.push({ name: pdfName(r), data: new Uint8Array(await res.arrayBuffer()) });
            } catch { miss.push(r.ncr_no); }
        }
        setBusy('');
        if (list.length === 1 && got.length === 1) saveBlob(new Blob([got[0].data], { type: 'application/pdf' }), got[0].name);
        else if (got.length) saveBlob(new Blob([makeZip(got)], { type: 'application/zip' }), `과거부적합_원본PDF_${got.length}건${miss.length ? `(${list.length}건 중 일부)` : ''}.zip`);
        setMsg(miss.length ? `⚠ ${list.length}개 중 ${got.length}개 받음 · 실패 ${miss.length}개(${miss.join(', ')})` : `${got.length}건 다운로드 완료`);
    };
    const toggle = (ids, on) => setSel(p => { const n = new Set(p); ids.forEach(id => (on ? n.add(id) : n.delete(id))); return n; });
    const resetW = (i) => setW(p => keepW(p.map((v, j) => (j === i ? COLS[i][1] : v))));

    useEffect(() => {
        api.fetch('/ncr_legacy')
            .then(r => r.json())
            .then(d => setRows((d || []).sort((a, b) => (b.issue_date || '').localeCompare(a.issue_date || '') || (b.ncr_no || '').localeCompare(a.ncr_no || '', 'ko', { numeric: true }))))   // 최신순 — 대장과 같게
            .catch(() => { setRows([]); setLoadErr(true); })
            .finally(() => setLoading(false));
    }, []);

    const years = [...new Set(rows.map(r => r.year))].sort((a, b) => b - a);
    const y = year ?? years[0];
    const all = y === 'all';
    const yLabel = all ? `${years[years.length - 1]}~${years[0]}` : y;
    const yearRows = all ? rows : rows.filter(r => r.year === y);
    const filtered = yearRows.filter(r => matchLegacy(r, q, disp));
    const last = Math.max(1, Math.ceil(filtered.length / size));
    const cur = Math.min(page, last);
    const shown = filtered.slice((cur - 1) * size, cur * size);
    const pbtn = (on) => `min-w-[30px] px-2 py-1 rounded-md text-xs font-semibold tabular-nums ${on ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'} disabled:opacity-40`;
    const ctl = 'border border-slate-300 rounded-lg text-sm px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';

    return (
        <div className="max-w-6xl">
            <div className="flex items-center justify-between mb-3">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center whitespace-nowrap">
                    <Archive className="mr-2 h-6 w-6 text-blue-600" /> 과거 부적합 조회 <span className="ml-2 text-sm font-normal text-slate-400 hidden sm:inline">종이 보고서 · 보기 전용</span>
                </h1>
            </div>
            <div className="text-sm px-4 py-2.5 mb-4 rounded-lg bg-blue-50 text-blue-800 border border-blue-200">
                종이 부적합보고서({yLabel || 2025}년) 원본 PDF와 대조해 정리한 값입니다. 정확한 내용은 원본 PDF를 확인하세요.
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
                <select value={y ?? ''} onChange={e => setYear(e.target.value === 'all' ? 'all' : Number(e.target.value))} className={ctl} aria-label="연도">
                    <option value="all">전체 기간</option>
                    {years.map(v => <option key={v} value={v}>{v}년</option>)}
                </select>
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder="번호·제품·업체·내용·도면번호 검색"
                        className="w-full md:w-96 pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <select value={disp} onChange={e => setDisp(e.target.value)} className={ctl} aria-label="처리방안">
                    <option value="">처리방안 전체</option>
                    {LEGACY_DISPOSITIONS.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
                <button type="button" onClick={download} disabled={sel.size === 0 || !!busy}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400">
                    <Download className="w-4 h-4" />{busy ? `받는 중 ${busy}` : `선택 다운로드${sel.size ? ` (${sel.size})` : ''}`}
                </button>
                {sel.size > 0 && !busy && <button type="button" onClick={() => setSel(new Set())} className="px-2 text-sm text-slate-500 hover:text-slate-700 underline">선택 해제</button>}
                {msg && <span className={`self-center text-xs ${msg.startsWith('⚠') ? 'text-red-600' : 'text-emerald-700'}`}>{msg}</span>}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200">
                <div className="overflow-x-auto">
                    <table className="text-sm whitespace-nowrap" style={{ tableLayout: 'fixed', width: 36 + w.reduce((a, b) => a + b, 0) }}>
                        <colgroup><col style={{ width: 36 }} />{w.map((px, i) => <col key={i} style={{ width: px }} />)}</colgroup>
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                                <th className="pl-3 py-3"><input type="checkbox" aria-label="이 쪽 전체 선택" className="cursor-pointer"
                                    checked={shown.length > 0 && shown.every(r => sel.has(r.id))}
                                    onChange={e => toggle(shown.map(r => r.id), e.target.checked)} /></th>
                                {COLS.map(([h], i) => (
                                    <th key={h} className={`relative px-3 py-3 font-semibold overflow-hidden text-ellipsis ${h === '품질비용' ? 'text-right' : 'text-left'}`}>
                                        {h}
                                        <span onPointerDown={drag(i)} onDoubleClick={() => resetW(i)} title="끌어서 너비 조절 · 두 번 누르면 원래대로"
                                            className="absolute right-0 top-0 h-full w-2 cursor-col-resize border-r border-slate-200 hover:bg-blue-300/60 touch-none" />
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={COLS.length + 1} className="px-4 py-10 text-slate-400">불러오는 중...</td></tr>
                            ) : loadErr ? (
                                <tr><td colSpan={COLS.length + 1} role="alert" className="px-4 py-10 text-red-600">불러오기 실패 — 새로고침(F5) 해 주세요.</td></tr>
                            ) : shown.length === 0 ? (
                                <tr><td colSpan={COLS.length + 1} className="px-4 py-10 text-slate-400">조건에 맞는 보고서가 없습니다.</td></tr>
                            ) : shown.map(r => (
                                <tr key={r.id} onClick={() => setSelected(r)} className={`border-b border-slate-100 hover:bg-blue-50/40 cursor-pointer ${sel.has(r.id) ? 'bg-blue-50/60' : ''}`}>
                                    <td className="pl-3 py-2.5" onClick={e => { e.stopPropagation(); toggle([r.id], !sel.has(r.id)); }}>
                                        <input type="checkbox" aria-label={`${r.ncr_no} 선택`} className="cursor-pointer" checked={sel.has(r.id)} readOnly />
                                    </td>
                                    {COLS.map(([h, , cell]) => (
                                        <td key={h} title={h === '완료' ? undefined : String(cell(r).props.children ?? '')}
                                            className={`px-3 py-2.5 overflow-hidden text-ellipsis ${h === '품질비용' ? 'text-right' : ''}`}>{cell(r)}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-t border-slate-200 text-xs text-slate-500">
                    <span className="tabular-nums">
                        {filtered.length === 0 ? '0건' : `${filtered.length}건 중 ${(cur - 1) * size + 1}–${Math.min(cur * size, filtered.length)}`}
                        {filtered.length !== yearRows.length && ` (${all ? '전체 기간' : `${y}년 전체`} ${yearRows.length}건)`}
                    </span>
                    <select value={size} onChange={e => setSize(Number(e.target.value))} aria-label="한 쪽에 보기"
                        className="border border-slate-300 rounded-md text-xs px-2 py-1 bg-white">
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
            </div>
            <p className="mt-2 text-[11px] text-slate-400">왼쪽 칸을 체크해 「선택 다운로드」 — 1건은 PDF, 2건 이상은 zip 하나로 받습니다(한 번에 최대 {MAX_DL}건) · 제목 칸 오른쪽 경계를 끌면 열 너비 조절(두 번 누르면 원래대로)</p>

            {selected && <LegacyDetail r={selected} onClose={() => setSelected(null)} />}
        </div>
    );
};

export default NCRLegacy;
