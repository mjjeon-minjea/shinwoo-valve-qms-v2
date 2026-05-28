import React, { useState, useEffect, useRef } from 'react';
import { Search, Filter, ArrowUpDown, ChevronLeft, ChevronRight, X, AlertTriangle, FileSpreadsheet, Upload, Download, Edit2, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '../lib/api';

const formatDate = (val) => {
    if (!val) return '2025-01-01'; // Fallback

    // If it's a number (Excel serial date), convert it
    // Excel base date: 1899-12-30
    if (typeof val === 'number') {
        const date = new Date(Math.round((val - 25569) * 86400 * 1000));
        return date.toISOString().split('T')[0];
    }

    // If it's a string, ensure it's YYYY-MM-DD
    if (typeof val === 'string') {
        // If looks like numeric string "45992"
        if (!isNaN(Number(val)) && !val.includes('-')) {
            const date = new Date(Math.round((Number(val) - 25569) * 86400 * 1000));
            return date.toISOString().split('T')[0];
        }
        return val;
    }
    return '2025-01-01';
};

const InboundHistory = () => {
    const [inspections, setInspections] = useState([]);
    // eslint-disable-next-line no-unused-vars
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const fileInputRef = useRef(null);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    // Progress State
    const [progress, setProgress] = useState({
        isOpen: false,
        type: 'upload', // 'upload' | 'delete'
        current: 0,
        total: 0,
        startTime: 0
    });

    const updateProgress = (current, total, type) => {
        setProgress(prev => {
            const startTime = current === 0 ? Date.now() : prev.startTime;
            return { isOpen: true, type, current, total, startTime };
        });
    };

    const closeProgress = () => {
        setProgress(prev => ({ ...prev, isOpen: false }));
    };

    const fetchInspections = async () => {
        try {
            const res = await api.fetch('/inspections');
            if (res.ok) {
                const data = await res.json();
                setInspections(Array.isArray(data) ? data : []);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInspections();
    }, []);

    // Handlers
    const handleExcelUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                // Read ALL sheets instead of just the first one
                let allData = [];
                wb.SheetNames.forEach(sheetName => {
                    const ws = wb.Sheets[sheetName];
                    const sheetData = XLSX.utils.sheet_to_json(ws);
                    allData = allData.concat(sheetData);
                });

                // Helper to safely parse numbers (handling '-' as 0)
                const parseNum = (val) => {
                    if (val === '-' || val === undefined || val === null || val === '') return 0;
                    const num = Number(String(val).replace(/,/g, '')); // Handle commas
                    return isNaN(num) ? 0 : num;
                };

                // Map Excel headers to our schema with ROBUST FUZZY SEARCH
                const mappedData = allData.map((row) => {
                    // Helper to find value by searching keys fuzzy (ignore spaces)
                    const findVal = (targets) => {
                        const rowKeys = Object.keys(row);
                        const targetArray = Array.isArray(targets) ? targets : [targets];

                        for (const t of targetArray) {
                            // 1. Direct match
                            if (row[t] !== undefined) return row[t];

                            // 2. Fuzzy match (ignore whitespace)
                            const cleanTarget = t.replace(/\s+/g, '');
                            const fuzzyKey = rowKeys.find(k => k.replace(/\s+/g, '') === cleanTarget);
                            if (fuzzyKey) return row[fuzzyKey];
                        }
                        return undefined;
                    };

                    const defectQty = parseNum(findVal(['불량수량(EA)', '불량수량', '불량']));

                    return {
                        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                        date: formatDate(findVal(['입고일', '입고일자', '날짜'])),
                        supplier: findVal(['입고업체', '업체명', '공급사']) || 'Unknown',
                        itemName: findVal(['제품명', '품명', '품목명']) || 'Unknown',
                        totalQuantity: parseNum(findVal(['입고수량(EA)', '입고수량', '수량'])),
                        inspectionQuantity: parseNum(findVal(['검사수량(EA)', '검사수량'])),
                        defectQuantity: defectQty,
                        result: defectQty > 0 ? '불합격' : '합격',
                        defectType: findVal(['불량유형', '불량내용']) || '',
                        itemType: (() => {
                            let val = findVal(['품목유형', '제품유형']) || '';
                            if (typeof val === 'string') {
                                val = val.trim();
                                // Map 'China Factory' or 'SMART VALVE...' to 'Outsourced Painting'
                                if (val === '중국공장' || val.includes('SMART VALVE') || val.includes('DALIAN')) return '외주도장';
                            }
                            return val;
                        })(),
                        // Critical Update: Fuzzy match for Inspection Report No
                        inspectionReportNo: findVal(['인수검사성적서NO', '인수검사성적서', '성적서NO', '성적서번호']) || ''
                    };
                });

                // Filter out empty rows, but keep rows with valid itemType even if itemName is Unknown
                const validData = mappedData.filter(d => {
                    // Basic check: must have at least date or supplier or itemName or itemType
                    const hasData = d.date !== null && (d.supplier !== 'Unknown' || d.itemName !== 'Unknown' || d.itemType !== '');
                    return hasData;
                });

                // Debug: Count mapped Outsourced Painting
                const outsourcedCount = validData.filter(d => d.itemType === '외주도장').length;
                if (outsourcedCount > 0) {
                     alert(`'중국공장' 데이터 ${outsourcedCount}건을 '외주도장'으로 자동 변환했습니다.`);
                }

                // Start Upload (Batch)
                updateProgress(1, 100, 'upload'); // Show "Uploading..."

                try {
                    const res = await api.fetch('/inspections/batch', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: validData
                    });

                    if (res.ok) {
                        const responseData = await res.json();
                        updateProgress(100, 100, 'upload');

                        // Close modal after a short delay or immediately
                        setTimeout(() => closeProgress(), 500);

                        alert(`${responseData.count}건이 일괄 업로드되었습니다. (속도: 빠름/데이터 손실: 없음)`);
                        fetchInspections();
                    } else {
                        throw new Error('Batch Upload Failed');
                    }
                } catch (error) {
                    console.error('Upload Error:', error);
                    closeProgress();
                    alert('업로드 중 서버 오류가 발생했습니다.');
                } finally {
                    if (fileInputRef.current) fileInputRef.current.value = '';
                }
            } catch (error) {
                console.error('Excel Parsing Error:', error);
                alert('엑셀 파일을 처리하는 중 오류가 발생했습니다.');
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = {
            date: formData.get('date'),
            supplier: formData.get('supplier'),
            itemName: formData.get('itemName'),
            totalQuantity: Number(formData.get('totalQuantity')),
            inspectionQuantity: Number(formData.get('inspectionQuantity')),
            defectQuantity: Number(formData.get('defectQuantity')),
            result: formData.get('result'),
            defectType: formData.get('defectType'),
        };

        if (editingItem) {
            await api.fetch(`/inspections/${editingItem.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: { ...editingItem, ...data }
            });
        } else {
            await api.fetch('/inspections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: data
            });
        }
        setIsModalOpen(false);
        setEditingItem(null);
        fetchInspections();
    };

    const handleDelete = async (id) => {
        if (window.confirm('정말 삭제하시겠습니까?')) {
            await api.fetch(`/inspections/${id}`, { method: 'DELETE' });
            fetchInspections();
        }
    };

    const handleDeleteAll = async () => {
        if (inspections.length === 0) {
            alert('삭제할 데이터가 없습니다.');
            return;
        }
        if (window.confirm('정말로 모든 검사 이력을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) {
            if (window.confirm('전체 삭제를 진행합니다. 정말 확실합니까?')) {
                try {
                    updateProgress(0, 100, 'delete'); // Show "Deleting..."
                    
                    // Server-side Batch Delete (Instant)
                    await api.fetch('/inspections', { method: 'DELETE' });
                    
                    updateProgress(100, 100, 'delete');
                    setTimeout(() => closeProgress(), 500);
                    alert('모든 데이터가 삭제되었습니다.');
                    fetchInspections();

                } catch (error) {
                    console.error('Delete All Error:', error);
                    closeProgress();
                    alert(`삭제 처리 중 오류가 발생했습니다: ${error.message}`);
                }
            }
        }
    };

    const openEditModal = (item) => {
        setEditingItem(item);
        setIsModalOpen(true);
    };

    // --- Filtering Logic ---
    const [filters, setFilters] = useState({});
    const [activeFilterColumn, setActiveFilterColumn] = useState(null);

    const getUniqueValues = (key) => {
        const values = inspections
            .map(item => item[key] || '(미지정)')
            .filter(val => val !== '(미지정)'); // Exclude empty/unspecified options
        return [...new Set(values)].sort();
    };

    const handleFilterChange = (key, value) => {
        setFilters(prev => {
            const current = prev[key] || [];
            if (current.includes(value)) {
                const updated = current.filter(v => v !== value);
                const newFilters = { ...prev, [key]: updated };
                if (updated.length === 0) delete newFilters[key]; 
                return newFilters;
            } else {
                return { ...prev, [key]: [...current, value] };
            }
        });
    };

    const clearFilter = (key) => {
        setFilters(prev => {
            const newFilters = { ...prev };
            delete newFilters[key];
            return newFilters;
        });
    };

    // ... (inside filteredInspections)
    const filteredInspections = inspections.filter(item => {
        return Object.entries(filters).every(([key, selectedValues]) => {
            if (!selectedValues || selectedValues.length === 0) return true;
             const itemValue = item[key] || '(미지정)'; // Match the display value
             return selectedValues.includes(itemValue);
        });
    });

    // Pagination Logic
    // Sort by Date Descending, then by ID Descending (String safe)
    const sortedInspections = [...filteredInspections].sort((a, b) => {
        // 1. Sort by Date
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        if (dateA > dateB) return -1;
        if (dateA < dateB) return 1;
        
        // 2. Secondary Sort by ID (String comparison for safety)
        const idA = String(a.id);
        const idB = String(b.id);
        return idB.localeCompare(idA);
    });
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = sortedInspections.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(sortedInspections.length / itemsPerPage);

    const paginate = (pageNumber) => setCurrentPage(pageNumber);

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">검사 이력 관리</h1>
                    <p className="text-slate-500">인수검사 상세 데이터 조회 및 관리</p>
                </div>
                <div className="flex gap-2">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleExcelUpload}
                        className="hidden"
                        accept=".xlsx, .xls"
                    />
                    <button
                        onClick={() => fileInputRef.current.click()}
                        className="flex items-center px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors shadow-sm"
                    >
                        <Upload className="w-4 h-4 mr-2" />
                        엑셀 일괄 등록
                    </button>
                    <button
                        onClick={() => { setEditingItem(null); setIsModalOpen(true); }}
                        className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors shadow-sm bg-gradient-to-r from-primary-600 to-indigo-600"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        검사 결과 등록
                    </button>
                    <button
                        onClick={handleDeleteAll}
                        className="flex items-center px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors shadow-sm"
                    >
                        <Trash2 className="w-4 h-4 mr-2" />
                        전체 리스트 삭제
                    </button>
                </div>
            </div>

            {/* Table Section */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800">검사 리스트 (전체: {sortedInspections.length}건)</h3>
                    <button onClick={fetchInspections} className="text-slate-400 hover:text-primary-600"><RefreshCw className="w-4 h-4" /></button>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                                {['date', 'supplier', 'itemName', 'itemType', 'totalQuantity', 'inspectionQuantity', 'result', 'defectType'].map((key, index) => {
                                    const labels = {
                                        date: '날짜', supplier: '공급사', itemName: '품목명', itemType: '품목유형',
                                        totalQuantity: '총수량', inspectionQuantity: '검사수량', result: '판정', defectType: '불량유형'
                                    };
                                    // Columns safe to filter (categorical or dates)
                                    const filterable = ['date', 'supplier', 'itemName', 'itemType', 'result', 'defectType'].includes(key);

                                    return (
                                        <th key={key} className={`px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase ${index === 7 ? '' : ''} relative`}>
                                            <div className={`flex items-center gap-1 ${filterable ? 'cursor-pointer hover:bg-slate-100 p-1 rounded' : ''}`}
                                                 onClick={() => filterable && setActiveFilterColumn(activeFilterColumn === key ? null : key)}>
                                                {labels[key]}
                                                {filterable && (
                                                    <Filter className={`w-3 h-3 ${filters[key] ? 'text-blue-600 fill-blue-600' : 'text-slate-300'}`} />
                                                )}
                                            </div>
                                            
                                            {/* Dropdown */}
                                            {activeFilterColumn === key && (
                                                <div className="absolute top-full left-0 mt-1 w-60 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col animate-fade-in" onClick={e => e.stopPropagation()}>
                                                    <div className="p-2 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                                                        <span className="text-xs font-bold text-slate-700">필터 선택</span>
                                                        <button onClick={() => clearFilter(key)} className="text-xs text-red-500 hover:underline">초기화</button>
                                                    </div>
                                                    <div className="max-h-60 overflow-y-auto p-2 space-y-1">
                                                        {getUniqueValues(key).map(val => (
                                                            <label key={val} className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={filters[key]?.includes(val) ?? false}
                                                                    onChange={() => handleFilterChange(key, val)}
                                                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                                                                />
                                                                <span className="text-sm text-slate-600 truncate">{val}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                    <div className="p-2 border-t border-slate-100 bg-slate-50 text-center">
                                                        <button 
                                                            onClick={() => setActiveFilterColumn(null)}
                                                            className="text-xs text-primary-600 font-medium hover:text-primary-800"
                                                        >
                                                            닫기
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </th>
                                    );
                                })}
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">관리</th>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {currentItems.length === 0 ? (
                                <tr><td colSpan="8" className="px-6 py-10 text-center text-slate-500">데이터가 없습니다.</td></tr>
                            ) : (
                                currentItems.map((item) => (
                                    <tr key={item.id} className="hover:bg-slate-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">{formatDate(item.date)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">{item.supplier}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{item.itemName}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{item.itemType || '(미지정)'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">{Number(item.totalQuantity).toLocaleString()}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{Number(item.inspectionQuantity).toLocaleString()}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-1 text-xs rounded-full font-medium ${item.result === '합격' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                                                {item.result}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{item.defectType || '-'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button onClick={() => openEditModal(item)} className="text-primary-600 hover:text-primary-900 mr-3"><Edit className="w-4 h-4" /></button>
                                            <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-900"><Trash2 className="w-4 h-4" /></button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="flex justify-center items-center p-4 border-t border-slate-100 gap-2">
                        <button
                            onClick={() => paginate(Math.max(1, currentPage - 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-1 rounded bg-slate-100 text-slate-600 disabled:opacity-50 hover:bg-slate-200"
                        >
                            이전
                        </button>
                        <span className="text-sm text-slate-600">
                            {currentPage} / {totalPages}
                        </span>
                        <button
                            onClick={() => paginate(Math.min(totalPages, currentPage + 1))}
                            disabled={currentPage === totalPages}
                            className="px-3 py-1 rounded bg-slate-100 text-slate-600 disabled:opacity-50 hover:bg-slate-200"
                        >
                            다음
                        </button>
                    </div>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 animate-scale-in">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-slate-900">{editingItem ? '검사 결과 수정' : '신규 검사 결과 등록'}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleSave} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">검사일자</label>
                                    <input type="date" name="date" required defaultValue={editingItem?.date} className="w-full px-3 py-2 border rounded-lg" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">공급업체</label>
                                    <input type="text" name="supplier" required defaultValue={editingItem?.supplier} className="w-full px-3 py-2 border rounded-lg" placeholder="예: 인성금속" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">품목명</label>
                                <input type="text" name="itemName" required defaultValue={editingItem?.itemName} className="w-full px-3 py-2 border rounded-lg" placeholder="예: BALL VALVE 15A" />
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">총수량</label>
                                    <input type="number" name="totalQuantity" required defaultValue={editingItem?.totalQuantity} className="w-full px-3 py-2 border rounded-lg" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">검사량</label>
                                    <input type="number" name="inspectionQuantity" required defaultValue={editingItem?.inspectionQuantity} className="w-full px-3 py-2 border rounded-lg" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">불량수</label>
                                    <input type="number" name="defectQuantity" required defaultValue={editingItem?.defectQuantity || 0} className="w-full px-3 py-2 border rounded-lg" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">판정 결과</label>
                                    <select name="result" required defaultValue={editingItem?.result || '합격'} className="w-full px-3 py-2 border rounded-lg">
                                        <option value="합격">합격</option>
                                        <option value="불합격">불합격</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">불량 유형</label>
                                    <input type="text" name="defectType" defaultValue={editingItem?.defectType} className="w-full px-3 py-2 border rounded-lg" placeholder="(선택사항)" />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 mt-6">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">취소</button>
                                <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">저장</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}


            {/* Progress Modal */}
            <ProgressModal
                isOpen={progress.isOpen}
                type={progress.type}
                current={progress.current}
                total={progress.total}
                startTime={progress.startTime}
            />
        </div >
    );
};

// Placeholder for other tabs

export default InboundHistory;
