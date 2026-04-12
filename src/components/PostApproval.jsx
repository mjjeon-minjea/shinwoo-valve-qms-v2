import React, { useState, useEffect } from 'react';
import { Settings, CheckCircle, Clock, Hash, XCircle, Eye, Cloud } from 'lucide-react';
import { api, supabase } from '../lib/api';

// ✅ 시맨틱 버전(vX.Y.Z) 정렬용 헬퍼 함수
const compareVersions = (a, b) => {
    const parse = (v) => (v || 'v0.0.0').replace(/[^\d.]/g, '').split('.').map(Number);
    const [ma, mia, pa] = parse(a.version);
    const [mb, mib, pb] = parse(b.version);
    
    if (ma !== mb) return mb - ma;
    if (mia !== mib) return mib - mia;
    if (pa !== pb) return pb - pa;
    
    return new Date(b.created_at || b.date) - new Date(a.created_at || a.date);
};

const PostApproval = ({ user }) => {
    const [drafts, setDrafts] = useState([]);
    const [published, setPublished] = useState([]);
    const [viewMode, setViewMode] = useState('pending');
    const [selectedNote, setSelectedNote] = useState(null);
    const [loading, setLoading] = useState(false);

    const loadData = async () => {
        try {
            let data;
            // ✅ 하이브리드 로직: 실서버(Vercel)는 Supabase에서, 로컬(개발환경)은 db.json에서
            if (import.meta.env.DEV) {
                const res = await fetch('http://localhost:3001/dev_notes');
                if (!res.ok) throw new Error('네트워크 응답이 올바르지 않습니다.');
                data = await res.json();
            } else {
                const res = await api.fetch('/dev_notes');
                if (!res.ok) throw new Error('Supabase 응답 에러');
                data = await res.json();
            }

            const all = (data || []).sort(compareVersions);
            setDrafts(all.filter(n => !n.status || n.status === 'draft' || n.status === 'rejected'));
            setPublished(all.filter(n => n.status === 'published'));
        } catch (err) {
            console.error('데이터 로드 실패:', err);
        }
    };

    useEffect(() => { loadData(); }, []);

    // ✅ 차장님 승인 → 로컬 DB 상태 변경
    const handleApprove = async (id) => {
        if (!import.meta.env.DEV) {
            alert('승인 및 시스템 관리 권한은 로컬 인트라넷(localhost) 환경에서만 수행 가능합니다.');
            return;
        }
        if (!window.confirm('이 개발자 노트를 승인하여 로컬 게시판에 공개하시겠습니까?')) return;
        setLoading(true);
        try {
            const res = await fetch(`http://localhost:3001/dev_notes/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'published',
                    date: new Date().toLocaleString('ko-KR', { 
                        year: 'numeric', month: '2-digit', day: '2-digit', 
                        hour: '2-digit', minute: '2-digit', hour12: false 
                    }).replace(/\. /g, '-').replace(/\./g, '')
                })
            });

            if (!res.ok) throw new Error('로컬 DB 반영 실패');
            alert('✅ 로컬 승인 완료! 로컬 개발자 노트 게시판에서 확인 가능합니다.');
            setSelectedNote(null);
            await loadData();
        } catch (err) {
            alert('승인 실패: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // ✅ 실서버(Supabase)로 데이터 전송 (Sync to Cloud)
    const handleCloudSync = async (note) => {
        if (!import.meta.env.DEV) {
            alert('클라우드 자동 동기화는 로컬 인트라넷(localhost) 시스템 서버에서만 실행 가능합니다.');
            return;
        }
        if (!window.confirm('이 개발자 노트를 실서버(Supabase) 게시판에 즉시 배포하시겠습니까?')) return;
        setLoading(true);
        try {
            // 1. Supabase 전송용 객체 정제 (local id 제외)
            const { id: localId, ...syncData } = note; 
            
            // 2. Supabase upsert
            const { error: syncErr } = await supabase
                .from('dev_notes')
                .upsert([{
                    ...syncData,
                    created_at: new Date().toISOString()
                }], { onConflict: 'title' });

            if (syncErr) throw syncErr;

            // 3. 로컬 DB에 동기화 완료 상태 업데이트
            const res = await fetch(`http://localhost:3001/dev_notes/${note.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_synced: true })
            });

            if (!res.ok) throw new Error('로컬 동기화 플래그 업데이트 실패');

            alert('🚀 실서버 배포 성공! 이제 모든 직원이 실서버에서 확인 가능합니다.');
            await loadData();
        } catch (err) {
            console.error('클라우드 전송 실패:', err);
            alert('배포 실패: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleReject = async (id) => {
        const reason = window.prompt('반려 사유를 입력하세요:');
        if (!reason) return;
        setLoading(true);
        try {
            const target = [...drafts, ...published].find(d => d.id === id);
            const res = await fetch(`http://localhost:3001/dev_notes/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'rejected',
                    content: `### 🚫 반려됨 - 재작업 필요\n**사유: ${reason}**\n\n---\n\n${target?.content || ''}`
                })
            });

            if (!res.ok) throw new Error('로컬 DB 반영 실패');
            alert('반려 처리가 완료되었습니다.');
            setSelectedNote(null);
            await loadData();
        } catch (err) {
            alert('반려 실패: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const currentList = viewMode === 'pending' ? drafts : published;

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center">
                        <Settings className="w-6 h-6 mr-2 text-primary-600" />
                        개발자 노트 승인 및 배포 관리
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        로컬에서 검증하고, 승인된 노트를 실서버(Supabase)로 배포합니다.
                    </p>
                </div>
                <div className="flex gap-3">
                    <span className="bg-amber-50 text-amber-700 text-sm font-semibold px-3 py-1.5 rounded-full border border-amber-200">
                        ⏳ 검토 {drafts.length}건
                    </span>
                    <span className="bg-emerald-50 text-emerald-700 text-sm font-semibold px-3 py-1.5 rounded-full border border-emerald-200">
                        ✅ 완료 {published.length}건
                    </span>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="border-b border-slate-200 bg-slate-50">
                    <div className="flex gap-6 px-6 pt-4">
                        <button
                            onClick={() => setViewMode('pending')}
                            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                                viewMode === 'pending'
                                    ? 'border-amber-500 text-amber-700'
                                    : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            ⏳ 승인 대기열 ({drafts.length})
                        </button>
                        <button
                            onClick={() => setViewMode('published')}
                            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                                viewMode === 'published'
                                    ? 'border-emerald-500 text-emerald-700'
                                    : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            🚀 배포 관리 ({published.length})
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full whitespace-nowrap">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 w-28">버전</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500">제목</th>
                                <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 w-28">담당자</th>
                                <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 w-32">작성일</th>
                                <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 w-44">액션</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {currentList.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-slate-400">
                                        표시할 항목이 없습니다.
                                    </td>
                                </tr>
                            ) : (
                                currentList.map((item) => (
                                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center text-primary-700 bg-primary-50 text-xs font-bold px-2 py-1 rounded">
                                                <Hash className="w-3 h-3 mr-0.5" />
                                                {item.version || 'v0.0.0'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 font-medium text-slate-800 text-sm truncate max-w-sm">
                                            {item.title}
                                        </td>
                                        <td className="px-6 py-4 text-center text-sm text-slate-600">
                                            {item.author || 'AI'}
                                        </td>
                                        <td className="px-6 py-4 text-center text-sm text-slate-500">
                                            {item.date || '-'}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex items-center justify-center gap-1.5">
                                                <button
                                                    onClick={() => setSelectedNote(item)}
                                                    className="inline-flex items-center px-2 py-1 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded text-xs font-medium"
                                                >
                                                    <Eye className="w-3 h-3 mr-1" /> 보기
                                                </button>
                                                {viewMode === 'pending' ? (
                                                    <>
                                                        <button
                                                            onClick={() => handleApprove(item.id)}
                                                            className="px-2 py-1 bg-emerald-500 text-white rounded text-xs"
                                                        >
                                                            승인
                                                        </button>
                                                        <button
                                                            onClick={() => handleReject(item.id)}
                                                            className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs"
                                                        >
                                                            반려
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button
                                                        onClick={() => handleCloudSync(item)}
                                                        disabled={item.is_synced}
                                                        className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                                                            item.is_synced 
                                                            ? 'bg-slate-100 text-slate-400' 
                                                            : 'bg-primary-600 text-white hover:bg-primary-700'
                                                        }`}
                                                    >
                                                        <Cloud className="w-3 h-3 mr-1" /> {item.is_synced ? '배포됨' : '실서버 배포'}
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {selectedNote && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b bg-slate-50">
                            <h3 className="text-xl font-bold">{selectedNote.title}</h3>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1 whitespace-pre-wrap text-sm text-slate-600">
                            {selectedNote.content}
                        </div>
                        <div className="p-4 border-t flex justify-end gap-2">
                            <button onClick={() => setSelectedNote(null)} className="px-4 py-2 bg-slate-100 rounded text-sm">닫기</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PostApproval;
