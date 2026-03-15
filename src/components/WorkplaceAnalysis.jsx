import { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/api';
import { 
    Factory, RefreshCw, Filter, Search, Table2, Presentation, Calendar, ChevronDown
} from 'lucide-react';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend, Cell 
} from 'recharts';

const WorkplaceAnalysis = () => {
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
        const map = {};
        data.forEach(row => {
            const rowDate = row.inspectionDate || '2025-01-01';
            if (rowDate >= dateRange.start && rowDate <= dateRange.end) {
                const key = row.workplaceFull || '미기재';
                if (!map[key]) {
                    map[key] = { workplaceName: key, records: 0, inspected: 0, passed: 0, failed: 0, resolved: 0, unresolved: 0 };
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

        const result = Object.values(map).map(item => ({
            ...item,
            failRate: item.inspected > 0 ? ((item.failed / item.inspected) * 100).toFixed(1) : '0.0',
            resolutionRate: (item.resolved + item.unresolved) > 0 
                ? ((item.resolved / (item.resolved + item.unresolved)) * 100).toFixed(1) : '0.0'
        }));
        
        // Sort by Fail Rate descending, then Inspected Quantity descending
        result.sort((a, b) => Number(b.failRate) - Number(a.failRate) || b.inspected - a.inspected);
        
        return result;
    }, [data, dateRange]);

    return (
        <div className="space-y-6 flex flex-col min-h-screen text-slate-800 animate-fade-in p-2">
            
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-4 pt-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-indigo-600 flex items-center gap-3">
                        <Factory className="w-8 h-8 text-blue-600" />
                        작업장별 분석현황
                    </h1>
                    <p className="text-slate-500 font-medium mt-1 ml-11">작업장/설비에 따른 검출량 및 품질 현황</p>
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

            {/* Content Display */}
            <div className="grid lg:grid-cols-3 gap-6 px-4 pb-8 flex-1">
                
                {/* Chart Section */}
                <div className="lg:col-span-3 bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold flex items-center gap-2 text-slate-800">
                            <Presentation className="w-5 h-5 text-indigo-500" />
                            작업장별 검사 vs 불량 분포
                        </h3>
                    </div>
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={groupedData.slice(0, 10)} margin={{ top: 20, right: 30, left: 20, bottom: 40 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="workplaceName" angle={-45} textAnchor="end" height={60} interval={0} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                                <YAxis yAxisId="left" orientation="left" stroke="#3b82f6" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                                <YAxis yAxisId="right" orientation="right" stroke="#ef4444" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
                                />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                <Bar yAxisId="left" dataKey="inspected" name="검사수량" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={40} />
                                <Bar yAxisId="right" dataKey="failed" name="부적합수량" fill="#ef4444" radius={[6, 6, 0, 0]} maxBarSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Table Section */}
                <div className="lg:col-span-3 bg-white rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
                    <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-gradient-to-r from-slate-50 to-white">
                        <h3 className="text-lg font-bold flex items-center gap-2 text-slate-800">
                            <Table2 className="w-5 h-5 text-emerald-500" />
                            세부 작업장 데이터
                        </h3>
                        <span className="text-sm font-bold text-slate-400 bg-white px-3 py-1 rounded-full border border-slate-100 shadow-sm">
                            총 {groupedData.length}개 작업장
                        </span>
                    </div>
                    <div className="overflow-x-auto min-h-[300px]">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs uppercase bg-slate-50 text-slate-500 border-b border-slate-100">
                                <tr>
                                    <th className="px-6 py-4 font-bold tracking-wider">작업장명</th>
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
                                    <tr key={row.workplaceName} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4 font-bold text-slate-800">{row.workplaceName}</td>
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

export default WorkplaceAnalysis;
