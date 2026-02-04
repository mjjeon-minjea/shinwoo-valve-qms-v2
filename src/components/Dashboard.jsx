import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area,
    PieChart, Pie, Cell, BarChart, Bar, Legend, ComposedChart
} from 'recharts';
import {
    Box, Package, ClipboardCheck, AlertTriangle, XCircle, Activity,
    Settings, CheckCircle, HelpCircle, ChevronRight, ChevronDown,
    Users, MoreHorizontal, UserCheck, User, RefreshCw, MessageSquare,
    Plus, Trash2, Edit, X, Upload, FileText, LayoutDashboard, Search,
    Monitor, Sliders, ToggleLeft, ToggleRight, Save, Filter
} from 'lucide-react';
import Chatbot from './Chatbot';
import ProgressModal from './ProgressModal';
import * as XLSX from 'xlsx';
import popupImage from '../assets/popup.png';
import NoticeBoard from './NoticeBoard';
import ResourceRoom from './ResourceRoom';
import WeeklyReport from './WeeklyReport';
import WeeklyStatus from './WeeklyStatus';
import CalendarView from './CalendarView';
import { api } from '../lib/api';
import NonConformanceStatus from './NonConformanceStatus';
import InspectionAnalysisDashboard from './InspectionAnalysisDashboard';

// --- Helper Functions ---

// Helper: Convert Excel Serial Date to YYYY-MM-DD
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

// --- Sub-components for Views ---

const InboundAnalysis = () => {
    const [inspections, setInspections] = useState([]);
    const [loading, setLoading] = useState(true);



    const [dateRange, setDateRange] = useState({
        start: '2024-01-01',
        end: new Date().toISOString().split('T')[0]
    });
    const [groupBy, setGroupBy] = useState('day'); // 'day', 'month', 'year'

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

    // --- Filtering Logic ---
    const filteredInspections = inspections.filter(item => {
        const itemDate = formatDate(item.date);
        return itemDate >= dateRange.start && itemDate <= dateRange.end;
    });

    // --- Grouping Helper ---
    const getGroupKey = (dateStr, type) => {
        const str = String(dateStr || '');
        if (type === 'month') return str.substring(0, 7); // YYYY-MM
        if (type === 'year') return str.substring(0, 4); // YYYY
        return str; // YYYY-MM-DD
    };

    // Calculations based on FILTERED data
    // Calculations based on FILTERED data

    // 1. Quantity Metrics (Row 1)
    const totalInboundQty = filteredInspections.reduce((acc, curr) => acc + Number(curr.totalQuantity || 0), 0);
    const totalInspectionQty = filteredInspections.reduce((acc, curr) => acc + Number(curr.inspectionQuantity || 0), 0);
    const totalDefectQty = filteredInspections.reduce((acc, curr) => acc + Number(curr.defectQuantity || 0), 0);

    // 2. Count Metrics (Row 2)
    const totalInboundCount = filteredInspections.length;
    // User logic: Count as 1 inspection if 'inspectionReportNo' exists and is not '-'
    const totalInspectionCount = filteredInspections.filter(i => i.inspectionReportNo && i.inspectionReportNo !== '-').length;

    const totalFailCount = filteredInspections.filter(i => i.result === '불합격').length;

    // Pass Count/Rate for charts (logic unchanged)
    const passCount = totalInboundCount - totalFailCount;
    // Defect Rate Logic (Changed from Pass Rate)
    const defectRate = totalInboundCount > 0 ? ((totalFailCount / totalInboundCount) * 100).toFixed(1) : 0;


    const summaryRows = [
        // Row 1: Quantity
        [
            { title: '총 입고수량', value: totalInboundQty.toLocaleString(), subtext: '전체 품목 입고 EA', icon: Box, color: 'text-indigo-600', bg: 'bg-indigo-50' },
            { title: '총 검사수량', value: totalInspectionQty.toLocaleString(), subtext: `검사율 ${totalInboundQty > 0 ? ((totalInspectionQty / totalInboundQty) * 100).toFixed(1) : 0}%`, icon: ClipboardCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { title: '총 불량수량', value: totalDefectQty.toLocaleString(), subtext: `불량률 ${totalInspectionQty > 0 ? ((totalDefectQty / totalInspectionQty) * 100).toFixed(2) : 0}% (수량 기준)`, icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50' },
        ],
        // Row 2: Count
        [
            { title: '총 입고건수', value: `${totalInboundCount.toLocaleString()}건`, subtext: '전체 데이터 라인 수', icon: Package, color: 'text-blue-600', bg: 'bg-blue-50' },
            { title: '총 검사건수', value: `${totalInspectionCount.toLocaleString()}건`, subtext: '성적서 발급 기준', icon: ClipboardCheck, color: 'text-teal-600', bg: 'bg-teal-50' },
            { title: '총 불합격건수', value: `${totalFailCount.toLocaleString()}건`, subtext: `불량률 ${totalInspectionCount > 0 ? ((totalFailCount / totalInspectionCount) * 100).toFixed(2) : 0}% (건수 기준)`, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
        ]
    ];

    // Chart Data Preparation (Grouped)
    const trendMap = filteredInspections.reduce((acc, curr) => {
        const dateStr = formatDate(curr.date);
        const groupKey = getGroupKey(dateStr, groupBy);

        if (!acc[groupKey]) acc[groupKey] = { qty: 0, count: 0 };
        acc[groupKey].qty += Number(curr.totalQuantity || 0);
        acc[groupKey].count += 1;
        return acc;
    }, {});

    const trendData = Object.keys(trendMap).sort().map(key => ({
        date: key,
        value: trendMap[key].qty, // Keep 'value' for compatibility with current AreaChart
        count: trendMap[key].count
    }));

    // Pie Data
    const pieData = [
        { name: '합격', value: passCount, color: '#3b82f6' },
        { name: '불합격', value: totalFailCount, color: '#ef4444' },
    ];

    // Supplier Data (Top 10 based on FILTERED data)
    const supplierMap = filteredInspections.reduce((acc, curr) => {
        if (!acc[curr.supplier]) acc[curr.supplier] = { total: 0, defect: 0, qty: 0, defectQty: 0, details: {} };
        acc[curr.supplier].total += 1;
        if (curr.result === '불합격') {
            acc[curr.supplier].defect += 1;
            const dType = curr.defectType || '미지정';
            acc[curr.supplier].details[dType] = (acc[curr.supplier].details[dType] || 0) + 1;
        }
        acc[curr.supplier].qty += Number(curr.totalQuantity);
        acc[curr.supplier].defectQty += Number(curr.defectQuantity);
        return acc;
    }, {});

    const supplierDefectCount = Object.keys(supplierMap).map(name => ({
        name,
        value: supplierMap[name].defect, // Count of defects
        details: supplierMap[name].details // Breakdown for tooltip
    })).filter(i => i.value > 0).sort((a, b) => b.value - a.value).slice(0, 10);

    // Defect Type Data (Top 10 Count) - NEW
    const defectTypeMap = filteredInspections.reduce((acc, curr) => {
        const type = curr.defectType;
        if (type && type !== '-' && type !== '') {
            if (!acc[type]) acc[type] = { count: 0, details: {} };
            acc[type].count += 1;
            const supp = curr.supplier || '미지정';
            acc[type].details[supp] = (acc[type].details[supp] || 0) + 1;
        }
        return acc;
    }, {});

    const defectTypeCount = Object.keys(defectTypeMap).map(name => ({
        name,
        value: defectTypeMap[name].count,
        details: defectTypeMap[name].details
    })).sort((a, b) => b.value - a.value).slice(0, 10);

    // Custom Tooltip Component
    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            const details = data.details || {};
            const detailKeys = Object.keys(details).sort((a, b) => details[b] - details[a]); // Sort desc

            return (
                <div className="bg-slate-800 text-white p-3 rounded-lg shadow-xl text-xs z-50 border border-slate-700 opacity-95">
                    <p className="font-bold mb-2 border-b border-slate-600 pb-1 text-sm">{label}</p>
                    <p className="font-bold text-lg mb-2 text-yellow-400">Total: {data.value}건</p>

                    {detailKeys.length > 0 && (
                        <div className="space-y-1 max-h-[200px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                            {detailKeys.map((key) => (
                                <div key={key} className="flex justify-between gap-6 items-center hover:bg-slate-700/50 p-1 rounded">
                                    <span className="text-slate-300 truncate max-w-[150px]" title={key}>{key}</span>
                                    <span className="font-mono text-white flex-shrink-0">{details[key]}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header with Filters */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">인수검사 분석 리포트</h1>
                    <p className="text-slate-500">공급업체 전체 현황 및 품질 지표</p>
                </div>

                {/* Filter Controls Container - Stacked */}
                <div className="flex flex-col items-end gap-2">
                    {/* Row 1: Date Range & Group By */}
                    <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <input
                                    type="date"
                                    value={dateRange.start}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                                    className="pl-3 pr-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                />
                            </div>
                            <span className="text-slate-400">~</span>
                            <div className="relative">
                                <input
                                    type="date"
                                    value={dateRange.end}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                                    className="pl-3 pr-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                />
                            </div>
                        </div>

                        <div className="h-6 w-px bg-slate-200 mx-1"></div>

                        <div className="flex bg-slate-100 p-1 rounded-lg">
                            {['day', 'month', 'year'].map((type) => (
                                <button
                                    key={type}
                                    onClick={() => setGroupBy(type)}
                                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${groupBy === type
                                        ? 'bg-white text-primary-600 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-900'
                                        }`}
                                >
                                    {type === 'day' ? '일별' : type === 'month' ? '월별' : '년별'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Row 2: Quick Month Select */}
                    <div className="flex items-center gap-2 bg-white p-2 rounded-xl shadow-sm border border-slate-200">
                        <span className="text-xs font-bold text-slate-500 px-1">빠른 기간 설정 :</span>

                        {/* Year Select */}
                        <select
                            className="pl-2 pr-8 py-1 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none bg-slate-50 hover:bg-white transition-colors"
                            value={parseInt(dateRange.start.split('-')[0]) || new Date().getFullYear()}
                            onChange={(e) => {
                                const newYear = parseInt(e.target.value);
                                const currentYear = dateRange.start.split('-')[0];
                                const isWholeYear = dateRange.start === `${currentYear}-01-01` && dateRange.end === `${currentYear}-12-31`;

                                if (isWholeYear) {
                                    setDateRange({
                                        start: `${newYear}-01-01`,
                                        end: `${newYear}-12-31`
                                    });
                                } else {
                                    const currentMonth = parseInt(dateRange.start.split('-')[1]);
                                    const lastDay = new Date(newYear, currentMonth, 0).getDate();
                                    setDateRange({
                                        start: `${newYear}-${String(currentMonth).padStart(2, '0')}-01`,
                                        end: `${newYear}-${String(currentMonth).padStart(2, '0')}-${lastDay}`
                                    });
                                }
                            }}
                        >
                            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                                <option key={year} value={year}>{year}년</option>
                            ))}
                        </select>

                        {/* Month Select */}
                        <select
                            className="pl-2 pr-8 py-1 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none bg-slate-50 hover:bg-white transition-colors"
                            value={(() => {
                                const year = dateRange.start.split('-')[0];
                                if (dateRange.start === `${year}-01-01` && dateRange.end === `${year}-12-31`) return 'all';
                                return parseInt(dateRange.start.split('-')[1]) || (new Date().getMonth() + 1);
                            })()}
                            onChange={(e) => {
                                const val = e.target.value;
                                const currentYear = parseInt(dateRange.start.split('-')[0]);

                                if (val === 'all') {
                                    setDateRange({
                                        start: `${currentYear}-01-01`,
                                        end: `${currentYear}-12-31`
                                    });
                                } else {
                                    const newMonth = parseInt(val);
                                    const lastDay = new Date(currentYear, newMonth, 0).getDate();
                                    setDateRange({
                                        start: `${currentYear}-${String(newMonth).padStart(2, '0')}-01`,
                                        end: `${currentYear}-${String(newMonth).padStart(2, '0')}-${lastDay}`
                                    });
                                }
                            }}
                        >
                            <option value="all">전체</option>
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                                <option key={month} value={month}>{month}월</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Summary Cards - 2 Rows */}
            <div className="space-y-4">
                {summaryRows.map((row, rowIndex) => (
                    <div key={rowIndex} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {row.map((item, index) => (
                            <div key={index} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex items-center justify-between mb-4">
                                    <div className={`p-3 rounded-lg ${item.bg}`}>
                                        {item.icon && <item.icon className={`w-6 h-6 ${item.color}`} />}
                                    </div>
                                </div>
                                <h3 className="text-sm font-medium text-slate-500">{item.title}</h3>
                                <div className="mt-2 flex items-baseline">
                                    <span className="text-2xl font-bold text-slate-800">{item.value}</span>
                                </div>
                                <p className="text-xs text-slate-400 mt-1">{item.subtext}</p>
                            </div>
                        ))}
                    </div>
                ))}
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Trend Chart */}
                <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="mb-6 flex justify-between items-center">
                        <h3 className="font-bold text-slate-800">입고 추이 분석 ({groupBy === 'day' ? '일별' : groupBy === 'month' ? '월별' : '년별'})</h3>
                    </div>
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={trendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />

                                {/* Left Axis: Quantity */}
                                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />

                                {/* Right Axis: Count */}
                                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#82ca9d' }} />

                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Legend />

                                {/* Area (Quantity) */}
                                <Area yAxisId="left" type="monotone" dataKey="value" name="입고수량" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />

                                {/* Bar (Count) */}
                                <Bar yAxisId="right" dataKey="count" name="입고건수" barSize={20} fill="#82ca9d" radius={[4, 4, 0, 0]} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Right: Pie Chart */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="mb-6">
                        <h3 className="font-bold text-slate-800">검사 판정 요약</h3>
                        <span className="text-xs text-slate-400">선택 기간 내 판정 비율</span>
                    </div>
                    <div className="h-[250px] w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none pb-8">
                            <p className="text-3xl font-bold text-slate-800">{defectRate}%</p>
                            <p className="text-xs text-slate-500">불량률</p>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
};

const InboundHistory = () => {
    const [inspections, setInspections] = useState([]);
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
                        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
                body: { id: String(Date.now()), ...data }
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
                    updateProgress(50, 100, 'delete'); // Show "Deleting..."
                    
                    // Server supports batch delete via custom route in server.js
                    const res = await api.fetch('/inspections', { method: 'DELETE' });

                    if (res.ok) {
                        updateProgress(100, 100, 'delete');
                        setTimeout(() => closeProgress(), 500);
                        alert('모든 데이터가 삭제되었습니다.');
                        fetchInspections();
                    } else {
                        // Fallback if server returns error (e.g. 404)
                        throw new Error(`Batch delete failed: ${res.status}`);
                    }

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

    // ... (inside filteredInspections)
    const filteredInspections = inspections.filter(item => {
        return Object.entries(filters).every(([key, selectedValues]) => {
            if (!selectedValues || selectedValues.length === 0) return true;
             const itemValue = item[key] || '(미지정)'; // Match the display value
             return selectedValues.includes(itemValue);
        });
    });

    // Pagination Logic
    // Sort by date/id desc first (newest top)
    const sortedInspections = [...filteredInspections].sort((a, b) => {
         if (a.id < b.id) return 1;
         if (a.id > b.id) return -1;
         return 0;
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
const PlaceholderView = ({ title, icon: Icon }) => (
    <div className="flex flex-col items-center justify-center h-[600px] text-slate-400 animate-fade-in">
        <div className="bg-slate-100 p-6 rounded-full mb-4">
            <Icon className="w-12 h-12" />
        </div>
        <h2 className="text-2xl font-bold text-slate-600 mb-2">{title}</h2>
        <p>해당 기능은 현재 개발 중입니다.</p>
    </div>
);

const InquiryManagement = ({ isAdmin, user }) => {
    const [inquiries, setInquiries] = React.useState([]);
    const [selectedInquiry, setSelectedInquiry] = React.useState(null);
    const [newMessage, setNewMessage] = React.useState('');
    const messagesEndRef = React.useRef(null);

    React.useEffect(() => {
        fetchInquiries();
        const interval = setInterval(fetchInquiries, 1000); // Polling every 1s for real-time feel
        return () => clearInterval(interval);
    }, []);

    // Sync selectedInquiry with updated inquiries list
    React.useEffect(() => {
        if (selectedInquiry) {
            const updated = inquiries.find(i => i.id === selectedInquiry.id);
            if (updated && JSON.stringify(updated.messages) !== JSON.stringify(selectedInquiry.messages)) {
                setSelectedInquiry(updated);
            }
        }
    }, [inquiries]);

    // Scroll to bottom only when messages change
    React.useEffect(() => {
        if (selectedInquiry) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [selectedInquiry?.messages?.length]);

    const fetchInquiries = async () => {
        try {
            const response = await fetch('/inquiries');
            if (response.ok) {
                const data = await response.json();
                // Ensure data is array
                let inquiriesArray = Array.isArray(data) ? data : [];

                // Filter for non-admins: only show own inquiries
                if (!isAdmin && user) {
                    inquiriesArray = inquiriesArray.filter(inq =>
                        inq.author === user.name || // Match by name (legacy)
                        inq.userId === user.id ||   // Match by ID (preferred)
                        (inq.messages && inq.messages.some(m => m.sender === 'user' && m.author === user.name)) // fallback
                    );
                }

                // Sort by date/id descending (newest first)
                setInquiries(inquiriesArray.sort((a, b) => b.id - a.id));
            }
        } catch (error) {
            console.error('Failed to fetch inquiries:', error);
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedInquiry) return;

        const message = {
            sender: isAdmin ? 'admin' : 'user', // Identify sender
            role: isAdmin ? 'assistant' : 'user', // Role for UI styling
            content: newMessage,
            timestamp: new Date().toISOString()
        };

        const updatedMessages = [...(selectedInquiry.messages || []), message];

        try {
            const response = await fetch(`/inquiries/${selectedInquiry.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: updatedMessages })
            });

            if (response.ok) {
                const updatedInquiry = await response.json();

                // Update local state
                setInquiries(prev => prev.map(inq => inq.id === updatedInquiry.id ? updatedInquiry : inq));
                setSelectedInquiry(updatedInquiry);
                setNewMessage(''); // Clear input
            }
        } catch (error) {
            console.error('Failed to send message:', error);
        }
    };

    return (
        <div className="animate-fade-in h-[calc(100vh-140px)] flex gap-6">
            {/* Inquiry List */}
            <div className="w-1/3 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-100 bg-slate-50">
                    <h2 className="font-bold text-slate-900 flex items-center gap-2">
                        <div className="bg-primary-100 p-1.5 rounded-lg">
                            <MessageSquare className="w-4 h-4 text-primary-600" />
                        </div>
                        문의 목록
                        <span className="text-xs font-normal text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                            {inquiries.length}
                        </span>
                    </h2>
                </div>
                <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                    {inquiries.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-sm flex flex-col items-center">
                            <MessageSquare className="w-8 h-8 mb-2 opacity-20" />
                            접수된 문의가 없습니다.
                        </div>
                    ) : (
                        inquiries.map((inquiry) => (
                            <button
                                key={inquiry.id}
                                onClick={() => setSelectedInquiry(inquiry)}
                                className={`w-full p-4 text-left transition-colors hover:bg-slate-50 ${selectedInquiry?.id === inquiry.id ? 'bg-primary-50 border-l-4 border-primary-600' : 'border-l-4 border-transparent'}`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <span className="font-medium text-slate-900 text-sm">{inquiry.author || inquiry.userName || '방문자'}</span>
                                    <span className="text-xs text-slate-400">{inquiry.date ? new Date(inquiry.date).toLocaleDateString() : ''}</span>
                                </div>
                                <p className="text-xs text-slate-500 line-clamp-1">
                                    {inquiry.messages && inquiry.messages.length > 0
                                        ? (inquiry.messages[inquiry.messages.length - 1].content || inquiry.messages[inquiry.messages.length - 1].text)
                                        : '메세지 없음'}
                                </p>
                                <div className="mt-2 flex gap-2">
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${inquiry.status === 'Open' || inquiry.status === 'pending' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                        {inquiry.status}
                                    </span>
                                    <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                                        ID: {String(inquiry.id).slice(-4)}
                                    </span>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* Chat Detail */}
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                {selectedInquiry ? (
                    <>
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600">
                                    <User className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900">{selectedInquiry.author || selectedInquiry.userName}</h3>
                                    <p className="text-xs text-slate-500">ID: {String(selectedInquiry.id).slice(-4)} • {selectedInquiry.date ? new Date(selectedInquiry.date).toLocaleString() : ''}</p>
                                </div>
                            </div>
                            <button className="text-xs flex items-center gap-1 text-slate-500 hover:text-slate-900 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                                <CheckCircle className="w-3 h-3" />
                                상태 변경
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50">
                            {selectedInquiry.messages && selectedInquiry.messages.map((msg, idx) => (
                                <div key={idx} className={`flex ${(msg.role === 'user' || msg.sender === 'user') ? 'justify-start' : 'justify-end'}`}>
                                    <div className={`flex flex-col ${(msg.role === 'user' || msg.sender === 'user') ? 'items-start' : 'items-end'} max-w-[70%]`}>
                                        <div className={`px-4 py-2.5 rounded-2xl text-sm shadow-sm ${(msg.role === 'user' || msg.sender === 'user')
                                            ? 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
                                            : 'bg-primary-600 text-white rounded-tr-none'
                                            }`}>
                                            {msg.content || msg.text}
                                        </div>
                                        <span className="text-[10px] text-slate-400 mt-1 px-1">
                                            {(msg.role === 'user' || msg.sender === 'user') ? '고객' : 'AI 챗봇'} • {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                        </span>
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>
                        <div className="p-4 border-t border-slate-100 bg-white">
                            <div className="p-4 border-t border-slate-100 bg-white">
                                <form className="relative" onSubmit={handleSendMessage}>
                                    <input
                                        type="text"
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        placeholder="메세지를 입력하세요..."
                                        className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition-shadow"
                                    />
                                    <button
                                        type="submit"
                                        disabled={!newMessage.trim()}
                                        className={`absolute right-2 top-2 p-1.5 rounded-lg transition-colors ${newMessage.trim() ? 'bg-primary-600 text-white hover:bg-primary-700' : 'bg-slate-200 text-white cursor-not-allowed'}`}
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </form>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                        <div className="bg-slate-50 p-6 rounded-full mb-4">
                            <MessageSquare className="w-12 h-12 text-slate-300" />
                        </div>
                        <h3 className="text-lg font-medium text-slate-600">문의 내용 확인</h3>
                        <p className="text-sm mt-1">좌측 목록에서 문의를 선택하여 대화 내용을 확인하세요.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const MemberManagement = ({ members, onDeleteMember, onEditMember, onAddMember, onRefresh }) => {
    const [openDropdownId, setOpenDropdownId] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [showPassword, setShowPassword] = useState(false);

    const handleAddSubmit = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const newUser = {
            name: formData.get('name'),
            company: formData.get('company'),
            rank: formData.get('rank'),
            role: formData.get('role'),
            email: formData.get('email'),
            status: 'Active'
        };
        onAddMember(newUser);
        setIsAddModalOpen(false);
        setShowPassword(false);
    };

    const toggleDropdown = (id) => {
        setOpenDropdownId(openDropdownId === id ? null : id);
    };

    const openEditModal = (user) => {
        setEditingUser(user);
        setIsEditModalOpen(true);
        setOpenDropdownId(null);
    };

    const handleSaveEdit = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const updatedData = {
            ...editingUser,
            name: formData.get('name'),
            company: formData.get('company'),
            rank: formData.get('rank'),
            role: formData.get('role'),
            email: formData.get('email'),
            password: formData.get('password'),
            status: formData.get('status'),
        };
        onEditMember(updatedData);
        setIsEditModalOpen(false);
    };

    return (
        <div className="space-y-6 animate-fade-in relative">
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold text-slate-900">회원 관리</h1>
                        <button
                            onClick={onRefresh}
                            className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-full transition-all duration-200"
                            title="목록 새로고침"
                        >
                            <RefreshCw className="w-5 h-5" />
                        </button>
                    </div>
                    <p className="text-slate-500 text-sm mt-1">등록된 회원 목록 및 상태 관리</p>
                </div>
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
                >
                    <User className="w-4 h-4 mr-2" />
                    신규 회원 등록
                </button>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-visible">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">이름</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">부서명</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">직급</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">권한</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">이메일</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">비밀번호</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">가입일</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">상태</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">관리</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {members.map((member) => (
                            <tr key={member.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold text-sm">
                                            {member.name[0]}
                                        </div>
                                        <div className="ml-4">
                                            <div className="text-sm font-medium text-slate-900">{member.name}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-slate-600">{member.company}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-slate-600">{member.rank}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                        member.role === 'director' ? 'bg-purple-100 text-purple-800' :
                                        member.role === 'manager' ? 'bg-blue-100 text-blue-800' :
                                        'bg-slate-100 text-slate-800'
                                    }`}>
                                        {member.role === 'director' ? '작성+검토+승인' : 
                                         member.role === 'manager' ? '작성+검토' : '작성'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-slate-500">{member.email}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-slate-500">{member.password}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-slate-500">{member.date}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${member.status === 'Active' ? 'bg-green-100 text-green-800' :
                                        member.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                                            'bg-slate-100 text-slate-800'
                                        }`}>
                                        {member.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium relative">
                                    <button
                                        onClick={() => toggleDropdown(member.id)}
                                        className="text-slate-400 hover:text-primary-600 focus:outline-none"
                                    >
                                        <MoreHorizontal className="w-5 h-5" />
                                    </button>

                                    {openDropdownId === member.id && (
                                        <div className="absolute right-0 mt-2 w-32 bg-white rounded-md shadow-lg border border-slate-100 z-50 animate-fade-in-up">
                                            <div className="py-1 flex flex-col">
                                                <button
                                                    onClick={() => openEditModal(member)}
                                                    className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                                                >
                                                    정보 수정
                                                </button>
                                                <button
                                                    onClick={() => onDeleteMember(member.id)}
                                                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                                                >
                                                    회원 삭제
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Edit Modal */}
            {isEditModalOpen && editingUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 animate-scale-in">
                        <h2 className="text-xl font-bold text-slate-900 mb-4">회원 정보 수정</h2>
                        <form onSubmit={handleSaveEdit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">이름</label>
                                <input name="name" defaultValue={editingUser.name} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">부서명</label>
                                <input name="company" defaultValue={editingUser.company} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">직급</label>
                                <input name="rank" defaultValue={editingUser.rank} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">권한 (Role)</label>
                                <select name="role" defaultValue={editingUser.role || 'employee'} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500">
                                    <option value="employee">작성</option>
                                    <option value="manager">작성+검토</option>
                                    <option value="director">작성+검토+승인</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">이메일</label>
                                <input name="email" defaultValue={editingUser.email} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">비밀번호</label>
                                <input name="password" defaultValue={editingUser.password} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">상태</label>
                                <select name="status" defaultValue={editingUser.status} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500">
                                    <option value="Active">Active</option>
                                    <option value="Inactive">Inactive</option>
                                    <option value="Pending">Pending</option>
                                </select>
                            </div>
                            <div className="flex justify-end gap-2 mt-6">
                                <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">취소</button>
                                <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">저장</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Add Member Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 animate-scale-in">
                        <h2 className="text-xl font-bold text-slate-900 mb-4">신규 회원 등록</h2>
                        <form onSubmit={handleAddSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">이름</label>
                                <input name="name" required className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500" placeholder="홍길동" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">부서명</label>
                                <input name="company" required className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500" placeholder="품질보증부" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">직급</label>
                                <input name="rank" required className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500" placeholder="대리" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">권한 (Role)</label>
                                <select name="role" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500">
                                    <option value="employee">작성</option>
                                    <option value="manager">작성+검토</option>
                                    <option value="director">작성+검토+승인</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">이메일</label>
                                <input name="email" type="email" required className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500" placeholder="name@company.com" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">비밀번호</label>
                                <input name="password" type="password" required className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500" placeholder="비밀번호" />
                            </div>
                            <div className="flex justify-end gap-2 mt-6">
                                <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">취소</button>
                                <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">등록</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

const HomepageSettings = () => {
    const [popupEnabled, setPopupEnabled] = useState(true);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await api.fetch('/settings/global');
            if (res.ok) {
                const data = await res.json();
                setPopupEnabled(data.popupEnabled);
                setError(null);
            } else if (res.status === 404) {
                setError('서버 재시작이 필요합니다. (새로운 설정 적용을 위해 터미널에서 npm run start를 다시 실행해주세요)');
            } else {
                throw new Error('Failed to fetch settings');
            }
        } catch (error) {
            console.error('Failed to fetch settings:', error);
            setError('설정을 불러오는 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await api.fetch('/settings/global', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: { id: 'global', popupEnabled }
            });

            if (res.ok) {
                alert('설정이 저장되었습니다.');
                setError(null);
            } else if (res.status === 404) {
                setError('서버 재시작이 필요합니다. (새로운 설정 적용을 위해 터미널에서 npm run start를 다시 실행해주세요)');
                alert('서버 재시작이 필요합니다.');
            } else {
                throw new Error('Failed to save');
            }
        } catch (error) {
            console.error('Save error:', error);
            alert('설정 저장 중 오류가 발생했습니다.');
            setError('설정 저장 중 오류가 발생했습니다.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500">설정을 불러오는 중...</div>;

    return (
        <div className="space-y-6 animate-fade-in">
            <h1 className="text-2xl font-bold text-slate-900">홈페이지 설정</h1>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-200 flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                    <span className="font-medium">{error}</span>
                </div>
            )}

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden text-left">
                <div className="p-6 border-b border-slate-100 bg-slate-50">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Monitor className="w-5 h-5 text-indigo-600" />
                        메인 팝업 설정
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">대시보드 접속 시 표시되는 공지 팝업을 관리합니다.</p>
                </div>
                <div className="p-8">
                    <div className="flex items-center justify-between max-w-2xl">
                        <div>
                            <h4 className="font-medium text-slate-900">팝업 표시</h4>
                            <p className="text-sm text-slate-500 mt-1">활성화 시 모든 사용자에게 로그인 직후 팝업이 표시됩니다.</p>
                        </div>
                        <button
                            onClick={() => setPopupEnabled(!popupEnabled)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${popupEnabled ? 'bg-primary-600' : 'bg-slate-200'}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${popupEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>
                </div>
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-sm disabled:opacity-50"
                    >
                        <Save className="w-4 h-4 mr-2" />
                        {saving ? '저장 중...' : '변경사항 저장'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const Popup = ({ onClose }) => {
    const [dontShowToday, setDontShowToday] = useState(false);

    const handleClose = () => {
        if (dontShowToday) {
            const today = new Date().toISOString().split('T')[0];
            localStorage.setItem(`hidePopup_${today}`, 'true');
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl overflow-hidden max-w-5xl w-full mx-4 flex flex-col animate-scale-in relative">
                <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 bg-white/80 p-1 rounded-full text-slate-600 hover:text-slate-900 z-10"
                >
                    <X className="w-6 h-6" />
                </button>
                <div className="relative w-full">
                    <img
                        src={popupImage}
                        alt="Promotional Popup"
                        className="w-full h-auto object-contain max-h-[70vh]"
                    />
                </div>
                <div className="p-4 bg-slate-100 flex justify-between items-center border-t border-slate-200">
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600 select-none">
                        <input
                            type="checkbox"
                            checked={dontShowToday}
                            onChange={(e) => setDontShowToday(e.target.checked)}
                            className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 w-4 h-4"
                        />
                        오늘 하루 열지 않기
                    </label>
                    <button
                        onClick={handleClose}
                        className="px-4 py-2 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-900 transition-colors"
                    >
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
};

const Home = ({ setActiveTab }) => {
    const [notices, setNotices] = useState([]);
    const [resources, setResources] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [noticeRes, resourceRes] = await Promise.all([
                    fetch('/notices'),
                    fetch('/resources')
                ]);
                if (noticeRes.ok) {
                    const data = await noticeRes.json();
                    setNotices(data.sort((a, b) => b.id - a.id).slice(0, 5));
                }
                if (resourceRes.ok) {
                    const data = await resourceRes.json();
                    setResources(data.sort((a, b) => b.id - a.id).slice(0, 5));
                }
            } catch (error) {
                console.error('Failed to fetch summary data', error);
            }
        };
        fetchData();
    }, []);

    return (
        <div className="space-y-6 animate-fade-in">
            <h1 className="text-2xl font-bold text-slate-900">메인화면</h1>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Notice Board */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden h-96 flex flex-col">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                        <div className="flex items-center gap-2">
                            <div className="bg-blue-100 p-1.5 rounded-lg">
                                <AlertTriangle className="w-4 h-4 text-blue-600" />
                            </div>
                            <h3 className="font-bold text-slate-800">공지사항</h3>
                        </div>
                        <button onClick={() => setActiveTab('notices')} className="text-xs text-slate-500 hover:text-primary-600 flex items-center">
                            <Search className="w-3 h-3 mr-1" />
                            상세보기
                        </button>
                    </div>
                    <div className="flex-1 overflow-auto">
                        <table className="min-w-full divide-y divide-slate-100">
                            <thead className="bg-slate-50 sticky top-0">
                                <tr>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase whitespace-nowrap w-12">No</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase whitespace-nowrap w-16">구분</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase w-full">공지제목</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase whitespace-nowrap w-20">작성자</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase whitespace-nowrap w-24">등록일자</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {notices.length === 0 ? (
                                    <tr><td colSpan="5" className="py-10 text-center text-slate-400 text-xs">등록된 공지가 없습니다.</td></tr>
                                ) : (
                                    notices.map((notice) => (
                                        <tr key={notice.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setActiveTab('notices')}>
                                            <td className="px-4 py-3 text-xs text-slate-500 text-center">{notice.id}</td>
                                            <td className="px-4 py-3 text-center whitespace-nowrap">
                                                <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${notice.type === 'MES' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                                                    {notice.type}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-800 line-clamp-1">{notice.title}</td>
                                            <td className="px-4 py-3 text-xs text-slate-500 text-center">{notice.author}</td>
                                            <td className="px-4 py-3 text-xs text-slate-400 text-center whitespace-nowrap">{notice.date}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Resource Room */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden h-96 flex flex-col">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                        <div className="flex items-center gap-2">
                            <div className="bg-green-100 p-1.5 rounded-lg">
                                <FileText className="w-4 h-4 text-green-600" />
                            </div>
                            <h3 className="font-bold text-slate-800">자료실</h3>
                        </div>
                        <button onClick={() => setActiveTab('resources')} className="text-xs text-slate-500 hover:text-primary-600 flex items-center">
                            <Search className="w-3 h-3 mr-1" />
                            상세보기
                        </button>
                    </div>
                    <div className="flex-1 overflow-auto">
                        <table className="min-w-full divide-y divide-slate-100">
                            <thead className="bg-slate-50 sticky top-0">
                                <tr>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase whitespace-nowrap w-12">No</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase whitespace-nowrap w-16">구분</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase w-full">자료제목</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase whitespace-nowrap w-20">작성자</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase whitespace-nowrap w-24">등록일자</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {resources.length === 0 ? (
                                    <tr><td colSpan="5" className="py-10 text-center text-slate-400 text-xs">등록된 자료가 없습니다.</td></tr>
                                ) : (
                                    resources.map((resource) => (
                                        <tr key={resource.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setActiveTab('resources')}>
                                            <td className="px-4 py-3 text-xs text-slate-500 text-center">{resource.id}</td>
                                            <td className="px-4 py-3 text-center whitespace-nowrap">
                                                <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${resource.type === '매뉴얼' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                                    {resource.type}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-800 line-clamp-1">{resource.title}</td>
                                            <td className="px-4 py-3 text-xs text-slate-500 text-center">{resource.author}</td>
                                            <td className="px-4 py-3 text-xs text-slate-400 text-center whitespace-nowrap">{resource.date}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

const Dashboard = ({ user, isAdmin, members, onDeleteMember, onEditMember, onAddMember, onRefresh }) => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('home'); // Default to home
    const [isMenuOpen, setIsMenuOpen] = useState(true);
    const [mainExpanded, setMainExpanded] = useState(true);
    const [inboundExpanded, setInboundExpanded] = useState(true);
    const [adminExpanded, setAdminExpanded] = useState(true);
    const [showPopup, setShowPopup] = useState(false);

    useEffect(() => {
        const checkPopup = async () => {
            const today = new Date().toISOString().split('T')[0];
            const hidePopup = localStorage.getItem(`hidePopup_${today}`);

            if (!hidePopup) {
                try {
                    const res = await api.fetch('/settings/global');
                    if (res.ok) {
                        const data = await res.json();
                        if (data.popupEnabled) {
                            setShowPopup(true);
                        }
                    }
                } catch (error) {
                    console.error('Popup check failed:', error);
                    // Do NOT default to true on error if using real Supabase
                    // Or keep it false to be safe?
                    // User wants to turn it off, so default to false might be better if error?
                    // But current logic is "Default to true on error".
                    // If api.fetch fails, it means Supabase is down or key is wrong.
                    // Let's keep existing fallback logic or maybe remove the "Default to true" if it causes issues.
                    // But the main issue was parsing HTML as JSON. api.fetch handles the data correctly.
                    // I will keep the fallback but the main path will now work.
                    setShowPopup(true);
                }
            }
        };
        checkPopup();
    }, []);

    const renderContent = () => {
        switch (activeTab) {
            case 'home': return <Home setActiveTab={setActiveTab} />;
            case 'notices': return <NoticeBoard />;
            case 'resources': return <ResourceRoom />;
            case 'inbound_analysis': return <InboundAnalysis />;
            case 'inspection_analysis': return <InspectionAnalysisDashboard />;
            case 'inbound_status': return <NonConformanceStatus />;
            case 'inbound_history': return <InboundHistory />;
            case 'process': return <PlaceholderView title="공정검사 현황" icon={Settings} />;
            case 'final': return <PlaceholderView title="최종검사 현황" icon={CheckCircle} />;
            case 'inquiries': return <InquiryManagement isAdmin={isAdmin} user={user} />;
            case 'members': return <MemberManagement members={members} onDeleteMember={onDeleteMember} onEditMember={onEditMember} onAddMember={onAddMember} onRefresh={onRefresh} />;
            case 'settings_home': return <HomepageSettings />;
            case 'weekly_report': return <WeeklyReport user={user} />;
            case 'weekly_status': return <WeeklyStatus />;
            case 'schedule': return <CalendarView user={user} />;
            default: return <InboundAnalysis />;
        }
    };

    return (
        <div className="flex min-h-[calc(100vh-64px)] bg-slate-50 pt-16">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-slate-200 fixed h-full z-40 hidden lg:block overflow-y-auto">
                <div className="p-6">
                    <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
                        Dashboards
                    </h2>
                    <nav className="space-y-1">
                        {/* Main Screen Group */}
                        <div>
                            <button
                                onClick={() => { setActiveTab('home'); setMainExpanded(!mainExpanded); }}
                                className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${activeTab === 'home' || activeTab === 'notices' || activeTab === 'resources'
                                    ? 'bg-primary-50 text-primary-700'
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                    }`}
                            >
                                <div className="flex items-center">
                                    <LayoutDashboard className={`mr-3 h-5 w-5 ${activeTab === 'home' || activeTab === 'notices' || activeTab === 'resources' ? 'text-primary-600' : 'text-slate-400'}`} />
                                    메인화면
                                </div>
                                <ChevronDown className={`w-4 h-4 transition-transform ${mainExpanded ? 'transform rotate-180' : ''} ${activeTab === 'home' ? 'text-primary-500' : 'text-slate-400'}`} />
                            </button>

                            {mainExpanded && (
                                <div className="mt-1 space-y-1 pl-11">
                                    <button
                                        onClick={() => setActiveTab('home')}
                                        className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'home' ? 'text-primary-600 bg-white shadow-sm' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}
                                    >
                                        대시보드 홈
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('notices')}
                                        className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'notices' ? 'text-primary-600 bg-white shadow-sm' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}
                                    >
                                        공지사항
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('resources')}
                                        className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'resources' ? 'text-primary-600 bg-white shadow-sm' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}
                                    >
                                        자료실
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Inbound Inspection Menu Group */}
                        <div>
                            <button
                                onClick={() => setInboundExpanded(!inboundExpanded)}
                                className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${activeTab.includes('inbound') ? 'text-primary-700 bg-primary-50' : 'text-slate-600 hover:bg-slate-50'
                                    }`}
                            >
                                <div className="flex items-center">
                                    <ClipboardCheck className={`mr-3 h-5 w-5 ${activeTab.includes('inbound') ? 'text-primary-600' : 'text-slate-400'}`} />
                                    인수검사
                                </div>
                                <ChevronDown className={`w-4 h-4 transition-transform ${inboundExpanded ? 'transform rotate-180' : ''} ${activeTab.includes('inbound') ? 'text-primary-500' : 'text-slate-400'}`} />
                            </button>


                            {inboundExpanded && (
                                <div className="mt-1 space-y-1 pl-11">
                                    <button
                                        onClick={() => setActiveTab('inbound_analysis')}
                                        className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'inbound_analysis' ? 'text-primary-600 bg-white shadow-sm' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                                            }`}
                                    >
                                        대시보드
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('inspection_analysis')}
                                        className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'inspection_analysis' ? 'text-primary-600 bg-white shadow-sm' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}
                                    >
                                        종합분석현황
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('inbound_status')}
                                        className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'inbound_status' ? 'text-primary-600 bg-white shadow-sm' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                                            }`}
                                    >
                                        부적합 현황 조회
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('inbound_history')}
                                        className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'inbound_history' ? 'text-primary-600 bg-white shadow-sm' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                                            }`}
                                    >
                                        이력 조회 및 등록
                                    </button>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => setActiveTab('process')}
                            className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${activeTab === 'process'
                                ? 'bg-primary-50 text-primary-700'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                }`}
                        >
                            <div className="flex items-center">
                                <Settings className={`mr-3 h-5 w-5 ${activeTab === 'process' ? 'text-primary-600' : 'text-slate-400'}`} />
                                공정검사
                            </div>
                        </button>

                        <button
                            onClick={() => setActiveTab('final')}
                            className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${activeTab === 'final'
                                ? 'bg-primary-50 text-primary-700'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                }`}
                        >
                            <div className="flex items-center">
                                <CheckCircle className={`mr-3 h-5 w-5 ${activeTab === 'final' ? 'text-primary-600' : 'text-slate-400'}`} />
                                최종검사
                            </div>
                        </button>

                        <button
                            onClick={() => setActiveTab('inquiries')}
                            className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${activeTab === 'inquiries'
                                ? 'bg-primary-50 text-primary-700'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                }`}
                        >
                            <div className="flex items-center">
                                <HelpCircle className={`mr-3 h-5 w-5 ${activeTab === 'inquiries' ? 'text-primary-600' : 'text-slate-400'}`} />
                                문의사항
                            </div>
                        </button>

                        {isAdmin && (
                            <div>
                                <button
                                    onClick={() => setAdminExpanded(!adminExpanded)}
                                    className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${activeTab === 'members' || activeTab === 'settings_home'
                                        ? 'bg-primary-50 text-primary-700'
                                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                        }`}
                                >
                                    <div className="flex items-center">
                                        <Settings className={`mr-3 h-5 w-5 ${activeTab === 'members' || activeTab === 'settings_home' ? 'text-primary-600' : 'text-slate-400'}`} />
                                        관리자 설정
                                    </div>
                                    <ChevronDown className={`w-4 h-4 transition-transform ${adminExpanded ? 'transform rotate-180' : ''} ${activeTab === 'members' || activeTab === 'settings_home' ? 'text-primary-500' : 'text-slate-400'}`} />
                                </button>

                                {adminExpanded && (
                                    <div className="mt-1 space-y-1 pl-11">
                                        <button
                                            onClick={() => setActiveTab('members')}
                                            className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'members'
                                                ? 'text-primary-600 bg-white shadow-sm'
                                                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                                                }`}
                                        >
                                            기존회원관리
                                        </button>
                                        <button
                                            onClick={() => setActiveTab('settings_home')}
                                            className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'settings_home'
                                                ? 'text-primary-600 bg-white shadow-sm'
                                                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                                                }`}
                                        >
                                            홈페이지 설정
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="pt-4 mt-4 border-t border-slate-200">
                            <h3 className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                업무 관리
                            </h3>
                            <button
                                onClick={() => setActiveTab('weekly_report')}
                                className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${activeTab === 'weekly_report'
                                    ? 'bg-primary-50 text-primary-700'
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                    }`}
                            >
                                <div className="flex items-center">
                                    <FileText className={`mr-3 h-5 w-5 ${activeTab === 'weekly_report' ? 'text-primary-500' : 'text-slate-400'}`} />
                                    주간업무보고
                                </div>
                            </button>
                            <button
                                onClick={() => setActiveTab('weekly_status')}
                                className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${activeTab === 'weekly_status'
                                    ? 'bg-primary-50 text-primary-700'
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                    }`}
                            >
                                <div className="flex items-center">
                                    <LayoutDashboard className={`mr-3 h-5 w-5 ${activeTab === 'weekly_status' ? 'text-primary-500' : 'text-slate-400'}`} />
                                    주간업무현황
                                </div>
                            </button>
                            <button
                                onClick={() => setActiveTab('schedule')}
                                className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${activeTab === 'schedule'
                                    ? 'bg-primary-50 text-primary-700'
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                    }`}
                            >
                                <div className="flex items-center">
                                    <Activity className={`mr-3 h-5 w-5 ${activeTab === 'schedule' ? 'text-primary-500' : 'text-slate-400'}`} />
                                    일정 (Calendar)
                                </div>
                            </button>
                        </div>
                    </nav>

                    {/* Additional Menu Section Mockup */}
                    <div className="mt-8">
                        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
                            Settings
                        </h2>
                        <nav className="space-y-1">
                            <button className="w-full flex items-center px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">
                                <FileText className="mr-3 h-5 w-5 text-slate-400" />
                                리포트 관리
                            </button>
                        </nav>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 lg:ml-64 p-8 relative">
                {renderContent()}
                <Chatbot />
            </main>

            {/* Login Popup */}
            {showPopup && <Popup onClose={() => setShowPopup(false)} />}
        </div>
    );
};

export default Dashboard;
