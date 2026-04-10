import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/api';

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
            let { data } = await supabase.from('users').select('*').eq('auth_id', authUser.id).single();
            // fallback: 혹시 auth_id 미매핑된 경우를 대비해 email로 2차 시도
            if (!data) {
                const fallback = await supabase.from('users').select('*').eq('email', authUser.email).single();
                data = fallback.data;
            }
            const profile = data || { name: '알수없음', email: authUser.email, role: '사원', status: 'Pending' };
            const finalUser = {
                ...profile,
                id: authUser.id, // 진짜 Auth UUID 부여
                isAdmin: profile.role === 'manager' || profile.role === 'admin' || profile.role === 'director'
            };
            setUser(finalUser);
        } catch (err) {
            console.error('Error fetching user profile:', err);
            // If it's a background refresh failure, don't necessarily log out the user
            if (!skipLoading) setUser(null); 
        } finally {
            if (!skipLoading) setLoading(false);
        }
    }

    const login = async (rawEmail, password) => {
        setLoading(true);
        const email = rawEmail.includes('@') ? rawEmail : `${rawEmail}@shinwoovalve.com`;
        
        // 1. 진짜 Auth 서버 정문 돌파 시도
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        
        if (error) {
            // 2. Seamless(무혈입성) 마이그레이션: Auth에 실패했지만, 구버전 DB에 비번까지 일치하는 유저인지 확인
            if (error.message.includes('Invalid login credentials')) {
                 const { data: oldUser } = await supabase.from('users')
                     .select('*')
                     .eq('email', email)
                     .eq('password', password) // 패스워드까지 완벽히 일치하는지 백그라운드 교차 검증
                     .single();

                 if (oldUser) {
                      // 당첨! 유저 몰래 그 자리에서 즉시 Auth 서버로 강제 이관 (회원가입 자동화)
                      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                          email,
                          password
                      });
                      
                      if (signUpError) {
                          setLoading(false);
                          throw signUpError; // 만약 Supabase Auth Rate Limit 등 에러가 나면 뱉어냄
                      }
                      
                      // [중요 로직 결함 수정] 신규 Supabase 프로젝트는 '이메일 확인(Confirm email)'이 켜져있어 세션 발급이 안 되고 무한로딩 걸리는 현상 방지!
                      if (!signUpData.session && signUpData.user) {
                          setLoading(false);
                          throw new Error("Supabase 설정 오류: 'Confirm email' 기능이 켜져 있어 로그인이 대기 중입니다. 관리자 대시보드(Authentication -> Providers -> Email)에서 이 기능을 꺼주세요!");
                      }
                      
                      setLoading(false);
                      return { user: signUpData.user };
                 } else {
                     setLoading(false);
                     throw new Error("아이디 또는 비밀번호가 올바르지 않습니다.");
                 }
            }
            setLoading(false);
            throw error;
        }
        
        setLoading(false); // 성공 시에도 반드시 로딩 해제
        return { user: data.user };
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
            auth_id: authData.user?.id, // [P2] Auth UUID 즉시 매핑
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
