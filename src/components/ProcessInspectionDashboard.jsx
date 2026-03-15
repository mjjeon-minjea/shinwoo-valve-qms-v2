import { useState, useEffect, useMemo } from 'react';
import { 
    PieChart, Pie, Cell, ResponsiveContainer
} from 'recharts';
import { 
    Activity, CheckCircle2, AlertTriangle, RefreshCw, 
    Target, ClipboardCheck, XCircle, TrendingUp, Package, Box
} from 'lucide-react';
import { api } from '../lib/api';

const ProcessInspectionDashboard = () => {
    const [mesData, setMesData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState({
        start: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`,
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

    // 1. Calculate KPI & PPM Data
    const kpiData = useMemo(() => {
        let totalRecords = 0, failedRecords = 0;
        let inspectedQty = 0, failedQty = 0;
        let resolvedRecords = 0, unresolvedRecords = 0, unresolvedQty = 0;

        filteredData.forEach(row => {
            totalRecords++;
            inspectedQty += row.inspectedQuantity || 0;
            
            if (row.failedQuantity > 0) {
                failedRecords++;
                failedQty += row.failedQuantity;
                // 처리방안 텍스트가 존재하거나, 기입여부가 'Y'로 명시된 경우
                const hasResolution = (row.resolution && row.resolution.trim() !== '') || row.isResolutionEntered === 'Y';
                
                if (hasResolution) {
                    resolvedRecords++;
                } else {
                    unresolvedRecords++;
                    unresolvedQty += row.failedQuantity;
                }
            }
        });

        const failRateByRecord = totalRecords > 0 ? (failedRecords / totalRecords) * 100 : 0;
        const failRateByQty = inspectedQty > 0 ? (failedQty / inspectedQty) * 100 : 0;
        const resolutionRate = failedRecords > 0 ? (resolvedRecords / failedRecords) * 100 : 0;
        
        // PPM Calculation (Parts Per Million)
        const ppmByRecord = totalRecords > 0 ? (failedRecords / totalRecords) * 1000000 : 0;
        const ppmByQty = inspectedQty > 0 ? (failedQty / inspectedQty) * 1000000 : 0;

        return {
            totalRecords, failedRecords,
            inspectedQty, failedQty,
            resolvedRecords, unresolvedRecords, unresolvedQty,
            failRateByRecord: failRateByRecord.toFixed(2), 
            failRateByQty: failRateByQty.toFixed(2), 
            resolutionRate: resolutionRate.toFixed(1),
            ppmByRecord: Math.round(ppmByRecord),
            ppmByQty: Math.round(ppmByQty)
        };
    }, [filteredData]);

    const TARGET_PPM = 100;
    const TARGET_PERCENT = 0.01;

    // Helper for Gauge Chart
    const renderGauge = (value, target, isPPM, title) => {
        const displayValue = isPPM ? value.toLocaleString() : value;
        
        let statusText = '';
        let statusColor = '';
        if (value <= target * 0.5) {
            statusText = '우수 유지';
            statusColor = 'text-blue-700 border-blue-200 bg-blue-50';
        } else if (value <= target) {
            statusText = '안정적 수준';
            statusColor = 'text-green-700 border-green-200 bg-green-50';
        } else if (value <= target * 1.5) {
            statusText = '주의 요망';
            statusColor = 'text-orange-600 border-orange-200 bg-orange-50';
        } else {
            statusText = '조치 필요';
            statusColor = 'text-red-600 border-red-200 bg-red-50';
        }

        const bgData = [
            { name: 'Blue', value: 1, color: '#1e40af' },
            { name: 'Green', value: 1, color: '#22c55e' },
            { name: 'Orange', value: 1, color: '#f59e0b' },
            { name: 'Red', value: 1, color: '#ef4444' }
        ];

        return (
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col items-center justify-center relative h-[340px]">
                <div className="w-full h-[160px] relative mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            {/* Background track */}
                            <Pie
                                data={bgData}
                                cx="50%"
                                cy="100%"
                                startAngle={180}
                                endAngle={0}
                                innerRadius="70%"
                                outerRadius="100%"
                                paddingAngle={0}
                                dataKey="value"
                                stroke="white"
                                strokeWidth={2}
                            >
                                {bgData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                    
                    {/* Needle UI using CSS rotation */}
                    {(() => {
                        let needleAngle = 0;
                        if (value <= target * 0.5) {
                            needleAngle = -67.5; // Center of Blue (-90 to -45)
                        } else if (value <= target) {
                            needleAngle = -22.5; // Center of Green (-45 to 0)
                        } else if (value <= target * 1.5) {
                            needleAngle = 22.5;  // Center of Orange (0 to 45)
                        } else {
                            needleAngle = 67.5;  // Center of Red (45 to 90)
                        }

                        
                        return (
                            <div 
                                className="absolute bottom-0 left-1/2 z-10"
                            >
                                {/* The Pointer (Speedometer style triangle) */}
                                <div 
                                    className="origin-bottom drop-shadow-md"
                                    style={{
                                        position: 'absolute',
                                        bottom: '0',
                                        left: '-6px', // half of base width
                                        width: '0',
                                        height: '0',
                                        borderLeft: '6px solid transparent',
                                        borderRight: '6px solid transparent',
                                        borderBottom: '100px solid #1e293b', // slate-800, length of needle
                                        transform: `rotate(${needleAngle}deg)`,
                                        transition: 'transform 1s cubic-bezier(0.4, 0, 0.2, 1)'
                                    }}
                                >
                                </div>
                                {/* The Pivot Dot (Prominent Center Circle) */}
                                <div 
                                    className="w-8 h-8 rounded-full bg-slate-800 absolute bottom-0 left-1/2 flex items-center justify-center shadow-lg pointer-events-none"
                                    style={{ transform: 'translate(-50%, 50%)' }}
                                >
                                    <div className="w-3 h-3 rounded-full bg-white border border-slate-300"></div>
                                </div>
                            </div>
                        );
                    })()}
                </div>
                
                {/* Numeric value beneath the gauge */}
                <div className="text-center w-full mt-2">
                    <div className="text-4xl font-black text-slate-800 tracking-tight">
                        {displayValue}{!isPPM && '%'}
                    </div>
                </div>
                
                {/* Labels and targets */}
                <div className="mt-3 text-center">
                    <p className="text-sm font-bold text-slate-700 flex flex-col items-center justify-center gap-1">
                        {title}
                        <span className={`text-[10px] font-bold border px-2 py-0.5 rounded-full whitespace-nowrap ${statusColor}`}>
                            {statusText}
                        </span>
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">Target: &lt; {target}{isPPM ? ' PPM' : '%'} ({TARGET_PPM}PPM)</p>
                </div>
            </div>
        );
    };



    return (
        <div className="space-y-6 animate-fade-in bg-slate-50 min-h-screen p-2">
            {/* Header with Filters */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 px-4 pt-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <Activity className="w-6 h-6 text-blue-600" />
                        공정검사 대시보드
                    </h1>
                    <p className="text-slate-500">생산 공정별 핵심 품질 지표 모니터링</p>
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

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 px-4">
                {/* Card 1: Total Inspections */}
                <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500"></div>
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="text-xs font-bold text-slate-500 tracking-wider">총 검사 실적 (TOTAL INSPECTIONS)</h3>
                        <Box className="w-5 h-5 text-blue-100" />
                    </div>
                    <div>
                        <div className="text-2xl font-black text-blue-600 mb-1 flex items-baseline gap-1">
                            {kpiData.totalRecords.toLocaleString()} <span className="text-sm font-bold text-slate-400">건</span>
                        </div>
                        <div className="text-xs text-slate-500 font-medium flex items-center gap-1">
                            <Package className="w-3 h-3 text-slate-400" /> {kpiData.inspectedQty.toLocaleString()} EA (수량)
                        </div>
                    </div>
                </div>

                {/* Card 2: Failure Rate */}
                <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-500"></div>
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="text-xs font-bold text-slate-500 tracking-wider">부적합률 (건수 기준)</h3>
                        <AlertTriangle className="w-4 h-4 text-orange-400" />
                    </div>
                    <div>
                        <div className="text-2xl font-black text-orange-500 mb-1">
                            {kpiData.failRateByRecord}%
                        </div>
                        <div className="text-[11px] text-orange-600 bg-orange-50 px-2 py-0.5 rounded inline-flex items-center gap-1 font-bold">
                            <AlertTriangle className="w-3 h-3" /> {kpiData.failedRecords.toLocaleString()}건 발생 / {kpiData.totalRecords.toLocaleString()}건
                        </div>
                    </div>
                </div>

                {/* Card 3: Action Rate */}
                <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500"></div>
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="text-xs font-bold text-slate-500 tracking-wider">처리방안 기입률 (ACTION RATE)</h3>
                        <ClipboardCheck className="w-5 h-5 text-emerald-200" />
                    </div>
                    <div>
                        <div className="text-2xl font-black text-emerald-500 mb-1">
                            {kpiData.resolutionRate}%
                        </div>
                        <div className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> {kpiData.resolvedRecords.toLocaleString()}건 완료 / {kpiData.failedRecords.toLocaleString()}건 대상
                        </div>
                    </div>
                </div>

                {/* Card 4: Pending Actions */}
                <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500"></div>
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="text-xs font-bold text-slate-500 tracking-wider">미기입 건수 (PENDING ACTIONS)</h3>
                        <AlertTriangle className="w-4 h-4 text-red-400 fill-red-100" />
                    </div>
                    <div>
                        <div className="text-2xl font-black text-red-500 mb-1 flex items-baseline gap-1">
                            {kpiData.unresolvedRecords.toLocaleString()} <span className="text-sm font-bold text-slate-400">건</span>
                        </div>
                        <div className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded inline-flex items-center gap-1 font-bold">
                            <XCircle className="w-3 h-3" /> 조치 내용 기입 필요
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-4 pb-8">
                
                {/* Left Column: Key Quality Metrics */}
                <div className="lg:col-span-2">
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-blue-600" /> 핵심 품질 지표 시각화 (Key Quality Metrics)
                        </h2>
                        <span className="text-xs bg-slate-200 text-slate-500 px-2 py-1 rounded font-mono">Real-time Visualization</span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {renderGauge(parseFloat(kpiData.failRateByQty), TARGET_PERCENT, false, "수량 기준 부적합률")}
                        {renderGauge(parseFloat(kpiData.failRateByRecord), TARGET_PERCENT, false, "건수 기준 부적합률")}
                        {renderGauge(kpiData.ppmByQty, TARGET_PPM, true, "PPM (수량 기준)")}
                        {renderGauge(kpiData.ppmByRecord, TARGET_PPM, true, "PPM (건수 기준)")}
                    </div>
                    
                    {/* Gauge Legend */}
                    <div className="bg-white p-4 mt-6 rounded-xl border border-slate-100 flex flex-col gap-3">
                        <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                            <Target className="w-4 h-4 text-slate-400" /> 게이지 차트 범례 (목표치 대비 상태)
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            <div className="flex items-start gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-[#1e40af] mt-1 shrink-0"></div>
                                <div>
                                    <p className="text-xs font-bold text-slate-700">우수 (Blue)</p>
                                    <p className="text-[10px] text-slate-500 leading-tight mt-0.5">목표치 이하<br/>(매우 안정적인 상태)</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-[#22c55e] mt-1 shrink-0"></div>
                                <div>
                                    <p className="text-xs font-bold text-slate-700">정상 (Green)</p>
                                    <p className="text-[10px] text-slate-500 leading-tight mt-0.5">목표 수준 달성 및 유지</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-[#f59e0b] mt-1 shrink-0"></div>
                                <div>
                                    <p className="text-xs font-bold text-slate-700">경고 (Orange)</p>
                                    <p className="text-[10px] text-slate-500 leading-tight mt-0.5">목표치 초과 위험군<br/>(집중 모니터링 실시)</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-[#ef4444] mt-1 shrink-0"></div>
                                <div>
                                    <p className="text-xs font-bold text-slate-700">심각 (Red)</p>
                                    <p className="text-[10px] text-slate-500 leading-tight mt-0.5">부적합/목표 미달<br/>(즉각 원인분석 필요)</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Status List */}
                <div className="flex flex-col">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
                        <ClipboardCheck className="w-5 h-5 text-slate-600" /> 품질 관리 상태 (Status)
                    </h2>
                    
                    <div className="bg-white p-1 rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex-1">
                        <div className="h-full flex flex-col p-5 gap-4">
                            
                            {/* Status Item 1 */}
                            <div className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                                <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-red-400"></div> 전체 부적합률 (수량)
                                </span>
                                <span className={`text-[11px] font-bold px-3 py-1 rounded ${parseFloat(kpiData.failRateByQty) > TARGET_PERCENT ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-green-50 text-green-600 border border-green-200'}`}>
                                    {parseFloat(kpiData.failRateByQty) > TARGET_PERCENT ? `심각 (${Math.round(kpiData.failRateByQty/TARGET_PERCENT)}배)` : '정상'}
                                </span>
                            </div>

                            {/* Status Item 2 */}
                            <div className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                                <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-red-400"></div> 전체 부적합률 (건수)
                                </span>
                                <span className={`text-[11px] font-bold px-3 py-1 rounded ${parseFloat(kpiData.failRateByRecord) > TARGET_PERCENT ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-green-50 text-green-600 border border-green-200'}`}>
                                   {parseFloat(kpiData.failRateByRecord) > TARGET_PERCENT ? `심각 (${Math.round(kpiData.failRateByRecord/TARGET_PERCENT)}배)` : '정상'}
                                </span>
                            </div>

                            {/* Status Item 3 */}
                            <div className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                                <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-red-400"></div> PPM 지표 (수량)
                                </span>
                                <span className={`text-[11px] font-bold px-3 py-1 rounded ${kpiData.ppmByQty > TARGET_PPM ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-green-50 text-green-600 border border-green-200'}`}>
                                    {kpiData.ppmByQty > TARGET_PPM ? `심각 (${Math.round(kpiData.ppmByQty/TARGET_PPM)}배)` : '정상'}
                                </span>
                            </div>

                            {/* Status Item 4 */}
                            <div className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                                <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-red-400"></div> PPM 지표 (건수)
                                </span>
                                <span className={`text-[11px] font-bold px-3 py-1 rounded ${kpiData.ppmByRecord > TARGET_PPM ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-green-50 text-green-600 border border-green-200'}`}>
                                    {kpiData.ppmByRecord > TARGET_PPM ? `심각 (${Math.round(kpiData.ppmByRecord/TARGET_PPM)}배)` : '정상'}
                                </span>
                            </div>

                            {/* Status Item 5 */}
                            <div className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                                <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-400"></div> 처리방안 기입률
                                </span>
                                <span className={`text-[11px] font-bold px-3 py-1 rounded ${parseFloat(kpiData.resolutionRate) < 100 ? 'bg-orange-50 text-orange-600 border border-orange-200' : 'bg-green-50 text-green-600 border border-green-200'}`}>
                                    {parseFloat(kpiData.resolutionRate) < 100 ? '심각 (기준 미달)' : '정상'}
                                </span>
                            </div>

                            {/* Status Item 6 */}
                            <div className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                                <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-red-400"></div> 미조치 건수
                                </span>
                                <span className={`text-[11px] font-bold px-3 py-1 rounded ${kpiData.unresolvedRecords > 0 ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-green-50 text-green-600 border border-green-200'}`}>
                                    {kpiData.unresolvedRecords > 0 ? `경고 (${kpiData.unresolvedRecords}건)` : '정상'}
                                </span>
                            </div>
                            
                            <div className="mt-auto pt-6 border-t border-slate-100 flex justify-center">
                                <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                                    <Activity className="w-3 h-3" /> 24시간 모니터링 중
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
};

export default ProcessInspectionDashboard;
