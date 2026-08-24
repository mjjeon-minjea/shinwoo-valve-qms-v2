import { useState, useEffect } from 'react';
import { Inbox, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import NCRDetail, { fetchNcrSettings, myTurnV101 } from './NCRDetail';
import { statusLabel } from '../lib/ncrFlow';

/* NCR 결재함 — Phase 2 + Phase 4(특채 판단·차석 허용)
   3분류: 내 차례(결재 가능 + 내 반려 문서) / 진행 중 / 완료 — 행 클릭 시 상세·결재 모달 */
/* I-① 상태 이름표: 이 맵의 키와 아래 PROGRESS_ST는 「저장값」 그대로다(색·분류 규칙 불변).
   화면에 찍는 글자만 statusLabel()로 갈아끼운다 — lib/ncrFlow.js 참조. */
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
    '발행': 'bg-blue-50 text-blue-700 border-blue-200',
    '특채 판단': 'bg-amber-100 text-amber-800 border-amber-300',
    '반려': 'bg-red-50 text-red-700 border-red-200'
};

/* v10.1 진행 중 상태군 (레거시 '발행'·'특채 판단' 포함) */
const PROGRESS_ST = ['발행승인 대기', '기술문의', '특채판단', '특채승인 대기', '회람중', '종합검토', '최종승인 대기', '처리중', '종결승인 대기', '무효승인 대기', '발행', '특채 판단'];

const NCRInbox = ({ user }) => {
    const [rows, setRows] = useState([]);
    const [tab, setTab] = useState('progress');
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);
    const [settings, setSettings] = useState(null); // ncr_settings — mount 시 1회

    useEffect(() => { fetchNcrSettings().then(setSettings); }, []);

    const load = async () => {
        setLoading(true);
        try {
            const res = await api.fetch('/ncr_reports');
            const d = await res.json();
            setRows((d || []).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')));
        } catch { setRows([]); }
        setLoading(false);
    };
    useEffect(() => { load(); }, []);

    const mine = r => r.author_email === user?.email;
    const groups = {
        my_turn: rows.filter(r => myTurnV101(user, r, settings)),
        progress: rows.filter(r => PROGRESS_ST.includes(r.status)),
        done: rows.filter(r => ['종결', '무효'].includes(r.status))
    };
    /* v10.2 G-⑧ — 「완료」 탭은 「내가 본 문서 중 끝난 것」 목록이므로 무효 문서도 그대로 둔다(차장 확정 08-22).
       다만 상세·인쇄가 「통계 제외」라고 말하는데 이 카운트에는 무효가 섞여 있어(F #72 실측)
       숫자를 그대로 통계로 옮기면 틀린다 — 무효가 몇 건 섞였는지 라벨에 따로 드러낸다. */
    const voidCount = groups.done.filter(r => r.status === '무효').length;
    const tabs = [
        { k: 'my_turn', label: `내 차례 (${groups.my_turn.length})` },
        { k: 'progress', label: `진행 중 (${groups.progress.length})` },
        { k: 'done', label: `완료 (${groups.done.length})`, sub: voidCount > 0 ? `무효 ${voidCount}` : '' }
    ];
    const list = groups[tab] || [];

    return (
        <div className="max-w-5xl">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-slate-800 flex items-center">
                    <Inbox className="mr-2 h-6 w-6 text-blue-600" /> NCR 결재함
                </h1>
                <button onClick={load} className="text-sm text-slate-500 hover:text-blue-600 flex items-center">
                    <RefreshCw className="w-4 h-4 mr-1" /> 새로고침
                </button>
            </div>

            <div className="flex gap-1.5 mb-4">
                {tabs.map(t => (
                    <button key={t.k} onClick={() => setTab(t.k)}
                        className={`px-4 py-2 text-sm font-semibold rounded-lg border transition-all ${tab === t.k ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'}`}>
                        {t.label}
                        {t.sub && (
                            <span className={`ml-1.5 px-1.5 py-0.5 text-[10px] font-bold rounded align-middle ${tab === t.k ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500 border border-slate-300'}`}>{t.sub}</span>
                        )}
                    </button>
                ))}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                            <th className="px-4 py-3 text-left font-semibold">NCR 번호</th>
                            <th className="px-4 py-3 text-left font-semibold">품명</th>
                            <th className="px-4 py-3 text-left font-semibold">업체</th>
                            <th className="px-4 py-3 text-right font-semibold">부적합수량</th>
                            <th className="px-4 py-3 text-center font-semibold">상태</th>
                            <th className="px-4 py-3 text-left font-semibold">작성자</th>
                            <th className="px-4 py-3 text-left font-semibold">발생일</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">불러오는 중...</td></tr>
                        ) : list.length === 0 ? (
                            <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">문서가 없습니다.</td></tr>
                        ) : list.map(r => (
                            <tr key={r.id} onClick={() => setSelected(r)}
                                className={`border-b border-slate-100 hover:bg-blue-50/40 cursor-pointer ${mine(r) ? 'bg-amber-50/30' : ''}`}>
                                <td className="px-4 py-3 font-mono font-semibold text-blue-700">{r.ncr_no}</td>
                                <td className="px-4 py-3 text-slate-800">{r.item_name}</td>
                                <td className="px-4 py-3 text-slate-600">{r.supplier}</td>
                                <td className="px-4 py-3 text-right font-semibold text-red-600">
                                    {r.qty_defect}{r.qty_total == null ? ' / 파악중' : ` / ${r.qty_total}`}
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <span className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-full border ${STATUS_BADGE[r.status] || STATUS_BADGE['작성중']}`}>{statusLabel(r.status)}</span>
                                </td>
                                <td className="px-4 py-3 text-slate-600">{r.author_name}{mine(r) && <span className="ml-1 text-xs text-amber-600 font-semibold">(나)</span>}</td>
                                <td className="px-4 py-3 text-slate-500">{r.occur_date}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <p className="mt-3 text-xs text-slate-400">행을 클릭하면 상세·결재 모달이 열립니다. 반려 문서는 작성자의 [내 차례]에 표시됩니다.</p>
            {/* G-⑧ — 무효는 시스템이 자동으로 빼주지 않는다. 어디서 걸러야 하는지를 숫자 옆에 적어 둔다. */}
            {tab === 'done' && voidCount > 0 && (
                <p className="mt-1 text-xs text-slate-400">완료 {groups.done.length}건에는 <b className="text-slate-500">무효 {voidCount}건</b>이 포함돼 있습니다 — 통계 집계 시에는 부적합 대장(CSV)의 「상태」 열에서 무효를 제외하십시오.</p>
            )}

            {selected && (
                <NCRDetail report={selected} user={user}
                    onClose={() => { setSelected(null); load(); }}
                    onChanged={load} />
            )}
        </div>
    );
};

export default NCRInbox;
