import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/api';

const UserContext = createContext();

export const UserProvider = ({ children }) => {
    // Session state
    const [user, setUser] = useState(null); // Auth user + profile table data
    const [loading, setLoading] = useState(true);

    // Initial auth state check and listener setup
    useEffect(() => {
        // Emergency Failsafe: 토큰 로딩 중 Supabase 통신이 3초 이상 멈추면 무한 로딩 강제 해제
        const emergencyTimer = setTimeout(() => {
            setLoading(false);
        }, 3000);

        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                fetchUserProfile(session.user);
            } else {
                setUser(null);
                setLoading(false);
            }
        }).catch(err => {
            console.error('Session retrieval error:', err);
            setUser(null);
            setLoading(false);
        });

        // Listen for auth changes (login, logout)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (_event, session) => {
                if (session?.user) {
                    await fetchUserProfile(session.user);
                } else {
                    setUser(null);
                    setLoading(false);
                }
            }
        );

        return () => {
            clearTimeout(emergencyTimer);
            subscription.unsubscribe();
        };
    }, []);

    // Fetch extra profile data from 'users' table based on Auth UID or email
    async function fetchUserProfile(authUser) {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('email', authUser.email)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error('Error fetching user profile:', error);
            }

            // Combine auth user data with public profile data
            const profile = data || { name: '이름없음', email: authUser.email, role: '사원', status: 'Pending' };
            
            setUser({
                ...authUser,
                ...profile,
                isAdmin: profile.role === 'manager' || profile.role === 'director'
            });
        } catch (err) {
            console.error('Failed to load user profile:', err);
        } finally {
            setLoading(false);
        }
    }

    // Supabase Auth Login
    const login = async (rawEmail, password) => {
        setLoading(true);
        // 로그인 서버 렉 방지용 긴급 타이머 장착 (5초 후 강제 해제)
        const loginTimer = setTimeout(() => { setLoading(false); }, 5000);
        
        try {
            const email = rawEmail.includes('@') ? rawEmail : `${rawEmail}@shinwoovalve.com`;

            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });
        
        let sessionData = data;
        let sessionError = error;

        // Legacy/Reset Password Migration Logic
        if (error && error.message.includes('Invalid login credentials')) {
            // Check if this user exists in public.users with the matching password via RPC (RLS bypass)
            const { data: hasLegacyPassword, error: rpcError } = await supabase.rpc('check_legacy_password', { 
                 check_email: email, 
                 check_password: password 
            });
            
            // If the RPC isn't deployed yet, fallback to direct query for backward compatibility during transition
            let isLegacyValid = false;
            if (rpcError) {
                 const { data: legacyUsers } = await supabase.from('users').select('*').eq('email', email).eq('password', password);
                 isLegacyValid = legacyUsers && legacyUsers.length > 0;
            } else {
                 isLegacyValid = hasLegacyPassword;
            }

            if (isLegacyValid) {
                 if (password.length < 6) {
                      setLoading(false);
                      const err = new Error("위메프 개인정보보호 캠페인\n비밀번호 변경\n\n고객님께서는 오랜 기간 비밀번호를 변경하지 않으셨습니다.\n안전한 비밀번호 설정방법: 영문, 숫자, 특수문자 조합하여 6~16자");
                      err.code = 'MIGRATION_REQUIRED';
                      err.legacyEmail = email;
                      throw err;
                 }
                 // Try to migrate them properly
                 const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                     email,
                     password
                 });
                 if (signUpError) {
                      setLoading(false);
                      if (signUpError.message.includes('already registered')) {
                           throw new Error("마이그레이션 실패: 이미 연동된 계정입니다.");
                      }
                      throw new Error("마이그레이션 오류: " + signUpError.message);
                 }
                 sessionData = signUpData;
                 sessionError = null;
            }
        }

        if (sessionError) {
            setLoading(false);
            throw sessionError;
        }

        const authData = sessionData;

        // Check user status in db before finalizing login
        if (authData?.user) {
            const { data: profile } = await supabase
                .from('users')
                .select('status')
                .eq('email', email)
                .single();
            
            if (profile && profile.status !== 'Active') {
                await supabase.auth.signOut();
                setUser(null);
                setLoading(false);
                clearTimeout(loginTimer);
                throw new Error("승인 대기 중이거나 비활성 상태의 계정입니다. 관리자 승인 후 로그인해 주세요.");
            }
        }

        clearTimeout(loginTimer);
        // API 직접 수동 로그인 후에는 fetchUserProfile이 트리거 될 때까지 대기하지 않고 직접 false로 풀어줍니다.
        setLoading(false);
        return authData;
        } catch (err) {
            clearTimeout(loginTimer);
            setLoading(false);
            throw err;
        }
    };

    // Supabase Auth Logout
    const logout = async () => {
        setLoading(true);
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error("Logout error:", error);
            setLoading(false);
            throw error;
        }
        setUser(null);
        setLoading(false);
    };

    // Supabase Auth SignUp
    const signup = async (email, password, profileData) => {
        setLoading(true);
        
        // 1. Create Auth user
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password
        });

        if (authError) {
            setLoading(false);
            throw authError;
        }

        // 2. Add extra info to users table
        if (authData?.user) {
            const newUserProfile = {
                // we can map supabase auth id if we altered our schema, but for now map email to be safe
                email: email,
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
                // Non-blocking but should be fixed
            }
        }
        setLoading(false);
        return authData;
    };

    // User self-migration function
    const updatePasswordAndMigrate = async (rawEmail, currentPassword, newPassword) => {
        // 글로벌 로딩 제거 (모달 유지)
        
        // Ensure email format
        const email = rawEmail.includes('@') ? rawEmail : `${rawEmail}@shinwoovalve.com`;

        try {
            // First, login with old password to verify their identity AGAIN before allowing change
            const { data: verifyData, error: verifyError } = await supabase.auth.signInWithPassword({
                email,
                password: currentPassword
            });

            // If old login fails and it's NOT a required migration error, stop
            if (verifyError && !verifyError.message.includes('Invalid login credentials')) {
                 throw new Error("기존 비밀번호 검증 실패: " + verifyError.message);
            }

            // Update user in Supabase Auth (This works if they are already logged in or migrated)
            let signInError = null;
            const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
            
            // If they are not logged in (e.g., first time migration), we need to create them or update them via admin/RPC
            // Since we can't use updateUser without session, we use signUp as a hack to set password if they don't exist
             if (updateError) {
                 const { error: signUpError } = await supabase.auth.signUp({
                     email,
                     password: newPassword
                 });

                 // Supabase returns 'already registered' or throws invalid login if email confirmation is required and user hasn't clicked link.
                 // We will bypass the strict sign in here and rely on the fact we just signed them up or they exist.
                 if (signUpError && signUpError.message.includes('already registered')) {
                      // Attempt to sign in with new password just in case it was already changed
                      const { error: testSignInError } = await supabase.auth.signInWithPassword({
                          email,
                          password: newPassword
                      });
                      // If email confirmation is ON, signIn will fail with "Email not confirmed". We handle this below.
                      if (testSignInError && !testSignInError.message.includes('Email not confirmed')) {
                           throw new Error("비밀번호 변경 권한이 없습니다. (이미 마이그레이션된 계정이거나, 관리자 문의 필요)");
                      }
                 } else if (signUpError) {
                      throw signUpError;
                 }
            }

            // Login with new password to get active session FIRST
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password: newPassword
            });
            if (error) throw error;

            // Now that session is active (RLS passes), sync new password to public.users table
            await supabase.from('users').update({ password: newPassword }).eq('email', email);
            
            // 🔥 마이그레이션 처리 후 명시적 Auth 상태 갱신 (무한루프/정체 방지) 🔥
            if (data?.user) {
                await fetchUserProfile(data.user);
            }

            return data;
        } catch (err) {
            console.error("Migration Error: ", err);
            throw err;
        }
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
