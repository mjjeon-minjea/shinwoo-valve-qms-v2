import { createClient } from '@supabase/supabase-js';

// Vercel 환경에서는 일반적인 process.env를 통해 환경 변수를 읽어옵니다.
// Vite 로컬 .env.local과 호환을 위해 VITE_ 접두어가 붙은 변수를 그대로 활용합니다.
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
    // 1. 요청 검증
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'POST 요청만 지원합니다.' });
    }

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
        return res.status(500).json({ error: '백엔드 환경 변수가 완전히 로드되지 않았습니다.' });
    }

    // 2. 관리자 인증 토큰 추출
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: '인증 토큰(JWT)이 누락되었습니다.' });
    }
    const token = authHeader.split(' ')[1];

    // 3. Supabase 클라이언트 초기화 (요청 검증용 일반 / 업데이트용 Service Role)
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    try {
        // 4. 요청을 보낸 주체(관리자) 검증
        const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
        if (userError || !user) {
            return res.status(401).json({ error: '유효하지 않거나 만료된 세션입니다.' });
        }

        // 해당 사용자가 실제로 관리자(차장)인지 DB 확인
        const { data: adminData, error: adminQueryError } = await supabaseAdmin
            .from('users')
            .select('rank, role')
            .eq('auth_id', user.id)
            .single();

        if (adminQueryError || !adminData) {
            return res.status(403).json({ error: '사용자 권한 검증에 실패했습니다.' });
        }

        // "차장" 직급이거나 "director" 롤을 가진 사람만 업데이트 허용
        if (adminData.rank !== '차장' && adminData.role !== 'director') {
            return res.status(403).json({ error: '접근 권한이 없습니다. (인사/관리자 전용 기능)' });
        }

        // 5. 프론트엔드로부터 받은 업데이트 페이로드
        const { auth_id, email, password, name, role, rank, company, status } = req.body;
        
        if (!auth_id) {
            return res.status(400).json({ error: '대상 직원의 식별자(auth_id)가 누락되었습니다.' });
        }

        // 6. Supabase Admin API를 통한 Auth.users 비밀번호 및 메타데이터 갱신
        const authUpdates = {};
        if (password) authUpdates.password = password; // 새 비밀번호가 넘어온 경우만 해시 변경
        if (name) authUpdates.user_metadata = { name };

        const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(
            auth_id,
            authUpdates
        );

        if (updateAuthError) {
            console.error('Auth User Update Error:', updateAuthError);
            return res.status(500).json({ error: `인증 서버 업데이트 실패: ${updateAuthError.message}` });
        }

        // 7. public.users 테이블 정보 동기화 (기초 정보)
        const dbUpdates = {
            name,
            role,
            rank,
            company,
            status,
        };
        // 참고: 보안상 password는 public 테이블에서 제거하는 것이 이상적이나,
        // 기존 시스템(JSON 서버 시절의 컬럼) 레거시 호환을 고려해 일단 덮어씀 (구조 통일)
        if (password) dbUpdates.password = password;

        const { error: dbUpdateError } = await supabaseAdmin
            .from('users')
            .update(dbUpdates)
            .eq('auth_id', auth_id);

        if (dbUpdateError) {
            console.error('DB User Update Error:', dbUpdateError);
            return res.status(500).json({ error: `사용자 DB 업데이트 실패: ${dbUpdateError.message}` });
        }

        // 8. 최종 성공 반환
        return res.status(200).json({ success: true, message: '직원 정보 및 비밀번호가 성공적으로 변경되었습니다.' });

    } catch (error) {
        console.error('Unexpected Backend Error:', error);
        return res.status(500).json({ error: '서버 내부 처리 중 알 수 없는 오류가 발생했습니다.' });
    }
}
