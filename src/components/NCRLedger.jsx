import { useState, useEffect } from 'react';
import { BookOpen, Download, Search } from 'lucide-react';
import { api } from '../lib/api';
import NCRDetail, { fetchNcrSettings, myTurnV101 } from './NCRDetail';
import { statusLabel } from '../lib/ncrFlow';

/* 부적합 대장 (FORM 933-08) — 전체 조회·검색·CSV.
   v10.2 D-10: 내 차례 문서는 이 화면에서도 결재 가능(결재함과 동일 동작, 차장 확정 08-21). */
const NCRLedger = ({ user }) => {
    const [rows, setRows] = useState([]);
    const [q, setQ] = useState('');
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);
    /* E영역 회귀 실측 — 배지 판정에 settings를 넘기지 않아 allow_deputy=false여도 차장에게 「내 차례」가 떴다.
       결재함(NCRInbox)·사이드바는 3개를 넘기는데 대장만 빠져 있었다. */
    const [settings, setSettings] = useState(null);

    const load = () => {
        api.fetch('/ncr_reports')
            .then(r => r.json())
            .then(d => setRows((d || []).sort((a, b) => (a.ncr_no || '').localeCompare(b.ncr_no || ''))))
            .catch(() => setRows([]))
            .finally(() => setLoading(false));
    };
    useEffect(() => { load(); fetchNcrSettings().then(setSettings).catch(() => setSettings(null)); }, []);

    /* I-① 상태 이름표 — 검색 대상에 「상태」를 넣는다.
       차장 요청: 사용자가 절차서 용어(「처리확인」·「회신완료」)로 대장을 찾을 수 있어야 한다.
       저장값(처리중·종합검토)도 같이 넣어 둔다 — 구 용어를 쓰던 사람도 그대로 찾을 수 있게(둘 다 통과). */
    const filtered = rows.filter(r =>
        !q.trim() || [r.ncr_no, r.item_name, r.supplier, r.defect_desc, r.author_name, statusLabel(r.status), r.status].join(' ').toLowerCase().includes(q.toLowerCase())
    );

    /* B-20 — 처리방안이 폐기 ↔ 불채용(반송)으로 바뀐 문서는 대장에도 변경 전 값을 병기한다.
       단, 한 칸에 합쳐 넣으면 피벗·필터가 오염되므로 「처리방안변경」을 별도 열로 뺀다(값의 원자성 유지). */
    const dispCell = (r) => r.disposition || '';
    const dispChgCell = (r) => (r.disposition_prev ? `${r.disposition_prev} → ${r.disposition || ''}` : '');
    /* B-21 — 품질비용을 1차(처리방안 확정분)·2차(실제 처리 중 추가 발생분)로 나눠 함께 내보낸다.
       종결 전이라도 1차가 확정(cost_stage1)됐으면 대장에 나와야 한다 — 「최종승인 대기」·「처리중」 문서 누락 방지. */
    const costCells = (r) => {
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

    const csv = () => {
        const head = ['NCR번호', '발생일', '업체', '품명', '도면번호', '전체수량', '부적합수량', '부적합내용', '처리방안', '처리방안변경', '특채유형', '상태', '작성자', '품질비용', '처리방안비용', '추가비용'];
        const lines = filtered.map(r => [
            r.ncr_no, r.occur_date, r.supplier, r.item_name, r.drawing_no || '',
            r.qty_total == null ? '파악중' : r.qty_total, r.qty_defect,
            (r.defect_desc || '').replace(/[\r\n,]/g, ' '), dispCell(r), dispChgCell(r), r.concession_type || '', statusLabel(r.status), r.author_name,
            ...costCells(r)
        ].map(v => { const t = String(v ?? ''); return /[",\r\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; }).join(','));
        const blob = new Blob(['﻿' + [head.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `부적합대장_933-08_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    return (
        <div className="max-w-6xl">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-slate-800 flex items-center">
                    <BookOpen className="mr-2 h-6 w-6 text-blue-600" /> 부적합 대장 <span className="ml-2 text-sm font-normal text-slate-400">FORM 933-08</span>
                </h1>
                <button onClick={csv} className="px-4 py-2 text-sm font-semibold rounded-lg bg-slate-700 text-white hover:bg-slate-800 flex items-center">
                    <Download className="w-4 h-4 mr-1.5" /> CSV 다운로드
                </button>
            </div>

            <div className="relative mb-4">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="번호·품명·업체·내용·작성자 검색"
                    className="w-full md:w-96 pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
                <table className="w-full text-sm whitespace-nowrap">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                            {['NCR 번호', '발생일', '업체', '품명', '수량(부적합/전체)', '처리방안', '처리방안변경', '상태', '작성자'].map(h =>
                                <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-400">불러오는 중...</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-400">등록된 부적합보고서가 없습니다.</td></tr>
                        ) : filtered.map(r => (
                            <tr key={r.id} onClick={() => setSelected(r)} className="border-b border-slate-100 hover:bg-blue-50/40 cursor-pointer">
                                <td className="px-4 py-3 font-mono font-semibold text-blue-700">{r.ncr_no}</td>
                                <td className="px-4 py-3 text-slate-500">{r.occur_date}</td>
                                <td className="px-4 py-3 text-slate-600">{r.supplier}</td>
                                <td className="px-4 py-3 text-slate-800 max-w-[16rem] truncate">{r.item_name}</td>
                                <td className="px-4 py-3"><span className="text-red-600 font-semibold">{r.qty_defect}</span><span className="text-slate-400"> / {r.qty_total == null ? '파악중' : r.qty_total}</span></td>
                                <td className="px-4 py-3 text-slate-600">{r.disposition || '—'}{r.concession_type ? <span className="text-amber-700"> ({r.concession_type})</span> : null}</td>
                                <td className="px-4 py-3 text-[11px] text-slate-400">{dispChgCell(r) || '—'}</td>
                                <td className="px-4 py-3 text-slate-600">{statusLabel(r.status)}{(() => { try { return myTurnV101 && myTurnV101(user, r, settings) ? <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold rounded bg-red-500 text-white">내 차례</span> : null; } catch { return null; } })()}</td>
                                <td className="px-4 py-3 text-slate-600">{r.author_name}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <p className="mt-3 text-xs text-slate-400">총 {filtered.length}건 표시 중 (전체 {rows.length}건)</p>

            {selected && (
                <NCRDetail report={selected} user={user}
                    onClose={() => { setSelected(null); load(); }}
                    onChanged={load} />
            )}
        </div>
    );
};

export default NCRLedger;
