import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, EyeOff, FileText, History, Info, Plus, RefreshCw, RotateCcw, Search, Settings, Upload, X } from 'lucide-react';
import {
    MAX_RESOURCE_FILE_SIZE,
    createResourceDownload,
    listCurrentResources,
    listResourceHistory,
    publishResourceRevision,
    restoreResource,
    softDeleteResource,
    validateResourceFile
} from '../lib/resourceFiles';
import {
    COMMON_MODULE, FIRST_NOTE, NEW_OPTION, activeTabOf, adminRows, adminSummary, buildDraft, categoryOptions, categoryTabs, docId, draftProblem,
    fileExt, filterResources, formatSize, freshLabel, moduleOptions, revisionStatus, startCategory
} from '../lib/resourceBoard';

/* 자료실 = 게시판. 직원은 구분 탭에서 보고 내려받기만 하고, 등록·새 판 올리기·숨기기·되살리기는 관리자(품질)만 한다.
   지난 판과 숨긴 자료는 관리자에게만 보이는 「관리」 탭에 모았다.
   저장·권한·지난 판 보관은 lib/resourceFiles.js 가 맡고, 이 화면은 이름만 다룬다 —
   서버가 요구하는 영문 키는 lib/resourceBoard.js 가 자동으로 채우며 화면 어디에도 보이지 않는다. */

const ITEMS_PER_PAGE = 10;
const EMPTY_FORM = {
    base: null, category: '', categoryNew: '', module: '', moduleNew: '',
    title: '', description: '', sourceRef: '', revisionNote: '', file: null
};

// 모양은 원래 자료실·공지사항 게시판의 클래스 조합을 그대로 쓴다(새 색·그림자·글꼴 없음).
const BADGE = 'px-2 py-0.5 text-xs rounded-full font-medium';
const GRAY = 'bg-slate-100 text-slate-600';
const CATEGORY_COLOR = { '매뉴얼': 'bg-green-100 text-green-700', '절차서': 'bg-indigo-100 text-indigo-700' }; // 그 밖의 구분은 회색
const STATUS_COLOR = { '최신': 'bg-green-100 text-green-700', '숨김': 'bg-red-100 text-red-700' };
const INPUT = 'w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none disabled:bg-slate-50 disabled:text-slate-500';
const LABEL = 'block text-sm font-medium text-slate-700 mb-1';
const TH = 'px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase';
const ALERT = 'rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700';
const OVERLAY = 'fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-3';
const DIALOG = 'max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl';
const CLOSE = 'shrink-0 text-slate-400 hover:text-slate-600';

const formatDate = (value) => (value ? new Date(value).toLocaleDateString('ko-KR') : '-');
const categoryBadge = (label) => `${BADGE} ${CATEGORY_COLOR[label] || GRAY}`;
// 탭 모양 = 주간업무보고(WeeklyReport)의 TabButton 클래스 조합. 다른 점: 폭을 고르게 나누지 않아(flex-1 없음) 좁은 화면에서 줄바꿈되고,
// 고르지 않은 탭에도 투명한 밑줄을 둬 높이가 흔들리지 않는다.
const tabClass = (on) => `max-w-full px-4 py-3 flex items-center justify-center text-sm font-medium transition-colors border-b-2 ${on
    ? 'border-blue-600 text-blue-600 bg-blue-50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`;

// 자료명 옆 표시: 2판 이상이면 「N판」, 등록 14일 이내면 「새 자료」(1판)·「새 판」(2판 이상)
const Marks = ({ row }) => {
    const fresh = freshLabel(row);
    return (
        <>
            {row.revision >= 2 && <span className="text-xs text-slate-500 whitespace-nowrap">{row.revision}판</span>}
            {fresh && <span className={`${BADGE} whitespace-nowrap bg-amber-100 text-amber-700`}>{fresh}</span>}
        </>
    );
};

const Status = ({ row }) => {
    const status = revisionStatus(row);
    return <span className={`${BADGE} whitespace-nowrap ${STATUS_COLOR[status] || GRAY}`}>{status}</span>;
};

const ResourceRoom = ({ isAdmin = false }) => {
    const [resources, setResources] = useState([]);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [historyError, setHistoryError] = useState('');
    const [search, setSearch] = useState('');
    const [tab, setTab] = useState(''); // 고른 구분 탭(이름). 비어 있으면 자료가 있는 첫 탭
    const [adminOpen, setAdminOpen] = useState(false); // 「관리」 탭(관리자만)
    const [adminSearch, setAdminSearch] = useState('');
    const [hiddenOnly, setHiddenOnly] = useState(false);
    const [moduleFilter, setModuleFilter] = useState('');
    const [page, setPage] = useState(1);
    const [detailId, setDetailId] = useState('');
    const [form, setForm] = useState(EMPTY_FORM);
    const [modalOpen, setModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [actionError, setActionError] = useState('');
    const [notice, setNotice] = useState('');
    const [publishReceipt, setPublishReceipt] = useState(null);
    const publishLock = useRef(false);
    const fileInput = useRef(null);

    const loadResources = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const current = await listCurrentResources();
            setResources(current);
            return current;
        } catch (loadError) {
            console.error('Resource list failed:', loadError);
            setResources([]);
            setError('자료실을 불러오지 못했습니다.');
            return null;
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
            setHistoryError('판 이력을 불러오지 못했습니다.');
        }
    }, [isAdmin]);

    // 목록(누구나)과 판 이력(관리자)을 함께 다시 읽고, 읽은 목록을 돌려준다(조회 실패면 null).
    const refresh = useCallback(async () => (await Promise.all([loadResources(), loadHistory()]))[0], [loadHistory, loadResources]);

    useEffect(() => { refresh(); }, [refresh]);

    // 관리자는 지난 판·숨긴 자료까지 안다 — 문서 키 겹침 검사에 쓴다. 고르기 목록은 지금 보이는 자료 + 기본값만(숨긴 자료에만 있던 이름은 보기로 남기지 않는다).
    const known = useMemo(() => [...resources, ...history], [history, resources]);
    const categories = useMemo(() => categoryOptions(resources), [resources]);
    const modules = useMemo(() => moduleOptions(resources), [resources]);
    const moduleNames = useMemo(() => [...new Set(resources.map(row => row.module_label))], [resources]);
    // 고른 업무가 목록에서 사라졌으면(숨김 등) 그 조건은 없는 것으로 본다 — 풀 수 없는 조건이 남지 않게.
    const activeModule = moduleNames.length >= 2 && moduleNames.includes(moduleFilter) ? moduleFilter : '';
    const tabs = useMemo(() => categoryTabs(resources, activeModule), [activeModule, resources]);
    const activeTab = activeTabOf(tabs, tab); // 처음 열었거나 보던 구분이 사라졌으면 자료가 있는 첫 탭
    const adminView = isAdmin && adminOpen;
    const searching = !adminView && search.trim() !== ''; // 검색어가 있으면 탭과 무관하게 모든 구분에서 찾는다
    const filtered = useMemo(
        () => filterResources(resources, { search, category: activeTab, module: activeModule }),
        [activeModule, activeTab, resources, search]
    );
    const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
    const pageItems = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
    // 상세는 행이 아니라 「어느 자료인지」만 기억한다 → 새 판을 올리면 열려 있던 상세가 새 판 내용으로 바뀐다.
    const detail = (detailId && resources.find(row => docId(row) === detailId)) || null;
    const adminList = useMemo(() => adminRows(history, { search: adminSearch, hiddenOnly }), [adminSearch, hiddenOnly, history]);
    const summary = useMemo(() => adminSummary(history), [history]);
    const locked = saving || !!publishReceipt;
    const firstLoad = loading && resources.length === 0;
    const counted = !error && !firstLoad; // 조회 실패·첫 불러오기 중에는 건수를 적지 않는다(0건으로 읽히지 않게)
    const adminCounted = !historyError && !firstLoad;

    useEffect(() => { setPage(1); }, [search, activeTab, activeModule]);
    useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

    // 탭을 누르면 검색어를 지우고 그 탭으로 간다.
    const pickTab = (label) => {
        setSearch('');
        setAdminOpen(false);
        setTab(label);
    };

    // 「관리」 탭 열기. keyword 가 있으면(상세의 「판 이력」) 그 자료명으로 검색된 상태로 연다.
    const openAdmin = (keyword = '') => {
        if (!isAdmin) return;
        setSearch('');
        setDetailId('');
        setAdminSearch(keyword);
        setHiddenOnly(false);
        setAdminOpen(true);
    };

    const openForm = (base = null) => {
        if (!isAdmin) return;
        setNotice('');
        setActionError('');
        // 올려 둔 파일의 영수증이 남아 있으면 그 입력 그대로 다시 연다(같은 입력으로 다시 눌러야 올린 파일을 재사용한다).
        if (!publishReceipt) {
            setForm(base
                ? { ...EMPTY_FORM, base, title: base.title, description: base.description || '', sourceRef: base.source_ref || '' }
                // 새 자료: 구분의 처음 값 = 지금 보고 있는 탭(관리 탭·검색 중이면 비워 「구분을 고르세요」), 업무 = 전사 공통
                : { ...EMPTY_FORM, category: startCategory(categories, adminView || searching ? '' : activeTab), module: (modules.find(option => option.label === COMMON_MODULE) || modules[0]).label });
        }
        setModalOpen(true);
    };

    const closeForm = () => {
        if (saving) return;
        setModalOpen(false);
        setPublishReceipt(null); // 발행 실패로 남은 「다시 시도」 값을 버린다 → 다음에는 새 창이 열린다(올라간 파일은 지우지 않는다)
        setActionError('');
    };

    const updateForm = (key, value) => {
        setActionError('');
        setForm(previous => ({ ...previous, [key]: value }));
    };

    const pickFile = (file) => {
        if (!file) return;
        try {
            validateResourceFile(file); // 허용 형식·크기를 고르는 즉시 확인한다
            updateForm('file', file);
        } catch (fileError) {
            setActionError(fileError.message);
        }
    };

    const handlePublish = async (event) => {
        event.preventDefault();
        if (!isAdmin || publishLock.current) return;
        const base = form.base;
        const draft = buildDraft(form, { receipt: publishReceipt, categories, modules, takenDocKeys: known.map(row => row.doc_key) });
        const problem = draftProblem(draft, !!base);
        if (problem) {
            setActionError(problem);
            return;
        }
        publishLock.current = true;
        setSaving(true);
        setActionError('');
        try {
            await publishResourceRevision({ draft, file: form.file, receipt: publishReceipt, isAdmin });
            setModalOpen(false);
            setPublishReceipt(null);
            setForm(EMPTY_FORM);
            if (!base) { // 새 자료가 목록 맨 위에 보이도록 그 구분 탭으로 가고 찾기 조건을 푼다
                setModuleFilter('');
                pickTab(draft.categoryLabel);
            }
            const current = await refresh();
            const published = base && current?.find(row => docId(row) === docId(base));
            setNotice(base
                ? `새 판을 올렸습니다.${published ? ` 직원 화면에는 지금부터 ${published.revision}판만 보입니다.` : ''}`
                : `등록했습니다.${current ? ' 목록 맨 위에 있습니다.' : ''}`);
        } catch (publishError) {
            console.error('Resource publish failed:', publishError);
            setPublishReceipt(publishError.receipt || publishReceipt);
            setActionError(publishError.message || '자료 등록에 실패했습니다.');
        } finally {
            publishLock.current = false;
            setSaving(false);
        }
    };

    const handleHide = async (row) => {
        if (!isAdmin) return;
        const question = row.is_current
            ? `"${row.title}" 자료를 숨길까요? 직원 화면에서 사라집니다. 「관리」 탭에서 되살릴 수 있습니다.`
            : `"${row.title}" ${row.revision}판(지난 판)을 숨길까요? 「관리」 탭에서 되살릴 수 있습니다.`;
        if (!window.confirm(question)) return;
        setActionError('');
        setNotice('');
        try {
            await softDeleteResource({ id: row.id, isAdmin });
            setDetailId(''); // 숨긴 자료의 상세 선택을 비운다 → 나중에 되살아나도 상세 창이 저절로 열리지 않는다
            await refresh();
            setNotice('숨겼습니다. 「관리」 탭에서 되살릴 수 있습니다.');
        } catch (hideError) {
            console.error('Resource hide failed:', hideError);
            setActionError('숨기지 못했습니다. 잠시 뒤 다시 시도해 주세요.');
        }
    };

    const handleRestore = async (row) => {
        if (!isAdmin || !window.confirm(`"${row.title}" ${row.revision}판을 되살릴까요?`)) return;
        setActionError('');
        setNotice('');
        try {
            const restored = await restoreResource({ id: row.id, isAdmin }); // 되살아난 줄(is_current 포함)
            await refresh();
            setNotice(restored?.is_current ? '되살렸습니다. 직원 화면에 다시 보입니다.' : '되살렸습니다. 지난 판으로 돌아왔습니다.');
        } catch (restoreError) {
            console.error('Resource restore failed:', restoreError);
            setActionError('되살리지 못했습니다. 잠시 뒤 다시 시도해 주세요.');
        }
    };

    const handleDownload = async (row) => {
        setActionError('');
        setNotice('');
        try {
            window.location.assign(await createResourceDownload({ id: row.id, isAdmin })); // 5분짜리 주소
        } catch (downloadError) {
            console.error('Resource download failed:', downloadError);
            if (['RESOURCE_NOT_CURRENT', 'RESOURCE_DELETED', 'RESOURCE_NOT_FOUND'].includes(downloadError.code)) {
                // 열어 둔 화면이 낡았다(그사이 새 판이 올라왔거나 숨겨졌다) → 목록을 새로 읽어 최신본을 보여 준다
                await refresh();
                setActionError('이 자료가 방금 바뀌었습니다. 목록을 새로 불러왔으니 다시 확인해 주세요.');
            } else {
                setActionError(downloadError.message || '다운로드에 실패했습니다.');
            }
        }
    };

    // 오류·성공 알림은 지금 맨 위에 떠 있는 곳(올리는 창 > 상세 창 > 목록) 한 군데에만 보인다.
    const feedback = (
        <>
            {actionError && <div role="alert" className={ALERT}>{actionError}</div>}
            {notice && <div role="status" data-testid="resource-notice" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</div>}
        </>
    );

    const downloadButton = (row, testid) => (
        <button type="button" data-testid={testid} onClick={(event) => { event.stopPropagation(); handleDownload(row); }}
            aria-label={`${row.original_name} 다운로드`} title={row.original_name}
            className="inline-flex shrink-0 items-center rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700 hover:bg-slate-100">
            <Download className="mr-1 h-3.5 w-3.5" />{fileExt(row.original_name)}
        </button>
    );

    const moduleNote = (row) => row.module_label !== COMMON_MODULE && row.module_label; // 「전사 공통」은 적지 않는다

    // 관리 탭(관리자만)의 줄마다 붙는 단추 — 숨긴 판은 서버가 내려받기를 막으므로 「되살리기」만 둔다.
    const adminActions = (row) => {
        const name = `${row.title} ${row.revision}판`;
        return row.is_deleted ? (
            <button type="button" data-testid="resource-restore" aria-label={`${name} 되살리기`} onClick={() => handleRestore(row)}
                className="inline-flex items-center rounded-lg border border-primary-200 px-2.5 py-2 text-xs text-primary-700 hover:bg-primary-50">
                <RotateCcw className="mr-1 h-3.5 w-3.5" />되살리기
            </button>
        ) : (
            <>
                <button type="button" data-testid="resource-admin-download" aria-label={`${name} 다운로드`} title={row.original_name} onClick={() => handleDownload(row)}
                    className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700 hover:bg-slate-100">
                    <Download className="mr-1 h-3.5 w-3.5" />다운로드
                </button>
                <button type="button" data-testid="resource-admin-hide" aria-label={`${name} 숨기기`} onClick={() => handleHide(row)}
                    className="inline-flex items-center rounded-lg border border-red-200 px-2.5 py-2 text-xs text-red-700 hover:bg-red-50">
                    <EyeOff className="mr-1 h-3.5 w-3.5" />숨기기
                </button>
            </>
        );
    };

    // 「관리」 탭 화면 — 지난 판·숨긴 판까지 모든 판을 자료별로 모아 보여 준다. 관리자가 아니면 만들지 않는다(adminView).
    // ponytail: 모든 판을 쪽 나눔 없이 한 번에 그린다 — 수백 판이 넘어 느려지면 목록처럼 10건씩 나눈다
    const adminPanel = adminView && (
        <div data-testid="resource-admin-panel">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 space-y-3">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h2 className="text-sm font-medium text-slate-900">판 이력 · 숨긴 자료 관리</h2>
                    {adminCounted && <p className="text-xs text-slate-500">자료 {summary.docs}건 · 판 {summary.revisions}개 · 숨김 {summary.hidden}개</p>}
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-x-4 gap-y-2">
                    <div className="relative w-full sm:max-w-xs">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input id="resource-admin-search" data-testid="resource-admin-search" type="search" aria-label="판 이력 검색" placeholder="자료명·구분·파일명 검색..."
                            value={adminSearch} onChange={event => setAdminSearch(event.target.value)}
                            className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-400 transition-all" />
                    </div>
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                        <input type="checkbox" data-testid="resource-admin-hidden-only" checked={hiddenOnly} onChange={event => setHiddenOnly(event.target.checked)} className="h-4 w-4" />
                        숨긴 것만 보기
                    </label>
                </div>
            </div>

            {firstLoad ? (
                <p className="py-10 text-center text-slate-500">자료실을 불러오는 중입니다…</p>
            ) : historyError ? (
                <div role="alert" className="px-4 py-10 text-center text-sm text-red-700">
                    {historyError} <button type="button" onClick={refresh} className="font-medium underline">다시 시도</button>
                </div>
            ) : adminList.length === 0 ? (
                <p className="py-10 text-center text-slate-500">{history.length === 0 ? '판 이력이 없습니다.' : '조건에 맞는 판이 없습니다.'}</p>
            ) : (
                <>
                    {/* 넓은 화면(1280px 이상): 표. 열이 7개라 목록 표(768px)보다 넓어야 읽힌다. 열 폭을 고정(table-fixed)해 긴 글은 칸 안에서 줄바꿈된다. */}
                    <div className="hidden xl:block">
                        <table className="w-full table-fixed divide-y divide-slate-200 text-sm">
                            <thead className="bg-slate-50">
                                <tr>
                                    {[['자료명', ''], ['구분', 'w-28'], ['판 · 상태', 'w-28'], ['등록일 · 등록자', 'w-36'], ['바뀐 점', ''], ['파일', ''], ['관리', 'w-48']].map(([head, width]) => (
                                        <th key={head} scope="col" className={`px-4 py-3 text-left text-xs font-medium text-slate-500 ${width}`}>{head}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-100">
                                {adminList.map(row => (
                                    <tr key={row.id} data-testid="resource-admin-row" data-status={revisionStatus(row)} className={row.is_deleted ? 'bg-slate-50' : undefined}>
                                        <td className="px-4 py-3 text-slate-900 break-words">{row.title}</td>
                                        <td className="px-4 py-3">
                                            <span title={row.category_label} className={`${categoryBadge(row.category_label)} inline-block max-w-full truncate align-middle`}>{row.category_label}</span>
                                        </td>
                                        <td className="px-4 py-3"><span className="mr-2 text-slate-700 whitespace-nowrap">{row.revision}판</span><Status row={row} /></td>
                                        <td className="px-4 py-3 text-xs text-slate-500 break-words">{formatDate(row.created_at)} · {row.registered_by_name}</td>
                                        <td className="px-4 py-3 text-xs text-slate-600 whitespace-pre-wrap break-words">{row.revision_note}</td>
                                        <td className="px-4 py-3 text-xs text-slate-600 break-all">{row.original_name}</td>
                                        <td className="px-4 py-3"><div className="flex flex-wrap gap-1">{adminActions(row)}</div></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {/* 그보다 좁은 화면: 카드형 줄. 고정 폭이 없어 가로 스크롤이 생기지 않는다. */}
                    <ul className="xl:hidden divide-y divide-slate-100">
                        {adminList.map(row => (
                            <li key={row.id} data-testid="resource-admin-row" data-status={revisionStatus(row)} className={`p-4 space-y-2 ${row.is_deleted ? 'bg-slate-50' : ''}`}>
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className={`${categoryBadge(row.category_label)} max-w-full truncate`}>{row.category_label}</span>
                                    <span className="text-xs text-slate-700 whitespace-nowrap">{row.revision}판</span>
                                    <Status row={row} />
                                </div>
                                <p className="text-sm font-medium text-slate-900 break-words">{row.title}</p>
                                <p className="text-xs text-slate-500 break-words">{formatDate(row.created_at)} · {row.registered_by_name}</p>
                                {row.revision_note && <p className="text-xs text-slate-600 whitespace-pre-wrap break-words">바뀐 점: {row.revision_note}</p>}
                                <p className="text-xs text-slate-600 break-all">{row.original_name}</p>
                                <div className="flex flex-wrap gap-2">{adminActions(row)}</div>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </div>
    );

    return (
        <div className="space-y-6 animate-fade-in" data-testid="resource-room">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <FileText className="w-6 h-6 text-green-600" />
                        자료실
                    </h1>
                    <p className="text-slate-500">업무 관련 서식 및 매뉴얼</p>
                </div>
                <div className="flex items-center gap-2">
                    <button type="button" onClick={() => { setNotice(''); setActionError(''); refresh(); }} aria-label="자료실 새로고침" title="새로고침"
                        className="p-2 text-slate-400 hover:text-primary-600 bg-white border border-slate-200 rounded-lg shadow-sm">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    {isAdmin && (
                        <button type="button" onClick={() => openForm()} data-testid="resource-upload-open"
                            className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors shadow-sm">
                            <Plus className="w-4 h-4 mr-2" />
                            자료 등록
                        </button>
                    )}
                </div>
            </div>

            <p className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
                <Info className="w-4 h-4 mt-0.5 shrink-0" />
                <span>여기 올라온 파일이 최신본입니다. 내려받아 둔 파일이나 출력물은 개정 전 것일 수 있으니, 쓰기 전에 등록일을 확인하세요.</span>
            </p>

            {!modalOpen && !detail && feedback}

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {/* 구분 탭 — 「전체」 탭은 없다. 좁은 화면에서는 줄바꿈된다(가로 스크롤 없음).
                    ponytail: 화살표 키로 탭 사이를 옮기는 기능은 넣지 않았다(탭마다 Tab 키로 닿는다) — 필요해지면 roving tabindex 를 더한다 */}
                <div role="tablist" aria-label="자료 구분" className="flex flex-wrap border-b border-slate-200">
                    {tabs.map(item => {
                        const on = !adminView && !searching && item.label === activeTab; // 검색 중에는 고른 표시가 없다
                        return (
                            <button key={item.label} type="button" role="tab" aria-selected={on} data-testid="resource-tab" data-label={item.label} title={item.label}
                                onClick={() => pickTab(item.label)} className={tabClass(on)}>
                                <span className="truncate">{item.label}</span>
                                {counted && <span className="ml-1.5 text-xs">{item.count}</span>}
                            </button>
                        );
                    })}
                    {isAdmin && (
                        <button type="button" role="tab" aria-selected={adminView} data-testid="resource-tab-admin" onClick={() => openAdmin()}
                            className={`${tabClass(adminView)} ml-auto`}>
                            <Settings className="w-4 h-4 mr-2" />관리
                        </button>
                    )}
                </div>

                {!adminView && (
                    <div className="p-4 border-b border-slate-100 bg-slate-50/50 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            {moduleNames.length >= 2 && (
                                <select aria-label="업무 고르기" value={activeModule} onChange={event => setModuleFilter(event.target.value)}
                                    className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-400">
                                    <option value="">모든 업무</option>
                                    {moduleNames.map(name => <option key={name} value={name}>{name}</option>)}
                                </select>
                            )}
                            <div className="relative w-full sm:max-w-xs">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input id="resource-search" data-testid="resource-search" type="search" aria-label="자료 검색" placeholder="자료명·구분·파일명 검색..."
                                    value={search} onChange={event => setSearch(event.target.value)}
                                    className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-400 transition-all" />
                            </div>
                            {counted && !searching && <span className="text-xs text-slate-500 sm:ml-auto">총 {filtered.length}건</span>}
                        </div>
                        {searching && (
                            <p data-testid="resource-search-scope" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-700">
                                <span role="status">모든 구분에서 찾은 결과{counted && ` ${filtered.length}건`}</span>
                                <button type="button" data-testid="resource-search-clear" onClick={() => setSearch('')} className="font-medium text-primary-600 hover:underline">검색 지우기</button>
                            </p>
                        )}
                    </div>
                )}

                {adminView ? adminPanel : firstLoad ? (
                    <p className="py-10 text-center text-slate-500">자료실을 불러오는 중입니다…</p>
                ) : error ? (
                    <div role="alert" className="px-4 py-10 text-center text-sm text-red-700">
                        {error} <button type="button" onClick={refresh} className="font-medium underline">다시 시도</button>
                    </div>
                ) : filtered.length === 0 ? (
                    <p className="py-10 text-center text-slate-500">
                        {resources.length === 0 ? '등록된 자료가 없습니다.' : searching || activeModule ? '조건에 맞는 자료가 없습니다.' : `「${activeTab}」 자료가 아직 없습니다.`}
                    </p>
                ) : (
                    <>
                        {/* 넓은 화면: 표. 열 폭을 고정(table-fixed)해 긴 자료명이 표를 밀어내지 않고 칸 안에서 줄바꿈된다. */}
                        <div className="hidden md:block">
                            <table className="w-full table-fixed divide-y divide-slate-200">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className={`${TH} w-14`}>No</th>
                                        <th className={`${TH} w-28`}>구분</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">자료명</th>
                                        <th className={`${TH} w-24`}>등록자</th>
                                        <th className={`${TH} w-28`}>등록일</th>
                                        <th className={`${TH} w-28`}>첨부</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-slate-100">
                                    {pageItems.map((row, index) => (
                                        <tr key={row.id} data-testid="resource-row" className="hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => setDetailId(docId(row))}>
                                            <td className="px-4 py-4 text-center text-xs text-slate-400">{filtered.length - (page - 1) * ITEMS_PER_PAGE - index}</td>
                                            <td className="px-4 py-4 text-center">
                                                <span title={row.category_label} className={`${categoryBadge(row.category_label)} inline-block max-w-full truncate align-middle`}>{row.category_label}</span>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                                    {/* 누르면 줄(tr)의 onClick 이 상세를 연다 — 버튼이라 키보드(Tab·Enter)로도 열린다 */}
                                                    <button type="button" className="min-w-0 text-left text-sm font-medium text-slate-900 break-words hover:text-primary-600 hover:underline">{row.title}</button>
                                                    <Marks row={row} />
                                                </div>
                                                {moduleNote(row) && <p className="mt-1 text-xs text-slate-500 break-words">{moduleNote(row)}</p>}
                                            </td>
                                            <td className="px-4 py-4 text-center text-sm text-slate-600 truncate" title={row.registered_by_name}>{row.registered_by_name}</td>
                                            <td className="px-4 py-4 text-center text-xs text-slate-400 whitespace-nowrap">{formatDate(row.created_at)}</td>
                                            <td className="px-4 py-4 text-center">{downloadButton(row, 'resource-row-download')}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {/* 좁은 화면(휴대폰): 카드형 줄. 고정 폭이 없어 가로 스크롤이 생기지 않는다. */}
                        <ul className="md:hidden divide-y divide-slate-100">
                            {pageItems.map(row => (
                                <li key={row.id} data-testid="resource-row" className="flex items-start gap-3 p-4 cursor-pointer" onClick={() => setDetailId(docId(row))}>
                                    <button type="button" className="min-w-0 flex-1 text-left">
                                        <span className="flex flex-wrap items-center gap-2">
                                            <span className={`${categoryBadge(row.category_label)} max-w-full truncate`}>{row.category_label}</span>
                                            <Marks row={row} />
                                        </span>
                                        <span className="mt-1.5 block text-sm font-medium text-slate-900 break-words">{row.title}</span>
                                        <span className="mt-1 block text-xs text-slate-500 break-words">
                                            {formatDate(row.created_at)} · {row.registered_by_name}{moduleNote(row) && ` · ${moduleNote(row)}`}
                                        </span>
                                    </button>
                                    {downloadButton(row, 'resource-row-download')}
                                </li>
                            ))}
                        </ul>
                    </>
                )}

                {!adminView && totalPages > 1 && (
                    <div className="flex justify-center items-center p-4 border-t border-slate-100 gap-2">
                        <button type="button" aria-label="이전 페이지" onClick={() => setPage(current => Math.max(1, current - 1))} disabled={page === 1} className="p-1 rounded hover:bg-slate-100 disabled:opacity-50"><ChevronLeft className="w-5 h-5 text-slate-500" /></button>
                        <span className="text-sm text-slate-600">{page} / {totalPages}</span>
                        <button type="button" aria-label="다음 페이지" onClick={() => setPage(current => Math.min(totalPages, current + 1))} disabled={page === totalPages} className="p-1 rounded hover:bg-slate-100 disabled:opacity-50"><ChevronRight className="w-5 h-5 text-slate-500" /></button>
                    </div>
                )}
            </div>

            {detail && (
                <div className={OVERLAY}>
                    <section role="dialog" aria-modal="true" aria-labelledby="resource-detail-title" data-testid="resource-detail" className={`${DIALOG} space-y-4`}>
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                    <span className={categoryBadge(detail.category_label)}>{detail.category_label}</span>
                                    <span className="text-xs text-slate-500">{detail.module_label}</span>
                                </div>
                                <h2 id="resource-detail-title" className="text-xl font-bold text-slate-900 break-words">{detail.title}</h2>
                                <p className="mt-1 text-sm text-slate-500">{detail.revision}판 · 최신본 · {formatDate(detail.created_at)} · {detail.registered_by_name}</p>
                                {detail.source_ref && <p className="mt-1 text-xs text-slate-500 break-words">원본 참조: {detail.source_ref}</p>}
                            </div>
                            <button type="button" onClick={() => setDetailId('')} aria-label="상세 닫기" className={CLOSE}><X className="w-6 h-6" /></button>
                        </div>

                        {!modalOpen && feedback}

                        {detail.description && <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{detail.description}</p>}

                        {detail.revision_note && (detail.revision >= 2 || detail.revision_note.trim() !== FIRST_NOTE) && (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                                <p className="font-medium">이번에 바뀐 점</p>
                                <p className="mt-1 whitespace-pre-wrap break-words">{detail.revision_note}</p>
                            </div>
                        )}

                        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 p-4">
                            <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm"><FileText className="w-6 h-6 text-primary-500" /></div>
                            <div className="min-w-0 flex-1 basis-40">
                                <h3 className="text-sm font-medium text-slate-900 break-all">{detail.original_name}</h3>
                                <p className="text-xs text-slate-500">첨부파일 · {formatSize(detail.file_size)}</p>
                            </div>
                            <button type="button" data-testid="resource-download" onClick={() => handleDownload(detail)}
                                className="flex w-full sm:w-auto items-center justify-center px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors shadow-sm">
                                <Download className="w-4 h-4 mr-2" />
                                다운로드
                            </button>
                        </div>

                        {isAdmin && (
                            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
                                <button type="button" data-testid="resource-history-link" onClick={() => openAdmin(detail.title)}
                                    className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
                                    <History className="mr-1.5 h-4 w-4" />판 이력
                                </button>
                                <button type="button" data-testid="resource-revise-open" onClick={() => openForm(detail)}
                                    className="inline-flex items-center rounded-lg border border-primary-200 px-3 py-2 text-sm text-primary-700 hover:bg-primary-50">
                                    <Upload className="mr-1.5 h-4 w-4" />새 판 올리기
                                </button>
                                <button type="button" data-testid="resource-hide" onClick={() => handleHide(detail)}
                                    className="inline-flex items-center rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50">
                                    <EyeOff className="mr-1.5 h-4 w-4" />숨기기
                                </button>
                            </div>
                        )}
                    </section>
                </div>
            )}

            {modalOpen && isAdmin && (
                <div className={OVERLAY}>
                    <section role="dialog" aria-modal="true" aria-labelledby="resource-form-heading" data-testid="resource-form" className={DIALOG}>
                        <div className="flex justify-between items-start gap-3 mb-4">
                            <div className="min-w-0">
                                {form.base && <p className="mb-1 text-xs font-medium text-primary-700">새 판 올리기</p>}
                                <h2 id="resource-form-heading" className="text-xl font-bold text-slate-900 break-words">
                                    {form.base ? `${form.base.title} (현재 ${form.base.revision}판)` : '새 자료 등록'}
                                </h2>
                            </div>
                            <button type="button" onClick={closeForm} aria-label="올리는 창 닫기" className={CLOSE}><X className="w-6 h-6" /></button>
                        </div>

                        {publishReceipt && (
                            <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                                {publishReceipt.uploaded
                                    ? '파일은 이미 올라갔고 등록만 끝나지 않았습니다. 입력은 바꿀 수 없으며, 아래 「다시 시도」를 누르면 올린 파일 그대로 등록을 마칩니다.'
                                    : '파일이 올라갔는지 확인되지 않았습니다. 입력은 바꿀 수 없으며, 아래 「다시 시도」를 누르면 같은 파일로 다시 올립니다.'}
                            </p>
                        )}

                        <form onSubmit={handlePublish} className="space-y-4">
                            {!form.base && (
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div>
                                        <label htmlFor="resource-form-category" className={LABEL}>구분 *</label>
                                        <select id="resource-form-category" required disabled={locked} value={form.category} onChange={event => updateForm('category', event.target.value)} className={INPUT}>
                                            <option value="" disabled>구분을 고르세요</option>
                                            {categories.map(option => <option key={option.label} value={option.label}>{option.label}</option>)}
                                            <option value={NEW_OPTION}>직접 입력…</option>
                                        </select>
                                        {form.category === NEW_OPTION && (
                                            <input id="resource-form-category-new" type="text" required disabled={locked} value={form.categoryNew} onChange={event => updateForm('categoryNew', event.target.value)}
                                                aria-label="새 구분 이름" placeholder="새 구분 이름" className={`${INPUT} mt-2`} />
                                        )}
                                    </div>
                                    <div>
                                        <label htmlFor="resource-form-module" className={LABEL}>업무 *</label>
                                        <select id="resource-form-module" required disabled={locked} value={form.module} onChange={event => updateForm('module', event.target.value)} className={INPUT}>
                                            {modules.map(option => <option key={option.label} value={option.label}>{option.label}</option>)}
                                            <option value={NEW_OPTION}>직접 입력…</option>
                                        </select>
                                        {form.module === NEW_OPTION && (
                                            <input id="resource-form-module-new" type="text" required disabled={locked} value={form.moduleNew} onChange={event => updateForm('moduleNew', event.target.value)}
                                                aria-label="새 업무 이름" placeholder="새 업무 이름" className={`${INPUT} mt-2`} />
                                        )}
                                    </div>
                                </div>
                            )}
                            <div>
                                <label htmlFor="resource-form-title" className={LABEL}>자료명 *</label>
                                <input id="resource-form-title" type="text" required disabled={locked} value={form.title} onChange={event => updateForm('title', event.target.value)}
                                    placeholder="자료 제목을 입력하세요" className={INPUT} />
                            </div>
                            <div>
                                <label htmlFor="resource-form-description" className={LABEL}>내용</label>
                                <textarea id="resource-form-description" rows="4" disabled={locked} value={form.description} onChange={event => updateForm('description', event.target.value)}
                                    placeholder="자료에 대한 설명을 입력하세요..." className={`${INPUT} resize-none`} />
                            </div>
                            <div>
                                <label htmlFor="resource-form-ref" className={LABEL}>원본 참조 (선택)</label>
                                <input id="resource-form-ref" type="text" disabled={locked} value={form.sourceRef} onChange={event => updateForm('sourceRef', event.target.value)}
                                    placeholder="다른 업무 기록에서 나온 자료일 때: NCR 번호, 주간보고 주차, 인수검사 LOT 등" className={INPUT} />
                            </div>
                            <div>
                                <span className={LABEL}>{form.base ? '새 파일 *' : '첨부파일 *'}</span>
                                <div
                                    className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-lg transition-colors relative ${locked ? 'opacity-60' : 'hover:border-primary-500 cursor-pointer'}`}
                                    onDragOver={event => event.preventDefault()}
                                    onDrop={(event) => { event.preventDefault(); if (!locked) pickFile(event.dataTransfer.files?.[0]); }}
                                    onClick={() => fileInput.current?.click()}
                                >
                                    <div className="min-w-0 space-y-1 text-center">
                                        <FileText className="mx-auto h-12 w-12 text-slate-400" />
                                        <div className="flex flex-wrap text-sm text-slate-600 justify-center">
                                            <label htmlFor="resource-form-file" className="relative cursor-pointer bg-white rounded-md font-medium text-primary-600 hover:text-primary-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary-500" onClick={event => event.stopPropagation()}>
                                                <span>파일 선택</span>
                                                <input id="resource-form-file" ref={fileInput} type="file" disabled={locked} className="sr-only" onChange={event => pickFile(event.target.files?.[0])} />
                                            </label>
                                            <p className="pl-1">또는 여기로 끌어다 놓기</p>
                                        </div>
                                        <p className={`text-xs break-all ${form.file ? 'font-medium text-slate-900' : 'text-slate-500'}`}>
                                            {form.file ? `${form.file.name} · ${formatSize(form.file.size)}` : '파일을 선택하세요'}
                                        </p>
                                    </div>
                                </div>
                                <p className="mt-1 text-xs text-slate-500">PDF, 이미지, Office, CSV/TXT, ZIP, HWP/HWPX · 최대 {MAX_RESOURCE_FILE_SIZE / 1048576}MB · 파일 이름은 올린 그대로 보존됩니다.</p>
                            </div>
                            {form.base && (
                                <div>
                                    <label htmlFor="resource-form-note" className={LABEL}>바뀐 점 *</label>
                                    <textarea id="resource-form-note" rows="2" required disabled={locked} value={form.revisionNote} onChange={event => updateForm('revisionNote', event.target.value)}
                                        placeholder="무엇이 바뀌었는지 적어 주세요" className={`${INPUT} resize-none`} />
                                    <p className="mt-2 text-xs text-slate-500">올리면 직원 화면에는 새 판만 보이고, 지난 판은 「관리」 탭에 보관됩니다.</p>
                                </div>
                            )}

                            {feedback}

                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={closeForm} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">취소</button>
                                <button type="submit" data-testid="resource-form-submit" disabled={saving}
                                    className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-sm disabled:opacity-50">
                                    {saving ? '올리는 중…' : publishReceipt ? '다시 시도' : form.base ? '새 판 올리기' : '등록하기'}
                                </button>
                            </div>
                        </form>
                    </section>
                </div>
            )}
        </div>
    );
};

export default ResourceRoom;
