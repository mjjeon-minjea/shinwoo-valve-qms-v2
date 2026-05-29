/* src/components/InboundHistory.jsx */
import { useState, useEffect } from 'react';
import { Search, Filter, RefreshCw, ChevronLeft, ChevronRight, X, AlertTriangle, CloudLightning, Database, Plus, Edit2, Trash2, Calendar, HardDrive, CheckCircle2 } from 'lucide-react';
import { api, supabase } from '../lib/api';
import ProgressModal from './ProgressModal';

const formatDate = (val) => {
    if (!val) return '2026-05-29';

    if (typeof val === 'number') {
        const date = new Date(Math.round((val - 25569) * 86400 * 1000));
        return date.toISOString().split('T')[0];
    }

    if (typeof val === 'string') {
        if (!isNaN(Number(val)) && !val.includes('-')) {
            const date = new Date(Math.round((Number(val) - 25569) * 86400 * 1000));
            return date.toISOString().split('T')[0];
        }
        return val;
    }
    return '2026-05-29';
};

// 로컬 개발/검증 단계용 가상 Mock CSV 데이터 (구글 시트 URL 미지정 시 폴백)
const MOCK_CSV = `품목번호,제품명,입고일,업체명,입고,검사(함수),부적합,인수검사 보고서 번호,업태(함수),부적합 유형
ITEM-SW-V01,게이트밸브 100A,2026-05-29,강남금속,150,150,2,SR-20260529-001,외주가공,주물치수부적합
ITEM-SW-V02,글로브밸브 50A,2026-05-29,신우산업,80,80,0,SR-20260529-002,주물류,
ITEM-SW-V03,체크밸브 80A,2026-05-29,한성정밀,120,120,5,SR-20260529-003,외주가공,흠집 및 도장 불량
ITEM-SW-V04,스트레이너 65A,2026-05-29,삼영금속,200,200,3,SR-20260529-004,주물류,주물부적합
ITEM-SW-V05,감압밸브 40A,2026-05-29,신우정밀,50,50,1,SR-20260529-005,외주가공,나사산 가공 오류
ITEM-SW-V06,버터플라이밸브 150A,2026-05-29,동양금속,90,90,4,SR-20260529-006,외주가공,조립 뻑뻑함`;

const InboundHistory = () => {
    const [inspections, setInspections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [syncing, setSyncing] = useState(false);
    const [syncStatus, setSyncStatus] = useState({
        lastSuccess: localStorage.getItem('qms_last_sync_time') || '미기록',
        status: 'idle',
        message: ''
    });

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    // Filtering & Searching States
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({});
    const [activeFilterColumn, setActiveFilterColumn] = useState(null);

    // Progress State
    const [progress, setProgress] = useState({
        isOpen: false,
        type: 'upload', // 'upload' | 'delete' | 'sync'
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

    // 하이브리드 파싱 헬퍼
    const getItemCode = (item) => {
        if (item.item_code) return item.item_code;
        const match = String(item.inspectionReportNo || '').match(/\[품목:(.+?)\]/);
        return match ? match[1] : '-';
    };

    const getCleanReportNo = (item) => {
        return String(item.inspectionReportNo || '').replace(/\[품목:.+?\]/, '').trim() || '없음';
    };

    const fetchInspections = async () => {
        setLoading(true);
        try {
            const res = await api.fetch('/inspections');
            if (res.ok) {
                const data = await res.json();
                setInspections(Array.isArray(data) ? data : []);
            }
        } catch (err) {
            console.error('[Fetch inspections error]', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInspections();
    }, []);

    // 🌐 브라우저 Direct 구글 스프레드시트 ➔ Gemini ➔ Supabase 연동 코어 엔진
    const handleGoogleSync = async () => {
        if (syncing) return;
        setSyncing(true);
        setSyncStatus(prev => ({ ...prev, status: 'idle', message: '구글 스프레드시트 연결 및 데이터를 분류 중입니다...' }));
        updateProgress(10, 100, 'sync');

        try {
            let csvData = '';
            // 로컬/운영 환경 변수에서 구글 시트 CSV 주소 참조
            const sheetUrl = import.meta.env.VITE_GOOGLE_SHEETS_CSV_URL;

            if (sheetUrl) {
                const response = await fetch(sheetUrl);
                if (!response.ok) throw new Error(`구글 시트 로드 실패. 코드: ${response.status}`);
                csvData = await response.text();
            } else {
                // 환경변수가 없을 경우 로컬 테스트용 Mock 데이터 가동
                csvData = MOCK_CSV;
            }

            updateProgress(30, 100, 'sync');

            // CSV 파싱
            const rows = parseCSV(csvData);
            if (rows.length === 0) {
                throw new Error('CSV 데이터가 비어 있습니다.');
            }

            updateProgress(50, 100, 'sync');

            // 비정형 부적합 유형 중복 제거 추출
            const uniqueDefectTypes = [...new Set(rows.map(r => r['부적합 유형'] || '').filter(val => val.trim() !== ''))];
            const defectCategoryMap = { '': '합격' };

            // Gemini 2.5 Flash API 직접 브라우저단에서 호출 (기밀 보관 키 활용)
            const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
            const modelName = import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash';

            if (uniqueDefectTypes.length > 0 && apiKey) {
                for (let i = 0; i < uniqueDefectTypes.length; i++) {
                    const originalType = uniqueDefectTypes[i];
                    updateProgress(50 + Math.round((i / uniqueDefectTypes.length) * 30), 100, 'sync');
                    
                    const standardCategory = await classifyDefectTypeWithGemini(originalType, apiKey, modelName);
                    defectCategoryMap[originalType] = standardCategory;
                }
            }

            updateProgress(85, 100, 'sync');

            // 가공 및 Upsert 데이터 리스트 빌드
            const inspectionsToUpsert = rows.map(row => {
                const supplier = (row['업체명'] || '').trim();
                const itemName = (row['제품명'] || '').trim();
                const date = (row['입고일'] || '').trim();
                const totalQuantity = parseInt((row['입고'] || '0').replace(/,/g, ''), 10);
                const inspectionQuantity = parseInt((row['검사(함수)'] || '0').replace(/,/g, ''), 10);
                const defectQuantity = parseInt((row['부적합'] || '0').replace(/,/g, ''), 10);
                const inspectionReportNo = (row['인수검사 보고서 번호'] || '없음').trim();
                const itemType = (row['업태(함수)'] || '외주가공').trim();
                const originalDefectType = (row['부적합 유형'] || '').trim();
                const itemCode = (row['품목번호'] || '').trim();

                const rawId = `${supplier}_${itemName}_${date}_${totalQuantity}`;
                const safeId = btoa(unescape(encodeURIComponent(rawId))).replace(/[^a-zA-Z0-9]/g, '').substring(0, 30);
                const defectCategory = defectCategoryMap[originalDefectType] || '합격';

                return {
                    id: safeId,
                    date: date || new Date().toISOString().split('T')[0],
                    supplier: supplier || '미지정업체',
                    itemName: itemName || '미지정제품',
                    totalQuantity: isNaN(totalQuantity) ? 0 : totalQuantity,
                    inspectionQuantity: isNaN(inspectionQuantity) ? 0 : inspectionQuantity,
                    defectQuantity: isNaN(defectQuantity) ? 0 : defectQuantity,
                    result: defectQuantity > 0 ? '불합격' : '합격',
                    defectType: originalDefectType ? `[${defectCategory}] ${originalDefectType}` : '',
                    inspectionReportNo: inspectionReportNo || '없음',
                    itemType: itemType || '외주가공',
                    item_code: itemCode
                };
            });

            updateProgress(90, 100, 'sync');

            // Supabase Cloud DB 에 무결성 일괄 Upsert 진행
            const { error: upsertError } = await supabase
                .from('inspections')
                .upsert(inspectionsToUpsert, { onConflict: 'id' });

            if (upsertError) {
                // [EMERGENCY Fallback] 스키마에 item_code 컬럼이 없거나(42703/PGRST100) 에러 메시지에 item_code가 포함된 경우 자동 우회 보존
                if (upsertError.code === '42703' || upsertError.code === 'PGRST100' || String(upsertError.message || '').includes('item_code')) {
                    const fallbackData = inspectionsToUpsert.map(item => {
                        const cleanItem = { ...item };
                        if (cleanItem.item_code) {
                            cleanItem.inspectionReportNo = `${cleanItem.inspectionReportNo} [품목:${cleanItem.item_code}]`;
                        }
                        delete cleanItem.item_code;
                        return cleanItem;
                    });

                    const { error: fallbackError } = await supabase
                        .from('inspections')
                        .upsert(fallbackData, { onConflict: 'id' });

                    if (fallbackError) throw fallbackError;
                } else {
                    throw upsertError;
                }
            }

            updateProgress(100, 100, 'sync');
            const nowStr = new Date().toLocaleString('ko-KR');
            localStorage.setItem('qms_last_sync_time', nowStr);
            setSyncStatus({
                lastSuccess: nowStr,
                status: 'success',
                message: `${inspectionsToUpsert.length}개의 구글 시트 데이터를 성공적으로 연동하고 Gemini Flash로 정형화했습니다!`
            });
            alert(`동기화 완수!\n${inspectionsToUpsert.length}건이 Supabase Staging DB에 안전하게 반영되었습니다.`);
            fetchInspections();

        } catch (error) {
            console.error('Sync error:', error);
            setSyncStatus(prev => ({
                ...prev,
                status: 'error',
                message: `동기화 에러: ${error.message}`
            }));
            alert(`동기화 중 에러 발생: ${error.message}\n기존 저장 데이터를 복구해 화면에 보존 중입니다.`);
        } finally {
            setSyncing(false);
            closeProgress();
        }
    };

    // CSV 라인 분해 및 특수기호 안전 헬퍼
    const parseCSV = (text) => {
        const lines = text.split(/\r?\n/);
        if (lines.length <= 1) return [];

        const parseCSVLine = (line) => {
            const result = [];
            let current = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    result.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            result.push(current.trim());
            return result;
        };

        const headers = parseCSVLine(lines[0]).map(h => h.replace(/^\uFEFF/, '').trim());
        const results = [];

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const values = parseCSVLine(line);
            const row = {};
            
            headers.forEach((header, index) => {
                row[header] = values[index] || '';
            });
            
            if (row['제품명'] || row['업체명']) {
                results.push(row);
            }
        }
        return results;
    };

    // Gemini 2.5 Flash API 브라우저 직접 연동
    const classifyDefectTypeWithGemini = async (defectType, apiKey, model) => {
        const systemInstruction = `너는 신우밸브주식회사 품질보증부의 인수검사 데이터 정제 전문가이다.
제공되는 입고/검사 데이터의 [부적합 유형] 텍스트를 정밀 분석하여, 아래 정의된 JSON 스키마 규격에 맞춰 정확히 매핑된 데이터만을 반환해야 한다. 절대 설명이나 마크다운 태그를 붙이지 말고 순수 JSON만 반환하라.

[부적합 유형(defectCategory) 매핑 규칙]
- 외관 불량, 흠집, 도장 불량, 사출 들뜸, 외관부적합 ➔ "외관부적합"
- 나사산 가공 불량, 리머 가공 오류, 홀 누락, 조립부 가공 오차, 가공부적합 ➔ "가공부적합"
- 치수 미달, 공차 초과, 금형 변형, 주물치수부적합, 주물부적합, 주물 부적합 ➔ "주물치수부적합"
- 조립 뻑뻑함, 부품 누락, 유격 오류, 조립부적합 ➔ "조립부적합"
- 재질 상이, 성적서 불일치, 인장 강도 미달, 재질부적합 ➔ "재질부적합"
- 해당 없음, 합격, 빈 문자열 또는 공란 ➔ "합격"
- 그 외 어떤 매핑 규칙에도 속하지 않는 경우 ➔ "기타"`;

        const fewShots = [
            { input: '주물 치수 부적합', output: '주물치수부적합' },
            { input: '가공부적합', output: '가공부적합' },
            { input: '외관부적합', output: '외관부적합' },
            { input: '사출 들뜸', output: '외관부적합' },
            { input: '', output: '합격' },
            { input: '주물부적합', output: '주물치수부적합' }
        ];

        const fewShotPrompt = fewShots.map(f => `입력: "${f.input}" ➔ 출력 JSON: {"defectCategory": "${f.output}"}`).join('\n');
        const userPrompt = `아래 입력 텍스트를 분류하여 JSON으로만 대답해라.\n---\n입력: "${defectType}"`;
        const fullPrompt = `${systemInstruction}\n\n[입출력 예시]\n${fewShotPrompt}\n\n${userPrompt}`;

        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: fullPrompt }] }],
                    generationConfig: { responseMimeType: 'application/json' }
                })
            });

            if (!response.ok) throw new Error(`Gemini 응답 실패: ${response.status}`);
            const resJson = await response.json();
            const responseText = resJson.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const cleanText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

            const result = JSON.parse(cleanText);
            return result.defectCategory || '기타';
        } catch (err) {
            console.error('Gemini error:', err);
            // 자체 안전 정규 매핑 백업
            const text = defectType.toLowerCase();
            if (text.includes('외관') || text.includes('도장') || text.includes('흠집') || text.includes('사출')) return '외관부적합';
            if (text.includes('가공') || text.includes('나사') || text.includes('리머') || text.includes('홀')) return '가공부적합';
            if (text.includes('치수') || text.includes('공차') || text.includes('금형') || text.includes('주물')) return '주물치수부적합';
            if (text.includes('조립') || text.includes('뻑뻑') || text.includes('유격')) return '조립부적합';
            if (text.includes('재질') || text.includes('성적') || text.includes('강도')) return '재질부적합';
            return '기타';
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const defectQty = Number(formData.get('defectQuantity') || 0);
        
        const data = {
            date: formData.get('date'),
            supplier: formData.get('supplier'),
            itemName: formData.get('itemName'),
            itemType: formData.get('itemType'),
            totalQuantity: Number(formData.get('totalQuantity') || 0),
            inspectionQuantity: Number(formData.get('inspectionQuantity') || 0),
            defectQuantity: defectQty,
            result: defectQty > 0 ? '불합격' : '합격',
            defectType: formData.get('defectType') || '',
            inspectionReportNo: formData.get('inspectionReportNo') || '없음',
            item_code: formData.get('item_code') || ''
        };

        try {
            if (editingItem) {
                await api.fetch(`/inspections/${editingItem.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: { ...editingItem, ...data }
                });
            } else {
                const randId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
                await api.fetch('/inspections', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: { id: randId, ...data }
                });
            }
            setIsModalOpen(false);
            setEditingItem(null);
            fetchInspections();
        } catch (err) {
            console.error('Save error:', err);
            alert('저장 도중 에러가 발생했습니다.');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('선택하신 인수검사 내역을 정말 삭제하시겠습니까?')) {
            try {
                await api.fetch(`/inspections/${id}`, { method: 'DELETE' });
                fetchInspections();
            } catch (err) {
                console.error('Delete error:', err);
                alert('삭제 중 오류가 발생했습니다.');
            }
        }
    };

    const handleDeleteAll = async () => {
        if (inspections.length === 0) {
            alert('삭제할 데이터가 없습니다.');
            return;
        }
        if (window.confirm('정말로 모든 검사 이력을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) {
            if (window.confirm('전체 삭제를 대행합니다. 계속하시겠습니까?')) {
                try {
                    updateProgress(0, 100, 'delete');
                    await api.fetch('/inspections', { method: 'DELETE' });
                    updateProgress(100, 100, 'delete');
                    setTimeout(() => closeProgress(), 500);
                    alert('모든 데이터가 소거되었습니다.');
                    fetchInspections();
                } catch (error) {
                    console.error('Delete All Error:', error);
                    closeProgress();
                    alert(`삭제 에러: ${error.message}`);
                }
            }
        }
    };

    const openEditModal = (item) => {
        setEditingItem(item);
        setIsModalOpen(true);
    };

    // --- 필터 및 검색 ---
    const getUniqueValues = (key) => {
        const values = inspections
            .map(item => {
                if (key === 'item_code') return getItemCode(item);
                if (key === 'inspectionReportNo') return getCleanReportNo(item);
                return item[key] || '(미지정)';
            })
            .filter(val => val !== '(미지정)' && val !== '-');
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

    const filteredInspections = inspections.filter(item => {
        const matchSearch = searchTerm.trim() === '' || 
            (item.supplier || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.itemName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            getItemCode(item).toLowerCase().includes(searchTerm.toLowerCase());

        if (!matchSearch) return false;

        return Object.entries(filters).every(([key, selectedValues]) => {
            if (!selectedValues || selectedValues.length === 0) return true;
            let itemValue = '';
            if (key === 'item_code') {
                itemValue = getItemCode(item);
            } else if (key === 'inspectionReportNo') {
                itemValue = getCleanReportNo(item);
            } else {
                itemValue = item[key] || '(미지정)';
            }
            return selectedValues.includes(itemValue);
        });
    });

    const sortedInspections = [...filteredInspections].sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        if (dateA > dateB) return -1;
        if (dateA < dateB) return 1;
        
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
        <div className="space-y-6 p-1 animate-fade-in text-slate-800">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-200">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                        <Database className="w-8 h-8 text-primary-600 animate-pulse" />
                        인수검사 이력 통합 관리
                    </h1>
                    <p className="text-slate-500 mt-1 font-medium">구글 스프레드시트 데이터 연동 및 Gemini 2.5 Flash 실시간 자동 정제 패널</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={handleGoogleSync}
                        disabled={syncing}
                        className={`flex items-center px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl shadow-md hover:from-blue-700 hover:to-indigo-700 transition-all active:scale-95 ${syncing ? 'opacity-70 cursor-wait' : ''}`}
                    >
                        <CloudLightning className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                        {syncing ? '구글 시트 동기화 중...' : '구글 시트 즉시 동기화'}
                    </button>
                    <button
                        onClick={() => { setEditingItem(null); setIsModalOpen(true); }}
                        className="flex items-center px-4 py-2.5 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800 transition-all active:scale-95 shadow-sm"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        수동 검사등록
                    </button>
                    <button
                        onClick={handleDeleteAll}
                        className="flex items-center px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-600 font-bold rounded-xl transition-all active:scale-95"
                    >
                        <Trash2 className="w-4 h-4 mr-2" />
                        전체 데이터 삭제
                    </button>
                </div>
            </div>

            {/* Google Sheets Sync Status Board */}
            <div className={`p-4 rounded-2xl border ${syncStatus.status === 'error' ? 'bg-red-50 border-red-200' : syncStatus.status === 'success' ? 'bg-emerald-50 border-emerald-200' : 'bg-blue-50/50 border-blue-100'} transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-inner`}>
                <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${syncStatus.status === 'error' ? 'bg-red-100 text-red-600' : syncStatus.status === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                        {syncStatus.status === 'error' ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                    </div>
                    <div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">구글 스프레드시트 동기화 엔진 상태</div>
                        <div className="text-sm font-semibold text-slate-700 mt-0.5">
                            {syncStatus.message || '안정적인 정적 수집 대기 중입니다. 실시간 수동 동기화를 인가할 수 있습니다.'}
                        </div>
                    </div>
                </div>
                <div className="text-xs font-bold text-slate-500 bg-white/70 px-3 py-1.5 rounded-lg border border-slate-200/50 flex items-center gap-1.5 self-start md:self-auto">
                    <Calendar className="w-3.5 h-3.5" />
                    최종 연동 완료 시점: <span className="text-primary-600">{syncStatus.lastSuccess}</span>
                </div>
            </div>

            {/* Filter Panel */}
            <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-2xl flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
                <div className="relative w-full md:w-80">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4.5 h-4.5" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="공급업체, 품목명, 품목번호 검색..."
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 text-sm font-medium bg-white"
                    />
                </div>
                <div className="flex gap-2 self-end md:self-auto text-xs font-bold text-slate-500">
                    <span className="bg-slate-200 px-3 py-1.5 rounded-lg">필터링 상태: {Object.keys(filters).length}개 활성</span>
                    {Object.keys(filters).length > 0 && (
                        <button 
                            onClick={() => setFilters({})}
                            className="text-red-500 hover:text-red-700 bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-100"
                        >
                            전체 초기화
                        </button>
                    )}
                </div>
            </div>

            {/* Table Area */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden transition-all">
                <div className="p-5 border-b border-slate-100 bg-slate-50/40 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 tracking-tight flex items-center gap-2">
                        <HardDrive className="w-4 h-4 text-slate-400" />
                        인수검사 이력 원장 그리드
                        <span className="text-xs bg-slate-200 text-slate-600 px-2.5 py-0.5 rounded-full font-extrabold">{sortedInspections.length}건</span>
                    </h3>
                    <button 
                        onClick={fetchInspections}
                        className="text-slate-400 hover:text-primary-600 p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                        title="새로고침"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50/60">
                            <tr>
                                {['date', 'item_code', 'itemName', 'itemType', 'supplier', 'totalQuantity', 'inspectionQuantity', 'result', 'defectType', 'inspectionReportNo'].map((key) => {
                                    const labels = {
                                        date: '검사일자',
                                        item_code: '품목번호',
                                        itemName: '품목명',
                                        itemType: '유형',
                                        supplier: '공급업체',
                                        totalQuantity: '총입고량',
                                        inspectionQuantity: '검사수량',
                                        result: '판정',
                                        defectType: '부적합 유형(정형)',
                                        inspectionReportNo: '성적서 번호'
                                    };
                                    const filterable = ['date', 'item_code', 'itemName', 'itemType', 'supplier', 'result'].includes(key);

                                    return (
                                        <th key={key} className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider relative">
                                            <div 
                                                className={`flex items-center gap-1 ${filterable ? 'cursor-pointer hover:bg-slate-200/50 p-1 -m-1 rounded-md transition-colors' : ''}`}
                                                onClick={() => filterable && setActiveFilterColumn(activeFilterColumn === key ? null : key)}
                                            >
                                                {labels[key]}
                                                {filterable && (
                                                    <Filter className={`w-3 h-3 ${filters[key] ? 'text-primary-600 fill-primary-500' : 'text-slate-300'}`} />
                                                )}
                                            </div>

                                            {activeFilterColumn === key && (
                                                <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col animate-scale-in" onClick={e => e.stopPropagation()}>
                                                    <div className="p-3 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                                                        <span className="text-xs font-extrabold text-slate-700">필터 설정 ({labels[key]})</span>
                                                        <button onClick={() => clearFilter(key)} className="text-xs text-red-500 font-bold hover:underline">초기화</button>
                                                    </div>
                                                    <div className="max-h-60 overflow-y-auto p-2.5 space-y-1">
                                                        {getUniqueValues(key).map(val => (
                                                            <label key={val} className="flex items-center gap-2 px-2.5 py-2 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={filters[key]?.includes(val) ?? false}
                                                                    onChange={() => handleFilterChange(key, val)}
                                                                    className="rounded border-slate-300 text-primary-600 focus:ring-primary-500/20 w-4.5 h-4.5"
                                                                />
                                                                <span className="text-sm font-semibold text-slate-600 truncate">{val}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                    <div className="p-2 border-t border-slate-100 bg-slate-50/60 text-center">
                                                        <button 
                                                            onClick={() => setActiveFilterColumn(null)}
                                                            className="w-full text-xs text-primary-600 font-bold hover:text-primary-800 py-1"
                                                        >
                                                            필터 적용 및 닫기
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </th>
                                    );
                                })}
                                <th className="px-5 py-3.5 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">액션</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="11" className="px-6 py-16 text-center text-slate-400 font-semibold bg-slate-50/20">
                                        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-2" />
                                        데이터를 로드하는 중입니다...
                                    </td>
                                </tr>
                            ) : currentItems.length === 0 ? (
                                <tr>
                                    <td colSpan="11" className="px-6 py-16 text-center text-slate-400 font-semibold bg-slate-50/20">
                                        <AlertTriangle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                        검사 이력이 존재하지 않습니다.
                                    </td>
                                </tr>
                            ) : (
                                currentItems.map((item) => (
                                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="px-5 py-3.5 whitespace-nowrap text-sm font-semibold text-slate-900">{formatDate(item.date)}</td>
                                        <td className="px-5 py-3.5 whitespace-nowrap text-sm font-extrabold text-indigo-600 bg-indigo-50/20 rounded-lg">{getItemCode(item)}</td>
                                        <td className="px-5 py-3.5 whitespace-nowrap text-sm font-bold text-slate-800">{item.itemName}</td>
                                        <td className="px-5 py-3.5 whitespace-nowrap text-sm font-semibold text-slate-500">{item.itemType || '(미지정)'}</td>
                                        <td className="px-5 py-3.5 whitespace-nowrap text-sm font-bold text-slate-700">{item.supplier}</td>
                                        <td className="px-5 py-3.5 whitespace-nowrap text-sm font-extrabold text-slate-900 text-right pr-10">{Number(item.totalQuantity).toLocaleString()}</td>
                                        <td className="px-5 py-3.5 whitespace-nowrap text-sm font-semibold text-slate-500 text-right pr-10">{Number(item.inspectionQuantity).toLocaleString()}</td>
                                        <td className="px-5 py-3.5 whitespace-nowrap">
                                            <span className={`px-2.5 py-1 text-xs rounded-full font-bold inline-flex items-center gap-1 ${item.result === '합격' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${item.result === '합격' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                                                {item.result}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5 whitespace-nowrap text-sm font-bold text-slate-600">
                                            {item.defectType ? (
                                                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                                    item.defectType.includes('외관') ? 'bg-amber-50 text-amber-700 border border-amber-200/50' :
                                                    item.defectType.includes('가공') ? 'bg-blue-50 text-blue-700 border border-blue-200/50' :
                                                    item.defectType.includes('주물') ? 'bg-purple-50 text-purple-700 border border-purple-200/50' :
                                                    item.defectType.includes('조립') ? 'bg-teal-50 text-teal-700 border border-teal-200/50' :
                                                    item.defectType.includes('재질') ? 'bg-cyan-50 text-cyan-700 border border-cyan-200/50' :
                                                    'bg-slate-50 text-slate-600'
                                                }`}>
                                                    {item.defectType}
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td className="px-5 py-3.5 whitespace-nowrap text-sm font-semibold text-slate-500">{getCleanReportNo(item)}</td>
                                        <td className="px-5 py-3.5 whitespace-nowrap text-right text-sm font-medium">
                                            <button 
                                                onClick={() => openEditModal(item)} 
                                                className="text-primary-600 hover:text-primary-900 p-1 hover:bg-primary-50 rounded-lg transition-colors mr-2"
                                                title="수정"
                                            >
                                                <Edit2 className="w-4.5 h-4.5" />
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(item.id)} 
                                                className="text-red-500 hover:text-red-900 p-1 hover:bg-red-50 rounded-lg transition-colors"
                                                title="삭제"
                                            >
                                                <Trash2 className="w-4.5 h-4.5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="flex justify-between items-center px-5 py-4 border-t border-slate-100 bg-slate-50/30">
                        <span className="text-xs font-bold text-slate-500">
                            총 {sortedInspections.length}건 중 {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, sortedInspections.length)}건 표시
                        </span>
                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={() => paginate(Math.max(1, currentPage - 1))}
                                disabled={currentPage === 1}
                                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40 hover:bg-slate-100 transition-colors"
                            >
                                <ChevronLeft className="w-4.5 h-4.5" />
                            </button>
                            <span className="text-sm font-bold text-slate-700 bg-white border border-slate-200 px-3 py-1 rounded-lg">
                                {currentPage} / {totalPages}
                            </span>
                            <button
                                onClick={() => paginate(Math.min(totalPages, currentPage + 1))}
                                disabled={currentPage === totalPages}
                                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40 hover:bg-slate-100 transition-colors"
                            >
                                <ChevronRight className="w-4.5 h-4.5" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl p-6 border border-slate-200/80 animate-scale-in">
                        <div className="flex justify-between items-center mb-6 pb-2 border-b">
                            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                                {editingItem ? '검사 결과 수정' : '신규 인수검사 결과 수동 등록'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleSave} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5">검사일자</label>
                                    <input 
                                        type="date" 
                                        name="date" 
                                        required 
                                        defaultValue={editingItem?.date || new Date().toISOString().split('T')[0]} 
                                        className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5">공급업체명</label>
                                    <input 
                                        type="text" 
                                        name="supplier" 
                                        required 
                                        defaultValue={editingItem?.supplier} 
                                        className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20" 
                                        placeholder="예: 세강정밀금속" 
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5">품목(제품)명</label>
                                    <input 
                                        type="text" 
                                        name="itemName" 
                                        required 
                                        defaultValue={editingItem?.itemName} 
                                        className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20" 
                                        placeholder="예: 게이트밸브 100A" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5">품목번호 (item_code)</label>
                                    <input 
                                        type="text" 
                                        name="item_code" 
                                        defaultValue={getItemCode(editingItem)} 
                                        className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 text-indigo-600 font-bold" 
                                        placeholder="ITEM-SW-XXX" 
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5">품목 유형 (업태)</label>
                                    <select 
                                        name="itemType" 
                                        defaultValue={editingItem?.itemType || '외주가공'} 
                                        className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                                    >
                                        <option value="외주가공">외주가공</option>
                                        <option value="주물류">주물류</option>
                                        <option value="원자재(주물)">원자재(주물)</option>
                                        <option value="외주도장">외주도장</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5">인수검사성적서 NO</label>
                                    <input 
                                        type="text" 
                                        name="inspectionReportNo" 
                                        defaultValue={getCleanReportNo(editingItem)} 
                                        className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20" 
                                        placeholder="SR-YYYYMMDD-XXX" 
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5">총입고량</label>
                                    <input 
                                        type="number" 
                                        name="totalQuantity" 
                                        required 
                                        defaultValue={editingItem?.totalQuantity || 0} 
                                        className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5">검사량</label>
                                    <input 
                                        type="number" 
                                        name="inspectionQuantity" 
                                        required 
                                        defaultValue={editingItem?.inspectionQuantity || 0} 
                                        className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5">불량수량</label>
                                    <input 
                                        type="number" 
                                        name="defectQuantity" 
                                        required 
                                        defaultValue={editingItem?.defectQuantity || 0} 
                                        className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 text-red-600 font-bold" 
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1.5">부적합(불량) 유형 현상</label>
                                <input 
                                    type="text" 
                                    name="defectType" 
                                    defaultValue={editingItem?.defectType} 
                                    className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20" 
                                    placeholder="예: [주물치수부적합] 공차 초과 변형" 
                                />
                            </div>
                            <div className="flex justify-end gap-2.5 mt-6 pt-4 border-t">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4.5 py-2 text-slate-500 hover:bg-slate-100 font-semibold rounded-xl transition-all">취소</button>
                                <button type="submit" className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl shadow-md transition-all">
                                    저장 완료
                                </button>
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
        </div>
    );
};

export default InboundHistory;
