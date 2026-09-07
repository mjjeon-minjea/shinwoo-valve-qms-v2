import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, FileText, History, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import {
    createResourceDownload,
    listCurrentResources,
    listResourceHistory,
    publishResourceRevision,
    softDeleteResource
} from '../lib/resourceFiles';

const EMPTY_FORM = {
    module: '', moduleLabel: '', category: '', categoryLabel: '', docKey: '',
    title: '', description: '', sourceRef: '', revisionNote: '', file: null
};
const ITEMS_PER_PAGE = 10;

const formatDate = (value) => value ? new Date(value).toLocaleDateString('ko-KR') : '-';
const revisionLabel = (resource) => `r${resource.revision}${resource.is_current ? ' · 최신' : ''}${resource.is_deleted ? ' · 삭제됨' : ''}`;

const ResourceRoom = ({ user, isAdmin = false }) => {
    const [resources, setResources] = useState([]);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [historyError, setHistoryError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [moduleFilter, setModuleFilter] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [detail, setDetail] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [modalOpen, setModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [actionError, setActionError] = useState('');
    const [publishReceipt, setPublishReceipt] = useState(null);
    const publishLock = useRef(false);

    const loadResources = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const current = await listCurrentResources();
            setResources(current);
        } catch (loadError) {
            console.error('Resource list failed:', loadError);
            setResources([]);
            setError('자료실을 불러오지 못했습니다 · 다시 시도');
        } finally {
            setLoading(false);
        }
    }, []);

    const loadHistory = useCallback(async () => {
        if (!isAdmin) {
            setHistory([]);
            setHistoryError('');
            return;
        }
        try {
            setHistory(await listResourceHistory({ isAdmin }));
            setHistoryError('');
        } catch (loadError) {
            console.error('Resource history failed:', loadError);
            setHistory([]);
            setHistoryError('개정 이력을 불러오지 못했습니다.');
        }
    }, [isAdmin]);

    const refresh = useCallback(async () => {
        await Promise.all([loadResources(), loadHistory()]);
    }, [loadHistory, loadResources]);

    useEffect(() => { refresh(); }, [refresh]);

    const moduleOptions = useMemo(() => [...new Map(resources.map(item => [item.module, item.module_label])).entries()], [resources]);
    const categoryOptions = useMemo(() => [...new Map(resources
        .filter(item => !moduleFilter || item.module === moduleFilter)
        .map(item => [item.category, item.category_label])).entries()], [moduleFilter, resources]);
    const filteredResources = useMemo(() => resources.filter((resource) => {
        const needle = searchTerm.trim().toLowerCase();
        const searchable = [resource.title, resource.module, resource.module_label, resource.category, resource.category_label, resource.doc_key, resource.registered_by_name]
            .join(' ').toLowerCase();
        return (!needle || searchable.includes(needle))
            && (!moduleFilter || resource.module === moduleFilter)
            && (!categoryFilter || resource.category === categoryFilter);
    }), [categoryFilter, moduleFilter, resources, searchTerm]);
    const totalPages = Math.max(1, Math.ceil(filteredResources.length / ITEMS_PER_PAGE));
    const currentItems = filteredResources.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    useEffect(() => { setCurrentPage(1); }, [searchTerm, moduleFilter, categoryFilter]);
    useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [currentPage, totalPages]);

    const openNew = () => {
        if (!isAdmin) return;
        if (publishReceipt) { setModalOpen(true); return; }
        setForm(EMPTY_FORM);
        setPublishReceipt(null);
        setActionError('');
        setModalOpen(true);
    };

    const openRevision = (resource) => {
        if (!isAdmin) return;
        if (publishReceipt) { setModalOpen(true); return; }
        setForm({
            module: resource.module, moduleLabel: resource.module_label, category: resource.category,
            categoryLabel: resource.category_label, docKey: resource.doc_key, title: resource.title,
            description: resource.description || '', sourceRef: resource.source_ref || '', revisionNote: '', file: null
        });
        setPublishReceipt(null);
        setActionError('');
        setModalOpen(true);
    };

    const updateForm = (key, value) => {
        setActionError('');
        setForm(previous => ({ ...previous, [key]: value }));
    };

    const handlePublish = async (event) => {
        event.preventDefault();
        if (!isAdmin || publishLock.current) return;
        publishLock.current = true;
        setSaving(true);
        setActionError('');
        try {
            await publishResourceRevision({ draft: form, file: form.file, receipt: publishReceipt, isAdmin });
            setModalOpen(false);
            setPublishReceipt(null);
            setForm(EMPTY_FORM);
            await refresh();
        } catch (publishError) {
            console.error('Resource publish failed:', publishError);
            setPublishReceipt(publishError.receipt || publishReceipt);
            setActionError(publishError.message || '자료 등록에 실패했습니다.');
        } finally {
            publishLock.current = false;
            setSaving(false);
        }
    };

    const handleDelete = async (resource) => {
        if (!isAdmin || !window.confirm(`“${resource.title}” 자료를 논리삭제하시겠습니까?`)) return;
        setActionError('');
        try {
            await softDeleteResource({ id: resource.id, isAdmin });
            if (detail?.id === resource.id) setDetail(null);
            await refresh();
        } catch (deleteError) {
            console.error('Resource delete failed:', deleteError);
            setActionError(deleteError.message || '자료 삭제에 실패했습니다.');
        }
    };

    const handleDownload = async (resource) => {
        setActionError('');
        try {
            const signedUrl = await createResourceDownload({ id: resource.id, isAdmin });
            window.location.assign(signedUrl);
        } catch (downloadError) {
            console.error('Resource download failed:', downloadError);
            setActionError(downloadError.message || '다운로드에 실패했습니다.');
        }
    };

    return (
        <div className="space-y-4 sm:space-y-6 animate-fade-in" data-testid="resource-room">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900"><FileText className="h-6 w-6 text-green-600" />자료실</h1>
                    <p className="text-sm text-slate-500">최신 개정본을 안전하게 내려받습니다{user?.name ? ` · ${user.name}` : ''}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={refresh} className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50" aria-label="자료실 다시 시도">
                        <RefreshCw className="mr-1.5 h-4 w-4" />새로고침
                    </button>
                    {isAdmin && <button type="button" onClick={openNew} className="inline-flex items-center rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700" data-testid="resource-upload-open">
                        <Plus className="mr-1.5 h-4 w-4" />자료 등록
                    </button>}
                </div>
            </div>

            {actionError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{actionError}</div>}
            {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="grid gap-2 border-b border-slate-100 bg-slate-50/60 p-3 sm:grid-cols-3 sm:p-4">
                    <label className="sr-only" htmlFor="resource-search">자료 검색</label>
                    <input id="resource-search" data-testid="resource-search" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="자료명, 모듈, 문서키 검색" className="min-w-0 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                    <label className="sr-only" htmlFor="resource-module-filter">모듈 필터</label>
                    <select id="resource-module-filter" value={moduleFilter} onChange={event => { setModuleFilter(event.target.value); setCategoryFilter(''); }} className="min-w-0 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                        <option value="">모든 모듈</option>
                        {moduleOptions.map(([key, label]) => <option key={key} value={key}>{label} ({key})</option>)}
                    </select>
                    <label className="sr-only" htmlFor="resource-category-filter">구분 필터</label>
                    <select id="resource-category-filter" value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)} className="min-w-0 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                        <option value="">모든 구분</option>
                        {categoryOptions.map(([key, label]) => <option key={key} value={key}>{label} ({key})</option>)}
                    </select>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-[720px] w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-50 text-left text-xs text-slate-500"><tr>
                            <th className="px-3 py-3">모듈 / 구분</th><th className="px-3 py-3">자료명</th><th className="px-3 py-3">문서키 / 개정</th><th className="px-3 py-3">등록자</th><th className="px-3 py-3">등록일</th><th className="px-3 py-3 text-right">다운로드</th>
                        </tr></thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? <tr><td colSpan="6" className="px-3 py-10 text-center text-slate-500">자료실을 불러오는 중입니다…</td></tr>
                                : !error && currentItems.length === 0 ? <tr><td colSpan="6" className="px-3 py-10 text-center text-slate-500">등록된 자료가 없습니다.</td></tr>
                                    : currentItems.map(resource => <tr key={resource.id} className="hover:bg-slate-50">
                                        <td className="px-3 py-3"><div className="font-medium text-slate-800">{resource.module_label}</div><div className="text-xs text-slate-500">{resource.module} / {resource.category_label} ({resource.category})</div></td>
                                        <td className="px-3 py-3"><button type="button" onClick={() => setDetail(resource)} className="text-left font-medium text-primary-700 hover:underline">{resource.title}</button><div className="max-w-xs truncate text-xs text-slate-500">{resource.original_name}</div></td>
                                        <td className="px-3 py-3 text-xs text-slate-600">{resource.doc_key}<br />{revisionLabel(resource)}</td>
                                        <td className="px-3 py-3 text-slate-600">{resource.registered_by_name}</td><td className="px-3 py-3 text-xs text-slate-500">{formatDate(resource.created_at)}</td>
                                        <td className="px-3 py-3 text-right"><button type="button" onClick={() => handleDownload(resource)} className="inline-flex items-center rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100" aria-label={`${resource.original_name} 다운로드`}><Download className="mr-1 h-3.5 w-3.5" />다운로드</button></td>
                                    </tr>)}
                        </tbody>
                    </table>
                </div>
                {totalPages > 1 && <div className="flex items-center justify-center gap-3 border-t border-slate-100 p-3"><button type="button" disabled={currentPage === 1} onClick={() => setCurrentPage(page => page - 1)} className="rounded p-1 disabled:opacity-40" aria-label="이전 페이지"><ChevronLeft className="h-5 w-5" /></button><span className="text-sm text-slate-600">{currentPage} / {totalPages}</span><button type="button" disabled={currentPage === totalPages} onClick={() => setCurrentPage(page => page + 1)} className="rounded p-1 disabled:opacity-40" aria-label="다음 페이지"><ChevronRight className="h-5 w-5" /></button></div>}
            </section>

            {isAdmin && <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center gap-2 border-b border-slate-100 p-4"><History className="h-4 w-4 text-slate-500" /><h2 className="font-bold text-slate-800">관리자 개정 이력</h2></div>
                {historyError ? <p role="alert" className="p-4 text-sm text-red-700">{historyError}</p> : <div className="overflow-x-auto"><table className="min-w-[720px] w-full divide-y divide-slate-100 text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="px-3 py-3">자료</th><th className="px-3 py-3">모듈 / 구분 / 문서키</th><th className="px-3 py-3">개정 상태</th><th className="px-3 py-3">파일</th><th className="px-3 py-3 text-right">관리</th></tr></thead><tbody className="divide-y divide-slate-100">{history.length === 0 ? <tr><td colSpan="5" className="p-5 text-center text-slate-500">개정 이력이 없습니다.</td></tr> : history.map(resource => <tr key={resource.id}><td className="px-3 py-3">{resource.title}</td><td className="px-3 py-3 text-xs text-slate-600">{resource.module} / {resource.category} / {resource.doc_key}</td><td className="px-3 py-3 text-xs">{revisionLabel(resource)}</td><td className="px-3 py-3 text-xs">{resource.original_name}</td><td className="space-x-1 whitespace-nowrap px-3 py-3 text-right">{!resource.is_deleted && <button type="button" onClick={() => handleDownload(resource)} className="rounded border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50">다운로드</button>}{!resource.is_deleted && <button type="button" onClick={() => handleDelete(resource)} className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50">논리삭제</button>}</td></tr>)}</tbody></table></div>}</section>}

            {detail && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-3"><section role="dialog" aria-modal="true" aria-labelledby="resource-detail-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl"><div className="flex items-start justify-between gap-3"><div><h2 id="resource-detail-title" className="text-xl font-bold text-slate-900">{detail.title}</h2><p className="mt-1 text-xs text-slate-500">{detail.module_label} / {detail.category_label} · {detail.doc_key} · {revisionLabel(detail)}</p></div><button type="button" onClick={() => setDetail(null)} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="상세 닫기"><X className="h-5 w-5" /></button></div><p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-slate-700">{detail.description || '설명 없음'}</p><div className="mt-5 rounded-lg bg-slate-50 p-3 text-sm"><div className="font-medium text-slate-800">{detail.original_name}</div><div className="mt-1 text-xs text-slate-500">{detail.mime_type} · {detail.file_size?.toLocaleString()} bytes</div></div><div className="mt-5 flex flex-wrap justify-end gap-2"><button type="button" onClick={() => handleDownload(detail)} className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-white hover:bg-slate-900"><Download className="mr-1 inline h-4 w-4" />다운로드</button>{isAdmin && !detail.is_deleted && <><button type="button" onClick={() => openRevision(detail)} className="rounded-lg border border-primary-200 px-3 py-2 text-sm text-primary-700 hover:bg-primary-50">새 개정 등록</button><button type="button" onClick={() => handleDelete(detail)} className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50"><Trash2 className="mr-1 inline h-4 w-4" />논리삭제</button></>}</div></section></div>}

            {modalOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-3"><section role="dialog" aria-modal="true" aria-labelledby="resource-form-title" className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl"><div className="mb-4 flex items-center justify-between"><h2 id="resource-form-title" className="text-xl font-bold text-slate-900">{publishReceipt ? '자료 발행 재시도' : '자료 등록 / 새 개정'}</h2><button type="button" onClick={() => { if (!saving) setModalOpen(false); }} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="등록 닫기"><X className="h-5 w-5" /></button></div>{publishReceipt && <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{publishReceipt.uploaded ? '파일은 이미 저장되었습니다. 파일과 입력값을 바꾸지 말고 발행을 재시도하세요.' : '파일 저장이 확인되지 않았습니다. 같은 파일과 입력값으로 저장을 재시도하세요.'}</p>}<form onSubmit={handlePublish} className="space-y-4"><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium text-slate-700">모듈 key<input disabled={saving || !!publishReceipt} required value={form.module} onChange={event => updateForm('module', event.target.value)} placeholder="예: weekly-report" pattern="[a-z0-9][a-z0-9_-]{0,63}" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label><label className="text-sm font-medium text-slate-700">모듈 표시명<input disabled={saving || !!publishReceipt} required value={form.moduleLabel} onChange={event => updateForm('moduleLabel', event.target.value)} placeholder="예: 주간보고" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label><label className="text-sm font-medium text-slate-700">구분 key<input disabled={saving || !!publishReceipt} required value={form.category} onChange={event => updateForm('category', event.target.value)} placeholder="예: attachment" pattern="[a-z0-9][a-z0-9_-]{0,63}" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label><label className="text-sm font-medium text-slate-700">구분 표시명<input disabled={saving || !!publishReceipt} required value={form.categoryLabel} onChange={event => updateForm('categoryLabel', event.target.value)} placeholder="예: 첨부" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label><label className="text-sm font-medium text-slate-700">문서 key<input disabled={saving || !!publishReceipt} required value={form.docKey} onChange={event => updateForm('docKey', event.target.value)} pattern="[a-z0-9][a-z0-9._-]{0,127}" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label><label className="text-sm font-medium text-slate-700">자료명<input disabled={saving || !!publishReceipt} required value={form.title} onChange={event => updateForm('title', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label></div><label className="block text-sm font-medium text-slate-700">원본 파일<input disabled={saving || !!publishReceipt} required={!publishReceipt} type="file" onChange={event => updateForm('file', event.target.files?.[0] || null)} className="mt-1 block w-full text-sm font-normal" aria-label="원본 파일 선택" /></label><p className="text-xs text-slate-500">PDF, 이미지, Office, CSV/TXT, ZIP, HWP/HWPX · 최대 20 MiB. 원본 파일명은 그대로 보존됩니다.</p><label className="block text-sm font-medium text-slate-700">설명<textarea disabled={saving || !!publishReceipt} value={form.description} onChange={event => updateForm('description', event.target.value)} rows="3" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium text-slate-700">원본 참조<input disabled={saving || !!publishReceipt} value={form.sourceRef} onChange={event => updateForm('sourceRef', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label><label className="text-sm font-medium text-slate-700">개정 사유<input disabled={saving || !!publishReceipt} value={form.revisionNote} onChange={event => updateForm('revisionNote', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label></div><div className="flex justify-end gap-2"><button type="button" onClick={() => { if (!saving) setModalOpen(false); }} className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">취소</button><button type="submit" disabled={saving} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{saving ? '처리 중…' : publishReceipt ? '같은 발행 재시도' : '자료 발행'}</button></div></form></section></div>}
        </div>
    );
};

export default ResourceRoom;
