import { useState, useEffect } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import Dashboard from './components/Dashboard';
import Chatbot from './components/Chatbot';
import { supabase, USER_PUBLIC_COLUMNS } from './lib/api';

import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import QualificationExam from './components/QualificationExam';
import PasswordChangeModal from './components/PasswordChangeModal';

import { UserProvider, useUser } from './contexts/UserContext';

// AppContent uses the UserContext to manage UI state
const AppContent = () => {
    const { user, login, logout, signup, loading: authLoading } = useUser();
    const navigate = useNavigate();
    
    // 🚨 Session Storage 연동: F5 새로고침 우회 원천 차단
    const [forcePasswordChange, setForcePasswordChange] = useState(() => {
        return sessionStorage.getItem('force_pw_change') === 'true';
    });

    // User management state for Dashboard admin view
    const [users, setUsers] = useState([]);


    // Login attempts state
    const [loginAttempts, setLoginAttempts] = useState(0);

    const fetchAllUsers = async () => {
        try {
            const { data, error } = await supabase.from('users').select(USER_PUBLIC_COLUMNS).order('id', { ascending: true });
            if (!error && data) {
                setUsers(data);
            }
        } catch (error) {
            console.error('Failed to fetch users:', error);
        }
    };

    // Only load all users if the logged-in user is an admin
    useEffect(() => {
        if (user?.isAdmin) {
             fetchAllUsers();
        }
    }, [user?.id, user?.isAdmin]);

    const handleLogin = async (email, password) => {
        if (loginAttempts >= 5) {
            alert('비밀번호 5회 연속 오류로 인해 보안상 로그인이 차단되었습니다.\n부서 관리자에게 문의해 주세요.');
            return;
        }

        try {
            await login(email, password);
            setLoginAttempts(0); // Reset on success
            
            // 🚨 초기비밀번호('123456') 감지 시 브라우저 메모리에 각인
            if (password === '123456') {
                sessionStorage.setItem('force_pw_change', 'true');
                setForcePasswordChange(true);
            }
        } catch (err) {
            setLoginAttempts(prev => prev + 1);
            alert('로그인 실패: ' + (err.message || '인증에 실패했습니다.'));
        }
    };

    const handleSignup = async (userData) => {
        try {
            await signup(userData.email, userData.password, userData);
            alert('회원가입이 완료되었습니다!\n승인 후 로그인 가능합니다.');
            if (user?.isAdmin) fetchAllUsers();
        } catch (err) {
            alert('회원가입 실패: ' + err.message);
        }
    };

    const handleLogout = async () => {
        try {
            await logout();
        } catch (err) {
            console.error('Logout error:', err);
        }
    };

    const handlePasswordChangeComplete = async () => {
        await handleLogout();
        sessionStorage.removeItem('force_pw_change');
        setForcePasswordChange(false);
        navigate('/', { replace: true }); 
    };

    const handleUpdateProfile = async (updatedData) => {
        if (!user) return false;
        try {
            // 부서·승인상태·비밀번호는 프로필 저장 payload에서 제외한다.
            const isPasswordChange = !!updatedData.password?.trim();
            const profilePayload = { name: updatedData.name, rank: updatedData.rank };
            const { data, error } = await supabase.from('users').update(profilePayload).eq('auth_id', user.id).select('auth_id');
            if (error) throw error;
            if (data?.length !== 1) throw new Error('프로필 갱신 대상이 확인되지 않았습니다.');

            if (isPasswordChange) {
                const newPassword = updatedData.password.trim();
                const { error: authError } = await supabase.auth.updateUser({ password: newPassword });
                if (authError) {
                    alert('프로필은 저장됐지만 비밀번호 변경은 실패했습니다. 이전 시도에서 비밀번호가 이미 바뀌었을 수 있으니 로그인 상태를 확인하고, 불확실하면 관리자에게 문의하세요.\n' + authError.message);
                    return false;
                }
            }

            alert(isPasswordChange
                ? '프로필 및 비밀번호가 수정되었습니다. 다음 로그인부터 새 비밀번호를 사용하세요.'
                : '프로필이 수정되었습니다. (새로고침 시 반영)');
            return true;
        } catch (err) {
            alert('수정 실패: ' + err.message);
            return false;
        }
    };

    // Dashboard User Control Functions
    const handleAddMember = async () => { alert('보호된 Auth 연결 이관으로만 등록합니다.'); return false; };
    const handleDeleteUser = async () => { alert('기존 업무 참조 보존: 삭제 불가'); return false; };

    const handleEditUser = async (updatedUser) => {
        try {
            // 비밀번호 변경 여부 파악 (빈 문자열이 아니면 변경 대상)
            const isPasswordChange = updatedUser.password && updatedUser.password.trim() !== '';

            {
                // 빈 비밀번호도 같은 검증 API로 처리한다.
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) throw new Error("유효한 세션이 없습니다.");
                
                // 2. 로컬 Express API 서버(server.js POST /api/admin-update-member) 호출
                const response = await fetch('/api/admin-update-member', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`
                    },
                    body: JSON.stringify({
                        auth_id: updatedUser.auth_id,
                        ...(isPasswordChange ? { password: updatedUser.password.trim() } : {}),
                        name: updatedUser.name,
                        role: updatedUser.role,
                        rank: updatedUser.rank,
                        company: updatedUser.company,
                        status: updatedUser.status
                    })
                });
                
                const responseData = await response.json();
                if (!response.ok) {
                    throw new Error(responseData.error || 'Serverless API 요청 중 오류가 발생했습니다.');
                }
            }

            await fetchAllUsers();
            alert('회원 정보가 성공적으로 수정되었습니다.');
            return true;
        } catch (error) {
            alert('수정 실패: ' + error.message);
            return false;
        }
    };

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-xl font-medium text-slate-500 animate-pulse">인증 정보를 불러오는 중입니다...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col">
            {forcePasswordChange && <PasswordChangeModal onComplete={handlePasswordChangeComplete} />}

            <Routes>
                <Route path="/exam" element={<QualificationExam />} />
                <Route path="/" element={
                    <>
                        <Header isLoggedIn={!!user} onLogout={handleLogout} currentUser={user} onUpdateProfile={handleUpdateProfile} />
                        <main className="flex-grow">
                            {user ? (
                                <Dashboard
                                    user={user}
                                    isAdmin={user.isAdmin}
                                    members={users}
                                    onDeleteMember={handleDeleteUser}
                                    onEditMember={handleEditUser}
                                    onAddMember={handleAddMember}
                                    onRefresh={fetchAllUsers}
                                />
                            ) : (
                                <Hero 
                                    onLogin={handleLogin} 
                                    onSignup={handleSignup} 

                                />
                            )}
                            <Chatbot />
                        </main>
                        <footer className="bg-slate-50 border-t border-slate-200 py-6 text-center text-sm text-slate-500">
                            © {new Date().getFullYear()} (주)신우밸브. All rights reserved.
                        </footer>
                    </>
                } />
                {/* 042 P8 — 구 「종합분석현황」 주소는 새 대시보드로 넘긴다.
                    히스토리에 남기지 않는다(replace) — 뒤로가기로 없어진 화면에 다시 들어가면 안 된다. */}
                <Route path="/inspection-analysis" element={<Navigate to="/#inbound_overview" replace />} />
                {/* 073 — 없는 주소(예: /abc)는 첫 화면으로. 흰 화면 방지 · 해시 탭(#ncr_ledger 등)은 "/" 안에서 처리 */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </div>
    );
};

// Root App Component
function App() {
    return (
        <UserProvider>
            <AppContent />
        </UserProvider>
    );
}

export default App;
