import { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/api';
import { 
    Activity, RefreshCw, Table2
} from 'lucide-react';
import { 
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell
} from 'recharts';

const StatCard = ({ title, data }) => {
    const rate = data.failRate;
    const isWarning = data.ppm > 100;
    
    const statusText = data.inspected === 0 
        ? "대기중" 
        : (isWarning ? `[ 기준 초과 ] 현재 ${data.ppm.toLocaleString()} PPM` : `[ 기준 이내 ] 현재 ${data.ppm.toLocaleString()} PPM`);
    const statusColor = data.inspected === 0 
        ? "bg-slate-100 text-slate-500" 
        : (data.ppm > 1000 ? "bg-red-50 text-red-600" : (isWarning ? "bg-yellow-50 text-yellow-600" : "bg-emerald-50 text-emerald-600"));
    const ringColor = data.inspected === 0 
        ? "#e2e8f0" 
        : (data.ppm > 1000 ? "#ef4444" : (isWarning ? "#eab308" : "#10b981"));

    const numericRate = rate > 0 ? parseFloat(rate) : 0;
    const filledValue = Math.min(numericRate, 100);
    const emptyValue = Math.max(0, 100 - filledValue);

    const pieData = [
        { name: '불량', value: filledValue },
        { name: '정상', value: emptyValue }
    ];

    return (
        <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col overflow-hidden transition-transform duration-300 hover:-translate-y-1">
            <div className="bg-slate-800 text-center py-2.5 border-b-[3px] border-emerald-500 min-h-[4rem] flex flex-col justify-center">
                <span className="text-white font-bold tracking-wider text-[13px] line-clamp-1 px-2" title={title}>{title}</span>
            </div>
            
            <div className="px-3 py-4 flex flex-col items-center flex-1">
                <div className="relative w-28 h-28 mb-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={36}
                                outerRadius={50}
                                startAngle={90}
                                endAngle={-270}
                                dataKey="value"
                                stroke="none"
                                isAnimationActive={true}
                                animationDuration={1500}
                            >
                                <Cell fill={ringColor} />
                                <Cell fill="#f1f5f9" />
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-[10px] font-bold text-slate-500">불량률</span>
                        <div className="flex items-baseline">
                            <span className="text-2xl font-black text-slate-800 tracking-tight">{rate > 0 ? rate : '0'}</span>
                            <span className="text-xs font-bold text-slate-500 ml-0.5">%</span>
                        </div>
                    </div>
                </div>

                <div className="w-full space-y-2 bg-slate-50 p-3 rounded-xl">
                    <div className="flex justify-between items-center">
                        <span className="text-xs font-medium text-slate-500">검사수량</span>
                        <div className="flex items-baseline gap-1">
                            <span className="text-sm font-bold text-slate-700">{data.inspected.toLocaleString()}</span>
                            <span className="text-[10px] font-bold text-slate-400">EA</span>
                        </div>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-xs font-medium text-slate-500">합격수량</span>
                        <div className="flex items-baseline gap-1">
                            <span className="text-sm font-bold text-emerald-600">{data.passed.toLocaleString()}</span>
                            <span className="text-[10px] font-bold text-emerald-400">EA</span>
                        </div>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-xs font-medium text-slate-500">불량수량</span>
                        <div className="flex items-baseline gap-1">
                            <span className="text-sm font-bold text-red-500">{data.failed.toLocaleString()}</span>
                            <span className="text-[10px] font-bold text-red-400">EA</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className={`py-2 text-center text-xs font-bold ${statusColor} mt-auto`}>
                {statusText}
            </div>
        </div>
    );
};

const ProcessAnalysis = () => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState({
        start: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`,
        end: new Date().toISOString().split('T')[0]
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await api.fetch('/process_inspections');
            if (res.ok) {
                const json = await res.json();
                setData(json);
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

    const groupedData = useMemo(() => {
        const map = {
            '가공': { processName: '가공', records: 0, inspected: 0, passed: 0, failed: 0, resolved: 0, unresolved: 0 },
            '조립': { processName: '조립', records: 0, inspected: 0, passed: 0, failed: 0, resolved: 0, unresolved: 0 },
            '수압': { processName: '수압', records: 0, inspected: 0, passed: 0, failed: 0, resolved: 0, unresolved: 0 },
            '도장': { processName: '도장', records: 0, inspected: 0, passed: 0, failed: 0, resolved: 0, unresolved: 0 },
            '기타': { processName: '기타', records: 0, inspected: 0, passed: 0, failed: 0, resolved: 0, unresolved: 0 }
        };

        data.forEach(row => {
            const rowDate = row.inspectionDate || '2025-01-01';
            if (rowDate >= dateRange.start && rowDate <= dateRange.end) {
                const type = String(row.inspectionType || '').trim();
                let key = '기타';
                if (['가공', '조립', '수압', '도장'].includes(type)) {
                    key = type;
                }

                map[key].records++;
                map[key].inspected += (row.inspectedQuantity || 0);
                map[key].passed += (row.passedQuantity || 0);
                map[key].failed += (row.failedQuantity || 0);
                if (row.failedQuantity > 0) {
                    const hasResolution = (row.resolution && row.resolution.trim() !== '') || row.isResolutionEntered === 'Y';
                    if (hasResolution) map[key].resolved++;
                    else map[key].unresolved++;
                }
            }
        });

        const result = Object.values(map)
            .filter(item => item.processName !== '기타' || item.records > 0) // Always show main categories, hide empty 기타
            .map(item => ({
                ...item,
                failRate: item.inspected > 0 ? ((item.failed / item.inspected) * 100).toFixed(1) : '0.0',
                ppm: item.inspected > 0 ? Math.round((item.failed / item.inspected) * 1000000) : 0,
                resolutionRate: (item.resolved + item.unresolved) > 0 
                    ? ((item.resolved / (item.resolved + item.unresolved)) * 100).toFixed(1) : '0.0'
            }));
        
        // 정렬 기준: 불량률 내림차순 -> 검사수량 내림차순
        result.sort((a, b) => {
            const rateA = a.inspected > 0 ? (a.failed / a.inspected) : 0;
            const rateB = b.inspected > 0 ? (b.failed / b.inspected) : 0;
            if (rateB !== rateA) return rateB - rateA;
            return b.inspected - a.inspected;
        });
        return result;
    }, [data, dateRange]);

    const topMetrics = useMemo(() => {
        // 공정은 기본 4개(+기타)이므로 불량률 높은 순으로 앞에서 4개를 자릅니다 (기타 제외)
        return groupedData
            .filter(p => p.processName !== '기타')
            .slice(0, 4);
    }, [groupedData]);

    return (
        <div className="space-y-6 flex flex-col min-h-screen text-slate-800 animate-fade-in p-2">
            
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-4 pt-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-indigo-600 flex items-center gap-3">
                        <Activity className="w-8 h-8 text-blue-600" />
                        공정별 분석현황
                    </h1>
                    <p className="text-slate-500 font-medium mt-1 ml-11">공정 코드에 따른 검출량 및 품질 현황</p>
                </div>

                {/* Filter Controls Container - Stacked */}
                <div className="flex flex-col items-end gap-2">
                    {/* Row 1: Date Range & Refresh */}
                    <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={dateRange.start}
                                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                                className="pl-3 pr-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                            <span className="text-slate-400">~</span>
                            <input
                                type="date"
                                value={dateRange.end}
                                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                                className="pl-3 pr-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div className="h-6 w-px bg-slate-200 mx-1"></div>
                        <button onClick={fetchData} className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors">
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Row 2: Quick Month Select */}
                    <div className="flex items-center gap-2 bg-white p-2 rounded-xl shadow-sm border border-slate-200">
                        <span className="text-xs font-bold text-slate-500 px-1">빠른 기간 설정 :</span>
                        <select
                            className="pl-2 pr-8 py-1 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 hover:bg-white transition-colors"
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
                        <select
                            className="pl-2 pr-8 py-1 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 hover:bg-white transition-colors"
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

            {/* Top Stat Cards Section */}
            {topMetrics.length > 0 && (
                <div className="px-4">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {topMetrics.map((item, index) => (
                            <StatCard 
                                key={index}
                                title={item.processName}
                                data={item}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Content Display */}
            <div className="grid lg:grid-cols-3 gap-6 px-4 pb-8 flex-1">

                {/* Table Section */}
                <div className="lg:col-span-3 bg-white rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
                    <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-gradient-to-r from-slate-50 to-white">
                        <h3 className="text-lg font-bold flex items-center gap-2 text-slate-800">
                            <Table2 className="w-5 h-5 text-emerald-500" />
                            세부 공정 데이터
                        </h3>
                        <span className="text-sm font-bold text-slate-400 bg-white px-3 py-1 rounded-full border border-slate-100 shadow-sm">
                            총 {groupedData.length}개 공정
                        </span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs uppercase bg-slate-50 text-slate-500 border-b border-slate-100">
                                <tr>
                                    <th className="px-6 py-4 font-bold tracking-wider">공정명</th>
                                    <th className="px-6 py-4 font-bold tracking-wider text-right">검사건수</th>
                                    <th className="px-6 py-4 font-bold tracking-wider text-right text-blue-600">검사수량</th>
                                    <th className="px-6 py-4 font-bold tracking-wider text-right text-emerald-600">합격수량</th>
                                    <th className="px-6 py-4 font-bold tracking-wider text-right text-red-500">부적합수량</th>
                                    <th className="px-6 py-4 font-bold tracking-wider text-center">불량률</th>
                                    <th className="px-6 py-4 font-bold tracking-wider text-center">조치율</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {groupedData.map((row) => (
                                    <tr key={row.processName} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4 font-bold text-slate-800">{row.processName}</td>
                                        <td className="px-6 py-4 text-right text-slate-500 font-medium">{row.records.toLocaleString()}건</td>
                                        <td className="px-6 py-4 text-right font-bold text-slate-700">{row.inspected.toLocaleString()}</td>
                                        <td className="px-6 py-4 text-right font-medium text-slate-600">{row.passed.toLocaleString()}</td>
                                        <td className="px-6 py-4 text-right font-bold text-red-500">{row.failed.toLocaleString()}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${Number(row.failRate) > 5 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                                                {row.failRate}%
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${Number(row.resolutionRate) >= 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                                {row.resolutionRate}%
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {groupedData.length === 0 && !loading && (
                                    <tr>
                                        <td colSpan="7" className="text-center py-12 text-slate-400">
                                            해당 기간에 데이터가 없습니다.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProcessAnalysis;
