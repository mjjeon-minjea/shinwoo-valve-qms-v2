import { useState, useEffect } from 'react';
import {
    PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { api } from '../lib/api';

const InspectionAnalysisDashboard = () => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        byCategory: [],
        supplierQty: [],
        supplierFreq: [],

        worstSuppliers: [], // Using this for top 5 defect count
        supplierDefectCount: [], // New Top 10
        defectTypeCount: [],     // New Top 10
        defectReasons: []
    });

    const [selectedYear, setSelectedYear] = useState(2025);
    const [selectedMonth, setSelectedMonth] = useState('all'); // Default to all months to show full year data

    useEffect(() => {
        fetchData();
    }, []);

    // Re-process data when filter changes, but we need the raw data first.
    // So let's store raw data in state too.
    const [rawData, setRawData] = useState({ inspections: [], items: [] });

    useEffect(() => {
        if (rawData.inspections.length > 0) {
            processData(rawData.inspections, rawData.items);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedYear, selectedMonth, rawData]);

    const fetchData = async () => {
        try {
            const [inspRes, itemRes] = await Promise.all([
                api.fetch('/inspections'),
                api.fetch('/item_master')
            ]);
            
            if (inspRes.ok) {
                const inspections = await inspRes.json();
                let items = [];
                if (itemRes.ok) {
                    items = await itemRes.json();
                }
                setRawData({ inspections, items });
                // processData is triggered by useEffect
            }
        } catch (error) {
            console.error("Failed to fetch dashboard data:", error);
        } finally {
            setLoading(false);
        }
    };

    // Helper to format date safely
    const formatDate = (val) => {
        if (!val) return null;
        if (typeof val === 'number') {
            const date = new Date(Math.round((val - 25569) * 86400 * 1000));
            return date;
        }
        if (typeof val === 'string') {
            // Check if it's a numeric string (Excel serial)
            if (!isNaN(Number(val)) && !val.includes('-')) {
                 const date = new Date(Math.round((Number(val) - 25569) * 86400 * 1000));
                 return date;
            }
            return new Date(val);
        }
        return new Date(val);
    };

    const processData = (inspections, items) => {
        // Filter by Date
        const filteredInspections = inspections.filter(insp => {
            const dateVal = insp.date || insp.inspectionDate; // Handle both potential keys
            if (!dateVal) return false;
            
            const date = formatDate(dateVal);
            if (!date || isNaN(date.getTime())) return false;

            const yearMatch = date.getFullYear() === parseInt(selectedYear);
            const monthMatch = selectedMonth === 'all' || date.getMonth() + 1 === parseInt(selectedMonth);
            return yearMatch && monthMatch;
        });

        const itemMap = items.reduce((acc, curr) => {
            acc[curr.id] = curr; // Map by item code if possible, or name
            if (curr.name) acc[curr.name] = curr; // Fallback map by name
            return acc;
        }, {});

        // 1. Product Category Analysis
        const categoryMap = {};
        filteredInspections.forEach(insp => {
            const item = itemMap[insp.itemName];
            // Use 'itemType' from inspection data if available, otherwise fallback to item_master '대분류설명'
            const category = insp.itemType || item?.originalData?.['대분류설명'] || '미분류';
            categoryMap[category] = (categoryMap[category] || 0) + 1; // Count Frequency
        });
        const byCategory = Object.entries(categoryMap)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

        // 2. Supplier Analysis
        const supplierQtyMap = {};
        const supplierFreqMap = {};
        
        // 3. Worst Supplier (Defect Count)
        const defectCountMap = {};

        // 4. Defect Reasons for Worst Suppliers
        // We need to track defect types per supplier
        const supplierDefectTypeMap = {};

        filteredInspections.forEach(insp => {
            const supplier = insp.supplier || '알수없음';
            const qty = Number(insp.totalQuantity) || 0;
            const defectQty = Number(insp.defectQuantity) || 0;
            
            // Supplier Stats
            supplierQtyMap[supplier] = (supplierQtyMap[supplier] || 0) + qty;
            supplierFreqMap[supplier] = (supplierFreqMap[supplier] || 0) + 1;

            // Defect Stats
            // Consider defect text or defect quantity > 0
            if (defectQty > 0 || insp.result === '불합격') {
                defectCountMap[supplier] = (defectCountMap[supplier] || 0) + 1;
                
                if (insp.defectType) {
                    if (!supplierDefectTypeMap[supplier]) supplierDefectTypeMap[supplier] = {};
                    supplierDefectTypeMap[supplier][insp.defectType] = (supplierDefectTypeMap[supplier][insp.defectType] || 0) + 1;
                }
            }
        });


        const getTop5 = (map) => Object.entries(map)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);
        
        // Helper for Top 10
        // eslint-disable-next-line no-unused-vars
        const getTop10 = (map) => Object.entries(map)
             .map(([name, value]) => ({ name, value }))
             .sort((a, b) => b.value - a.value)
             .slice(0, 10);

        const supplierQty = getTop5(supplierQtyMap);
        const supplierFreq = getTop5(supplierFreqMap);
        const worstSuppliers = getTop5(defectCountMap);

        // 5. New Charts Data (Top 10)
        // Re-calculate robust maps for detailed charts
        const fullSupplierDefectMap = {};
        const fullDefectTypeMap = {};
        
        filteredInspections.forEach(insp => {
             // Supplier Defect Details
             const supplier = insp.supplier || '알수없음';
             if (!fullSupplierDefectMap[supplier]) fullSupplierDefectMap[supplier] = { value: 0, details: {} };
             
             if (insp.result === '불합격') {
                 fullSupplierDefectMap[supplier].value += 1;
                 const dType = insp.defectType || '미지정';
                 fullSupplierDefectMap[supplier].details[dType] = (fullSupplierDefectMap[supplier].details[dType] || 0) + 1;
             }
             
             // Defect Type Details
             const type = insp.defectType;
             if (type && type !== '-' && type !== '') {
                 if (!fullDefectTypeMap[type]) fullDefectTypeMap[type] = { value: 0, details: {} };
                 fullDefectTypeMap[type].value += 1;
                 fullDefectTypeMap[type].details[supplier] = (fullDefectTypeMap[type].details[supplier] || 0) + 1;
             }
        });

        const supplierDefectCount = Object.entries(fullSupplierDefectMap)
            .map(([name, data]) => ({ name, value: data.value, details: data.details }))
            .filter(i => i.value > 0)
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);

        const defectTypeCount = Object.entries(fullDefectTypeMap)
            .map(([name, data]) => ({ name, value: data.value, details: data.details }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);

        // Process Defect Reasons for the top 5 worst suppliers
        const defectReasons = worstSuppliers.map(ws => {
            const supplier = ws.name;
            const reasons = supplierDefectTypeMap[supplier] || {};
            // Flatten reasons to array
            const reasonList = Object.entries(reasons).map(([type, count]) => ({ type, count }));
            return {
                supplier,
                reasons: reasonList.sort((a, b) => b.count - a.count)
            };
        });

        setStats({ byCategory, supplierQty, supplierFreq, worstSuppliers, supplierDefectCount, defectTypeCount, defectReasons });
    };

    // Custom Tooltip Component (Copied from Dashboard.jsx)
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

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

    if (loading) return <div className="p-8 text-center text-slate-500">데이터 분석 중...</div>;

    return (
        <div className="space-y-8 animate-fade-in p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                     <h1 className="text-2xl font-bold text-slate-900">대시보드(인수검사)</h1>
                     <p className="text-slate-500">품목, 공급업체, 불량 현황 심층 분석</p>
                </div>
                <div className="flex gap-2">
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="bg-white border border-slate-300 text-slate-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 shadow-sm"
                    >
                        <option value={2024}>2024년</option>
                        <option value={2025}>2025년</option>
                        <option value={2026}>2026년</option>
                    </select>
                    <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="bg-white border border-slate-300 text-slate-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 shadow-sm"
                    >
                        <option value="all">전체 월</option>
                        {[...Array(12)].map((_, i) => (
                            <option key={i + 1} value={i + 1}>{i + 1}월</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Section 1: Category Analysis */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-lg text-slate-800 mb-6 flex items-center gap-2">
                    <span className="w-1 h-6 bg-blue-600 rounded-sm"></span>
                    품목 카테고리 분석 (대분류별 입고 비중)
                </h3>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={stats.byCategory}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={65}
                                    outerRadius={95}
                                    paddingAngle={2}
                                    dataKey="value"
                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                                    isAnimationActive={false}
                                >
                                    {stats.byCategory.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Legend wrapperStyle={{ pointerEvents: 'none' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

            {/* Section 2: Supplier Analysis */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="font-bold text-lg text-slate-800 mb-6 border-l-4 border-blue-600 pl-3">
                        입고 수량 기준 Top 5
                    </h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={stats.supplierQty}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    dataKey="value"
                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                                    isAnimationActive={false}
                                >
                                     {stats.supplierQty.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                 </div>
                 <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="font-bold text-lg text-slate-800 mb-6 border-l-4 border-blue-600 pl-3">
                        입고 건수 기준 Top 5
                    </h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={stats.supplierFreq}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    dataKey="value"
                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                                    isAnimationActive={false}
                                >
                                     {stats.supplierFreq.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                 </div>
            </div>



            {/* Section 3: Defect Analysis Charts (Top 10) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-2">
                {/* Supplier Defect Count Top 10 */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="mb-6">
                        <h3 className="font-bold text-slate-800 border-l-4 border-red-500 pl-3">공급사별 불량건수 Top 10</h3>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.supplierDefectCount} layout="vertical" margin={{ left: 40 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                <XAxis type="number" />
                                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9' }} />
                                <Bar dataKey="value" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                {/* Defect Type Count Top 10 */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="mb-6">
                        <h3 className="font-bold text-slate-800 border-l-4 border-orange-500 pl-3">불량유형별 건수 Top 10</h3>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.defectTypeCount} layout="vertical" margin={{ left: 40 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                <XAxis type="number" />
                                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9' }} />
                                <Bar dataKey="value" fill="#f97316" radius={[0, 4, 4, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>



            {/* Section 4: Defect Reason Analysis */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                 <h3 className="font-bold text-lg text-slate-800 mb-6 border-l-4 border-slate-600 pl-3">
                    워스트 업체별 주요 부적합 사유
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {stats.defectReasons.map((item, idx) => (
                        <div key={idx} className="border border-slate-100 p-4 rounded-lg">
                            <h4 className="font-bold text-slate-700 mb-3">{item.supplier}</h4>
                            <ul className="space-y-2">
                                {item.reasons.map((reason, rIdx) => (
                                    <li key={rIdx} className="flex justify-between text-sm">
                                        <span className="text-slate-500">{reason.type || '기타'}</span>
                                        <span className="font-medium text-slate-900">{reason.count}건</span>
                                    </li>
                                ))}
                                {item.reasons.length === 0 && <li className="text-xs text-slate-400">등록된 사유 없음</li>}
                            </ul>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default InspectionAnalysisDashboard;
