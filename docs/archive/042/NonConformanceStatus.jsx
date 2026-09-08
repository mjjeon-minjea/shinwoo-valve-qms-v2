/* src/components/NonConformanceStatus.jsx */
import { useState, useEffect } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';
import { AlertTriangle, Calendar, BarChart as LucideBarChart, PieChart as LucidePieChart } from 'lucide-react';
import { api } from '../lib/api';

const NonConformanceStatus = () => {
    const [loading, setLoading] = useState(true);
    const [inspections, setInspections] = useState([]);
    const [items, setItems] = useState([]);
    const [dateRange, setDateRange] = useState({
        start: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`,
        end: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [inspRes, itemRes] = await Promise.all([
                api.fetch('/inspections'),
                api.fetch('/item_master')
            ]);
            
            if (inspRes.ok) {
                const inspData = await inspRes.json();
                setInspections(Array.isArray(inspData) ? inspData : []);
            }
            
            if (itemRes.ok) {
                const itemData = await itemRes.json();
                setItems(Array.isArray(itemData) ? itemData : []);
            }
        } catch (error) {
            console.error("Failed to fetch data:", error);
        } finally {
            setLoading(false);
        }
    };

    // 데이터 처리 파이프라인
    const processData = () => {
        const filtered = inspections.filter(insp => {
            let d = insp.date;
            if (typeof d === 'number') {
                 d = new Date(Math.round((d - 25569) * 86400 * 1000)).toISOString().split('T')[0];
            }
            return d >= dateRange.start && d <= dateRange.end && Number(insp.defectQuantity || 0) > 0;
        });

        // 아이템 마스터 고속 조회 맵 빌드
        const itemMap = items.reduce((acc, curr) => {
            acc[curr.name] = curr;
            return acc;
        }, {});

        // 집계 맵 구성
        const byProductMap = {};
        const bySizeMap = {};
        const byCategoryMap = {
            '외관부적합': 0,
            '가공부적합': 0,
            '주물치수부적합': 0,
            '조립부적합': 0,
            '재질부적합': 0,
            '기타': 0
        };

        filtered.forEach(insp => {
            const item = itemMap[insp.itemName];
            const defectQty = Number(insp.defectQuantity || 0);

            // 1. 제품명별 (재고분류설명)
            const productCategory = item?.originalData?.['재고분류설명'] || '미분류';
            byProductMap[productCategory] = (byProductMap[productCategory] || 0) + defectQty;

            // 2. 사이즈별 (소분류설명)
            const sizeCategory = item?.originalData?.['소분류설명'] || '미분류';
            bySizeMap[sizeCategory] = (bySizeMap[sizeCategory] || 0) + defectQty;

            // 3. Gemini 표준 카테고리별 파싱 집계
            const defectTypeStr = String(insp.defectType || '');
            const match = defectTypeStr.match(/^\[(.+?)\]/);
            const category = match ? match[1] : '기타';
            
            if (byCategoryMap[category] !== undefined) {
                byCategoryMap[category] += defectQty;
            } else {
                byCategoryMap['기타'] += defectQty;
            }
        });

        // Recharts 포맷팅 및 내림차순 정렬
        const byProductData = Object.keys(byProductMap).map(key => ({
            name: key,
            value: byProductMap[key]
        })).sort((a, b) => b.value - a.value);

        const bySizeData = Object.keys(bySizeMap).map(key => ({
            name: key,
            value: bySizeMap[key]
        })).sort((a, b) => b.value - a.value);

        const byCategoryData = Object.keys(byCategoryMap)
            .map(key => ({ name: key, value: byCategoryMap[key] }))
            .filter(item => item.value > 0) // 비중이 있는 카테고리만 출력
            .sort((a, b) => b.value - a.value);

        const totalDefects = filtered.reduce((acc, curr) => acc + Number(curr.defectQuantity || 0), 0);

        return { byProductData, bySizeData, byCategoryData, totalDefects };
    };

    const { byProductData, bySizeData, byCategoryData, totalDefects } = processData();

    if (loading) {
        return <div className="p-16 text-center text-slate-500 font-semibold">데이터를 불러오는 중입니다...</div>;
    }

    const COLORS = ['#6366f1', '#f59e0b', '#3b82f6', '#ec4899', '#10b981', '#ef4444', '#8b5cf6'];

    return (
        <div className="space-y-6 p-1 animate-fade-in text-slate-800">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-200">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                        <LucideBarChart className="w-8 h-8 text-primary-600" />
                        부적합 통계 현황판
                    </h1>
                    <p className="text-slate-500 mt-1 font-medium">인수검사 부적합 유형 및 제품별 정밀 분석 대시보드</p>
                </div>

                {/* Date Filter */}
                <div className="flex items-center gap-3 bg-white p-2.5 rounded-xl shadow-sm border border-slate-200">
                    <Calendar className="w-4 h-4 text-slate-400 ml-2" />
                    <input
                        type="date"
                        value={dateRange.start}
                        onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                        className="py-1 px-2 text-sm border-none focus:ring-0 text-slate-600 font-bold cursor-pointer"
                    />
                    <span className="text-slate-300 font-bold">~</span>
                    <input
                        type="date"
                        value={dateRange.end}
                        onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                        className="py-1 px-2 text-sm border-none focus:ring-0 text-slate-600 font-bold cursor-pointer"
                    />
                </div>
            </div>

            {/* Summary Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-rose-50 to-white p-6 rounded-2xl border border-rose-100 shadow-md flex items-center gap-4 hover:shadow-lg transition-shadow">
                    <div className="p-4 bg-rose-100 rounded-xl text-rose-600 shadow-sm">
                        <AlertTriangle className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="text-xs text-slate-400 font-extrabold uppercase tracking-wider">조회 기간 부적합 누적량</p>
                        <h3 className="text-3xl font-black text-rose-600 mt-1">{totalDefects.toLocaleString()} <span className="text-sm font-bold text-slate-500">EA</span></h3>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 1. Gemini defectCategory 표준 카테고리 비중 (Pie Chart) - NEW */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-md flex flex-col">
                    <div className="mb-4">
                        <h3 className="font-extrabold text-slate-800 flex items-center gap-1.5">
                            <LucidePieChart className="w-5 h-5 text-indigo-500" />
                            Gemini AI 부적합 유형 분류 비중
                        </h3>
                        <p className="text-xs text-slate-400 font-semibold mt-0.5">Gemini 2.5 Flash가 매핑한 7대 표준 카테고리 기준</p>
                    </div>
                    <div className="h-[350px] w-full flex items-center justify-center">
                        {byCategoryData.length === 0 ? (
                            <div className="text-slate-400 font-semibold text-sm">해당 기간 불량 발생 건이 없습니다.</div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={byCategoryData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={70}
                                        outerRadius={110}
                                        paddingAngle={3}
                                        dataKey="value"
                                        nameKey="name"
                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                    >
                                        {byCategoryData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                    <Legend formatter={(value) => <span className="text-xs font-bold text-slate-600">{value}</span>} />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* 2. By Product Category (Bar Chart) */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-md flex flex-col">
                    <div className="mb-4">
                        <h3 className="font-extrabold text-slate-800 flex items-center gap-1.5">
                            <LucideBarChart className="w-5 h-5 text-indigo-500" />
                            제품군별 부적합 현황 (재고분류)
                        </h3>
                        <p className="text-xs text-slate-400 font-semibold mt-0.5">품목 마스터 &apos;재고분류설명&apos; 기준 집계</p>
                    </div>
                    <div className="h-[350px] w-full flex items-center justify-center">
                        {byProductData.length === 0 ? (
                            <div className="text-slate-400 font-semibold text-sm">해당 기간 불량 발생 건이 없습니다.</div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={byProductData} layout="vertical" margin={{ left: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                                    <XAxis type="number" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                                    <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 10, fontWeight: 'bold' }} stroke="#94a3b8" />
                                    <Tooltip 
                                        contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                        cursor={{ fill: '#f8fafc' }}
                                    />
                                    <Bar dataKey="value" fill="#6366f1" radius={[0, 6, 6, 0]} barSize={20} name="부적합 수량(EA)">
                                        {byProductData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[(index + 1) % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* 3. By Size Category (Pie Chart) */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-md flex flex-col lg:col-span-2">
                    <div className="mb-4">
                        <h3 className="font-extrabold text-slate-800 flex items-center gap-1.5">
                            <LucidePieChart className="w-5 h-5 text-indigo-500" />
                            사이즈 규격별 부적합 현황 (소분류)
                        </h3>
                        <p className="text-xs text-slate-400 font-semibold mt-0.5">품목 마스터 &apos;소분류설명&apos; 기준 집계</p>
                    </div>
                    <div className="h-[350px] w-full flex items-center justify-center">
                        {bySizeData.length === 0 ? (
                            <div className="text-slate-400 font-semibold text-sm">해당 기간 불량 발생 건이 없습니다.</div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={bySizeData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={70}
                                        outerRadius={110}
                                        paddingAngle={2}
                                        dataKey="value"
                                        nameKey="name"
                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                    >
                                        {bySizeData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                    <Legend formatter={(value) => <span className="text-xs font-bold text-slate-600">{value}</span>} />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NonConformanceStatus;
