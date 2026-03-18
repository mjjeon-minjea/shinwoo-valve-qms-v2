
import { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Filter, CheckSquare, Activity, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api';

const CalendarView = () => {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        schedule: true,
        project: true,
        issue: true
    });

    const fetchEvents = async () => {
        try {
            setLoading(true);
            const response = await api.fetch('/weekly_reports');
            if (response.ok) {
                const reports = await response.json();
                let allEvents = [];
                reports.forEach(report => {
                    // Filter: Only show Approved reports (match Weekly Status logic)
                    // if (report.status !== \'approved\') return;

                    // 1. Schedule Events
                    if (report.schedule && Array.isArray(report.schedule)) {
                        report.schedule.forEach(item => {
                            allEvents.push({
                                ...item,
                                category: 'schedule',
                                authorName: report.authorName,
                                reportId: report.id
                            });
                        });
                    }
                    
                    // 2. Project Events (Map to Week Start Date)
                    if (report.projects && Array.isArray(report.projects)) {
                        report.projects.forEach(item => {
                            allEvents.push({
                                ...item,
                                date: report.weekStartDate, // Use report start date
                                content: item.title, // Use title as content
                                type: '프로젝트',
                                category: 'project',
                                authorName: report.authorName,
                                reportId: report.id
                            });
                        });
                    }

                    // 3. Issue Events (Map to Week Start Date)
                    if (report.issues && Array.isArray(report.issues)) {
                        report.issues.forEach(item => {
                            allEvents.push({
                                ...item,
                                date: report.weekStartDate, // Use report start date
                                content: item.title,
                                type: '이슈',
                                category: 'issue',
                                authorName: report.authorName,
                                reportId: report.id
                            });
                        });
                    }
                });
                setEvents(allEvents);
            }
        } catch (error) {
            console.error('Failed to fetch calendar events:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEvents();
    }, []);

    const onNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
    const onPrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
    const toggleFilter = (key) => setFilters(prev => ({ ...prev, [key]: !prev[key] }));

    const renderHeader = () => {
        return (
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                {/* Month Navigation */}
                <div className="flex items-center space-x-4 bg-white px-6 py-3 rounded-xl shadow-sm border border-gray-100">
                    <button onClick={onPrevMonth} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                        <ChevronLeft className="w-6 h-6 text-gray-600" />
                    </button>
                    <div className="flex items-center space-x-3">
                        <CalendarIcon className="w-6 h-6 text-primary-600" />
                        <span className="text-xl font-bold text-gray-800">
                            {format(currentMonth, 'yyyy년 M월')}
                        </span>
                    </div>
                    <button onClick={onNextMonth} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                        <ChevronRight className="w-6 h-6 text-gray-600" />
                    </button>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-2 bg-white px-4 py-3 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center mr-2 text-sm font-bold text-gray-500">
                        <Filter className="w-4 h-4 mr-1" /> 필터:
                    </div>
                    
                    <button 
                        onClick={() => toggleFilter('schedule')}
                        className={`flex items-center px-3 py-1.5 rounded-lg text-xs font-bold transition-all border
                            ${filters.schedule ? 'bg-green-100 text-green-700 border-green-200 shadow-sm' : 'bg-gray-50 text-gray-400 border-gray-100'}
                        `}
                    >
                        <Activity className="w-3 h-3 mr-1.5" />
                        일정
                    </button>
                    
                    <button 
                        onClick={() => toggleFilter('project')}
                        className={`flex items-center px-3 py-1.5 rounded-lg text-xs font-bold transition-all border
                            ${filters.project ? 'bg-blue-100 text-blue-700 border-blue-200 shadow-sm' : 'bg-gray-50 text-gray-400 border-gray-100'}
                        `}
                    >
                        <CheckSquare className="w-3 h-3 mr-1.5" />
                        프로젝트
                    </button>
                    
                    <button 
                        onClick={() => toggleFilter('issue')}
                        className={`flex items-center px-3 py-1.5 rounded-lg text-xs font-bold transition-all border
                            ${filters.issue ? 'bg-red-100 text-red-700 border-red-200 shadow-sm' : 'bg-gray-50 text-gray-400 border-gray-100'}
                        `}
                    >
                        <AlertTriangle className="w-3 h-3 mr-1.5" />
                        이슈
                    </button>
                </div>
            </div>
        );
    };

    const renderDays = () => {
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        return (
            <div className="grid grid-cols-7 mb-2 text-center">
                {days.map(day => (
                    <div key={day} className={`text-sm font-bold py-2 ${day === '일' ? 'text-red-500' : day === '토' ? 'text-blue-500' : 'text-gray-500'}`}>
                        {day}
                    </div>
                ))}
            </div>
        );
    };

    const renderCells = () => {
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(monthStart);
        const startDate = startOfWeek(monthStart);
        const endDate = endOfWeek(monthEnd);

        const rows = [];
        let days = [];
        let day = startDate;
        let formattedDate = '';

        while (day <= endDate) {
            for (let i = 0; i < 7; i++) {
                formattedDate = format(day, 'd');
                // eslint-disable-next-line no-unused-vars
                const cloneDay = day;
                
                // Find events for this day AND fitler them
                let dayEvents = events.filter(event => {
                    if (!isSameDay(new Date(event.date), day)) return false;
                    return filters[event.category]; // Check filter
                });

                // Sort: Vacation (All Day) first, then by Time
                dayEvents.sort((a, b) => {
                    // 1. Vacation ('휴가') comes first
                    const isVacationA = a.type === '휴가';
                    const isVacationB = b.type === '휴가';
                    if (isVacationA && !isVacationB) return -1;
                    if (!isVacationA && isVacationB) return 1;

                    // 2. Sort by Time (treat empty as 00:00)
                    const timeA = a.time || '00:00';
                    const timeB = b.time || '00:00';
                    return timeA.localeCompare(timeB);
                });

                days.push(
                    <div
                        key={day}
                        className={`min-h-[140px] p-2 border border-slate-100 bg-white relative group transition-all hover:shadow-md hover:z-10
                            ${!isSameMonth(day, monthStart) ? 'bg-slate-50/50 text-slate-300' : ''}
                            ${isSameDay(day, new Date()) ? 'ring-2 ring-primary-100 bg-primary-50/10' : ''}
                        `}
                    >
                        <div className={`text-sm font-bold mb-2 flex justify-between items-center
                            ${!isSameMonth(day, monthStart) ? 'text-slate-300' : 
                              format(day, 'E') === 'Sun' ? 'text-red-500' : 
                              format(day, 'E') === 'Sat' ? 'text-blue-500' : 'text-slate-700'}
                        `}>
                            <span className={`w-7 h-7 flex items-center justify-center rounded-full ${isSameDay(day, new Date()) ? 'bg-primary-600 text-white shadow-md' : ''}`}>
                                {formattedDate}
                            </span>
                            {dayEvents.length > 0 && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">{dayEvents.length}</span>}
                        </div>
                        
                        <div className="space-y-1 overflow-y-auto max-h-[100px] custom-scrollbar pr-1">
                            {dayEvents.map((event, idx) => {
                                // Dynamic Style based on Category
                                let styleClass = 'bg-gray-100 text-gray-700 border-gray-200'; // Default
                                if (event.category === 'schedule') {
                                    styleClass = 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100';
                                } else if (event.category === 'project') {
                                    styleClass = 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100';
                                } else if (event.category === 'issue') {
                                    styleClass = 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100';
                                }

                                return (
                                    <div 
                                        key={idx} 
                                        title={`[${event.type}] ${event.authorName}: ${event.content}`}
                                        className={`text-[11px] px-1.5 py-1 rounded border mb-1 truncate cursor-pointer transition-colors ${styleClass}`}
                                    >
                                        <div className="flex items-center gap-1 justify-between">
                                            <div className="flex items-center gap-1 overflow-hidden">
                                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 
                                                    ${event.category === 'schedule' ? 'bg-green-500' : 
                                                      event.category === 'project' ? 'bg-blue-500' : 'bg-red-500'}`
                                                }></span>
                                                <span className="font-bold whitespace-nowrap opacity-75 text-[10px]">{event.authorName}</span>
                                            </div>
                                            {/* Time or AllDay Badge - Only for Schedule */}
                                            {event.category === 'schedule' && (
                                                <span className="text-[9px] font-mono opacity-80 flex-shrink-0 ml-1">
                                                    {event.type === '휴가' 
                                                        ? <span className="bg-blue-100 text-blue-600 px-1 rounded-sm">종일</span>
                                                        : event.time}
                                                </span>
                                            )}
                                        </div>
                                        <div className="truncate font-medium leading-tight">
                                           {event.content}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
                day = addDays(day, 1);
            }
            rows.push(
                <div className="grid grid-cols-7 divide-x divide-slate-100 border-b border-slate-100" key={day}>
                    {days}
                </div>
            );
            days = [];
        }
        return <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">{rows}</div>;
    };

    // Helper for adding days
    const addDays = (date, days) => {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }

    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
    );

    return (
        <div className="p-8 bg-slate-50 min-h-screen animate-fade-in">
            <div className="max-w-7xl mx-auto space-y-6">
                 <div>
                    <h2 className="text-2xl font-bold text-slate-900">팀 업무 캘린더</h2>
                    <p className="text-slate-500 mt-1">주간 업무 보고 기반 팀 일정 및 이슈 통합 조휘</p>
                </div>
                {renderHeader()}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    {renderDays()}
                    {renderCells()}
                </div>
            </div>
        </div>
    );
};

export default CalendarView;
