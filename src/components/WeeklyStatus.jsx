
import React, { useState, useEffect } from 'react';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns';
// eslint-disable-next-line no-unused-vars
import { ChevronLeft, ChevronRight, Printer, FileText, CheckCircle, List, AlertTriangle, Calendar as CalendarIcon, Package, CheckSquare } from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { api } from '../lib/api';

// Rank Hierarchy for Sorting
const rankOrder = {
    '이사': 1,
    '부장': 2,
    '차장': 3,
    '과장': 4,
    '대리': 5,
    '계장': 6,
    '주임': 7,
    '사원': 8
};

// Helper to get sort weight
const getRankWeight = (rank) => rankOrder[rank] || 99;

// Helper for badge colors
const getBadgeColor = (rank) => {
    switch (rank) {
        case '이사':
        case '부장':
            return 'bg-purple-100 text-purple-800 border-purple-200';
        case '차장':
        case '과장':
            return 'bg-sky-100 text-sky-800 border-sky-200';
        case '대리':
            return 'bg-orange-100 text-orange-800 border-orange-200';
        case '계장':
        case '주임':
            return 'bg-green-100 text-green-800 border-green-200';
        default: // 사원 and others
            return 'bg-gray-100 text-gray-800 border-gray-200';
    }
};

const WeeklyStatus = () => {
    // eslint-disable-next-line no-unused-vars
    const { user } = useUser();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [reports, setReports] = useState([]);
    // eslint-disable-next-line no-unused-vars
    const [users, setUsers] = useState([]); // Store users for rank lookup
    const [aggregatedData, setAggregatedData] = useState({
        projects: [],
        issues: [],
        schedules: [],
        samples: []
    });
    const [loading, setLoading] = useState(true);

    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
    const weekKey = format(weekStart, 'yyyy-MM-dd');

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch Users and Reports in parallel
                const [reportsRes, usersRes] = await Promise.all([
                    api.fetch('/weekly_reports'),
                    api.fetch('/users')
                ]);

                if (reportsRes.ok && usersRes.ok) {
                    const reportsData = await reportsRes.json();
                    const usersData = await usersRes.json();
                    
                    setUsers(usersData);

                    // Filter for Approved reports in the current week
                    const weekReports = reportsData.filter(r => 
                        r.weekStartDate === weekKey
                    );
                    
                    setReports(weekReports);
                    processAggregatedData(weekReports, usersData);
                }
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [weekKey]);

    const processAggregatedData = (reports, usersList) => {
        const projects = [];
        const issues = [];
        const schedules = [];
        const samples = [];

        reports.forEach(report => {
            // Find user to get current rank - Ensure ID comparison is string safe
            const author = usersList.find(u => String(u.id) === String(report.authorId)) || {};
            const userRank = author?.rank || report?.rank || '사원';

            const authorInfo = {
                name: report.authorName,
                rank: userRank,
                weight: getRankWeight(userRank)
            };

            // Projects
            if (report.projects) {
                report.projects.forEach(item => {
                    projects.push({ ...item, ...authorInfo });
                });
            }
            // Issues
            if (report.issues) {
                report.issues.forEach(item => {
                    issues.push({ ...item, ...authorInfo });
                });
            }
            // Schedules
            if (report.schedule) {
                report.schedule.forEach(item => {
                    schedules.push({ ...item, ...authorInfo });
                });
            }
            // Samples
            if (report.samples) {
                report.samples.forEach(item => {
                    samples.push({ ...item, ...authorInfo });
                });
            }
        });

        // Sort by Rank
        const sortByRank = (a, b) => a.weight - b.weight;

        // Sort by Date then Time
        const sortByDateAndTime = (a, b) => {
            if (a.date !== b.date) {
                return new Date(a.date) - new Date(b.date);
            }
            // If dates are equal, sort by time (treat empty as 00:00)
            const timeA = (a.time && typeof a.time === 'string') ? a.time : '00:00';
            const timeB = (b.time && typeof b.time === 'string') ? b.time : '00:00';
            return timeA.localeCompare(timeB);
        };

        setAggregatedData({
            projects: projects.sort(sortByRank),
            issues: issues.sort(sortByRank),
            schedules: schedules.sort(sortByDateAndTime),
            samples: samples.sort(sortByRank)
        });
    };

    const handlePrint = () => {
        window.print();
    };

    if (loading) return <div className="p-8 text-center">로딩 중...</div>;

    return (
        <div className="p-6 max-w-7xl mx-auto bg-gray-50 min-h-screen print:bg-white print:p-0">
            {/* Header - Hidden on Print */}
            <div className="flex justify-between items-center mb-8 print:hidden">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                    <FileText className="w-8 h-8 mr-3 text-indigo-600" />
                    주간 업무 현황 (통합)
                </h2>
                <div className="flex items-center space-x-4">
                    <div className="flex items-center bg-white rounded-lg shadow-sm border border-gray-200 p-1">
                        <button onClick={() => setCurrentDate(subWeeks(currentDate, 1))} className="p-2 hover:bg-gray-100 rounded"><ChevronLeft className="w-5 h-5"/></button>
                        <span className="px-4 font-bold text-gray-700">{format(weekStart, 'yyyy-MM-dd')} ~ {format(weekEnd, 'MM/dd')}</span>
                        <button onClick={() => setCurrentDate(addWeeks(currentDate, 1))} className="p-2 hover:bg-gray-100 rounded"><ChevronRight className="w-5 h-5"/></button>
                    </div>
                    <button onClick={handlePrint} className="flex items-center px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 shadow-sm transition-colors">
                        <Printer className="w-4 h-4 mr-2" />
                        출력하기
                    </button>
                </div>
            </div>

            {/* Print Header - Visible only on Print */}
            <div className="hidden print:block mb-8 text-center border-b-2 border-gray-800 pb-4">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">주간 업무 통합 보고서</h1>
                <p className="text-gray-600">기간: {format(weekStart, 'yyyy.MM.dd')} ~ {format(weekEnd, 'yyyy.MM.dd')}</p>
            </div>

            {reports.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
                    <p className="text-gray-500 text-lg">해당 주차에 승인된 보고서가 없습니다.</p>
                </div>
            ) : (
                <div className="space-y-8 print:space-y-6">
                    {/* 1. Projects Section */}
                    <SectionPanel 
                        title="인증 및 프로젝트 진행 현황" 
                        icon={CheckSquare} 
                        color="blue"
                        items={aggregatedData.projects}
                        renderItem={(item) => (
                            <div className="flex flex-col sm:flex-row sm:items-center py-2 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                                <div className="w-40 flex-shrink-0 mb-1 sm:mb-0">
                                    <NameBadge name={item.name} rank={item.rank} />
                                </div>
                                <div className="flex-1">
                                    <span className="font-bold text-gray-800 mr-2">{item.title}</span>
                                    <span className="text-sm text-gray-500">- {item.content}</span>
                                </div>
                                <div className="w-24 text-right flex-shrink-0 mt-1 sm:mt-0">
                                    <span className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-600">{item.status}</span>
                                </div>
                            </div>
                        )}
                    />

                    {/* 2. Issues Section */}
                    <SectionPanel 
                        title="공정 이슈 및 불량 현황" 
                        icon={AlertTriangle} 
                        color="red"
                        items={aggregatedData.issues}
                        renderItem={(item) => (
                            <div className="flex flex-col sm:flex-row sm:items-center py-2 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                                <div className="w-40 flex-shrink-0 mb-1 sm:mb-0">
                                    <NameBadge name={item.name} rank={item.rank} />
                                </div>
                                <div className="flex-1">
                                    <span className="font-bold text-red-700 mr-2">⚠ {item.title}</span>
                                    <span className="text-sm text-gray-500">- {item.content}</span>
                                </div>
                                <div className="w-24 text-right flex-shrink-0 mt-1 sm:mt-0">
                                    <span className={`text-xs px-2 py-1 rounded font-bold
                                        ${item.status === '발생' ? 'bg-red-100 text-red-700' : 
                                          item.status === '완료' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`
                                    }>
                                        {item.status}
                                    </span>
                                </div>
                            </div>
                        )}
                    />

                    {/* 3. Samples Section */}
                    <SectionPanel 
                        title="초도품 및 Sample 관리" 
                        icon={Package} 
                        color="indigo"
                        items={aggregatedData.samples}
                        renderItem={(item) => (
                            <div className="flex flex-col sm:flex-row sm:items-start py-2 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                                <div className="w-40 flex-shrink-0 mb-1 sm:mb-0 pt-1">
                                    <NameBadge name={item.name} rank={item.rank} />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center flex-wrap gap-2 mb-1">
                                        <span className="font-bold text-gray-800">{item.itemName}</span>
                                        <span className="text-sm font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded whitespace-nowrap">
                                            진행률: {item.progress}
                                        </span>
                                    </div>
                                    <div className="text-sm text-gray-600">
                                        <span className="text-gray-500 mr-2">[{item.note || '특이사항 없음'}]</span>
                                        <span className="font-medium text-indigo-700">{item.status}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    />

                    {/* 4. Schedule Section */}
                    <SectionPanel 
                        title="금주 일정 및 근태" 
                        icon={CalendarIcon} 
                        color="green"
                        items={aggregatedData.schedules}
                        renderItem={(item) => (
                            <div className="flex flex-col sm:flex-row sm:items-center py-2 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                                <div className="w-40 flex-shrink-0 mb-1 sm:mb-0">
                                    <NameBadge name={item.name} rank={item.rank} />
                                </div>
                                <div className="w-48 flex-shrink-0 text-sm font-bold text-gray-700 truncate">
                                    {item.date} 
                                    {item.type === '휴가' 
                                        ? <span className="text-xs text-blue-600 bg-blue-50 px-1 rounded ml-1">종일</span> 
                                        : item.time && <span className="text-xs text-gray-500 ml-1">{item.time}</span>
                                    } 
                                    ({item.type})
                                </div>
                                <div className="flex-1 text-sm text-gray-800">
                                    {item.content} <span className="text-gray-400 text-xs ml-2">{item.note}</span>
                                </div>
                            </div>
                        )}
                    />
                </div>
            )}
        </div>
    );
};

const NameBadge = ({ name, rank }) => (
    <span className={`
        inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border transition-colors
        ${getBadgeColor(rank)} print:border-gray-300 print:text-black print:bg-transparent
    `}>
        {name} {rank}
    </span>
);

const SectionPanel = ({ title, icon: Icon, color, items, renderItem }) => {
    // Dynamic border color map
    const borderColors = {
        blue: 'border-blue-100 border-t-4 border-t-blue-500',
        red: 'border-red-100 border-t-4 border-t-red-500',
        green: 'border-green-100 border-t-4 border-t-green-500',
        indigo: 'border-indigo-100 border-t-4 border-t-indigo-500',
    };
    
    const textColors = {
        blue: 'text-blue-700',
        red: 'text-red-700',
        green: 'text-green-700',
        indigo: 'text-indigo-700',
    };

    return (
        <div className={`bg-white rounded-xl shadow-sm border ${borderColors[color]} overflow-hidden print:shadow-none print:border-gray-200 print:border-t-2 print:border-t-black page-break-inside-avoid`}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 print:bg-white print:border-b-2 print:border-gray-300">
                <h3 className={`text-lg font-bold flex items-center ${textColors[color]} print:text-black`}>
                    <Icon className="w-5 h-5 mr-2 print:hidden" />
                    {title}
                </h3>
                <span className="text-xs font-semibold text-gray-400 bg-white px-2 py-1 rounded border border-gray-100 print:hidden">
                    총 {items.length}건
                </span>
            </div>
            <div className="p-6">
                {items.length === 0 ? (
                    <p className="text-center text-gray-400 italic py-4">해당 사항 없음</p>
                ) : (
                    <div className="flex flex-col">
                        {items.map((item, i) => React.Fragment ? <React.Fragment key={i}>{renderItem(item)}</React.Fragment> : <div key={i}>{renderItem(item)}</div>)}
                    </div>
                )}
            </div>
        </div>
    );
};

export default WeeklyStatus;
