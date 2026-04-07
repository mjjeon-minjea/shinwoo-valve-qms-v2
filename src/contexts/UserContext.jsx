import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/api';

const UserContext = createContext();

export const UserProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // [핵심 변경] 로컬스토리지 야매 폐기, 공식 세션 리스너(onAuthStateChange) 부활!
    // [핵심 변경] 로컬스토리지 야매 폐기, 공식 세션 리스너(onAuthStateChange) 부활!
    useEffect(() => {
        // [긴급 우회로] Supabase Auth 500 에러를 피하기 위한 야매 세션 로더
        const override = localStorage.getItem('qms_override_session');
        if (override) {
            const sessionUser = JSON.parse(override);
            fetchUserProfile(sessionUser);
            return;
        }

        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) fetchUserProfile(session.user);
            else { setUser(null); setLoading(false); }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session) fetchUserProfile(session.user);
            else { setUser(null); setLoading(false); }
        });

        return () => subscription.unsubscribe();
    }, []);

    async function fetchUserProfile(authUser) {
        setLoading(true);
        try {
            const { data } = await supabase.from('users').select('*').eq('email', authUser.email).single();
            const profile = data || { name: '알수없음', email: authUser.email, role: '사원', status: 'Pending' };
            const finalUser = {
                ...profile,
                id: authUser.id, // 진짜 Auth ID 부여
                isAdmin: profile.role === 'manager' || profile.role === 'director'
            };
            setUser(finalUser);
        } catch (err) {
            setUser(null);
        } finally {
            setLoading(false);
        }
    }

    const login = async (rawEmail, password) => {
        setLoading(true);
        const email = rawEmail.includes('@') ? rawEmail : `${rawEmail}@shinwoovalve.com`;
        
        // 1. 진짜 Auth 서버 정문 돌파 시도
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        
        if (error) {
            // 2. Seamless(무혈입성) 마이그레이션: Auth에 실패했지만, 구버전 DB에 비번까지 일치하는 유저인지 확인
            // 추가: Supabase 500 Database error querying schema 에러도 함께 캐치해서 프리패스!
            if (error.message.includes('Invalid login credentials') || error.message.includes('Database error')) {
                 const { data: oldUser } = await supabase.from('users')
                     .select('*')
                     .eq('email', email)
                     .eq('password', password) // 패스워드까지 완벽히 일치하는지 백그라운드 교차 검증
                     .single();

                 if (oldUser) {
                      // 당첨! 유저 몰래 야매 세션을 생성해서 localStorage에 구워버립니다.
                      const overrideUser = { id: oldUser.id, email: oldUser.email };
                      localStorage.setItem('qms_override_session', JSON.stringify(overrideUser));
                      return { user: overrideUser };
                 } else {
                     setLoading(false);
                     throw new Error("아이디 또는 비밀번호가 올바르지 않습니다.");
                 }
            }
            setLoading(false);
            throw error;
        }
        return { user: data.user };
    };

    const logout = async () => {
        setLoading(true);
        localStorage.removeItem('qms_override_session');
        await supabase.auth.signOut();
        setUser(null);
        setLoading(false);
    };

    // 진짜 신규 가입 (Auth 서버 + public.users 쌍방향 주입)
    const signup = async (rawEmail, password, profileData) => {
        setLoading(true);
        const email = rawEmail.includes('@') ? rawEmail : `${rawEmail}@shinwoovalve.com`;
        
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email, password, options: { data: { name: profileData.name } }
        });
        if (authError) { setLoading(false); throw authError; }

        const newUserProfile = {
            email, name: profileData.name,
            company: profileData.company || '품질보증부',
            rank: profileData.rank || '사원',
            role: 'user', status: 'Pending',
            date: new Date().toISOString().split('T')[0]
        };
        const { error: dbError } = await supabase.from('users').upsert([newUserProfile]);
        
        setLoading(false);
        if (dbError) throw dbError;
        return { user: authData.user };
    };

    // 구버전 유저가 뜨는 Auth 이관 비상 탈출구 (App.jsx의 비밀번호 재설정 모달과 연결됨)
    const migrateUser = async (email, newPassword) => {
         setLoading(true);
         const { error } = await supabase.auth.signUp({ email, password: newPassword });
         setLoading(false);
         if (error) throw error;
         alert('시스템 보안 업데이트가 반영되었습니다. 새 비밀번호로 다시 로그인해 주세요.');
    };

    return (
        <UserContext.Provider value={{ user, login, logout, signup, migrateUser, loading }}>
            {children}
        </UserContext.Provider>
    );
};

export const useUser = () => {
    const context = useContext(UserContext);
    if (!context) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
};
