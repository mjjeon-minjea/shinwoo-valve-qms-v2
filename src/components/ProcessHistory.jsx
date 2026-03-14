import { useState, useEffect, useRef, useMemo } from 'react';
import {
    Upload, Plus, Trash2, Edit, X, RefreshCw, Filter, Save, Search, ClipboardList
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '../lib/api';
import ProgressModal from './ProgressModal';

// Helper: Convert Excel Serial Date to YYYY-MM-DD
const parseExcelDate = (val) => {
    if (!val) return '';
    if (typeof val === 'number') {
        const date = new Date(Math.round((val - 25569) * 86400 * 1000));
        return date.toISOString().split('T')[0];
    }
    if (typeof val === 'string') {
        if (!isNaN(Number(val)) && !val.includes('-')) {
            const date = new Date(Math.round((Number(val) - 25569) * 86400 * 1000));
            return date.toISOString().split('T')[0];
        }
        return val.trim();
    }
    return String(val);
};

const parseNum = (val) => {
    if (val === undefined || val === null || val === '') return 0;
    const n = Number(val);
    return isNaN(n) ? 0 : n;
};

// ====================================================
// 수기 등록 / 수정 모달
// ====================================================
const ProcessHistoryModal = ({ isOpen, onClose, onSave, editingItem }) => {
    const [form, setForm] = useState({
        inspectionDate: '', modelCategory: '', modelName: '', workplaceFull: '', itemName: '',
        plannedQuantity: '', inspectedQuantity: '', failedQuantity: '', passedQuantity: '',
        resolution: '', isResolutionEntered: '해당없음'
    });

    useEffect(() => {
        if (editingItem) {
            setForm({
                inspectionDate: editingItem.inspectionDate || '',
                modelCategory: editingItem.modelCategory || '',
                modelName: editingItem.modelName || '',
                workplaceFull: editingItem.workplaceFull || '',
                itemName: editingItem.itemName || '',
                plannedQuantity: editingItem.plannedQuantity || '',
                inspectedQuantity: editingItem.inspectedQuantity || '',
                failedQuantity: editingItem.failedQuantity || '',
                passedQuantity: editingItem.passedQuantity || '',
                resolution: editingItem.resolution || '',
                isResolutionEntered: editingItem.isResolutionEntered || '해당없음',
            });
        } else {
            setForm({
                inspectionDate: new Date().toISOString().split('T')[0],
                modelCategory: '', modelName: '', workplaceFull: '', itemName: '',
                plannedQuantity: '', inspectedQuantity: '', failedQuantity: '', passedQuantity: '',
                resolution: '', isResolutionEntered: '해당없음'
            });
        }
    }, [editingItem, isOpen]);

    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({
            ...form,
            plannedQuantity: parseNum(form.plannedQuantity),
            inspectedQuantity: parseNum(form.inspectedQuantity),
            failedQuantity: parseNum(form.failedQuantity),
            passedQuantity: parseNum(form.passedQuantity),
        });
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden animate-fade-in">
                <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <ClipboardList className="w-5 h-5 text-blue-600" />
                        {editingItem ? '공정검사 이력 수정' : '공정검사 이력 등록'}
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">검사일자 *</label>
                            <input type="date" name="inspectionDate" value={form.inspectionDate} onChange={handleChange}
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" required />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">모델대분류</label>
                            <input type="text" name="modelCategory" value={form.modelCategory} onChange={handleChange}
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">모델명</label>
                            <input type="text" name="modelName" value={form.modelName} onChange={handleChange}
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">작업장 / 설비</label>
                            <input type="text" name="workplaceFull" value={form.workplaceFull} onChange={handleChange}
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">품목명</label>
                            <input type="text" name="itemName" value={form.itemName} onChange={handleChange}
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">지시수량</label>
                            <input type="number" name="plannedQuantity" value={form.plannedQuantity} onChange={handleChange}
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">검사수량</label>
                            <input type="number" name="inspectedQuantity" value={form.inspectedQuantity} onChange={handleChange}
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">부적합수량</label>
                            <input type="number" name="failedQuantity" value={form.failedQuantity} onChange={handleChange}
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">합격수량</label>
                            <input type="number" name="passedQuantity" value={form.passedQuantity} onChange={handleChange}
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">처리방안</label>
                        <textarea name="resolution" value={form.resolution} onChange={handleChange} rows={2}
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">처리방안 기입여부</label>
                        <select name="isResolutionEntered" value={form.isResolutionEntered} onChange={handleChange}
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                            <option value="Y">Y (기입완료)</option>
                            <option value="N">N (미기입)</option>
                            <option value="해당없음">해당없음</option>
                        </select>
                    </div>
                    <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                        <button type="button" onClick={onClose}
                            className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
                            취소
                        </button>
                        <button type="submit"
                            className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                            <Save className="w-4 h-4" />
                            {editingItem ? '수정 완료' : '등록'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ====================================================
// 메인 컴포넌트
// ====================================================
const ProcessHistory = () => {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [searchText, setSearchText] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [filters, setFilters] = useState({});
    const [activeFilterColumn, setActiveFilterColumn] = useState(null);
    const [progressState, setProgressState] = useState({ show: false, current: 0, total: 100, mode: 'upload' });
    const fileInputRef = useRef(null);
    const ITEMS_PER_PAGE = 50;

    const updateProgress = (current, total, mode) => {
        setProgressState({ show: true, current, total, mode });
    };
    const closeProgress = () => setProgressState(prev => ({ ...prev, show: false }));

    const fetchRecords = async () => {
        setLoading(true);
        try {
            const res = await api.fetch('/process_inspections');
            if (res.ok) {
                const data = await res.json();
                setRecords(data);
            }
        } catch (error) {
            console.error('Fetch process_inspections failed:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRecords();
    }, []);

    // ---- Excel Upload ----
    const handleExcelUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                updateProgress(10, 100, 'upload');
                const wb = XLSX.read(evt.target.result, { type: 'binary' });
                // Check if 'LOW DATA' sheet exists, otherwise fall back to first sheet
                const sheetName = wb.SheetNames.includes('LOW DATA') ? 'LOW DATA' : wb.SheetNames[0];
                const ws = wb.Sheets[sheetName];
                const rawRows = XLSX.utils.sheet_to_json(ws, { raw: true, defval: '' });

                updateProgress(40, 100, 'upload');

                const findVal = (row, keys) => {
                    for (const k of keys) {
                        if (row[k] !== undefined && row[k] !== '') return row[k];
                    }
                    return '';
                };

                const mapped = rawRows.map((row, idx) => ({
                    id: `pi_${Date.now()}_${idx}`,
                    workOrderNo: String(findVal(row, ['지시번호']) || ''),
                    processCode: String(findVal(row, ['공정']) || ''),
                    workplaceFull: String(findVal(row, ['작업장명']) || ''),
                    inspectionType: String(findVal(row, ['검사구분']) || ''),
                    itemCode: String(findVal(row, ['품목번호']) || ''),
                    itemName: String(findVal(row, ['품목명칭', '품목명']) || ''),
                    inspectionDate: parseExcelDate(findVal(row, ['검사일자'])),
                    plannedQuantity: parseNum(findVal(row, ['지시수량'])),
                    inspectedQuantity: parseNum(findVal(row, ['검사수량'])),
                    failedQuantity: parseNum(findVal(row, ['부적합수량'])),
                    passedQuantity: parseNum(findVal(row, ['합격수량'])),
                    orderNo: String(findVal(row, ['수주or계획번호', '수주번호']) || ''),
                    resolution: String(findVal(row, ['처리방안']) || ''),
                    workplaceCode: String(findVal(row, ['작업장코드']) || ''),
                    modelName: String(findVal(row, ['모델명']) || ''),
                    modelCategory: String(findVal(row, ['모델대분류']) || ''),
                    workplace: String(findVal(row, ['작업장']) || ''),
                    equipmentName: String(findVal(row, ['설비명']) || ''),
                    isResolutionEntered: String(findVal(row, ['처리방안 기입여부']) || '해당없음'),
                }));

                // 빈 행 제거
                const valid = mapped.filter(r => r.inspectionDate && (r.itemName || r.modelName || r.workplaceFull));

                updateProgress(70, 100, 'upload');

                const res = await api.fetch('/process_inspections/batch', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: valid
                });

                if (res.ok) {
                    const result = await res.json();
                    updateProgress(100, 100, 'upload');
                    setTimeout(() => closeProgress(), 500);
                    alert(`✅ ${result.count}건이 업로드되었습니다.\n공정검사 대시보드와 자동 연동됩니다.`);
                    fetchRecords();
                } else {
                    throw new Error('Batch upload failed');
                }
            } catch (err) {
                console.error('Excel upload error:', err);
                closeProgress();
                alert('업로드 중 오류가 발생했습니다.');
            } finally {
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsBinaryString(file);
    };

    // ---- Save (Add/Edit) ----
    const handleSave = async (formData) => {
        try {
            if (editingItem) {
                await api.fetch(`/process_inspections/${editingItem.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: { ...editingItem, ...formData }
                });
            } else {
                await api.fetch('/process_inspections', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: { id: `pi_${Date.now()}`, ...formData }
                });
            }
            setIsModalOpen(false);
            setEditingItem(null);
            fetchRecords();
        } catch (err) {
            console.error('Save error:', err);
            alert('저장 중 오류가 발생했습니다.');
        }
    };

    // ---- Delete Single ----
    const handleDelete = async (id) => {
        if (!window.confirm('이 항목을 삭제하시겠습니까?')) return;
        await api.fetch(`/process_inspections/${id}`, { method: 'DELETE' });
        fetchRecords();
    };

    // ---- Delete All ----
    const handleDeleteAll = async () => {
        if (records.length === 0) { alert('삭제할 데이터가 없습니다.'); return; }
        if (!window.confirm('모든 공정검사 이력을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) return;
        if (!window.confirm('정말로 전체 삭제하시겠습니까?')) return;
        try {
            updateProgress(0, 100, 'delete');
            await api.fetch('/process_inspections', { method: 'DELETE' });
            updateProgress(100, 100, 'delete');
            setTimeout(() => closeProgress(), 500);
            fetchRecords();
        } catch (err) {
            closeProgress();
            alert('삭제 중 오류가 발생했습니다.');
        }
    };

    // ---- Filtering ----
    const FILTER_COLUMNS = ['modelName', 'workplaceFull', 'isResolutionEntered'];

    const getUniqueValues = (key) => {
        const vals = records.map(r => r[key] || '(미지정)');
        return [...new Set(vals)].sort();
    };

    const handleFilterChange = (key, val) => {
        setFilters(prev => {
            const cur = prev[key] || [];
            const updated = cur.includes(val) ? cur.filter(v => v !== val) : [...cur, val];
            if (updated.length === 0) { const n = { ...prev }; delete n[key]; return n; }
            return { ...prev, [key]: updated };
        });
    };

    const clearFilter = (key) => {
        setFilters(prev => { const n = { ...prev }; delete n[key]; return n; });
    };

    // ---- Derived data ----
    const filtered = useMemo(() => {
        return records.filter(item => {
            const matchSearch = !searchText ||
                (item.modelName || '').toLowerCase().includes(searchText.toLowerCase()) ||
                (item.workplaceFull || '').toLowerCase().includes(searchText.toLowerCase()) ||
                (item.itemName || '').toLowerCase().includes(searchText.toLowerCase());

            const matchFilters = Object.entries(filters).every(([key, vals]) => {
                if (!vals || vals.length === 0) return true;
                return vals.includes(item[key] || '(미지정)');
            });

            return matchSearch && matchFilters;
        });
    }, [records, searchText, filters]);

    const sorted = useMemo(() => {
        return [...filtered].sort((a, b) => {
            const dateA = a.inspectionDate || '';
            const dateB = b.inspectionDate || '';
            if (dateB > dateA) return 1;
            if (dateB < dateA) return -1;
            return String(b.id).localeCompare(String(a.id));
        });
    }, [filtered]);

    const totalPages = Math.ceil(sorted.length / ITEMS_PER_PAGE);
    const currentItems = sorted.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const COLUMNS = [
        { key: 'inspectionDate', label: '검사일자', filterable: false },
        { key: 'modelCategory', label: '모델대분류', filterable: true },
        { key: 'modelName', label: '모델명', filterable: true },
        { key: 'workplaceFull', label: '작업장 / 설비', filterable: true },
        { key: 'itemName', label: '품목명', filterable: false },
        { key: 'plannedQuantity', label: '지시수량', filterable: false },
        { key: 'inspectedQuantity', label: '검사수량', filterable: false },
        { key: 'failedQuantity', label: '부적합수량', filterable: false },
        { key: 'isResolutionEntered', label: '처리방안', filterable: true },
    ];

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Progress Modal */}
            {progressState.show && (
                <ProgressModal
                    current={progressState.current}
                    total={progressState.total}
                    mode={progressState.mode}
                    onClose={closeProgress}
                />
            )}

            {/* Modal */}
            <ProcessHistoryModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditingItem(null); }}
                onSave={handleSave}
                editingItem={editingItem}
            />

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <ClipboardList className="w-6 h-6 text-blue-600" />
                        공정검사 이력 조회 및 등록
                    </h1>
                    <p className="text-slate-500">MES 공정별 검사 데이터 조회 및 관리</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleExcelUpload}
                        className="hidden"
                        accept=".xlsx,.xls"
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors shadow-sm"
                    >
                        <Upload className="w-4 h-4" />
                        엑셀 일괄 등록
                    </button>
                    <button
                        onClick={() => { setEditingItem(null); setIsModalOpen(true); }}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
                    >
                        <Plus className="w-4 h-4" />
                        수기 등록
                    </button>
                    <button
                        onClick={handleDeleteAll}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors shadow-sm"
                    >
                        <Trash2 className="w-4 h-4" />
                        전체 삭제
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                    type="text"
                    placeholder="모델명, 작업장, 품목명 검색..."
                    value={searchText}
                    onChange={e => { setSearchText(e.target.value); setCurrentPage(1); }}
                    className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <span className="font-bold text-slate-700 text-sm">
                        전체 <span className="text-blue-600">{sorted.length}</span>건
                        {Object.keys(filters).length > 0 && <span className="text-xs text-amber-600 ml-2">(필터 적용 중)</span>}
                    </span>
                    <button onClick={fetchRecords} className="text-slate-400 hover:text-blue-600">
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-100 text-sm">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">No</th>
                                {COLUMNS.map(col => (
                                    <th key={col.key} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase relative">
                                        <div
                                            className={`flex items-center gap-1 ${col.filterable ? 'cursor-pointer hover:text-blue-600' : ''}`}
                                            onClick={() => col.filterable && setActiveFilterColumn(activeFilterColumn === col.key ? null : col.key)}
                                        >
                                            {col.label}
                                            {col.filterable && (
                                                <Filter className={`w-3 h-3 ${filters[col.key] ? 'text-blue-600 fill-blue-200' : 'text-slate-300'}`} />
                                            )}
                                        </div>
                                        {activeFilterColumn === col.key && (
                                            <div
                                                className="absolute top-full left-0 mt-1 w-56 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 overflow-hidden"
                                                onClick={e => e.stopPropagation()}
                                            >
                                                <div className="p-2 border-b bg-slate-50 flex justify-between items-center">
                                                    <span className="text-xs font-bold text-slate-700">필터 선택</span>
                                                    <button onClick={() => clearFilter(col.key)} className="text-xs text-red-500 hover:underline">초기화</button>
                                                </div>
                                                <div className="max-h-52 overflow-y-auto p-2 space-y-1">
                                                    {getUniqueValues(col.key).map(val => (
                                                        <label key={val} className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 rounded-lg cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={filters[col.key]?.includes(val) ?? false}
                                                                onChange={() => handleFilterChange(col.key, val)}
                                                                className="rounded border-slate-300 text-blue-600 w-4 h-4"
                                                            />
                                                            <span className="text-xs text-slate-600 truncate">{val}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                                <div className="p-2 border-t bg-slate-50 text-center">
                                                    <button onClick={() => setActiveFilterColumn(null)} className="text-xs text-blue-600 font-medium">닫기</button>
                                                </div>
                                            </div>
                                        )}
                                    </th>
                                ))}
                                <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase">관리</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan={COLUMNS.length + 2} className="py-16 text-center text-slate-400">
                                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                                    <p>데이터 불러오는 중...</p>
                                </td></tr>
                            ) : currentItems.length === 0 ? (
                                <tr><td colSpan={COLUMNS.length + 2} className="py-16 text-center text-slate-400">
                                    <ClipboardList className="w-10 h-10 mx-auto mb-3 text-slate-200" />
                                    <p className="font-medium">데이터가 없습니다.</p>
                                    <p className="text-xs mt-1">'엑셀 일괄 등록' 버튼으로 MES 데이터를 업로드하세요.</p>
                                </td></tr>
                            ) : (
                                currentItems.map((item, idx) => (
                                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3 text-xs text-slate-400">{(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}</td>
                                        <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{item.inspectionDate}</td>
                                        <td className="px-4 py-3 text-blue-700 text-xs font-bold">{item.modelCategory || '-'}</td>
                                        <td className="px-4 py-3 font-medium text-slate-800">{item.modelName || '-'}</td>
                                        <td className="px-4 py-3 text-slate-600 text-xs">{item.workplaceFull || '-'}</td>
                                        <td className="px-4 py-3 text-slate-600 text-xs max-w-[120px] truncate">{item.itemName || '-'}</td>
                                        <td className="px-4 py-3 text-right text-slate-700">{Number(item.plannedQuantity || 0).toLocaleString()}</td>
                                        <td className="px-4 py-3 text-right text-slate-700">{Number(item.inspectedQuantity || 0).toLocaleString()}</td>
                                        <td className="px-4 py-3 text-right">
                                            <span className={`font-bold ${(item.failedQuantity || 0) > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                                                {Number(item.failedQuantity || 0).toLocaleString()}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                item.isResolutionEntered === 'Y' ? 'bg-green-100 text-green-700' :
                                                item.isResolutionEntered === 'N' ? 'bg-amber-100 text-amber-700' :
                                                'bg-slate-100 text-slate-500'
                                            }`}>
                                                {item.isResolutionEntered || '해당없음'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right whitespace-nowrap">
                                            <button onClick={() => { setEditingItem(item); setIsModalOpen(true); }}
                                                className="text-blue-500 hover:text-blue-700 mr-3"><Edit className="w-4 h-4" /></button>
                                            <button onClick={() => handleDelete(item.id)}
                                                className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
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
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                            className="px-3 py-1 rounded-lg bg-slate-100 text-slate-600 disabled:opacity-40 hover:bg-slate-200 text-sm">
                            이전
                        </button>
                        <div className="flex gap-1">
                            {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => {
                                const page = i + 1;
                                return (
                                    <button key={page} onClick={() => setCurrentPage(page)}
                                        className={`w-8 h-8 rounded-lg text-sm font-medium ${currentPage === page ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                                        {page}
                                    </button>
                                );
                            })}
                            {totalPages > 10 && <span className="px-2 py-1 text-slate-400 text-sm">...</span>}
                        </div>
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                            className="px-3 py-1 rounded-lg bg-slate-100 text-slate-600 disabled:opacity-40 hover:bg-slate-200 text-sm">
                            다음
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProcessHistory;
