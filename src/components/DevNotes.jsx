import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Search, ChevronLeft, ChevronRight, Hash } from 'lucide-react';
import { supabase } from '../lib/api';

// ✅ 시맨틱 버전(vX.Y.Z) 정렬용 헬퍼 함수
const compareVersions = (a, b) => {
    // 1. 숫자가 아닌 배열 요소가 나오면 무조건 0으로 덮어씀 (안전장치)
    const parse = (v) => {
        const parts = (v || 'v0.0.0').replace(/[^\d.]/g, '').split('.').map(x => parseInt(x, 10) || 0);
        return [parts[0] || 0, parts[1] || 0, parts[2] || 0]; 
    };
    
    const [ma, mia, pa] = parse(a.version);
    const [mb, mib, pb] = parse(b.version);
    
    // 2. 메이저 -> 마이너 -> 패치 순으로 숫자값 철저 평가 (최신이 위로 = 내림차순)
    if (ma !== mb) return mb - ma;
    if (mia !== mib) return mib - mia;
    if (pa !== pb) return pb - pa;
    
    // 3. 완전히 똑같은 버전일 경우 -> 최신 날짜가 무조건 위로 오도록 설계
    return new Date(b.created_at || b.date) - new Date(a.created_at || a.date);
};

const DevNotes = ({ user }) => {
    const [notes, setNotes] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedNote, setSelectedNote] = useState(null);
    const ITEMS_PER_PAGE = 10;

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    const loadNotes = async () => {
        try {
            // ✅ 실서버(Supabase) 대신 로컬망(3001) 데이터 소스로 전환
            const res = await fetch('http://localhost:3001/dev_notes');
            if (!res.ok) throw new Error('네트워크 응답이 올바르지 않습니다.');
            const data = await res.json();

            // ✅ 차장님이 승인한(published) 데이터만 필터링하여 게시판에 노출
            const publishedNotes = (data || []).filter(item => item.status === 'published');
            
            // ✅ 버전 번호 기준 논리적 내림차순 정렬 (v0.19.0 > v0.18.3)
            const sorted = publishedNotes.sort(compareVersions);
            setNotes(sorted);
        } catch (error) {
            console.error("로컬 데이터 로드 실패:", error);
            setNotes([]);
        }
    };

    useEffect(() => {
        loadNotes();
    }, []);

    const filteredList = notes.filter(item => 
        (item.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.version || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    const totalPages = Math.ceil(filteredList.length / ITEMS_PER_PAGE) || 1;
    const paginatedList = filteredList.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center">
                        <LayoutDashboard className="w-6 h-6 mr-2 text-primary-600" />
                        개발자 노트
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        시스템 업데이트 내역 및 시맨틱 버전(v0.x.y) 관리 노트
                    </p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="버전 번호 또는 제목 검색..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full whitespace-nowrap">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 w-24">버전</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500">패치 노트 내역</th>
                                <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 w-32">담당자</th>
                                <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 w-32">배포일</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {paginatedList.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-12 text-center text-slate-400">
                                        기록된 개발자 노트가 없습니다.
                                    </td>
                                </tr>
                            ) : (
                                paginatedList.map((item, idx) => (
                                    <tr 
                                        key={item.id || idx} 
                                        onClick={() => setSelectedNote(item)}
                                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                                    >
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center text-primary-700 bg-primary-50 text-xs font-bold px-2 py-1 rounded">
                                                <Hash className="w-3 h-3 mr-0.5" />
                                                {item.version || 'v0.0.0'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-slate-800 text-sm truncate max-w-md">{item.title}</div>
                                            <div className="text-xs text-slate-500 truncate max-w-md mt-1">{item.content}</div>
                                        </td>
                                        <td className="px-6 py-4 text-center text-sm text-slate-600">{item.author || item.manager || '시스템'}</td>
                                        <td className="px-6 py-4 text-center text-sm text-slate-500">
                                            {item.created_at ? new Date(item.created_at).toISOString().split('T')[0] : item.date}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="p-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
                    <span className="text-sm text-slate-500">
                        총 <span className="font-medium text-slate-900">{filteredList.length}</span>개 중 {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredList.length)}
                    </span>
                    <div className="flex gap-1">
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className="p-1 rounded text-slate-600 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        {Array.from({ length: totalPages }).map((_, i) => (
                            <button
                                key={i}
                                onClick={() => setCurrentPage(i + 1)}
                                className={`w-8 h-8 rounded text-sm font-medium transition-colors ${
                                    currentPage === i + 1 ? 'bg-primary-600 text-white' : 'text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                {i + 1}
                            </button>
                        ))}
                        <button
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages}
                            className="p-1 rounded text-slate-600 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>

            {selectedNote && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <span className="inline-flex items-center text-primary-700 bg-primary-100 text-xs font-bold px-2.5 py-1 rounded-full mb-2">
                                    <Hash className="w-3.5 h-3.5 mr-1" />
                                    {selectedNote.version || 'v0.0.0'}
                                </span>
                                <h3 className="text-xl font-bold text-slate-800">{selectedNote.title}</h3>
                            </div>
                            <button 
                                onClick={() => setSelectedNote(null)}
                                className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-200 transition-colors"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto">
                            <div className="whitespace-pre-wrap text-slate-600 text-sm leading-relaxed">
                                {selectedNote.content}
                            </div>
                        </div>
                        <div className="p-4 border-t border-slate-100 bg-slate-50 text-xs text-slate-500 flex justify-between items-center">
                            <span>담당자: <span className="font-semibold text-slate-700">{selectedNote.author || selectedNote.manager || '시스템 개발자'}</span></span>
                            <span>배포일: {selectedNote.created_at ? new Date(selectedNote.created_at).toISOString().split('T')[0] : selectedNote.date}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DevNotes;
