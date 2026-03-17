import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/api';

const UserContext = createContext();

export const UserProvider = ({ children }) => {
    // Session state
    const [user, setUser] = useState(null); // Auth user + profile table data
    const [loading, setLoading] = useState(true);

    // Initial auth state check and listener setup
    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                fetchUserProfile(session.user);
            } else {
                setUser(null);
                setLoading(false);
            }
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

        return () => subscription.unsubscribe();
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
    const login = async (email, password) => {
        setLoading(true);

        // Master Admin Bypass (Temporary fallback for management if Supabase auth is locked)
        if (
            (email === 'jmj4007@shinwoovalve.com' && password === '880228') ||
            (email === 'mjjeon@shinwoovalve.com' && password === '1')
        ) {
             // Fake a session for master admin
             const adminProfile = { name: '최고관리자 (전민재)', email, role: 'manager', isAdmin: true, status: 'Active' };
             setUser(adminProfile);
             setLoading(false);
             return { user: adminProfile };
        }

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
                throw new Error("승인 대기 중이거나 비활성 상태의 계정입니다. 관리자 승인 후 로그인해 주세요.");
            }
        }

        return authData;
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
    const migrateUser = async (email, newPassword) => {
        setLoading(true);
        try {
            // Create user in Supabase Auth
            const { error: signUpError } = await supabase.auth.signUp({
                email,
                password: newPassword
            });
            if (signUpError) {
                if (!signUpError.message.includes('already registered')) {
                     throw signUpError;
                }
            }
            
            // Sync new password to public.users table just in case they revert
            await supabase.from('users').update({ password: newPassword }).eq('email', email);
            
            // Login with new password to get active session
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password: newPassword
            });
            if (error) throw error;
            
            return data;
        } finally {
            setLoading(false);
        }
    };

    return (
        <UserContext.Provider value={{ user, login, logout, signup, migrateUser, loading }}>
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
