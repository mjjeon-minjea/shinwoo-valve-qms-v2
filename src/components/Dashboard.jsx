import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    // eslint-disable-next-line no-unused-vars
    PieChart, Pie, Cell, BarChart, Bar, Legend, Area, ComposedChart
} from 'recharts';
import {
    Box, Package, ClipboardCheck, AlertTriangle, XCircle, Activity,
    Settings, CheckCircle, HelpCircle, ChevronRight, ChevronDown,
    MoreHorizontal, User, RefreshCw, MessageSquare,
    Plus, Trash2, Edit, X, Upload, FileText, LayoutDashboard, Search,
    Monitor, Save, Filter
} from 'lucide-react';
import Chatbot from './Chatbot';
import UserManagement from './UserManagement';
import ProgressModal from './ProgressModal';
import * as XLSX from 'xlsx';
import popupImage from '../assets/popup.png';
import NoticeBoard from './NoticeBoard';
import DevNotes from './DevNotes';
import Suggestions from './Suggestions';
import PostApproval from './PostApproval';
import ResourceRoom from './ResourceRoom';
import WeeklyReport from './WeeklyReport';
import WeeklyStatus from './WeeklyStatus';
import CalendarView from './CalendarView';
import { api } from '../lib/api';
import NonConformanceStatus from './NonConformanceStatus';
import InspectionAnalysisDashboard from './InspectionAnalysisDashboard';
import ProcessInspectionDashboard from './ProcessInspectionDashboard';
import ProcessHistory from './ProcessHistory';
import ProcessAnalysis from './ProcessAnalysis';
import WorkplaceAnalysis from './WorkplaceAnalysis';
import EquipmentAnalysis from './EquipmentAnalysis';
import ModelCategoryAnalysis from './ModelCategoryAnalysis';
import InboundAnalysis from './InboundAnalysis';
import InboundHistory from './InboundHistory';
// --- Helper Functions ---

// Helper: Convert Excel Serial Date to YYYY-MM-DD
const formatDate = (val) => {
    if (!val) return '2025-01-01'; // Fallback

    // If it's a number (Excel serial date), convert it
    // Excel base date: 1899-12-30
    if (typeof val === 'number') {
        const date = new Date(Math.round((val - 25569) * 86400 * 1000));
        return date.toISOString().split('T')[0];
    }

    // If it's a string, ensure it's YYYY-MM-DD
    if (typeof val === 'string') {
        // If looks like numeric string "45992"
        if (!isNaN(Number(val)) && !val.includes('-')) {
            const date = new Date(Math.round((Number(val) - 25569) * 86400 * 1000));
            return date.toISOString().split('T')[0];
        }
        return val;
    }
    return '2025-01-01';
};

// --- Sub-components for Views ---

const PlaceholderView = ({ title, icon: Icon }) => (
    <div className="flex flex-col items-center justify-center h-[600px] text-slate-400 animate-fade-in">
        <div className="bg-slate-100 p-6 rounded-full mb-4">
            <Icon className="w-12 h-12" />
        </div>
        <h2 className="text-2xl font-bold text-slate-600 mb-2">{title}</h2>
        <p>해당 기능은 현재 개발 중입니다.</p>
    </div>
);

const InquiryManagement = ({ isAdmin, user }) => {
    const [inquiries, setInquiries] = useState([]);
    const [selectedInquiry, setSelectedInquiry] = useState(null);
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef(null);

    useEffect(() => {
        fetchInquiries();
        const interval = setInterval(fetchInquiries, 1000); // Polling every 1s for real-time feel
        return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Sync selectedInquiry with updated inquiries list
    useEffect(() => {
        if (selectedInquiry) {
            const updated = inquiries.find(i => i.id === selectedInquiry.id);
            if (updated && JSON.stringify(updated.messages) !== JSON.stringify(selectedInquiry.messages)) {
                setSelectedInquiry(updated);
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [inquiries]);

    // Scroll to bottom only when messages change
    useEffect(() => {
        if (selectedInquiry) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedInquiry?.messages?.length]);

    const fetchInquiries = async () => {
        try {
            const response = await fetch('/inquiries');
            if (response.ok) {
                const data = await response.json();
                // Ensure data is array
                let inquiriesArray = Array.isArray(data) ? data : [];

                // Filter for non-admins: only show own inquiries
                if (!isAdmin && user) {
                    inquiriesArray = inquiriesArray.filter(inq =>
                        inq.author === user.name || // Match by name (legacy)
                        inq.userId === user.id ||   // Match by ID (preferred)
                        (inq.messages && inq.messages.some(m => m.sender === 'user' && m.author === user.name)) // fallback
                    );
                }

                // Sort by date/id descending (newest first)
                setInquiries(inquiriesArray.sort((a, b) => b.id - a.id));
            }
        } catch (error) {
            console.error('Failed to fetch inquiries:', error);
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedInquiry) return;

        const message = {
            sender: isAdmin ? 'admin' : 'user', // Identify sender
            role: isAdmin ? 'assistant' : 'user', // Role for UI styling
            content: newMessage,
            timestamp: new Date().toISOString()
        };

        const updatedMessages = [...(selectedInquiry.messages || []), message];

        try {
            const response = await fetch(`/inquiries/${selectedInquiry.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: updatedMessages })
            });

            if (response.ok) {
                const updatedInquiry = await response.json();

                // Update local state
                setInquiries(prev => prev.map(inq => inq.id === updatedInquiry.id ? updatedInquiry : inq));
                setSelectedInquiry(updatedInquiry);
                setNewMessage(''); // Clear input
            }
        } catch (error) {
            console.error('Failed to send message:', error);
        }
    };

    return (
        <div className="animate-fade-in h-[calc(100vh-140px)] flex gap-6">
            {/* Inquiry List */}
            <div className="w-1/3 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-100 bg-slate-50">
                    <h2 className="font-bold text-slate-900 flex items-center gap-2">
                        <div className="bg-primary-100 p-1.5 rounded-lg">
                            <MessageSquare className="w-4 h-4 text-primary-600" />
                        </div>
                        문의 목록
                        <span className="text-xs font-normal text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                            {inquiries.length}
                        </span>
                    </h2>
                </div>
                <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                    {inquiries.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-sm flex flex-col items-center">
                            <MessageSquare className="w-8 h-8 mb-2 opacity-20" />
                            접수된 문의가 없습니다.
                        </div>
                    ) : (
                        inquiries.map((inquiry) => (
                            <button
                                key={inquiry.id}
                                onClick={() => setSelectedInquiry(inquiry)}
                                className={`w-full p-4 text-left transition-colors hover:bg-slate-50 ${selectedInquiry?.id === inquiry.id ? 'bg-primary-50 border-l-4 border-primary-600' : 'border-l-4 border-transparent'}`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <span className="font-medium text-slate-900 text-sm">{inquiry.author || inquiry.userName || '방문자'}</span>
                                    <span className="text-xs text-slate-400">{inquiry.date ? new Date(inquiry.date).toLocaleDateString() : ''}</span>
                                </div>
                                <p className="text-xs text-slate-500 line-clamp-1">
                                    {inquiry.messages && inquiry.messages.length > 0
                                        ? (inquiry.messages[inquiry.messages.length - 1].content || inquiry.messages[inquiry.messages.length - 1].text)
                                        : '메세지 없음'}
                                </p>
                                <div className="mt-2 flex gap-2">
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${inquiry.status === 'Open' || inquiry.status === 'pending' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                        {inquiry.status}
                                    </span>
                                    <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                                        ID: {String(inquiry.id).slice(-4)}
                                    </span>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* Chat Detail */}
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                {selectedInquiry ? (
                    <>
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600">
                                    <User className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900">{selectedInquiry.author || selectedInquiry.userName}</h3>
                                    <p className="text-xs text-slate-500">ID: {String(selectedInquiry.id).slice(-4)} • {selectedInquiry.date ? new Date(selectedInquiry.date).toLocaleString() : ''}</p>
                                </div>
                            </div>
                            <button className="text-xs flex items-center gap-1 text-slate-500 hover:text-slate-900 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                                <CheckCircle className="w-3 h-3" />
                                상태 변경
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50">
                            {selectedInquiry.messages && selectedInquiry.messages.map((msg, idx) => (
                                <div key={idx} className={`flex ${(msg.role === 'user' || msg.sender === 'user') ? 'justify-start' : 'justify-end'}`}>
                                    <div className={`flex flex-col ${(msg.role === 'user' || msg.sender === 'user') ? 'items-start' : 'items-end'} max-w-[70%]`}>
                                        <div className={`px-4 py-2.5 rounded-2xl text-sm shadow-sm ${(msg.role === 'user' || msg.sender === 'user')
                                            ? 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
                                            : 'bg-primary-600 text-white rounded-tr-none'
                                            }`}>
                                            {msg.content || msg.text}
                                        </div>
                                        <span className="text-[10px] text-slate-400 mt-1 px-1">
                                            {(msg.role === 'user' || msg.sender === 'user') ? '고객' : 'AI 챗봇'} • {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                        </span>
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>
                        <div className="p-4 border-t border-slate-100 bg-white">
                            <div className="p-4 border-t border-slate-100 bg-white">
                                <form className="relative" onSubmit={handleSendMessage}>
                                    <input
                                        type="text"
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        placeholder="메세지를 입력하세요..."
                                        className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition-shadow"
                                    />
                                    <button
                                        type="submit"
                                        disabled={!newMessage.trim()}
                                        className={`absolute right-2 top-2 p-1.5 rounded-lg transition-colors ${newMessage.trim() ? 'bg-primary-600 text-white hover:bg-primary-700' : 'bg-slate-200 text-white cursor-not-allowed'}`}
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </form>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                        <div className="bg-slate-50 p-6 rounded-full mb-4">
                            <MessageSquare className="w-12 h-12 text-slate-300" />
                        </div>
                        <h3 className="text-lg font-medium text-slate-600">문의 내용 확인</h3>
                        <p className="text-sm mt-1">좌측 목록에서 문의를 선택하여 대화 내용을 확인하세요.</p>
                    </div>
                )}
            </div>
        </div>
    );
};


const HomepageSettings = () => {
    const [popupEnabled, setPopupEnabled] = useState(true);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await api.fetch('/settings/global');
            if (res.ok) {
                const data = await res.json();
                setPopupEnabled(data.popupEnabled);
                setError(null);
            } else if (res.status === 404) {
                setError('서버 재시작이 필요합니다. (새로운 설정 적용을 위해 터미널에서 npm run start를 다시 실행해주세요)');
            } else {
                throw new Error('Failed to fetch settings');
            }
        } catch (error) {
            console.error('Failed to fetch settings:', error);
            setError('설정을 불러오는 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await api.fetch('/settings/global', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: { id: 'global', popupEnabled }
            });

            if (res.ok) {
                alert('설정이 저장되었습니다.');
                setError(null);
            } else if (res.status === 404) {
                setError('서버 재시작이 필요합니다. (새로운 설정 적용을 위해 터미널에서 npm run start를 다시 실행해주세요)');
                alert('서버 재시작이 필요합니다.');
            } else {
                throw new Error('Failed to save');
            }
        } catch (error) {
            console.error('Save error:', error);
            alert('설정 저장 중 오류가 발생했습니다.');
            setError('설정 저장 중 오류가 발생했습니다.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500">설정을 불러오는 중...</div>;

    return (
        <div className="space-y-6 animate-fade-in">
            <h1 className="text-2xl font-bold text-slate-900">홈페이지 설정</h1>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-200 flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                    <span className="font-medium">{error}</span>
                </div>
            )}

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden text-left">
                <div className="p-6 border-b border-slate-100 bg-slate-50">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Monitor className="w-5 h-5 text-indigo-600" />
                        메인 팝업 설정
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">대시보드 접속 시 표시되는 공지 팝업을 관리합니다.</p>
                </div>
                <div className="p-8">
                    <div className="flex items-center justify-between max-w-2xl">
                        <div>
                            <h4 className="font-medium text-slate-900">팝업 표시</h4>
                            <p className="text-sm text-slate-500 mt-1">활성화 시 모든 사용자에게 로그인 직후 팝업이 표시됩니다.</p>
                        </div>
                        <button
                            onClick={() => setPopupEnabled(!popupEnabled)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${popupEnabled ? 'bg-primary-600' : 'bg-slate-200'}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${popupEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>
                </div>
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-sm disabled:opacity-50"
                    >
                        <Save className="w-4 h-4 mr-2" />
                        {saving ? '저장 중...' : '변경사항 저장'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const Popup = ({ onClose }) => {
    const [dontShowToday, setDontShowToday] = useState(false);

    const handleClose = () => {
        if (dontShowToday) {
            const today = new Date().toISOString().split('T')[0];
            localStorage.setItem(`hidePopup_${today}`, 'true');
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl overflow-hidden max-w-5xl w-full mx-4 flex flex-col animate-scale-in relative">
                <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 bg-white/80 p-1 rounded-full text-slate-600 hover:text-slate-900 z-10"
                >
                    <X className="w-6 h-6" />
                </button>
                <div className="relative w-full">
                    <img
                        src={popupImage}
                        alt="Promotional Popup"
                        className="w-full h-auto object-contain max-h-[70vh]"
                    />
                </div>
                <div className="p-4 bg-slate-100 flex justify-between items-center border-t border-slate-200">
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600 select-none">
                        <input
                            type="checkbox"
                            checked={dontShowToday}
                            onChange={(e) => setDontShowToday(e.target.checked)}
                            className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 w-4 h-4"
                        />
                        오늘 하루 열지 않기
                    </label>
                    <button
                        onClick={handleClose}
                        className="px-4 py-2 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-900 transition-colors"
                    >
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
};

const Home = ({ setActiveTab }) => {
    const [notices, setNotices] = useState([]);
    const [resources, setResources] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [noticeRes, resourceRes] = await Promise.all([
                    api.fetch('/notices'),
                    api.fetch('/resources')
                ]);
                if (noticeRes.ok) {
                    const data = await noticeRes.json();
                    setNotices(data.sort((a, b) => b.id - a.id).slice(0, 5));
                }
                if (resourceRes.ok) {
                    const data = await resourceRes.json();
                    setResources(data.sort((a, b) => b.id - a.id).slice(0, 5));
                }
            } catch (error) {
                console.error('Failed to fetch summary data', error);
            }
        };
        fetchData();
    }, []);

    return (
        <div className="space-y-6 animate-fade-in">
            <h1 className="text-2xl font-bold text-slate-900">메인화면</h1>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Notice Board */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden h-96 flex flex-col">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                        <div className="flex items-center gap-2">
                            <div className="bg-blue-100 p-1.5 rounded-lg">
                                <AlertTriangle className="w-4 h-4 text-blue-600" />
                            </div>
                            <h3 className="font-bold text-slate-800">공지사항</h3>
                        </div>
                        <button onClick={() => setActiveTab('notices')} className="text-xs text-slate-500 hover:text-primary-600 flex items-center">
                            <Search className="w-3 h-3 mr-1" />
                            상세보기
                        </button>
                    </div>
                    <div className="flex-1 overflow-auto">
                        <table className="min-w-full divide-y divide-slate-100">
                            <thead className="bg-slate-50 sticky top-0">
                                <tr>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase whitespace-nowrap w-12">No</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase whitespace-nowrap w-16">구분</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase w-full">공지제목</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase whitespace-nowrap w-20">작성자</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase whitespace-nowrap w-24">등록일자</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {notices.length === 0 ? (
                                    <tr><td colSpan="5" className="py-10 text-center text-slate-400 text-xs">등록된 공지가 없습니다.</td></tr>
                                ) : (
                                    notices.map((notice) => (
                                        <tr key={notice.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setActiveTab('notices')}>
                                            <td className="px-4 py-3 text-xs text-slate-500 text-center">{notice.id}</td>
                                            <td className="px-4 py-3 text-center whitespace-nowrap">
                                                <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${notice.type === 'MES' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                                                    {notice.type}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-800 line-clamp-1">{notice.title}</td>
                                            <td className="px-4 py-3 text-xs text-slate-500 text-center">{notice.author}</td>
                                            <td className="px-4 py-3 text-xs text-slate-400 text-center whitespace-nowrap">{notice.date}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Resource Room */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden h-96 flex flex-col">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                        <div className="flex items-center gap-2">
                            <div className="bg-green-100 p-1.5 rounded-lg">
                                <FileText className="w-4 h-4 text-green-600" />
                            </div>
                            <h3 className="font-bold text-slate-800">자료실</h3>
                        </div>
                        <button onClick={() => setActiveTab('resources')} className="text-xs text-slate-500 hover:text-primary-600 flex items-center">
                            <Search className="w-3 h-3 mr-1" />
                            상세보기
                        </button>
                    </div>
                    <div className="flex-1 overflow-auto">
                        <table className="min-w-full divide-y divide-slate-100">
                            <thead className="bg-slate-50 sticky top-0">
                                <tr>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase whitespace-nowrap w-12">No</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase whitespace-nowrap w-16">구분</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase w-full">자료제목</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase whitespace-nowrap w-20">작성자</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase whitespace-nowrap w-24">등록일자</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {resources.length === 0 ? (
                                    <tr><td colSpan="5" className="py-10 text-center text-slate-400 text-xs">등록된 자료가 없습니다.</td></tr>
                                ) : (
                                    resources.map((resource) => (
                                        <tr key={resource.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setActiveTab('resources')}>
                                            <td className="px-4 py-3 text-xs text-slate-500 text-center">{resource.id}</td>
                                            <td className="px-4 py-3 text-center whitespace-nowrap">
                                                <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${resource.type === '매뉴얼' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                                    {resource.type}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-800 line-clamp-1">{resource.title}</td>
                                            <td className="px-4 py-3 text-xs text-slate-500 text-center">{resource.author}</td>
                                            <td className="px-4 py-3 text-xs text-slate-400 text-center whitespace-nowrap">{resource.date}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

const Dashboard = ({ user, isAdmin, members, onDeleteMember, onEditMember, onAddMember, onRefresh }) => {
    // eslint-disable-next-line no-unused-vars
    const navigate = useNavigate();
    const getInitialTab = () => {
        const hash = window.location.hash.replace('#', '');
        return hash ? hash : 'home';
    };
    const [activeTab, setActiveTab] = useState(getInitialTab); // Default to home (or current hash)
    // eslint-disable-next-line no-unused-vars
    const [isMenuOpen, setIsMenuOpen] = useState(true);
    const [mainExpanded, setMainExpanded] = useState(true);
    const [inboundExpanded, setInboundExpanded] = useState(true);
    const [processExpanded, setProcessExpanded] = useState(true);
    const [adminExpanded, setAdminExpanded] = useState(true);
    const [showPopup, setShowPopup] = useState(false);

    // [QA 적용본] 이탈 방지용 깃발 및 히스토리 제어 로직 
    const isPopStateRef = useRef(false);

    useEffect(() => {
        // [이중 잠금] 관리자도 아닌데 강제 상태 변조 시 홈으로 튕겨냄
        if (activeTab === 'post_approval' && !isAdmin) {
            console.warn("Unauthorized access to post_approval blocked.");
            setActiveTab('home');
            return;
        }

        // 1. 뒤로가기가 아니면 정상적으로 히스토리 스택 추가
        if (!isPopStateRef.current) {
            window.history.pushState({ tab: activeTab }, '', `#${activeTab}`);
        } else {
            // 뒤로가기로 왔으면 푸시 금지 후 플래그 리셋
            isPopStateRef.current = false;
        }

        const handlePopState = (event) => {
            isPopStateRef.current = true; // 뒤로가기 발생 플래그 켜기
            if (event.state && event.state.tab) {
                setActiveTab(event.state.tab);
            } else {
                setActiveTab('home');
                window.history.replaceState({ tab: 'home' }, '', '#home');
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [activeTab, isAdmin]);

    useEffect(() => {
        const checkPopup = async () => {
            const today = new Date().toISOString().split('T')[0];
            const hidePopup = localStorage.getItem(`hidePopup_${today}`);

            if (!hidePopup) {
                try {
                    const res = await api.fetch('/settings/global');
                    if (res.ok) {
                        const data = await res.json();
                        if (data.popupEnabled) {
                            setShowPopup(true);
                        }
                    }
                } catch (error) {
                    console.error('Popup check failed:', error);
                    setShowPopup(true);
                }
            }
        };
        checkPopup();
    }, []);

    const renderContent = () => {
        switch (activeTab) {
            case 'home': return <Home setActiveTab={setActiveTab} />;
            case 'notices': return <NoticeBoard />;
            case 'resources': return <ResourceRoom />;
            case 'inbound_analysis': return <InboundAnalysis />;
            case 'inspection_analysis': return <InspectionAnalysisDashboard />;
            case 'inbound_status': return <NonConformanceStatus />;
            case 'inbound_history': return <InboundHistory />;
            case 'process':
            case 'process_dashboard': return <ProcessInspectionDashboard user={user} isAdmin={isAdmin} />;
            case 'process_by_process': return <ProcessAnalysis />;
            case 'process_by_workplace': return <WorkplaceAnalysis />;
            case 'process_by_equipment': return <EquipmentAnalysis />;
            case 'process_by_model_category': return <ModelCategoryAnalysis />;
            case 'process_history': return <ProcessHistory />;
            case 'final': return <PlaceholderView title="최종검사 현황" icon={CheckCircle} />;
            case 'dev_notes': return <DevNotes user={user} />;
            case 'suggestions': return <Suggestions user={user} />;
            case 'post_approval': return isAdmin ? <PostApproval user={user} /> : null;
            case 'members': return <UserManagement members={members} onDeleteMember={onDeleteMember} onEditMember={onEditMember} onAddMember={onAddMember} onRefresh={onRefresh} />;
            case 'settings_home': return <HomepageSettings />;
            case 'weekly_report': return <WeeklyReport user={user} />;
            case 'weekly_status': return <WeeklyStatus />;
            case 'schedule': return <CalendarView user={user} />;
            default: return <InboundAnalysis />;
        }
    };

    return (
        <div className="flex min-h-[calc(100vh-64px)] bg-slate-50 pt-16">
            {/* Sidebar (Dark-Grey Premium Banner) */}
            <aside className="w-64 bg-[#1e293b] border-r border-[#0f172a]/20 fixed h-full z-40 hidden lg:block overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                <div className="p-6">
                    <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
                        Dashboards
                    </h2>
                    <nav className="space-y-1.5">
                        {/* Main Screen Group */}
                        <div>
                            <button
                                onClick={() => { setActiveTab('home'); setMainExpanded(!mainExpanded); }}
                                className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold rounded-lg transition-all ${['home', 'notices', 'resources', 'dev_notes', 'suggestions'].includes(activeTab)
                                    ? 'bg-slate-800 text-white border-l-4 border-blue-500'
                                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                                    }`}
                            >
                                <div className="flex items-center">
                                    <LayoutDashboard className={`mr-3 h-5 w-5 ${['home', 'notices', 'resources', 'dev_notes', 'suggestions'].includes(activeTab) ? 'text-blue-400' : 'text-slate-400'}`} />
                                    메인화면
                                </div>
                                <ChevronDown className={`w-4 h-4 transition-transform ${mainExpanded ? 'transform rotate-180' : ''} ${activeTab === 'home' ? 'text-white' : 'text-slate-400'}`} />
                            </button>

                            {mainExpanded && (
                                <div className="mt-1.5 space-y-1.5 pl-6 border-l border-slate-700/50 ml-5">
                                    <button
                                        onClick={() => setActiveTab('home')}
                                        className={`w-full flex items-center px-3 py-2 text-xs font-medium rounded-md transition-all ${activeTab === 'home' ? 'text-blue-400 font-bold bg-slate-800/40' : 'text-slate-400 hover:text-white'}`}
                                    >
                                        대시보드 홈
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('notices')}
                                        className={`w-full flex items-center px-3 py-2 text-xs font-medium rounded-md transition-all ${activeTab === 'notices' ? 'text-blue-400 font-bold bg-slate-800/40' : 'text-slate-400 hover:text-white'}`}
                                    >
                                        공지사항
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('dev_notes')}
                                        className={`w-full flex items-center px-3 py-2 text-xs font-medium rounded-md transition-all ${activeTab === 'dev_notes' ? 'text-blue-400 font-bold bg-slate-800/40' : 'text-slate-400 hover:text-white'}`}
                                    >
                                        개발자 노트
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('resources')}
                                        className={`w-full flex items-center px-3 py-2 text-xs font-medium rounded-md transition-all ${activeTab === 'resources' ? 'text-blue-400 font-bold bg-slate-800/40' : 'text-slate-400 hover:text-white'}`}
                                    >
                                        자료실
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('suggestions')}
                                        className={`w-full flex items-center px-3 py-2 text-xs font-medium rounded-md transition-all ${activeTab === 'suggestions' ? 'text-blue-400 font-bold bg-slate-800/40' : 'text-slate-400 hover:text-white'}`}
                                    >
                                        건의사항
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Inbound Inspection Menu Group */}
                        <div>
                            <button
                                onClick={() => setInboundExpanded(!inboundExpanded)}
                                className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold rounded-lg transition-all ${activeTab.includes('inbound') || activeTab === 'inspection_analysis' ? 'bg-slate-800 text-white border-l-4 border-blue-500' : 'text-slate-300 hover:bg-slate-800/60'}`}
                            >
                                <div className="flex items-center">
                                    <ClipboardCheck className={`mr-3 h-5 w-5 ${activeTab.includes('inbound') || activeTab === 'inspection_analysis' ? 'text-blue-400' : 'text-slate-400'}`} />
                                    인수검사
                                </div>
                                <ChevronDown className={`w-4 h-4 transition-transform ${inboundExpanded ? 'transform rotate-180' : ''} ${activeTab.includes('inbound') ? 'text-white' : 'text-slate-400'}`} />
                            </button>

                            {inboundExpanded && (
                                <div className="mt-1.5 space-y-1.5 pl-6 border-l border-slate-700/50 ml-5">
                                    <button
                                        onClick={() => setActiveTab('inbound_analysis')}
                                        className={`w-full flex items-center px-3 py-2 text-xs font-medium rounded-md transition-all ${activeTab === 'inbound_analysis' ? 'text-blue-400 font-bold bg-slate-800/40' : 'text-slate-400 hover:text-white'}`}
                                    >
                                        대시보드
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('inspection_analysis')}
                                        className={`w-full flex items-center px-3 py-2 text-xs font-medium rounded-md transition-all ${activeTab === 'inspection_analysis' ? 'text-blue-400 font-bold bg-slate-800/40' : 'text-slate-400 hover:text-white'}`}
                                    >
                                        종합분석현황
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('inbound_status')}
                                        className={`w-full flex items-center px-3 py-2 text-xs font-medium rounded-md transition-all ${activeTab === 'inbound_status' ? 'text-blue-400 font-bold bg-slate-800/40' : 'text-slate-400 hover:text-white'}`}
                                    >
                                        부적합 현황 조회
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('inbound_history')}
                                        className={`w-full flex items-center px-3 py-2 text-xs font-medium rounded-md transition-all ${activeTab === 'inbound_history' ? 'text-blue-400 font-bold bg-slate-800/40' : 'text-slate-400 hover:text-white'}`}
                                    >
                                        이력 조회 및 등록
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Process Inspection Menu Group */}
                        <div>
                            <button
                                onClick={() => setProcessExpanded(!processExpanded)}
                                className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold rounded-lg transition-all ${activeTab.includes('process') ? 'bg-slate-800 text-white border-l-4 border-blue-500' : 'text-slate-300 hover:bg-slate-800/60'}`}
                            >
                                <div className="flex items-center">
                                    <Settings className={`mr-3 h-5 w-5 ${activeTab.includes('process') ? 'text-blue-400' : 'text-slate-400'}`} />
                                    공정검사
                                </div>
                                <ChevronDown className={`w-4 h-4 transition-transform ${processExpanded ? 'transform rotate-180' : ''} ${activeTab.includes('process') ? 'text-white' : 'text-slate-400'}`} />
                            </button>

                            {processExpanded && (
                                <div className="mt-1.5 space-y-1.5 pl-6 border-l border-slate-700/50 ml-5">
                                    <button
                                        onClick={() => setActiveTab('process_dashboard')}
                                        className={`w-full flex items-center px-3 py-2 text-xs font-medium rounded-md transition-all ${activeTab === 'process_dashboard' || activeTab === 'process' ? 'text-blue-400 font-bold bg-slate-800/40' : 'text-slate-400 hover:text-white'}`}
                                    >
                                        대시보드
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('process_by_process')}
                                        className={`w-full flex items-center px-3 py-2 text-xs font-medium rounded-md transition-all ${activeTab === 'process_by_process' ? 'text-blue-400 font-bold bg-slate-800/40' : 'text-slate-400 hover:text-white'}`}
                                    >
                                        공정별 분석현황
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('process_by_workplace')}
                                        className={`w-full flex items-center px-3 py-2 text-xs font-medium rounded-md transition-all ${activeTab === 'process_by_workplace' ? 'text-blue-400 font-bold bg-slate-800/40' : 'text-slate-400 hover:text-white'}`}
                                    >
                                        작업장별 분석현황
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('process_by_equipment')}
                                        className={`w-full flex items-center px-3 py-2 text-xs font-medium rounded-md transition-all ${activeTab === 'process_by_equipment' ? 'text-blue-400 font-bold bg-slate-800/40' : 'text-slate-400 hover:text-white'}`}
                                    >
                                        설비명별 분석현황
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('process_by_model_category')}
                                        className={`w-full flex items-center px-3 py-2 text-xs font-medium rounded-md transition-all ${activeTab === 'process_by_model_category' ? 'text-blue-400 font-bold bg-slate-800/40' : 'text-slate-400 hover:text-white'}`}
                                    >
                                        모델별 분석현황
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('process_history')}
                                        className={`w-full flex items-center px-3 py-2 text-xs font-medium rounded-md transition-all ${activeTab === 'process_history' ? 'text-blue-400 font-bold bg-slate-800/40' : 'text-slate-400 hover:text-white'}`}
                                    >
                                        이력 조회 및 등록
                                    </button>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => setActiveTab('final')}
                            className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold rounded-lg transition-all ${activeTab === 'final'
                                ? 'bg-slate-800 text-white border-l-4 border-blue-500'
                                : 'text-slate-300 hover:bg-slate-800/60'
                                }`}
                        >
                            <div className="flex items-center">
                                <CheckCircle className={`mr-3 h-5 w-5 ${activeTab === 'final' ? 'text-blue-400' : 'text-slate-400'}`} />
                                최종검사
                            </div>
                        </button>

                        {isAdmin && (
                            <div>
                                <button
                                    onClick={() => setAdminExpanded(!adminExpanded)}
                                    className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold rounded-lg transition-all ${['members', 'settings_home', 'post_approval'].includes(activeTab)
                                        ? 'bg-slate-800 text-white border-l-4 border-blue-500'
                                        : 'text-slate-300 hover:bg-slate-800/60'
                                        }`}
                                >
                                    <div className="flex items-center">
                                        <Settings className={`mr-3 h-5 w-5 ${['members', 'settings_home', 'post_approval'].includes(activeTab) ? 'text-blue-400' : 'text-slate-400'}`} />
                                        관리자 설정
                                    </div>
                                    <ChevronDown className={`w-4 h-4 transition-transform ${adminExpanded ? 'transform rotate-180' : ''} ${['members', 'settings_home', 'post_approval'].includes(activeTab) ? 'text-white' : 'text-slate-400'}`} />
                                </button>

                                {adminExpanded && (
                                    <div className="mt-1.5 space-y-1.5 pl-6 border-l border-slate-700/50 ml-5">
                                        <button
                                            onClick={() => setActiveTab('post_approval')}
                                            className={`w-full flex items-center px-3 py-2 text-xs font-medium rounded-md transition-all ${activeTab === 'post_approval' ? 'text-blue-400 font-bold bg-slate-800/40' : 'text-slate-400 hover:text-white'}`}
                                        >
                                            게시물 승인 관리
                                        </button>
                                        <button
                                            onClick={() => setActiveTab('members')}
                                            className={`w-full flex items-center px-3 py-2 text-xs font-medium rounded-md transition-all ${activeTab === 'members' ? 'text-blue-400 font-bold bg-slate-800/40' : 'text-slate-400 hover:text-white'}`}
                                        >
                                            기존회원관리
                                        </button>
                                        <button
                                            onClick={() => setActiveTab('settings_home')}
                                            className={`w-full flex items-center px-3 py-2 text-xs font-medium rounded-md transition-all ${activeTab === 'settings_home' ? 'text-blue-400 font-bold bg-slate-800/40' : 'text-slate-400 hover:text-white'}`}
                                        >
                                            홈페이지 설정
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="pt-4 mt-4 border-t border-slate-700/50">
                            <h3 className="px-3 text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                                업무 관리
                            </h3>
                            <button
                                onClick={() => setActiveTab('weekly_report')}
                                className={`w-full flex items-center px-3 py-2.5 text-sm font-semibold rounded-lg transition-all ${activeTab === 'weekly_report'
                                    ? 'bg-slate-800 text-white border-l-4 border-blue-500'
                                    : 'text-slate-300 hover:bg-slate-800/60'
                                    }`}
                            >
                                <div className="flex items-center">
                                    <FileText className={`mr-3 h-5 w-5 ${activeTab === 'weekly_report' ? 'text-blue-400' : 'text-slate-400'}`} />
                                    주간업무보고
                                </div>
                            </button>
                            <button
                                onClick={() => setActiveTab('weekly_status')}
                                className={`w-full flex items-center px-3 py-2.5 text-sm font-semibold rounded-lg transition-all ${activeTab === 'weekly_status'
                                    ? 'bg-slate-800 text-white border-l-4 border-blue-500'
                                    : 'text-slate-300 hover:bg-slate-800/60'
                                    }`}
                            >
                                <div className="flex items-center">
                                    <LayoutDashboard className={`mr-3 h-5 w-5 ${activeTab === 'weekly_status' ? 'text-blue-400' : 'text-slate-400'}`} />
                                    주간업무현황
                                </div>
                            </button>
                            <button
                                onClick={() => setActiveTab('schedule')}
                                className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${activeTab === 'schedule'
                                    ? 'bg-primary-50 text-primary-700'
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                    }`}
                            >
                                <div className="flex items-center">
                                    <Activity className={`mr-3 h-5 w-5 ${activeTab === 'schedule' ? 'text-primary-500' : 'text-slate-400'}`} />
                                    일정 (Calendar)
                                </div>
                            </button>
                        </div>
                    </nav>

                    {/* Additional Menu Section Mockup */}
                    <div className="mt-8">
                        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
                            Settings
                        </h2>
                        <nav className="space-y-1">
                            <button className="w-full flex items-center px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">
                                <FileText className="mr-3 h-5 w-5 text-slate-400" />
                                리포트 관리
                            </button>
                        </nav>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 lg:ml-64 p-8 relative">
                {renderContent()}
                <Chatbot />
            </main>

            {/* Login Popup */}
            {showPopup && <Popup onClose={() => setShowPopup(false)} />}
        </div>
    );
};

export default Dashboard;
