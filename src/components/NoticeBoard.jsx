import { useState, useEffect } from 'react';
// eslint-disable-next-line no-unused-vars
import { Search, Plus, Edit, Trash2, X, ChevronLeft, ChevronRight, Eye, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api';
import { useUser } from '../contexts/UserContext';

const NoticeBoard = () => {
    const { user } = useUser();
    const [notices, setNotices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [currentNotice, setCurrentNotice] = useState(null);
    const [formData, setFormData] = useState({ title: '', type: '공지', author: '', content: '' });

    const itemsPerPage = 10;

    useEffect(() => {
        fetchNotices();
    }, []);

    const fetchNotices = async () => {
        try {
            const res = await api.fetch('/notices');
            if (res.ok) {
                const data = await res.json();
                // 날짜 내림차순(최신순) 정렬, 날짜가 같으면 ID 내림차순
                setNotices(data.sort((a, b) => {
                    if (b.date !== a.date) return b.date.localeCompare(a.date);
                    return b.id.localeCompare(a.id);
                }));
            }
        } catch (error) {
            console.error('Failed to fetch notices:', error);
        } finally {
            setLoading(false);
        }
    };

    // 작성자 명칭 단일화 (시스템 관리자 -> 관리자)
    const getUnifiedAuthor = (author) => {
        if (author === '시스템 관리자' || author === '관리자') return '관리자';
        return author;
    };

    // 넘버링 체계 생성: [구분코드][작성자ID코드][YYMMDD][순번]
    const generateNoticeNo = (type, authorName, date) => {
        const typeMap = { '공지': 'A', 'MES': 'B', '인사': 'C', '품질': 'D', '업데이트': 'E' };
        const prefix = typeMap[type] || 'Z';
        
        // 작성자 코드 (관리자면 ADM, 아니면 이메일 ID 앞부분)
        let authorCode = 'ADM';
        if (authorName !== '관리자' && authorName !== '시스템 관리자') {
            // 현재 로그인 유저의 이메일 ID 사용
            if (user && user.email) {
                authorCode = user.email.split('@')[0].toUpperCase();
            } else {
                authorCode = authorName ? authorName.substring(0, 3).toUpperCase() : 'NON';
            }
        }

        const dateStr = date.replace(/-/g, '').substring(2); // YYMMDD
        
        // 해당 날짜의 기존 공지 수 파악하여 순번 부여
        const todayNotices = notices.filter(n => n.date === date);
        const seq = String(todayNotices.length + 1).padStart(3, '0');
        
        return `${prefix}${authorCode}${dateStr}${seq}`;
    };

    const handleSave = async (e) => {
        e.preventDefault();
        const date = new Date().toISOString().split('T')[0];
        
        // 작성자 단일화 적용
        const unifiedAuthor = getUnifiedAuthor(formData.author);
        const payload = { ...formData, author: unifiedAuthor, date, views: currentNotice?.views || 0 };

        try {
            if (currentNotice?.id) {
                await api.fetch(`/notices/${currentNotice.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...currentNotice, ...payload })
                });
            } else {
                // 신규 작성 시 새로운 넘버링 체계 적용 (하이픈 제거)
                const newId = generateNoticeNo(formData.type, unifiedAuthor, date);
                await api.fetch('/notices', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: newId, ...payload, views: 0 })
                });
            }
            setIsModalOpen(false);
            setCurrentNotice(null);
            setFormData({ title: '', type: '공지', author: '', content: '' });
            fetchNotices();
        } catch (error) {
            console.error('Error saving notice:', error);
            alert('저장 중 오류가 발생했습니다.');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('정말 삭제하시겠습니까?')) {
            try {
                await api.fetch(`/notices/${id}`, { method: 'DELETE' });
                fetchNotices();
                if (isDetailOpen) setIsDetailOpen(false);
            } catch (error) {
                console.error('Error deleting notice:', error);
            }
        }
    };

    const openModal = (notice = null) => {
        if (notice) {
            setCurrentNotice(notice);
            setFormData({ title: notice.title, type: notice.type, author: getUnifiedAuthor(notice.author), content: notice.content });
        } else {
            setCurrentNotice(null);
            // 신규 작성 시 현재 로그인 사용자 정보를 기본값으로 세팅
            const defaultAuthor = user?.isAdmin ? '관리자' : (user?.name || '');
            setFormData({ title: '', type: '공지', author: defaultAuthor, content: '' });
        }
        setIsModalOpen(true);
    };

    const openDetail = async (notice) => {
        setCurrentNotice(notice);
        setIsDetailOpen(true);
        // Increment view count
        try {
            await api.fetch(`/notices/${notice.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ views: (notice.views || 0) + 1 })
            });
            fetchNotices(); // Refresh to show updated view count in background
        } catch (err) {
            console.error('Failed to update views', err);
        }
    };

    // Filter & Pagination
    const filteredNotices = notices.filter(n =>
        n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        n.author.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredNotices.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredNotices.length / itemsPerPage);

    if (isDetailOpen && currentNotice) {
        return (
            <div className="space-y-6 animate-fade-in">
                <button onClick={() => setIsDetailOpen(false)} className="flex items-center text-slate-500 hover:text-primary-600 mb-4 transition-colors">
                    <ChevronLeft className="w-4 h-4 mr-1" /> 목록으로 돌아가기
                </button>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-start">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${currentNotice.type === 'MES' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                                    {currentNotice.type}
                                </span>
                                <h1 className="text-2xl font-bold text-slate-800">{currentNotice.title}</h1>
                            </div>
                            <div className="flex gap-4 text-sm text-slate-500">
                                <span>번호: {currentNotice.id}</span>
                                <span>작성자: {getUnifiedAuthor(currentNotice.author)}</span>
                                <span>작성일: {currentNotice.date}</span>
                                <span>조회수: {currentNotice.views || 0}</span>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => { setIsDetailOpen(false); openModal(currentNotice); }} className="p-2 text-slate-400 hover:text-primary-600 bg-white border border-slate-200 rounded-lg shadow-sm"><Edit className="w-4 h-4" /></button>
                            <button onClick={() => handleDelete(currentNotice.id)} className="p-2 text-slate-400 hover:text-red-600 bg-white border border-slate-200 rounded-lg shadow-sm"><Trash2 className="w-4 h-4" /></button>
                        </div>
                    </div>
                    <div className="p-8 min-h-[400px] whitespace-pre-wrap text-slate-700 leading-relaxed">
                        {currentNotice.content}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <AlertTriangle className="w-6 h-6 text-blue-600" />
                        공지사항
                    </h1>
                    <p className="text-slate-500">사내 주요 소식 및 업데이트 안내</p>
                </div>
                <button onClick={() => openModal()} className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors shadow-sm">
                    <Plus className="w-4 h-4 mr-2" />
                    공지 작성
                </button>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div className="relative max-w-xs w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="제목 또는 작성자 검색..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-400 transition-all"
                        />
                    </div>
                    <span className="text-xs text-slate-500">총 {filteredNotices.length}건</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase w-40 whitespace-nowrap">No</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase w-24">구분</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">제목</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase w-32">작성자</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase w-32">날짜</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase w-20">조회</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan="6" className="py-10 text-center text-slate-500">로딩 중...</td></tr>
                            ) : currentItems.length === 0 ? (
                                <tr><td colSpan="6" className="py-10 text-center text-slate-500">등록된 공지사항이 없습니다.</td></tr>
                            ) : (
                                currentItems.map((notice) => (
                                    <tr key={notice.id} className="hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => openDetail(notice)}>
                                        <td className="px-6 py-4 text-center text-xs text-slate-400 font-mono whitespace-nowrap">{notice.id}</td>
                                        <td className="px-6 py-4 text-center whitespace-nowrap">
                                            <span className={`px-2 py-1 text-xs rounded-full font-medium ${notice.type === 'MES' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                                                {notice.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium text-slate-900">{notice.title}</td>
                                        <td className="px-6 py-4 text-center text-sm text-slate-600">{getUnifiedAuthor(notice.author)}</td>
                                        <td className="px-6 py-4 text-center text-xs text-slate-400">{notice.date}</td>
                                        <td className="px-6 py-4 text-center text-xs text-slate-400">{notice.views || 0}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex justify-center items-center p-4 border-t border-slate-100 gap-2">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1 rounded hover:bg-slate-100 disabled:opacity-50"><ChevronLeft className="w-5 h-5 text-slate-500" /></button>
                        <span className="text-sm text-slate-600">{currentPage} / {totalPages}</span>
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1 rounded hover:bg-slate-100 disabled:opacity-50"><ChevronRight className="w-5 h-5 text-slate-500" /></button>
                    </div>
                )}
            </div>

            {/* Write/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl p-6 animate-scale-in">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-slate-900">{currentNotice ? '공지사항 수정' : '새 공지사항 작성'}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
                        </div>
                        <form onSubmit={handleSave} className="space-y-4">
                            <div className="grid grid-cols-4 gap-4">
                                <div className="col-span-1">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">구분</label>
                                    <select
                                        value={formData.type}
                                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                    >
                                        <option value="공지">공지</option>
                                        <option value="MES">MES</option>
                                        <option value="인사">인사</option>
                                        <option value="품질">품질</option>
                                        <option value="업데이트">업데이트</option>
                                    </select>
                                </div>
                                <div className="col-span-3">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">작성자</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.author}
                                        onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                        placeholder="이름"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">제목</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                    placeholder="공지 제목을 입력하세요"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">내용</label>
                                <textarea
                                    required
                                    rows="10"
                                    value={formData.content}
                                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none resize-none"
                                    placeholder="상세 내용을 입력하세요..."
                                ></textarea>
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">취소</button>
                                <button type="submit" className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-sm">저장하기</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NoticeBoard;
