import React, { useState } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import Dashboard from './components/Dashboard';
import Chatbot from './components/Chatbot';
import { api } from './lib/api';

import { Routes, Route } from 'react-router-dom';
import InspectionAnalysisDashboard from './components/InspectionAnalysisDashboard';
import QualificationExam from './components/QualificationExam';

import { UserProvider, useUser } from './contexts/UserContext';


// User Switcher Component (Temporary for testing)
const UserSwitcher = () => {
    const { user, users, login } = useUser();
    if (!user) return null;
    return (
        <div className="fixed bottom-4 right-4 bg-white p-3 rounded-lg shadow-xl border border-gray-200 z-50 flex flex-col gap-2">
            <span className="text-xs font-bold text-gray-500">테스트용 사용자 전환</span>
            <select 
                value={user.id} 
                onChange={(e) => login(e.target.value)}
                className="text-sm border rounded p-1"
            >
                {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role || '사원'})</option>
                ))}
            </select>
        </div>
    );
};

function App() {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);

    // Initialize with safe default or localStorage data to prevent blank screen
    const [users, setUsers] = useState(() => {
        const savedUsers = localStorage.getItem('app_users');
        return savedUsers ? JSON.parse(savedUsers) : [
            { id: 1, name: '전민재', company: '품질보증부', rank: '과장', role: 'manager', email: 'mjjeon@shinwoovalve.com', password: '1', date: '2025-12-30', status: 'Active' },
            // { id: 4, name: '김철수', company: '품질보증부', rank: '과장', role: 'manager', email: 'cskim@shinwoovalve.com', password: '11', date: '2026-02-04', status: 'Active' },
            { id: 2, name: '손양수', company: '품질보증부', rank: '부장', role: 'director', email: 'ysson@shinwoovalve.com', password: '111', date: '2025-12-30', status: 'Active' },
            { id: 3, name: '오민석', company: '품질보증부', rank: '이사', role: 'director', email: 'msoh@shinwoovalve.com', password: '1111', date: '2025-12-30', status: 'Active' },
        ];
    });

    // API URL - Proxy handled (works for local and tunnel)
    const API_URL = '/users';

    const fetchUsers = async () => {
        try {
            const response = await api.fetch(API_URL);
            if (!response.ok) throw new Error('Server not ready');
            const data = await response.json();
            if (Array.isArray(data)) {
                setUsers(data);
            }
        } catch (error) {
            console.log('API Server inaccessible, keeping local/default data.');
            // No action needed; we already have default data in state
        }
    };

    // Fetch users from API on load and poll every 2 seconds
    React.useEffect(() => {
        fetchUsers();
        const interval = setInterval(fetchUsers, 2000);
        return () => clearInterval(interval);
    }, []);

    const handleLogin = (identifier, password) => {
        // Handle Admin Login (explicit or via credentials)
        if (identifier === true || (identifier?.trim() === 'jmj4007' && password?.trim() === '880228')) {
            setIsLoggedIn(true);
            setIsAdmin(true);
            setCurrentUser({ name: '관리자', email: 'admin', company: 'System', isAdmin: true });
            return;
        }

        // Check for matching user from loaded users
        const cleanIdentifier = identifier?.trim();
        const cleanPassword = password?.trim();

        const user = users.find(u => u.email === cleanIdentifier && u.password === cleanPassword);

        if (user) {
            if (user.status !== 'Active') {
                alert('계정이 승인 대기 중이거나 비활성화 상태입니다.\n관리자 승인 후 로그인할 수 있습니다.');
                return;
            }
            setIsLoggedIn(true);
            setIsAdmin(false);
            setCurrentUser(user);
        } else {
            alert('이메일 또는 비밀번호가 올바르지 않습니다.\n(입력하신 정보: ' + cleanIdentifier + ')');
        }
    };

    const handleSignup = async (userData) => {
        const newUser = {
            ...userData,
            id: Date.now(), // json-server generates IDs but we can control them to be safe
            date: new Date().toISOString().split('T')[0],
            status: 'Pending' // Default to Pending for admin approval
        };

        try {
            await api.fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: newUser
            });
            await fetchUsers(); // Refresh list
            alert('회원가입이 완료되었습니다!\n관리자 승인 후 로그인 가능합니다.');
        } catch (error) {
            alert('회원가입 실패: ' + error.message);
        }
    };

    const handleAddMember = async (newUser) => {
        const memberData = {
            ...newUser,
            id: Date.now(),
            date: new Date().toISOString().split('T')[0],
            status: 'Active'
        };
        try {
            await api.fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: memberData
            });
            await fetchUsers(); // Refresh list
        } catch (error) {
            alert('추가 실패: ' + error.message);
        }
    };

    const handleDeleteUser = async (id) => {
        if (window.confirm('정말 이 회원을 삭제하시겠습니까?')) {
            try {
                await api.fetch(`${API_URL}/${id}`, {
                    method: 'DELETE',
                });
                await fetchUsers(); // Refresh list
            } catch (error) {
                alert('삭제 실패: ' + error.message);
            }
        }
    };

    const handleEditUser = async (updatedUser) => {
        try {
            await api.fetch(`${API_URL}/${updatedUser.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: updatedUser
            });
            await fetchUsers(); // Refresh list

            // If the edited user is the current user, update currentUser as well
            if (currentUser && currentUser.id === updatedUser.id) {
                setCurrentUser(updatedUser);
            }
        } catch (error) {
            alert('수정 실패: ' + error.message);
        }
    };

    const handleLogout = () => {
        setIsLoggedIn(false);
        setIsAdmin(false);
        setCurrentUser(null);
    };

    const handleUpdateProfile = (updatedData) => {
        if (!currentUser) return;
        const updatedUser = { ...currentUser, ...updatedData };
        handleEditUser(updatedUser);
        alert('프로필이 수정되었습니다.');
    };

    return (
        <UserProvider>
            <div className="min-h-screen flex flex-col">
                <UserSwitcher />
                <Routes>
                    <Route path="/exam" element={<QualificationExam />} />

                    <Route path="/" element={
                        <>
                            <Header isLoggedIn={isLoggedIn} onLogout={handleLogout} currentUser={currentUser} onUpdateProfile={handleUpdateProfile} />
                            <main className="flex-grow">
                                {isLoggedIn ? (
                                    <Dashboard
                                        user={currentUser}
                                        isAdmin={isAdmin}
                                        members={users}
                                        onDeleteMember={handleDeleteUser}
                                        onEditMember={handleEditUser}
                                        onAddMember={handleAddMember}
                                        onRefresh={fetchUsers}
                                    />
                                ) : (
                                    <Hero onLogin={handleLogin} onSignup={handleSignup} />
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
                            <Header isLoggedIn={isLoggedIn} onLogout={handleLogout} currentUser={currentUser} onUpdateProfile={handleUpdateProfile} />
                            <div className="p-8 bg-slate-50 min-h-screen">
                                <InspectionAnalysisDashboard />
                            </div>
                         </>
                    } />
                </Routes>
            </div>
        </UserProvider>
    );
}

export default App;
