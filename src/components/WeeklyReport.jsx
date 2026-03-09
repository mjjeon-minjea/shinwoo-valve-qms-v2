import { useState, useEffect } from 'react';
import { useUser } from '../contexts/UserContext';
import { api } from '../lib/api';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns';
import { Save, Send, CheckCircle, AlertCircle, Plus, Trash2, Calendar as CalendarIcon, FileText, CheckSquare, Package, AlertTriangle, Copy } from 'lucide-react';

const WeeklyReport = ({ user: propUser }) => {
    const { user: contextUser } = useUser();
    const user = propUser || contextUser;
    const [currentDate, setCurrentDate] = useState(new Date());
    const [activeTab, setActiveTab] = useState('schedule');
    const [report, setReport] = useState(null);
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(false);

    // Calculate week range
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday start
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
    const weekKey = format(weekStart, 'yyyy-MM-dd');

    useEffect(() => {
        fetchReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, weekKey]);

    const fetchReports = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const response = await api.fetch('/weekly_reports');
            if (response.ok) {
                const data = await response.json();
                // Ensure data is an array to prevent crashes
                setReports(Array.isArray(data) ? data : []);
                
                // Find current user's report for this week
                const myReport = data.find(r => 
                    String(r.authorId) === String(user.id) && r.weekStartDate === weekKey
                );

                if (myReport) {
                    setReport(myReport);
                } else {
                    // Initialize blank report
                    setReport({
                        authorId: user.id,
                        authorName: user.name,
                        weekStartDate: weekKey,
                        status: 'draft',
                        schedule: [],
                        projects: [],
                        issues: [],
                        samples: []
                    });
                }
            }
        } catch (error) {
            console.error('Error fetching reports:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleLoadPreviousReport = async () => {
        if (!user || !report) return;
        
        const previousWeekStart = subWeeks(weekStart, 1);
        const previousWeekKey = format(previousWeekStart, 'yyyy-MM-dd');

        setLoading(true);
        try {
            const response = await api.fetch('/weekly_reports');
            if (response.ok) {
                const data = await response.json();
                const prevReport = data.find(r => 
                    String(r.authorId) === String(user.id) && r.weekStartDate === previousWeekKey
                );

                if (prevReport) {
                    setReport(prev => ({
                        ...prev,
                        projects: [...prev.projects, ...(prevReport.projects || [])],
                        issues: [...prev.issues, ...(prevReport.issues || [])],
                        samples: [...prev.samples, ...(prevReport.samples || [])]
                    }));
                    alert('지난주 보고서 내용을 불러왔습니다. (일정 제외)');
                } else {
                    alert('지난주 보고서 내역이 없습니다.');
                }
            }
        } catch (error) {
            console.error('Error loading previous report:', error);
            alert('오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleMyReport = () => {
        const myReport = reports.find(r => 
            String(r.authorId) === String(user.id) && r.weekStartDate === weekKey
        );
        
        if (myReport) {
            setReport(myReport);
        } else {
            setReport({
                authorId: user.id,
                authorName: user.name,
                weekStartDate: weekKey,
                status: 'draft',
                schedule: [],
                projects: [],
                issues: [],
                samples: []
            });
        }
    };

    const handleSave = async (submit = false) => {
        if (!report) return;

        const updatedReport = {
            ...report,
            status: submit ? 'submitted' : 'draft',
            createdDate: new Date().toISOString()
        };

        try {
            let url = '/weekly_reports';
            let method = 'POST';

            if (report.id) {
                url = `/weekly_reports/${report.id}`;
                method = 'PUT';
            }

            const response = await api.fetch(url, {
                method: method,
                body: updatedReport
            });

            if (response.ok) {
                const savedData = await response.json();
                setReport(savedData);
                alert(submit ? '보고서가 제출되었습니다.' : '임시 저장되었습니다.');
                
                // Optimsitic update: Update list locally to avoid stale read from immediate refetch
                setReports(prev => {
                    const idx = prev.findIndex(r => r.id === savedData.id);
                    if (idx >= 0) {
                        const newReports = [...prev];
                        newReports[idx] = savedData;
                        return newReports;
                    } else {
                        return [...prev, savedData];
                    }
                });
            }
        } catch (error) {
            console.error('Error saving report:', error);
            alert('저장 중 오류가 발생했습니다.');
        }
    };

    const handleApproval = async (status, comment) => {
        if (!report || !report.id) return;

        const updatedReport = {
            ...report,
            status: status,
            [user.role === 'manager' ? 'reviewerComment' : 'approverComment']: comment
        };

        try {
            const response = await api.fetch(`/weekly_reports/${report.id}`, {
                method: 'PUT',
                body: updatedReport
            });

            if (response.ok) {
                alert(status === 'approved' ? '승인되었습니다.' : '검토 완료되었습니다.');
                fetchReports();
            }
        } catch (error) {
            console.error('Error updating status:', error);
            alert('처리 중 오류가 발생했습니다.');
        }
    };




    const handleResubmit = async () => {
        if (!report || !report.id) return;
        
        const isApprovedOrReviewed = report.status === 'approved' || report.status === 'reviewed';
        const msg = isApprovedOrReviewed 
            ? '검토/승인이 취소되고 작성중 상태로 돌아갑니다. 진행하시겠습니까?' 
            : '제출을 취소하고 수정 모드로 전환하시겠습니까?';

        if (!window.confirm(msg)) return;

        const updatedReport = {
            ...report,
            status: 'draft',
            reviewerComment: '',
            approverComment: ''
        };

        try {
            const response = await api.fetch(`/weekly_reports/${report.id}`, {
                method: 'PUT',
                body: updatedReport
            });

        if (response.ok) {
            const savedData = await response.json();
            alert('수정 모드로 전환되었습니다.');
            setReport(savedData); // Update current view immediately
            
            // Update list locally
            setReports(prev => {
                const idx = prev.findIndex(r => r.id === savedData.id);
                if (idx >= 0) {
                    const newReports = [...prev];
                    newReports[idx] = savedData;
                    return newReports;
                }
                return prev;
            });
        }
        } catch (error) {
            console.error('Error resubmitting:', error);
            alert('처리 중 오류가 발생했습니다.');
        }
    };

    const handleDelete = async () => {
        if (!report || !report.id) return;

        if (!window.confirm('정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;

        try {
            const response = await api.fetch(`/weekly_reports/${report.id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                alert('보고서가 삭제되었습니다.');
                // Refresh to blank state
                setReport({
                    authorId: user.id,
                    authorName: user.name,
                    weekStartDate: weekKey,
                    status: 'draft',
                    schedule: [],
                    projects: [],
                    issues: [],
                    samples: []
                });
                fetchReports();
            }
        } catch (error) {
            console.error('Error deleting report:', error);
            alert('삭제 중 오류가 발생했습니다.');
        }
    };

    // Helper to update arrays in report
    // eslint-disable-next-line no-unused-vars
    const updateSection = (section, items) => {
        setReport(prev => ({ ...prev, [section]: items }));
    };

    const addRow = (section, template) => {
        setReport(prev => ({
            ...prev,
            [section]: [...(prev[section] || []), template]
        }));
    };

    const removeRow = (section, index) => {
        setReport(prev => ({
            ...prev,
            [section]: prev[section].filter((_, i) => i !== index)
        }));
    };

    const updateRow = (section, index, field, value) => {
        setReport(prev => {
            const newItems = [...(prev[section] || [])];
            newItems[index] = { ...newItems[index], [field]: value };
            return { ...prev, [section]: newItems };
        });
    };

    // Render logic based on Role
    // Manager/Director View
    if (user && (user.role === 'manager' || user.role === 'director')) {
        // Simple list view for managers to select report
        // For now, let's keep it simple: If looking at own report -> Edit mode
        // If clicking on team member report -> Review mode
        // TO-DO: Implement a "Team Reports" list here. 
        // For this MVP, we will stick to the basic "My Report" view first, adding a "View Team" toggle later if requested.
        // Actually, the requirement implies flow. Let's add a "Team Status" block at the top.
    }

    const renderTeamStatus = () => {
        if (!user || user.role === 'employee') return null;

        const teamReports = reports.filter(r => r.weekStartDate === weekKey);

        return (
            <div className="mb-8 bg-white p-6 rounded-lg shadow-sm border border-indigo-100">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                    <CheckCircle className="w-5 h-5 mr-2 text-indigo-600" />
                    팀원 보고 현황 ({format(weekStart, 'MM/dd')} ~ {format(weekEnd, 'MM/dd')})
                </h3>
                
                {/* My Report Button for Manager */}
                {isReviewMode && (
                    <div className="mb-4">
                        <button 
                            onClick={handleMyReport}
                            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition shadow-sm"
                        >
                            <FileText className="w-4 h-4 mr-2" />
                            내 보고서 작성하기
                        </button>
                    </div>
                )}
                {teamReports.length === 0 ? (
                    <p className="text-gray-500">제출된 보고서가 없습니다.</p>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {teamReports.map(r => (
                            <div key={r.id} className="border p-4 rounded-lg bg-gray-50 hover:bg-white hover:shadow-md transition cursor-pointer" onClick={() => setReport(r)}>
                                <div className="flex justify-between items-start mb-2">
                                    <span className="font-bold text-gray-700">{r.authorName}</span>
                                    <span className={`px-2 py-1 text-xs rounded-full 
                                        ${r.status === 'submitted' ? 'bg-blue-100 text-blue-700' : 
                                          r.status === 'reviewed' ? 'bg-purple-100 text-purple-700' :
                                          r.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-gray-200'}`}>
                                        {r.status === 'submitted' ? '검토중' : 
                                         r.status === 'reviewed' ? '승인대기중' :
                                         r.status === 'approved' ? '승인됨' : '작성중'}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500">제출: {new Date(r.createdDate).toLocaleDateString()}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    if (!user) return <div className="p-8">로그인이 필요합니다. (사용자 전환을 이용해주세요)</div>;
    if (loading) return <div className="p-8">로딩 중...</div>;

    const isReadOnly = report && report.status !== 'draft' && report.status !== 'rejected' && String(report.authorId) === String(user.id);
    const isReviewMode = report && String(report.authorId) !== String(user.id);
    const canReview = user.role === 'manager' && report?.status === 'submitted';
    // Allow Director to approve. Manager Self-Approval is removed.
    const canApprove = user.role === 'director' && (report?.status === 'reviewed' || report?.status === 'submitted');

    return (
        <div className="p-6 max-w-7xl mx-auto bg-gray-50 min-h-screen">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                    <FileText className="w-8 h-8 mr-3 text-blue-600" />
                    주간 업무 보고
                </h2>
                <div className="flex items-center space-x-4">
                    <button onClick={() => setCurrentDate(subWeeks(currentDate, 1))} className="p-2 hover:bg-gray-200 rounded"><ChevronLeft/></button>
                    <span className="text-lg font-medium">{format(weekStart, 'yyyy-MM-dd')} ~ {format(weekEnd, 'MM/dd')}</span>
                    <button onClick={() => setCurrentDate(addWeeks(currentDate, 1))} className="p-2 hover:bg-gray-200 rounded"><ChevronRight/></button>
                </div>
            </div>

            {renderTeamStatus()}

            {report && (
                <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
                    {/* Header */}
                    <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                                {report.authorName?.[0] || '?'}
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-800">{report.authorName || '사용자'} 주간보고</h3>
                                <p className="text-xs text-gray-500">상태: {
                                    report.status === 'submitted' ? '검토중' : 
                                    report.status === 'reviewed' ? '승인대기중' : 
                                    report.status === 'approved' ? '승인됨' : '작성중'
                                }</p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-2">
                            
                            {/* Draft Author Actions */}
                            {!isReadOnly && !isReviewMode && (
                                <>
                                    <button onClick={() => handleDelete()} className="px-4 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 flex items-center transition-colors">
                                        <Trash2 className="w-4 h-4 mr-2" /> 삭제
                                    </button>
                                    <button onClick={handleLoadPreviousReport} className="px-4 py-2 bg-white text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 flex items-center shadow-sm transition-colors">
                                        <Copy className="w-4 h-4 mr-2" /> 지난주 불러오기
                                    </button>
                                    <button onClick={() => handleSave(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center transition-colors">
                                        <Save className="w-4 h-4 mr-2" /> 임시저장
                                    </button>
                                    <button onClick={() => handleSave(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center shadow-sm transition-colors">
                                        <Send className="w-4 h-4 mr-2" /> 제출하기
                                    </button>
                                </>
                            )}

                            {/* Author Resubmit Action (Approved/Submitted/Reviewed -> Draft) */}
                            {(report.status === 'approved' || report.status === 'submitted' || report.status === 'reviewed') && String(report.authorId) === String(user.id) && (
                                <button onClick={handleResubmit} className="px-4 py-2 bg-orange-100 text-orange-700 border border-orange-200 rounded-lg hover:bg-orange-200 flex items-center transition-colors">
                                    <AlertCircle className="w-4 h-4 mr-2" /> 
                                    {report.status === 'approved' ? '재상신(승인취소)' : '제출취소(수정하기)'}
                                </button>
                            )}

                            {/* Manager/Director Actions */}
                            {canReview && (
                                <button onClick={() => handleApproval('reviewed', '수고했습니다.')} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                                    검토 완료
                                </button>
                            )}
                            {canApprove && (
                                <button onClick={() => handleApproval('approved', '승인합니다.')} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                                    승인
                                </button>
                            )}

                            {/* Admin Force Delete */}
                            {(user.role === 'director' || user.role === 'admin') && report.id && (
                                <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center shadow-sm ml-2" title="관리자 강제 삭제">
                                    <Trash2 className="w-4 h-4 mr-2" /> 강제 삭제
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b">
                        <TabButton id="schedule" current={activeTab} set={setActiveTab} icon={CalendarIcon} label="근태 및 일정" />
                        <TabButton id="projects" current={activeTab} set={setActiveTab} icon={CheckSquare} label="인증 및 프로젝트" />
                        <TabButton id="issues" current={activeTab} set={setActiveTab} icon={AlertTriangle} label="공정 이슈" />
                        <TabButton id="samples" current={activeTab} set={setActiveTab} icon={Package} label="초도품 관리" />
                    </div>

                    {/* Content Area */}
                    <div className="p-6 min-h-[400px]">
                        {activeTab === 'schedule' && (
                            <SectionTable 
                                title="근태 및 일정 관리"
                                headers={['날짜', '시간', '구분', '내용', '비고']}
                                data={report.schedule || []}
                                readOnly={isReadOnly || isReviewMode}
                                onAdd={() => addRow('schedule', { date: format(new Date(), 'yyyy-MM-dd'), time: '09:00', type: '미팅', content: '', note: '' })}
                                onRemove={(i) => removeRow('schedule', i)}
                                renderRow={(item, i) => (
                                    <>
                                        <td>
                                            <input type="date" value={item.date} onChange={(e) => updateRow('schedule', i, 'date', e.target.value)} disabled={isReadOnly || isReviewMode} className="w-full bg-transparent p-1"/>
                                        </td>
                                        <td>
                                            {item.type === '휴가' ? (
                                                <div className="flex items-center justify-center h-full">
                                                    <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded">종일</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center space-x-1">
                                                    <select 
                                                        value={(item.time || '09:00').split(':')[0]} 
                                                        onChange={(e) => {
                                                            const newHour = e.target.value;
                                                            const currentMinute = (item.time || '09:00').split(':')[1] || '00';
                                                            updateRow('schedule', i, 'time', `${newHour}:${currentMinute}`);
                                                        }} 
                                                        disabled={isReadOnly || isReviewMode} 
                                                        className="w-16 bg-transparent p-1 border border-gray-200 rounded text-center focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                    >
                                                        {Array.from({ length: 24 }, (_, k) => String(k).padStart(2, '0')).map(h => (
                                                            <option key={h} value={h}>{h}</option>
                                                        ))}
                                                    </select>
                                                    <span className="text-gray-400">:</span>
                                                    <select 
                                                        value={(item.time || '09:00').split(':')[1]} 
                                                        onChange={(e) => {
                                                            const newMinute = e.target.value;
                                                            const currentHour = (item.time || '09:00').split(':')[0] || '09';
                                                            updateRow('schedule', i, 'time', `${currentHour}:${newMinute}`);
                                                        }} 
                                                        disabled={isReadOnly || isReviewMode} 
                                                        className="w-16 bg-transparent p-1 border border-gray-200 rounded text-center focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                    >
                                                        {['00', '10', '20', '30', '40', '50'].map(m => (
                                                            <option key={m} value={m}>{m}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            <select 
                                                value={item.type} 
                                                onChange={(e) => {
                                                    const newType = e.target.value;
                                                    updateRow('schedule', i, 'type', newType);
                                                    // If changing TO Vacation, optional: set time to default or clear it?
                                                    // For now, we prefer to keep the underlying value or irrelevant.
                                                    // But sorting logic might prefer Vacation to be sorted first.
                                                    if (newType === '휴가') {
                                                        // Set time to 00:00 to ensure it sorts correctly
                                                        updateRow('schedule', i, 'time', '00:00');
                                                    }
                                                }} 
                                                disabled={isReadOnly || isReviewMode} 
                                                className="w-full bg-transparent p-1"
                                            >
                                                <option>미팅</option>
                                                <option>외근</option>
                                                <option>휴가</option>
                                                <option>조퇴</option>
                                                <option>교육</option>
                                                <option>기타</option>
                                            </select>
                                        </td>
                                        <td>
                                            <input type="text" value={item.content} onChange={(e) => updateRow('schedule', i, 'content', e.target.value)} disabled={isReadOnly || isReviewMode} className="w-full bg-transparent p-1" placeholder="일정 내용"/>
                                        </td>
                                        <td>
                                            <input type="text" value={item.note} onChange={(e) => updateRow('schedule', i, 'note', e.target.value)} disabled={isReadOnly || isReviewMode} className="w-full bg-transparent p-1" placeholder="비고"/>
                                        </td>
                                    </>
                                )}
                            />
                        )}

                        {activeTab === 'projects' && (
                            <SectionTable 
                                title="인증 및 프로젝트 진행 현황"
                                headers={['항목명', '진행상태', '세부내용', '비고']}
                                data={report.projects || []}
                                readOnly={isReadOnly || isReviewMode}
                                onAdd={() => addRow('projects', { title: '', status: '진행중', content: '', note: '' })}
                                onRemove={(i) => removeRow('projects', i)}
                                renderRow={(item, i) => (
                                    <>
                                        <td><input type="text" value={item.title} onChange={(e) => updateRow('projects', i, 'title', e.target.value)} disabled={isReadOnly || isReviewMode} className="w-full bg-transparent p-1" placeholder="프로젝트명"/></td>
                                        <td><input type="text" value={item.status} onChange={(e) => updateRow('projects', i, 'status', e.target.value)} disabled={isReadOnly || isReviewMode} className="w-full bg-transparent p-1"/></td>
                                        <td><input type="text" value={item.content} onChange={(e) => updateRow('projects', i, 'content', e.target.value)} disabled={isReadOnly || isReviewMode} className="w-full bg-transparent p-1"/></td>
                                        <td><input type="text" value={item.note} onChange={(e) => updateRow('projects', i, 'note', e.target.value)} disabled={isReadOnly || isReviewMode} className="w-full bg-transparent p-1"/></td>
                                    </>
                                )}
                            />
                        )}

                        {activeTab === 'issues' && (
                             <SectionTable 
                                title="공정 이슈 및 불량 현황"
                                headers={['이슈명', '진행상태', '원인 및 대책', '비고']}
                                data={report.issues || []}
                                readOnly={isReadOnly || isReviewMode}
                                onAdd={() => addRow('issues', { title: '', status: '조치중', content: '', note: '' })}
                                onRemove={(i) => removeRow('issues', i)}
                                renderRow={(item, i) => (
                                    <>
                                        <td><input type="text" value={item.title} onChange={(e) => updateRow('issues', i, 'title', e.target.value)} disabled={isReadOnly || isReviewMode} className="w-full bg-transparent p-1" placeholder="이슈 내용"/></td>
                                        <td>
                                            <select value={item.status} onChange={(e) => updateRow('issues', i, 'status', e.target.value)} disabled={isReadOnly || isReviewMode} className="w-full bg-transparent p-1">
                                                <option>발생</option>
                                                <option>조치중</option>
                                                <option>완료</option>
                                                <option>모니터링</option>
                                            </select>
                                        </td>
                                        <td><input type="text" value={item.content} onChange={(e) => updateRow('issues', i, 'content', e.target.value)} disabled={isReadOnly || isReviewMode} className="w-full bg-transparent p-1"/></td>
                                        <td><input type="text" value={item.note} onChange={(e) => updateRow('issues', i, 'note', e.target.value)} disabled={isReadOnly || isReviewMode} className="w-full bg-transparent p-1"/></td>
                                    </>
                                )}
                            />
                        )}

                        {activeTab === 'samples' && (
                            <SectionTable 
                                title="초도품 및 Sample 관리"
                                headers={['품목명', '진행률', '승인상태', '비고']}
                                data={report.samples || []}
                                readOnly={isReadOnly || isReviewMode}
                                onAdd={() => addRow('samples', { itemName: '', progress: '', status: '검토중', note: '' })}
                                onRemove={(i) => removeRow('samples', i)}
                                renderRow={(item, i) => (
                                    <>
                                        <td><input type="text" value={item.itemName} onChange={(e) => updateRow('samples', i, 'itemName', e.target.value)} disabled={isReadOnly || isReviewMode} className="w-full bg-transparent p-1" placeholder="품목명"/></td>
                                        <td><input type="text" value={item.progress} onChange={(e) => updateRow('samples', i, 'progress', e.target.value)} disabled={isReadOnly || isReviewMode} className="w-full bg-transparent p-1" placeholder="예: 50%"/></td>
                                        <td><input type="text" value={item.status} onChange={(e) => updateRow('samples', i, 'status', e.target.value)} disabled={isReadOnly || isReviewMode} className="w-full bg-transparent p-1"/></td>
                                        <td><input type="text" value={item.note} onChange={(e) => updateRow('samples', i, 'note', e.target.value)} disabled={isReadOnly || isReviewMode} className="w-full bg-transparent p-1"/></td>
                                    </>
                                )}
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const TabButton = ({ id, current, set, icon: Icon, label }) => (
    <button 
        onClick={() => set(id)}
        className={`flex-1 py-4 flex items-center justify-center font-medium transition-colors
            ${current === id ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}
        `}
    >
        <Icon className="w-4 h-4 mr-2" />
        {label}
    </button>
);

const SectionTable = ({ title, headers, data, readOnly, onAdd, onRemove, renderRow }) => (
    <div>
        <div className="flex justify-between items-center mb-4">
            <h4 className="text-lg font-bold text-gray-700">{title}</h4>
            {!readOnly && (
                <button onClick={onAdd} className="flex items-center px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded text-sm transition-colors">
                    <Plus className="w-3 h-3 mr-1" /> 추가
                </button>
            )}
        </div>
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                        {headers.map((h, i) => <th key={i} className="px-4 py-3 text-left font-medium text-gray-500">{h}</th>)}
                        {!readOnly && <th className="w-10"></th>}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {data.length === 0 ? (
                        <tr><td colSpan={headers.length + 1} className="px-4 py-8 text-center text-gray-400">등록된 데이터가 없습니다.</td></tr>
                    ) : (
                        data.map((item, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                                {renderRow(item, i)}
                                {!readOnly && (
                                    <td className="px-4 text-center">
                                        <button onClick={() => onRemove(i)} className="text-gray-400 hover:text-red-500 p-1">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                )}
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    </div>
);

// Lucide icon imports needs to be handled if not using lucide-react in App.jsx (already using it in Sidebar)
function ChevronLeft(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  )
}

function ChevronRight(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

export default WeeklyReport;
