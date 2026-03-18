import { useState, useEffect } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import Dashboard from './components/Dashboard';
import Chatbot from './components/Chatbot';
import { supabase } from './lib/api';

import { Routes, Route } from 'react-router-dom';
import InspectionAnalysisDashboard from './components/InspectionAnalysisDashboard';
import QualificationExam from './components/QualificationExam';

import { UserProvider, useUser } from './contexts/UserContext';

// AppContent uses the UserContext to manage UI state
const AppContent = () => {
    const { user, login, logout, signup, loading: authLoading, migrateUser } = useUser();
    
    // User management state for Dashboard admin view
    const [users, setUsers] = useState([]);

    // Migration state
    const [migrationState, setMigrationState] = useState(null);

    // Login attempts state
    const [loginAttempts, setLoginAttempts] = useState(0);

    const fetchAllUsers = async () => {
        try {
            const { data, error } = await supabase.from('users').select('*').order('id', { ascending: true });
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
        } catch (err) {
            if (err.code === 'MIGRATION_REQUIRED') {
                setMigrationState({ email: err.legacyEmail });
            } else {
                setLoginAttempts(prev => prev + 1);
                const remaining = Math.max(0, 4 - loginAttempts);
                
                if (remaining === 0) {
                    alert('비밀번호를 5회 잘못 입력하셨습니다.\n보안 조치로 인해 로그인이 일시 차단됩니다. 관리자에게 문의해주세요.');
                } else {
                    alert(`로그인 실패: ${err.message || '이메일 또는 비밀번호가 올바르지 않습니다.'}\n\n⚠️ 주의: 앞으로 ${remaining}회 더 실패 시 계정이 차단됩니다.`);
                }
            }
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

    const handleUpdateProfile = async (updatedData) => {
        if (!user) return;
        try {
            const { error } = await supabase.from('users').update(updatedData).eq('email', user.email);
            if (error) throw error;
            alert('프로필이 수정되었습니다. (새로고침 시 반영)');
        } catch (err) {
            alert('수정 실패: ' + err.message);
        }
    };

    // Dashboard User Control Functions
    const handleAddMember = async (newUser) => {
        const memberData = {
            ...newUser,
            date: new Date().toISOString().split('T')[0],
            status: 'Active'
        };
        try {
            const { error } = await supabase.from('users').insert([memberData]);
            if (error) throw error;
            await fetchAllUsers(); 
        } catch (error) {
            alert('회원 추가 실패: ' + error.message);
        }
    };

    const handleDeleteUser = async (id) => {
        if (window.confirm('정말 이 회원을 삭제하시겠습니까?')) {
            try {
                const { error } = await supabase.from('users').delete().eq('id', id);
                if (error) throw error;
                await fetchAllUsers(); 
            } catch (error) {
                alert('삭제 실패: ' + error.message);
            }
        }
    };

    const handleEditUser = async (updatedUser) => {
        try {
            // Remove the 'id' before update to avoid mutating primary key
            const { id, ...updatePayload } = updatedUser;
            const { error } = await supabase.from('users').update(updatePayload).eq('id', id);
            if (error) throw error;
            await fetchAllUsers();
        } catch (error) {
            alert('수정 실패: ' + error.message);
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
                                    migrationState={migrationState}
                                    onMigrate={migrateUser}
                                    onCancelMigration={() => setMigrationState(null)}
                                />
                            )}
                            <Chatbot />
                        </main>
                        <footer className="bg-slate-50 border-t border-slate-200 py-6 text-center text-sm text-slate-500">
                            © {new Date().getFullYear()} (주)신우밸브. All rights reserved.
                        </footer>
                    </>
                } />
                <Route path="/inspection-analysis" element={
                     <>
                        <Header isLoggedIn={!!user} onLogout={handleLogout} currentUser={user} onUpdateProfile={handleUpdateProfile} />
                        <div className="p-8 bg-slate-50 min-h-screen">
                            <InspectionAnalysisDashboard />
                        </div>
                     </>
                } />
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
