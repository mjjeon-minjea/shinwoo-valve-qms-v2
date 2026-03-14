import { useState, useEffect, useMemo } from 'react';
import { 
    BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
    PieChart, Pie, Cell, ComposedChart, Area, Legend
} from 'recharts';
import { 
    Filter, Activity, CheckCircle2, AlertTriangle, RefreshCw, 
    Target, ClipboardCheck, XCircle, TrendingUp, Search, Calendar,
    Package, Box
} from 'lucide-react';
import { api } from '../lib/api';

const ProcessInspectionDashboard = () => {
    const [mesData, setMesData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState({
        start: '2024-01-01',
        end: new Date().toISOString().split('T')[0]
    });
    const [groupBy, setGroupBy] = useState('month'); // 'day', 'month', 'year'

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await api.fetch('/process_inspections');
            if (res.ok) {
                const data = await res.json();
                setMesData(data);
            }
        } catch (error) {
            console.error("Fetch data failed", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Helper: Normalize date from YYYY-MM-DD or other formats
    const formatDate = (val) => {
        if (!val) return '2025-01-01';
        try {
            return new Date(val).toISOString().split('T')[0];
        } catch (e) {
            return '2025-01-01';
        }
    };

    // Filtered Content
    const filteredData = useMemo(() => {
        return mesData.filter(item => {
            const itemDate = formatDate(item.inspectionDate);
            return itemDate >= dateRange.start && itemDate <= dateRange.end;
        });
    }, [mesData, dateRange]);

    // 1. Calculate KPI Data
    const kpiData = useMemo(() => {
        let planned = 0, inspected = 0, passed = 0, failed = 0;
        let unresolvedCount = 0;

        filteredData.forEach(row => {
            planned += row.plannedQuantity || 0;
            inspected += row.inspectedQuantity || 0;
            passed += row.passedQuantity || 0;
            failed += row.failedQuantity || 0;
            if (row.isResolutionEntered === 'N') unresolvedCount++;
        });

        const inspectionRate = planned > 0 ? ((inspected / planned) * 100).toFixed(1) : 0;
        const passRate = inspected > 0 ? ((passed / inspected) * 100).toFixed(1) : 0;
        const failRate = inspected > 0 ? ((failed / inspected) * 100).toFixed(1) : 0;
        const unresolvedRate = failed > 0 ? ((unresolvedCount / failed) * 100).toFixed(1) : 0;

        return {
            planned, inspected, passed, failed, unresolvedCount,
            inspectionRate, passRate, failRate, unresolvedRate
        };
    }, [filteredData]);

    // Summary Rows for KPI Display (Style compatible with InboundAnalysis)
    const summaryRows = [
        [
            { title: '검사 진행률', value: `${kpiData.inspectionRate}%`, subtext: `지시 ${kpiData.planned.toLocaleString()} / 실적 ${kpiData.inspected.toLocaleString()} EA`, icon: Target, color: 'text-blue-600', bg: 'bg-blue-50' },
            { title: '품질 합격률', value: `${kpiData.passRate}%`, subtext: `합격 ${kpiData.passed.toLocaleString()} / 검사 ${kpiData.inspected.toLocaleString()} EA`, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { title: '불량 발생건수', value: `${kpiData.failed.toLocaleString()} EA`, subtext: `공정 불량률 ${kpiData.failRate}% (수량 기준)`, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
        ]
    ];

    // 2. Calculate Trend Data
    const trendData = useMemo(() => {
        const dataMap = {};
        filteredData.forEach(row => {
            if (!row.inspectionDate) return;
            const date = new Date(row.inspectionDate);
            let key = '';

            if (groupBy === 'day') {
                key = date.toISOString().split('T')[0];
            } else if (groupBy === 'month') {
                key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
            } else if (groupBy === 'year') {
                key = `${date.getFullYear()}`;
            } else { 
                const year = date.getFullYear();
                const month = date.getMonth();
                const day = date.getDate();
                let weekNum = Math.ceil(day / 7);
                key = `${year} ${month + 1}M ${weekNum}W`;
            }
            
            if (!dataMap[key]) dataMap[key] = { name: key, ins: 0, pass: 0, fail: 0 };
            dataMap[key].ins += row.inspectedQuantity || 0;
            dataMap[key].pass += row.passedQuantity || 0;
            dataMap[key].fail += row.failedQuantity || 0;
        });

        const sortedKeys = Object.keys(dataMap).sort();
        return sortedKeys.map(key => dataMap[key]);
    }, [filteredData, groupBy]);

    // 3. Calculate Process Defect Data
    const processDefectData = useMemo(() => {
        const processMap = { '주조': 0, '가공': 0, '조립': 0 };
        filteredData.forEach(row => {
            if (row.failedQuantity > 0 && row.processType) {
                const key = row.processType;
                if (processMap.hasOwnProperty(key)) {
                    processMap[key] += row.failedQuantity;
                }
            }
        });
        return [
            { name: '주조', value: processMap['주조'] || 0 },
            { name: '조립', value: processMap['조립'] || 0 },
            { name: '가공', value: processMap['가공'] || 0 },
        ].filter(item => item.value >= 0);
    }, [filteredData]);

    // 4. Calculate Model Defect Data
    const modelDefectDataConfig = useMemo(() => {
        const modelMap = {};
        filteredData.forEach(row => {
            if (row.failedQuantity > 0) {
                const model = row.modelName || '기타';
                modelMap[model] = (modelMap[model] || 0) + row.failedQuantity;
            }
        });

        const sortedModels = Object.entries(modelMap)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

        const top4 = sortedModels.slice(0, 4);
        const others = sortedModels.slice(4).reduce((sum, item) => sum + item.value, 0);
        
        const colors = ['#ef4444', '#f59e0b', '#eab308', '#8b5cf6'];
        const resultData = top4.map((item, idx) => ({
            ...item,
            color: colors[idx]
        }));
        
        if (others > 0) {
            resultData.push({ name: '기타', value: others, color: '#94a3b8' });
        }
        
        return {
             data: resultData,
             legend: top4
        };
    }, [filteredData]);

    // 5. Calculate Recent Defects Data
    const recentDefectsData = useMemo(() => {
        const defects = filteredData.filter(row => row.failedQuantity > 0);
        defects.sort((a, b) => new Date(b.inspectionDate) - new Date(a.inspectionDate));
        return defects.slice(0, 5).map((row, idx) => {
            const isResolved = row.isResolutionEntered === 'Y';
            return {
                id: row.id || String(idx),
                model: row.modelName,
                workstation: row.workplaceFull,
                defectQty: row.failedQuantity,
                isResolved,
                highlight: row.failedQuantity >= 5
            };
        });
    }, [filteredData]);

    return (
        <div className="space-y-6 animate-fade-in bg-slate-50 min-h-screen p-2">
            {/* Header with Filters */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 px-4 pt-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <Activity className="w-6 h-6 text-blue-600" />
                        공정검사 분석 리포트
                    </h1>
                    <p className="text-slate-500">생산 공정별 품질 현황 및 주요 이슈 현황</p>
                </div>

                <div className="flex flex-col items-end gap-2">
                    <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={dateRange.start}
                                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                                className="pl-3 pr-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                            />
                            <span className="text-slate-400">~</span>
                            <input
                                type="date"
                                value={dateRange.end}
                                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                                className="pl-3 pr-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                            />
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
                        <button onClick={fetchData} className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors">
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="space-y-4 px-4">
                {summaryRows.map((row, idx) => (
                    <div key={idx} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {row.map((item, i) => (
                            <div key={i} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all group">
                                <div className="flex items-center justify-between mb-4">
                                    <div className={`p-3 rounded-lg ${item.bg} group-hover:scale-110 transition-transform`}>
                                        <item.icon className={`w-6 h-6 ${item.color}`} />
                                    </div>
                                    <TrendingUp className="w-4 h-4 text-slate-300" />
                                </div>
                                <h3 className="text-sm font-medium text-slate-500">{item.title}</h3>
                                <div className="mt-2 flex items-baseline">
                                    <span className="text-2xl font-bold text-slate-800 tracking-tight">{item.value}</span>
                                </div>
                                <p className="text-xs text-slate-400 mt-1">{item.subtext}</p>
                            </div>
                        ))}
                    </div>
                ))}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-4">
                <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                         <TrendingUp className="w-4 h-4 text-blue-500" />
                         공정 품질 추이 ({groupBy === 'month' ? '월별' : groupBy === 'day' ? '일별' : '년별'})
                    </h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={trendData}>
                                <defs>
                                    <linearGradient id="colorIns" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                                <Legend verticalAlign="top" align="right" />
                                <Area type="monotone" dataKey="ins" name="검사수량" stroke="#3b82f6" strokeWidth={2} fill="url(#colorIns)" />
                                <Bar dataKey="fail" name="불량수량" fill="#ef4444" barSize={12} radius={[4, 4, 0, 0]} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <Box className="w-4 h-4 text-orange-500" /> 주요 불량 공정 분포
                    </h3>
                    <div className="h-[300px] relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={processDefectData}
                                    innerRadius={70}
                                    outerRadius={90}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {processDefectData.map((entry, idx) => (
                                        <Cell key={`cell-${idx}`} fill={['#3b82f6', '#f59e0b', '#10b981'][idx % 3]} />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none pb-7">
                            <p className="text-2xl font-black text-slate-800">{kpiData.failed}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Total EA</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 px-4 pb-8">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Package className="w-4 h-4 text-indigo-500" /> 모델별 불량 TOP 5
                    </h3>
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={modelDefectDataConfig.data} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#475569' }} width={80} />
                                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                                    {modelDefectDataConfig.data.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <ClipboardCheck className="w-4 h-4 text-emerald-500" /> 최근 주요 공정 불량 이력
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-100">
                                <tr>
                                    <th className="py-3 px-3 text-left">모델/공정</th>
                                    <th className="py-3 px-3 text-center">불량수량</th>
                                    <th className="py-3 px-3 text-center">조치여부</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentDefectsData.map((item, idx) => (
                                    <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                        <td className="py-3 px-3">
                                            <p className="font-bold text-slate-800">{item.model}</p>
                                            <p className="text-[10px] text-slate-400">{item.workstation}</p>
                                        </td>
                                        <td className={`py-3 px-3 text-center font-bold ${item.highlight ? 'text-red-500' : 'text-slate-600'}`}>
                                            {item.defectQty} EA
                                        </td>
                                        <td className="py-3 px-3 text-center">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${item.isResolved ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                                {item.isResolved ? '조치완료' : '검토중'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProcessInspectionDashboard;
