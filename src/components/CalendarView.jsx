
import React, { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { useUser } from '../contexts/UserContext';

const CalendarView = ({ user: propUser }) => {
    const { user: contextUser } = useUser();
    const user = propUser || contextUser;
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchEvents = async () => {
        try {
            setLoading(true);
            const response = await fetch('http://localhost:3001/weekly_reports');
            if (response.ok) {
                const reports = await response.json();
                // Flatten all schedule items from all reports
                let allEvents = [];
                reports.forEach(report => {
                    if (report.schedule && Array.isArray(report.schedule)) {
                        report.schedule.forEach(item => {
                            allEvents.push({
                                ...item,
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

    const renderHeader = () => {
        return (
            <div className="flex justify-between items-center mb-4 px-4 py-2 bg-white rounded-lg shadow-sm border border-gray-100">
                <div className="flex items-center space-x-2">
                    <CalendarIcon className="w-5 h-5 text-blue-600" />
                    <span className="text-xl font-bold text-gray-800">
                        {format(currentMonth, 'yyyy년 M월')}
                    </span>
                </div>
                <div className="flex space-x-2">
                    <button onClick={onPrevMonth} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <ChevronLeft className="w-5 h-5 text-gray-600" />
                    </button>
                    <button onClick={onNextMonth} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <ChevronRight className="w-5 h-5 text-gray-600" />
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
                    <div key={day} className={`text-sm font-semibold py-2 ${day === '일' ? 'text-red-500' : day === '토' ? 'text-blue-500' : 'text-gray-500'}`}>
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
                const cloneDay = day;
                
                // Find events for this day
                const dayEvents = events.filter(event => 
                    isSameDay(new Date(event.date), day)
                );

                days.push(
                    <div
                        key={day}
                        className={`min-h-[120px] p-2 border border-gray-100 bg-white relative group transition-colors hover:bg-gray-50
                            ${!isSameMonth(day, monthStart) ? 'bg-gray-50 text-gray-300' : ''}
                            ${isSameDay(day, new Date()) ? 'bg-blue-50 border-blue-200' : ''}
                        `}
                        onClick={() => setSelectedDate(cloneDay)}
                    >
                        <div className={`text-sm font-bold mb-1 
                            ${!isSameMonth(day, monthStart) ? 'text-gray-300' : 
                              format(day, 'E') === 'Sun' ? 'text-red-500' : 
                              format(day, 'E') === 'Sat' ? 'text-blue-500' : 'text-gray-700'}
                        `}>
                            {formattedDate}
                        </div>
                        <div className="space-y-1 overflow-y-auto max-h-[80px] custom-scrollbar">
                            {dayEvents.map((event, idx) => (
                                <div 
                                    key={idx} 
                                    title={`${event.authorName}: ${event.content}`}
                                    className={`text-xs px-1 py-0.5 rounded truncate shadow-sm cursor-pointer
                                        ${event.type === '휴가' ? 'bg-green-100 text-green-700 border-green-200' : 
                                          event.type === '외근' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                                          event.type === '미팅' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                          'bg-gray-100 text-gray-700 border-gray-200'}
                                        border
                                    `}
                                >
                                    <span className="font-semibold mr-1">[{event.authorName}]</span>
                                    {event.content}
                                </div>
                            ))}
                        </div>
                    </div>
                );
                day = addDays(day, 1);
            }
            rows.push(
                <div className="grid grid-cols-7" key={day}>
                    {days}
                </div>
            );
            days = [];
        }
        return <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">{rows}</div>;
    };

    // Helper for adding days
    const addDays = (date, days) => {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }

    if (loading) return <div className="p-8 text-center text-gray-500">일정 데이터를 불러오는 중...</div>;

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">부서 일정 캘린더</h2>
            <div className="max-w-7xl mx-auto">
                {renderHeader()}
                {renderDays()}
                {renderCells()}
            </div>
        </div>
    );
};

export default CalendarView;
