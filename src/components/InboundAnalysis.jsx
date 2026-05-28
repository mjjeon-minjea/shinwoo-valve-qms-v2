import React, { useState, useEffect } from 'react';
import { ResponsiveContainer, ComposedChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Area, Bar, PieChart, Pie, Cell } from 'recharts';
import { Box, ClipboardCheck, AlertTriangle, Package, XCircle } from 'lucide-react';
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

const InboundAnalysis = () => {
    const [inspections, setInspections] = useState([]);
    // eslint-disable-next-line no-unused-vars
    const [loading, setLoading] = useState(true);



    const [dateRange, setDateRange] = useState({
        start: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`,
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

    // eslint-disable-next-line no-unused-vars
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

    // eslint-disable-next-line no-unused-vars
    const defectTypeCount = Object.keys(defectTypeMap).map(name => ({
        name,
        value: defectTypeMap[name].count,
        details: defectTypeMap[name].details
    })).sort((a, b) => b.value - a.value).slice(0, 10);

    // Custom Tooltip Component
    // eslint-disable-next-line no-unused-vars
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


export default InboundAnalysis;
