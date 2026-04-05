import React, { useState, useEffect } from 'react';
import { MessageSquare, Plus, Search, ChevronLeft, ChevronRight, AlertCircle, CheckCircle } from 'lucide-react';
import { api } from '../lib/api';

const Suggestions = ({ user }) => {
    const [suggestions, setSuggestions] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [formData, setFormData] = useState({ title: '', content: '', type: 'feature' });
    const ITEMS_PER_PAGE = 10;

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    const loadSuggestions = async () => {
        try {
            const response = await api.fetch('/suggestions');
            if (response.ok) {
                const data = await response.json();
                const filtered = data.filter(item => 
                    item.status === 'published' || item.authorEmail === user?.email
                );
                setSuggestions(filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
            }
        } catch (error) {
            console.error("데이터 로드 실패:", error);
        }
    };

    useEffect(() => {
        loadSuggestions();
    }, [user]);

    const handlePostSuggestion = async (e) => {
        e.preventDefault();
        const payload = {
            ...formData,
            author: user?.name,
            authorEmail: user?.email,
            status: 'draft',
            created_at: new Date().toISOString()
        };
        try {
            await api.fetch('/suggestions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            alert('작성하신 글은 관리자 승인 후 공개됩니다.');
            setIsFormOpen(false);
            setFormData({ title: '', content: '', type: 'feature' });
            loadSuggestions();
        } catch (error) {
            console.error("작성 실패:", error);
        }
    };

    const filteredList = suggestions.filter(item => item.title.toLowerCase().includes(searchTerm.toLowerCase()));
    const totalPages = Math.ceil(filteredList.length / ITEMS_PER_PAGE) || 1;
    const paginatedList = filteredList.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center">
                        <MessageSquare className="w-6 h-6 mr-2 text-primary-600" />
                        건의사항 (하이브리드)
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        시스템 버그 및 개선 기능을 제안해 주세요. 작성 후 승인 거쳐 등록됩니다.
                    </p>
                </div>
                <button
                    onClick={() => setIsFormOpen(!isFormOpen)}
                    className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
                >
                    <Plus className="w-4 h-4 mr-1" />
                    새 건의사항
                </button>
            </div>

            {isFormOpen && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">건의사항 작성</h3>
                    <form onSubmit={handlePostSuggestion} className="space-y-4">
                        <div className="flex gap-4">
                            <select 
                                value={formData.type}
                                onChange={(e) => setFormData({...formData, type: e.target.value})}
                                className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                            >
                                <option value="feature">개선 제안 (Feature)</option>
                                <option value="bug">버그 리포트 (Bug)</option>
                            </select>
                            <input 
                                type="text"
                                required
                                placeholder="제목을 입력하세요"
                                className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                value={formData.title}
                                onChange={(e) => setFormData({...formData, title: e.target.value})}
                            />
                        </div>
                        <textarea 
                            required
                            placeholder="상세 내용을 입력하세요 (관리자가 확인 후 퍼블리싱 됩니다)"
                            className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm h-32 focus:outline-none focus:ring-2 focus:ring-primary-500"
                            value={formData.content}
                            onChange={(e) => setFormData({...formData, content: e.target.value})}
                        />
                        <div className="flex justify-end gap-2">
                            <button 
                                type="button" 
                                onClick={() => setIsFormOpen(false)}
                                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors"
                            >
                                취소
                            </button>
                            <button 
                                type="submit"
                                className="px-4 py-2 bg-slate-800 text-white hover:bg-slate-900 rounded-lg text-sm font-medium transition-colors"
                            >
                                등록 (임시저장)
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="제목 검색..."
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
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 w-24">분류</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500">제목</th>
                                <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 w-32">작성자</th>
                                <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 w-24">상태</th>
                                <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 w-32">작성일</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {paginatedList.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-slate-400">
                                        표시할 데이터가 없습니다.
                                    </td>
                                </tr>
                            ) : (
                                paginatedList.map((item, idx) => (
                                    <tr key={item.id || idx} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                                                item.type === 'bug' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                                            }`}>
                                                {item.type === 'bug' ? '버그' : '제안'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-slate-800 text-sm truncate max-w-md">{item.title}</div>
                                            <div className="text-xs text-slate-500 truncate max-w-md mt-1">{item.content}</div>
                                        </td>
                                        <td className="px-6 py-4 text-center text-sm text-slate-600">{item.author}</td>
                                        <td className="px-6 py-4 text-center">
                                            {item.status === 'published' ? (
                                                <span className="inline-flex items-center text-emerald-600 text-xs font-medium">
                                                    <CheckCircle className="w-3 h-3 mr-1" />
                                                    공개
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center text-amber-500 text-xs font-medium bg-amber-50 px-2 py-1 rounded">
                                                    <AlertCircle className="w-3 h-3 mr-1" />
                                                    승인 대기
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-center text-sm text-slate-500">
                                            {new Date(item.created_at).toISOString().split('T')[0]}
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
        </div>
    );
};

export default Suggestions;
