import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/api';

const UserContext = createContext();

export const UserProvider = ({ children }) => {
    // Session state
    const [user, setUser] = useState(null); // Auth user + profile table data
    const [loading, setLoading] = useState(true);

    // Initial auth state check from localStorage
    useEffect(() => {
        const savedSession = sessionStorage.getItem('qms-legacy-user');
        if (savedSession) {
            try {
                const sessionData = JSON.parse(savedSession);
                if (sessionData && sessionData.email) {
                    fetchUserProfile({ email: sessionData.email });
                } else {
                    setUser(null);
                    setLoading(false);
                }
            } catch (err) {
                console.error("Local session parsing error", err);
                setUser(null);
                setLoading(false);
            }
        } else {
            setUser(null);
            setLoading(false);
        }
    }, []);

    // Fetch extra profile data from 'users' table
    async function fetchUserProfile(authUser) {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('email', authUser.email)
                .single();

            if (error) {
                console.error('Error fetching user profile:', error);
                throw error;
            }

            const profile = data || { name: '알수없음', email: authUser.email, role: '사원', status: 'Pending' };
            
            const finalUser = {
                ...profile,
                isAdmin: profile.role === 'manager' || profile.role === 'director'
            };

            setUser(finalUser);
        } catch (err) {
            console.error('Failed to load user profile:', err);
            setUser(null);
            sessionStorage.removeItem('qms-legacy-user');
        } finally {
            setLoading(false);
        }
    }

    // Direct DB Login (초고속 DB 직접 대조)
    const login = async (rawEmail, password) => {
        setLoading(true);
        try {
            const email = rawEmail.includes('@') ? rawEmail : `${rawEmail}@shinwoovalve.com`;

            // DB에서 이메일과 비밀번호가 정확히 일치하는 행을 직접 찾습니다
            const { data, error } = await supabase.from('users').select('*').eq('email', email).eq('password', password);
            
            if (error) throw error;

            if (data && data.length > 0) {
                const loggedInUser = data[0];
                
                if (loggedInUser.status !== 'Active') {
                    throw new Error("승인 대기 중이거나 비활성 상태의 계정입니다. 관리자 승인 후 로그인해 주세요.");
                }
                
                const finalUser = {
                    ...loggedInUser,
                    isAdmin: loggedInUser.role === 'manager' || loggedInUser.role === 'director'
                };
                
                // sessionStorage에 이메일만 저장해두어 새로고침 시 세션 유지 (브라우저 종료 시 만료)
                sessionStorage.setItem('qms-legacy-user', JSON.stringify({ email: loggedInUser.email }));
                setUser(finalUser);
                setLoading(false);
                return { user: finalUser };
            } else {
                throw new Error("Invalid login credentials"); // Hero.jsx 알림창 호환을 위해 에러 메시지 유지
            }
        } catch (err) {
            setLoading(false);
            throw err;
        }
    };

    // Logout
    const logout = async () => {
        setLoading(true);
        sessionStorage.removeItem('qms-legacy-user');
        setUser(null);
        setLoading(false);
    };

    // Direct DB SignUp (Auth 락(Rate Limit) 우회용 직접 가입)
    const signup = async (rawEmail, password, profileData) => {
        setLoading(true);
        try {
            const email = rawEmail.includes('@') ? rawEmail : `${rawEmail}@shinwoovalve.com`;
            
            // 1. 중복 확인
            const { data: existing } = await supabase.from('users').select('id').eq('email', email);
            if (existing && existing.length > 0) {
                throw new Error("이미 등록된 이메일 또는 사번입니다.");
            }

            // 2. Insert into users DB مباشرة
            const newUserProfile = {
                email: email,
                password: password,
                name: profileData.name,
                company: profileData.company || '품질보증부',
                rank: profileData.rank || '사원',
                role: 'user', 
                status: 'Pending',
                date: new Date().toISOString().split('T')[0]
            };

            const { error: dbError } = await supabase.from('users').insert([newUserProfile]);
            
            if (dbError) {
                console.error("Error creating user profile:", dbError);
                throw dbError;
            }

            setLoading(false);
            return { user: newUserProfile };
        } catch (err) {
            setLoading(false);
            throw err;
        }
    };

    // 더미 함수 (기존 App.jsx 및 모달창 에러 방지용)
    const updatePasswordAndMigrate = async () => {
        return null;
    };

    return (
        <UserContext.Provider value={{ user, login, logout, signup, migrateUser: updatePasswordAndMigrate, loading }}>
            {children}
        </UserContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useUser = () => {
    const context = useContext(UserContext);
    if (!context) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
};
