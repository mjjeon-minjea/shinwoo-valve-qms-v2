import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase, USER_PUBLIC_COLUMNS } from '../lib/api';
const DEFAULT_USER_ROLE = 'employee';

const UserContext = createContext();

export const UserProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // 🚨 [HOTFIX] 탭 전환 시 Stale Closure로 인한 로딩(Unmount) 붕괴 방지 물리 메모리
    const userRef = useRef(null);
    useEffect(() => {
        userRef.current = user;
    }, [user]);

    // [핵심 변경] 로컬스토리지 야매 폐기, 공식 세션 리스너(onAuthStateChange) 부활!
    // [핵심 변경] 로컬스토리지 야매 폐기, 공식 세션 리스너(onAuthStateChange) 부활!
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) fetchUserProfile(session.user);
            else { setUser(null); setLoading(false); }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (session) {
                // 🚨 [HOTFIX] user 변수 대신 userRef.current 물리 메모리를 참조하여 무조건 로딩 바운스(Skip) 방어
                const skip = (event === 'TOKEN_REFRESHED' || !!userRef.current);
                fetchUserProfile(session.user, skip);
            } else {
                setUser(null);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    async function fetchUserProfile(authUser, skipLoading = false) {
        if (!skipLoading) setLoading(true);
        try {
            // [P2 완성] auth_id 컬럼 기반 조회로 전환 (email 의존 제거)
            const { data: profile, error } = await supabase.from('users').select(USER_PUBLIC_COLUMNS).eq('auth_id', authUser.id).single();
            if (error || !profile || profile.status !== 'Active') throw new Error('승인된 정확한 Auth 연결이 필요합니다.');
            const finalUser = {
                ...profile,
                id: authUser.id, // 진짜 Auth UUID 부여
                profileId: profile.id,
                isAdmin: profile.is_admin === true
            };
            setUser(finalUser);
        } catch (err) {
            console.error('Error fetching user profile:', err);
            setUser(null);
        } finally {
            if (!skipLoading) setLoading(false);
        }
    }

    const login = async (rawEmail, password) => {
        setLoading(true);
        const email = rawEmail.includes('@') ? rawEmail : `${rawEmail}@shinwoovalve.com`;
        
        try {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error || !data?.user) throw new Error('아이디 또는 비밀번호가 올바르지 않습니다.');
            return { user: data.user };
        } finally { setLoading(false); }
    };

    const logout = async () => {
        setLoading(true);
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
            id: authData.user?.id,
            auth_id: authData.user?.id,
            email, name: profileData.name,
            company: profileData.company || '품질보증부',
            rank: profileData.rank || '사원',
            role: DEFAULT_USER_ROLE, status: 'Pending',
            date: new Date().toISOString().split('T')[0]
        };
        if (!authData.user?.id || !authData.session) {
            setLoading(false);
            throw new Error('Auth 가입 확인 대기: 자동 재가입하지 말고 관리자에게 연결을 요청하세요.');
        }
        const { error: dbError } = await supabase.from('users').insert([newUserProfile]);
        
        setLoading(false);
        if (dbError) throw dbError;
        return { user: authData.user };
    };


    return (
        <UserContext.Provider value={{ user, login, logout, signup, loading }}>
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
