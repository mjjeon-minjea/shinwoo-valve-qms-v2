import React, { useState, useEffect } from 'react';
import { Settings, CheckCircle, Clock, Hash, XCircle, Eye } from 'lucide-react';
import { supabase } from '../lib/api';

// ✅ 시맨틱 버전(vX.Y.Z) 정렬용 헬퍼 함수
const compareVersions = (a, b) => {
    const parse = (v) => (v || 'v0.0.0').replace(/[^\d.]/g, '').split('.').map(Number);
    const [ma, mia, pa] = parse(a.version);
    const [mb, mib, pb] = parse(b.version);
    
    if (ma !== mb) return mb - ma;
    if (mia !== mib) return mib - mia;
    if (pa !== pb) return pb - pa;
    
    // 버전이 같으면 날짜순
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
            const { data, error } = await supabase
                .from('dev_notes')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            const all = (data || []).sort(compareVersions); // ✅ 버전순 정렬 적용
            setDrafts(all.filter(n => !n.status || n.status === 'draft'));
            setPublished(all.filter(n => n.status === 'published'));
        } catch (err) {
            console.error('데이터 로드 실패:', err);
        }
    };

    useEffect(() => { loadData(); }, []);

    // ✅ 차장님 승인 → draft → published 로 상태 변경
    const handleApprove = async (id) => {
        if (!window.confirm('이 개발자 노트를 승인하여 개발자노트 게시판에 공개하시겠습니까?')) return;
        setLoading(true);
        try {
            const { error } = await supabase
                .from('dev_notes')
                .update({
                    status: 'published',
                    date: new Date().toLocaleString('ko-KR', { 
                        year: 'numeric', month: '2-digit', day: '2-digit', 
                        hour: '2-digit', minute: '2-digit', hour12: false 
                    }).replace(/\. /g, '-').replace(/\./g, '') // 승인 시각 상세 기록
                })
                .eq('id', id);

            if (error) throw error;
            alert('✅ 승인 완료! 개발자 노트 게시판에 공개됩니다.');
            setSelectedNote(null);
            await loadData();
        } catch (err) {
            alert('승인 실패: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // ❌ 반려 처리 (draft 유지, 반려 사유 기록)
    const handleReject = async (id) => {
        const reason = window.prompt('반려 사유를 입력하세요 (AI 재작업 지시용):');
        if (!reason) return;
        setLoading(true);
        try {
            const target = [...drafts, ...published].find(d => d.id === id);
            const { error } = await supabase
                .from('dev_notes')
                .update({
                    status: 'rejected',
                    content: `[🚫 반려됨 - 재작업 필요]\n사유: ${reason}\n\n---\n\n${target?.content || ''}`
                })
                .eq('id', id);

            if (error) throw error;
            alert('반려 처리 및 재작업 지시가 기록되었습니다.');
            setSelectedNote(null);
            await loadData();
        } catch (err) {
            alert('반려 처리 실패: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const currentList = viewMode === 'pending' ? drafts : published;

    return (
        <div className="p-6 max-w-6xl mx-auto">
            {/* 헤더 */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center">
                        <Settings className="w-6 h-6 mr-2 text-primary-600" />
                        개발자 노트 승인 관리
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        AI가 작성한 개발 노트를 검토하고 개발자노트 게시판 공개 여부를 결정합니다.
                    </p>
                </div>
                <div className="flex gap-3">
                    <span className="bg-amber-50 text-amber-700 text-sm font-semibold px-3 py-1.5 rounded-full border border-amber-200">
                        ⏳ 대기 중 {drafts.length}건
                    </span>
                    <span className="bg-emerald-50 text-emerald-700 text-sm font-semibold px-3 py-1.5 rounded-full border border-emerald-200">
                        ✅ 승인 완료 {published.length}건
                    </span>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {/* 탭 */}
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
                            ✅ 승인 완료 내역 ({published.length})
                        </button>
                    </div>
                </div>

                {/* 테이블 */}
                <div className="overflow-x-auto">
                    <table className="w-full whitespace-nowrap">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 w-28">버전</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500">제목 및 내용 요약</th>
                                <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 w-28">담당자</th>
                                <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 w-32">작성일</th>
                                {viewMode === 'published' && (
                                    <th className="px-6 py-3 text-center text-xs font-semibold text-emerald-600 w-32">✅ 승인일</th>
                                )}
                                <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 w-44">액션</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {currentList.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-slate-400">
                                        {viewMode === 'pending'
                                            ? '승인 대기 중인 개발자 노트가 없습니다.'
                                            : '승인 완료된 내역이 없습니다.'}
                                    </td>
                                </tr>
                            ) : (
                                currentList.map((item, idx) => (
                                    <tr key={item.id || idx} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center text-primary-700 bg-primary-50 text-xs font-bold px-2 py-1 rounded">
                                                <Hash className="w-3 h-3 mr-0.5" />
                                                {item.version || 'v0.0.0'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-slate-800 text-sm truncate max-w-sm">{item.title}</div>
                                            <div className="text-xs text-slate-500 truncate max-w-sm mt-1">
                                                {(item.content || '').slice(0, 80)}{item.content && item.content.length > 80 ? '...' : ''}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center text-sm text-slate-600">
                                            {item.author || item.manager || 'AI Dev'}
                                        </td>
                                        <td className="px-6 py-4 text-center text-sm text-slate-500">
                                            {item.created_at
                                                ? new Date(item.created_at).toISOString().split('T')[0]
                                                : item.date || '-'}
                                        </td>
                                        {viewMode === 'published' && (
                                            <td className="px-6 py-4 text-center text-xs font-semibold text-emerald-600">
                                                {item.date || '-'}
                                            </td>
                                        )}
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex items-center justify-center gap-1.5">
                                                <button
                                                    onClick={() => setSelectedNote(item)}
                                                    className="inline-flex items-center px-2 py-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded text-xs font-medium transition-colors"
                                                >
                                                    <Eye className="w-3 h-3 mr-1" /> 보기
                                                </button>
                                                {viewMode === 'pending' ? (
                                                    <>
                                                        <button
                                                            onClick={() => handleApprove(item.id)}
                                                            disabled={loading}
                                                            className="inline-flex items-center px-2 py-1.5 bg-emerald-500 text-white hover:bg-emerald-600 rounded text-xs font-medium transition-colors disabled:opacity-50"
                                                        >
                                                            <CheckCircle className="w-3 h-3 mr-1" /> 승인
                                                        </button>
                                                        <button
                                                            onClick={() => handleReject(item.id)}
                                                            disabled={loading}
                                                            className="inline-flex items-center px-2 py-1.5 bg-red-100 text-red-700 hover:bg-red-200 rounded text-xs font-medium transition-colors disabled:opacity-50"
                                                        >
                                                            <XCircle className="w-3 h-3 mr-1" /> 반려
                                                        </button>
                                                    </>
                                                ) : (
                                                    <span className="inline-flex items-center text-emerald-600 text-xs font-medium bg-emerald-50 px-2 py-1 rounded">
                                                        <CheckCircle className="w-3 h-3 mr-1" /> 공개됨
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* 하단 카운트 */}
                <div className="p-4 border-t border-slate-200 bg-slate-50">
                    <span className="text-sm text-slate-500">
                        총 <span className="font-semibold text-slate-800">{currentList.length}</span>건
                        {viewMode === 'pending' ? ' 검토 대기 중' : ' 승인 완료'}
                    </span>
                </div>
            </div>

            {/* 상세 내용 보기 모달 */}
            {selectedNote && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50">
                            <div>
                                <span className="inline-flex items-center text-primary-700 bg-primary-100 text-xs font-bold px-2.5 py-1 rounded-full mb-2">
                                    <Hash className="w-3.5 h-3.5 mr-1" />
                                    {selectedNote.version || 'v0.0.0'}
                                </span>
                                <h3 className="text-xl font-bold text-slate-800">{selectedNote.title}</h3>
                            </div>
                            <button
                                onClick={() => setSelectedNote(null)}
                                className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-200 transition-colors ml-4 flex-shrink-0"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1">
                            <div className="whitespace-pre-wrap text-slate-600 text-sm leading-relaxed">
                                {selectedNote.content}
                            </div>
                        </div>
                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
                            <div className="flex gap-2">
                                {(!selectedNote.status || selectedNote.status === 'draft') && (
                                    <>
                                        <button
                                            onClick={() => handleApprove(selectedNote.id)}
                                            disabled={loading}
                                            className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50"
                                        >
                                            ✅ 승인하기
                                        </button>
                                        <button
                                            onClick={() => handleReject(selectedNote.id)}
                                            disabled={loading}
                                            className="px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors disabled:opacity-50"
                                        >
                                            ❌ 반려
                                        </button>
                                    </>
                                )}
                                {selectedNote.status === 'published' && (
                                    <span className="px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium">
                                        ✅ 이미 공개된 노트입니다
                                    </span>
                                )}
                            </div>
                            <span className="text-xs text-slate-500">
                                담당: {selectedNote.author || 'AI Dev'} | {selectedNote.created_at
                                    ? new Date(selectedNote.created_at).toISOString().split('T')[0]
                                    : selectedNote.date}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PostApproval;
