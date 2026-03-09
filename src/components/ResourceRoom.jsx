import { useState, useEffect } from 'react';
import { Search, Plus, Edit, Trash2, X, ChevronLeft, ChevronRight, Download, FileText } from 'lucide-react';
import { api } from '../lib/api';

const ResourceRoom = () => {
    const [resources, setResources] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [currentResource, setCurrentResource] = useState(null);
    const [formData, setFormData] = useState({ title: '', type: '자료', author: '', content: '', attachment: '' });

    const itemsPerPage = 10;

    useEffect(() => {
        fetchResources();
    }, []);

    const fetchResources = async () => {
        try {
            const res = await api.fetch('/resources');
            if (res.ok) {
                const data = await res.json();
                setResources(data.sort((a, b) => b.id - a.id));
            }
        } catch (error) {
            console.error('Failed to fetch resources:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        const date = new Date().toISOString().split('T')[0];

        let uploadedFilename = currentResource?.attachment || '';
        let originalFilename = currentResource?.originalFilename || '';

        // Handle File Upload
        if (formData.file) {
            const uploadData = new FormData();
            uploadData.append('file', formData.file);

            try {
                const uploadRes = await api.fetch('/upload', {
                    method: 'POST',
                    body: uploadData
                });

                if (uploadRes.ok) {
                    const result = await uploadRes.json();
                    uploadedFilename = result.filename;
                    originalFilename = result.originalName;
                } else {
                    alert('파일 업로드 실패');
                    return;
                }
            } catch (error) {
                console.error('File upload error:', error);
                alert('파일 업로드 중 오류가 발생했습니다.');
                return;
            }
        } else if (formData.attachment && formData.attachment !== uploadedFilename) {
            // Case where user might have manually edited the text field (legacy support or if we keep the text input)
            // But with new design we should rely on file input. 
            // If user cleared it, we might want to respect that.
            // For now, let's assume if no new file is selected, we keep the old one unless explicitly cleared?
            // Since we are changing the UI to file input, let's stick to the file object.
        }

        const payload = {
            ...formData,
            attachment: uploadedFilename,
            originalFilename: originalFilename,
            date,
            views: currentResource?.views || 0
        };
        // Remove the 'file' object from payload as we don't store it in DB
        delete payload.file;

        try {
            if (currentResource?.id) {
                await api.fetch(`/resources/${currentResource.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...currentResource, ...payload })
                });
            } else {
                await api.fetch('/resources', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: String(Date.now()), ...payload, views: 0 })
                });
            }
            setIsModalOpen(false);
            setCurrentResource(null);
            setFormData({ title: '', type: '자료', author: '', content: '', attachment: '', file: null });
            fetchResources();
        } catch (error) {
            console.error('Error saving resource:', error);
            alert('저장 중 오류가 발생했습니다.');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('정말 삭제하시겠습니까?')) {
            try {
                await api.fetch(`/resources/${id}`, { method: 'DELETE' });
                fetchResources();
                if (isDetailOpen) setIsDetailOpen(false);
            } catch (error) {
                console.error('Error deleting resource:', error);
            }
        }
    };

    const openModal = (resource = null) => {
        if (resource) {
            setCurrentResource(resource);
            setFormData({
                title: resource.title,
                type: resource.type,
                author: resource.author,
                content: resource.content,
                attachment: resource.attachment || '',
                originalFilename: resource.originalFilename || '',
                file: null
            });
        } else {
            setCurrentResource(null);
            setFormData({ title: '', type: '자료', author: '', content: '', attachment: '', file: null });
        }
        setIsModalOpen(true);
    };

    const openDetail = async (resource) => {
        setCurrentResource(resource);
        setIsDetailOpen(true);
        // Increment view count
        try {
            await api.fetch(`/resources/${resource.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ views: (resource.views || 0) + 1 })
            });
            fetchResources();
        } catch (err) {
            console.error('Failed to update views', err);
        }
    };

    // Filter & Pagination
    const filteredResources = resources.filter(r =>
        r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.author.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredResources.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredResources.length / itemsPerPage);

    if (isDetailOpen && currentResource) {
        return (
            <div className="space-y-6 animate-fade-in">
                <button onClick={() => setIsDetailOpen(false)} className="flex items-center text-slate-500 hover:text-primary-600 mb-4 transition-colors">
                    <ChevronLeft className="w-4 h-4 mr-1" /> 목록으로 돌아가기
                </button>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-start">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${currentResource.type === '매뉴얼' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                    {currentResource.type}
                                </span>
                                <h1 className="text-2xl font-bold text-slate-800">{currentResource.title}</h1>
                            </div>
                            <div className="flex gap-4 text-sm text-slate-500">
                                <span>작성자: {currentResource.author}</span>
                                <span>작성일: {currentResource.date}</span>
                                <span>조회수: {currentResource.views || 0}</span>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => { setIsDetailOpen(false); openModal(currentResource); }} className="p-2 text-slate-400 hover:text-primary-600 bg-white border border-slate-200 rounded-lg shadow-sm"><Edit className="w-4 h-4" /></button>
                            <button onClick={() => handleDelete(currentResource.id)} className="p-2 text-slate-400 hover:text-red-600 bg-white border border-slate-200 rounded-lg shadow-sm"><Trash2 className="w-4 h-4" /></button>
                        </div>
                    </div>

                    <div className="p-8 min-h-[300px] border-b border-slate-100">
                        <div className="whitespace-pre-wrap text-slate-700 leading-relaxed max-w-4xl">
                            {currentResource.content}
                        </div>
                    </div>

                    {/* Attachment Section */}
                    {currentResource.attachment && (
                        <div className="p-6 bg-slate-50 flex items-center gap-4">
                            <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                                <FileText className="w-8 h-8 text-primary-500" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-sm font-medium text-slate-900">{currentResource.originalFilename || currentResource.attachment}</h3>
                                <p className="text-xs text-slate-500">첨부파일</p>
                            </div>
                            <a
                                href={`/uploads/${currentResource.attachment}`}
                                download
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors shadow-sm"
                            >
                                <Download className="w-4 h-4 mr-2" />
                                다운로드
                            </a>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <FileText className="w-6 h-6 text-green-600" />
                        자료실
                    </h1>
                    <p className="text-slate-500">업무 관련 서식 및 매뉴얼</p>
                </div>
                <button onClick={() => openModal()} className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors shadow-sm">
                    <Plus className="w-4 h-4 mr-2" />
                    자료 등록
                </button>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div className="relative max-w-xs w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="제목 또는 자료명 검색..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-400 transition-all"
                        />
                    </div>
                    <span className="text-xs text-slate-500">총 {filteredResources.length}건</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase w-16">No</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase w-24">구분</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">자료명</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase w-32">작성자</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase w-32">날짜</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase w-24">첨부</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan="6" className="py-10 text-center text-slate-500">로딩 중...</td></tr>
                            ) : currentItems.length === 0 ? (
                                <tr><td colSpan="6" className="py-10 text-center text-slate-500">등록된 자료가 없습니다.</td></tr>
                            ) : (
                                currentItems.map((resource) => (
                                    <tr key={resource.id} className="hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => openDetail(resource)}>
                                        <td className="px-6 py-4 text-center text-xs text-slate-400">{resource.id}</td>
                                        <td className="px-6 py-4 text-center whitespace-nowrap">
                                            <span className={`px-2 py-1 text-xs rounded-full font-medium ${resource.type === '매뉴얼' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                                {resource.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium text-slate-900">{resource.title}</td>
                                        <td className="px-6 py-4 text-center text-sm text-slate-600">{resource.author}</td>
                                        <td className="px-6 py-4 text-center text-xs text-slate-400">{resource.date}</td>
                                        <td className="px-6 py-4 text-center">
                                            {resource.attachment && <Download className="w-4 h-4 text-slate-400 mx-auto" />}
                                        </td>
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
                            <h2 className="text-xl font-bold text-slate-900">{currentResource ? '자료 수정' : '새 자료 등록'}</h2>
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
                                        <option value="자료">자료</option>
                                        <option value="매뉴얼">매뉴얼</option>
                                        <option value="양식">양식</option>
                                        <option value="규격">규격</option>
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
                                    placeholder="자료 제목을 입력하세요"
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
                                    placeholder="자료에 대한 설명을 입력하세요..."
                                ></textarea>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">첨부파일</label>
                                <div
                                    className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-lg hover:border-primary-500 transition-colors cursor-pointer relative"
                                    onDragOver={(e) => { e.preventDefault(); }}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                                            setFormData({ ...formData, file: e.dataTransfer.files[0] });
                                        }
                                    }}
                                    onClick={() => document.getElementById('file-upload').click()}
                                >
                                    <div className="space-y-1 text-center">
                                        <FileText className="mx-auto h-12 w-12 text-slate-400" />
                                        <div className="flex text-sm text-slate-600 justify-center">
                                            <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-primary-600 hover:text-primary-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary-500" onClick={(e) => e.stopPropagation()}>
                                                <span>파일 선택</span>
                                                <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={(e) => setFormData({ ...formData, file: e.target.files[0] })} />
                                            </label>
                                            <p className="pl-1">또는 드래그 앤 드롭</p>
                                        </div>
                                        <p className="text-xs text-slate-500">
                                            {formData.file ? formData.file.name : (formData.originalFilename || '파일을 선택하세요')}
                                        </p>
                                    </div>
                                </div>
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

export default ResourceRoom;
