
import { useState, useEffect } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';
import { AlertTriangle, Filter } from 'lucide-react';
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

    // --- Processing Logic ---
    const processData = () => {
        // Filter by Date and Defect
        const filtered = inspections.filter(insp => {
            // Helper to handle various date formats
            let d = insp.date;
            // If excel serial date (number)
            if (typeof d === 'number') {
                 d = new Date(Math.round((d - 25569) * 86400 * 1000)).toISOString().split('T')[0];
            }
            return d >= dateRange.start && d <= dateRange.end && Number(insp.defectQuantity) > 0;
        });

        // Map Item Master for Attributes
        // Create a lookup map for speed: name -> item
        const itemMap = items.reduce((acc, curr) => {
            acc[curr.name] = curr;
            return acc;
        }, {});

        // Aggregation Maps
        const byProductMap = {};
        const bySizeMap = {};

        filtered.forEach(insp => {
            const item = itemMap[insp.itemName];
            const defectQty = Number(insp.defectQuantity);

            // 1. Product Name Status (재고분류설명)
            // If item not found or field missing, use 'Unknown' or fallback
            // Try to find '재고분류설명' in originalData
            const productCategory = item?.originalData?.['재고분류설명'] || '미분류';
            
            byProductMap[productCategory] = (byProductMap[productCategory] || 0) + defectQty;

            // 2. Size Status (소분류설명)
            const sizeCategory = item?.originalData?.['소분류설명'] || '미분류';
            bySizeMap[sizeCategory] = (bySizeMap[sizeCategory] || 0) + defectQty;
        });

        // Convert to Arrays for Recharts
        const byProductData = Object.keys(byProductMap).map(key => ({
            name: key,
            value: byProductMap[key]
        })).sort((a, b) => b.value - a.value);

        const bySizeData = Object.keys(bySizeMap).map(key => ({
            name: key,
            value: bySizeMap[key]
        })).sort((a, b) => b.value - a.value);

        return { byProductData, bySizeData, totalDefects: filtered.reduce((acc, curr) => acc + Number(curr.defectQuantity), 0) };
    };

    const { byProductData, bySizeData, totalDefects } = processData();

    if (loading) return <div className="p-8 text-center text-slate-500">데이터를 불러오는 중...</div>;

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

    return (
        <div className="space-y-6 animate-fade-in">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">부적합 현황 조회</h1>
                    <p className="text-slate-500">제품명(재고분류) 및 사이즈(소분류)별 부적합 분석</p>
                </div>

                {/* Date Filter */}
                <div className="flex items-center gap-3 bg-white p-2 rounded-xl shadow-sm border border-slate-200">
                    <Filter className="w-4 h-4 text-slate-400 ml-2" />
                    <input
                        type="date"
                        value={dateRange.start}
                        onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                        className="py-1.5 text-sm border-none focus:ring-0 text-slate-600 cursor-pointer"
                    />
                    <span className="text-slate-300">~</span>
                    <input
                        type="date"
                        value={dateRange.end}
                        onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                        className="py-1.5 text-sm border-none focus:ring-0 text-slate-600 cursor-pointer"
                    />
                </div>
            </div>

            {/* Summary Card */}
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-red-100 rounded-lg text-red-600">
                        <AlertTriangle className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 font-medium">총 부적합 수량</p>
                        <h3 className="text-2xl font-bold text-slate-900">{totalDefects.toLocaleString()} EA</h3>
                    </div>
                </div>
             </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Chart 1: By Product Category */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="mb-6">
                        <h3 className="font-bold text-slate-800">제품명별 현황 (재고분류)</h3>
                        <p className="text-xs text-slate-400">품목 마스터 &apos;재고분류설명&apos; 기준 집계</p>
                    </div>
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={byProductData} layout="vertical" margin={{ left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                <XAxis type="number" />
                                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    cursor={{fill: '#f8fafc'}}
                                />
                                <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={24} name="부적합 수량">
                                    {byProductData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Chart 2: By Size Category */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="mb-6">
                         <h3 className="font-bold text-slate-800">사이즈별 현황 (소분류)</h3>
                         <p className="text-xs text-slate-400">품목 마스터 &apos;소분류설명&apos; 기준 집계</p>
                    </div>
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                             <PieChart>
                                <Pie
                                    data={bySizeData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={2}
                                    dataKey="value"
                                    nameKey="name"
                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                >
                                    {bySizeData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NonConformanceStatus;
