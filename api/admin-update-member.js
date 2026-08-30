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

        // 해당 사용자가 시스템 관리자인지 DB 확인
        /* v10.2 관리자 축 분리(260830) — 종전 「직급 차장 OR role director」 판정은
   ①실무 차장(예: 정준길)도 통과시키고 ②NCR 도입으로 director가 늘면 부서장 전원이 통과하며
   ③정작 최고관리자(admin)는 차장도 director도 아니라 차단되는 3중 결함이 있었다.
   시스템 관리자 축(role=admin 또는 is_admin=true)으로만 판정한다.
   select('*') 를 쓰는 이유 — is_admin 컬럼이 아직 없는 DB(코드 선배포)에서 42703으로
   전면 장애가 나지 않게 하기 위함이다. 없으면 undefined→false로 안전하게 떨어진다. */
        const { data: adminData, error: adminQueryError } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('auth_id', user.id)
            .single();

        if (adminQueryError || !adminData) {
            return res.status(403).json({ error: '사용자 권한 검증에 실패했습니다.' });
        }

        if (adminData.is_admin !== true) { // 차장 확정(260830): is_admin 단독 판정
            return res.status(403).json({ error: '접근 권한이 없습니다. (시스템 관리자 전용 기능)' });
        }

        // 5. 프론트엔드로부터 받은 업데이트 페이로드
        const { auth_id, email, password, name, role, rank, company, status, is_admin } = req.body;
        
        if (!auth_id) {
            return res.status(400).json({ error: '대상 직원의 식별자(auth_id)가 누락되었습니다.' });
        }

        /* r8(260830) 보상 원복 — server.js와 동일 규격 (예림 조건 6항):
           사전조회 1행 → 갱신 1행 → Auth 확정 실패 시 사전값 보상 → read-back 일치 시에만 「원복됨」,
           불명확(예외)·보상실패는 HOLD 응답, 원복 전 동시 수정 보호 */
        // 6-0. 대상 행 사전조회 — 정확히 1행이 아니면 변경 없이 중단
        const { data: beforeRows, error: preErr } = await supabaseAdmin
            .from('users').select('*').eq('auth_id', auth_id);
        if (preErr || !beforeRows || beforeRows.length !== 1) {
            return res.status(409).json({ error: '대상 행이 정확히 1행이 아닙니다 — 변경 없이 중단' });
        }
        const beforeRow = beforeRows[0];

        // 6. public.users 테이블 정보 동기화 (선행)
        //    r9: 정의된 필드만 담는다 — undefined 키는 전송되지 않으므로 CAS 원복 필터에서도 제외돼야 한다
        const dbUpdates = {};
        if (name !== undefined) dbUpdates.name = name;
        if (role !== undefined) dbUpdates.role = role;
        if (rank !== undefined) dbUpdates.rank = rank;
        if (company !== undefined) dbUpdates.company = company;
        if (status !== undefined) dbUpdates.status = status;
        if (is_admin !== undefined) dbUpdates.is_admin = is_admin === true; // v10.2 관리자 축
        // 참고: 보안상 password는 public 테이블에서 제거하는 것이 이상적이나,
        // 기존 시스템(JSON 서버 시절의 컬럼) 레거시 호환을 고려해 일단 덮어씀 (제거는 별건)
        if (password) dbUpdates.password = password;

        /* r9(260830) — server.js와 동일 규격: 오류 분류(확정/불확실) + 원자적 CAS 원복 */
        // code 가 SQLSTATE(5자리)나 PGRST 코드일 때만 「DB가 요청을 받고 거부한 확정 응답」으로 본다.
        // (일부 런타임은 네트워크 errno(ECONNREFUSED 등)를 code에 싣는다 — 그건 불확실로 분류해야 한다)
        const isUncertainDbErr = (e) => !!e && !(typeof e.code === 'string' && /^([0-9A-Z]{5}|PGRST\d+)$/.test(e.code));
        const isUncertainAuthErr = (e) => !!e && (
            e.name === 'AuthRetryableFetchError' || typeof e.status !== 'number' || e.status === 0 || e.status >= 500
        );

        const dbKeys = Object.keys(dbUpdates);
        if (dbKeys.length > 0) {
        let updRows = null, dbUpdateError = null;
        try {
            const r = await supabaseAdmin.from('users').update(dbUpdates).eq('auth_id', auth_id).select();
            updRows = r.data; dbUpdateError = r.error;
        } catch (netEx) {
            console.error('DB 결과 불명확(예외):', netEx);
            return res.status(500).json({ error: 'DB 결과 불명확(네트워크) — 부분 상태 불명확, HOLD. 수동 확인 필요' });
        }
        if (dbUpdateError) {
            console.error('DB User Update Error:', dbUpdateError);
            if (isUncertainDbErr(dbUpdateError)) {
                return res.status(500).json({ error: `DB 결과 불명확 — 부분 상태 불명확, HOLD. 수동 확인 필요 (${dbUpdateError.message})` });
            }
            return res.status(500).json({ error: `사용자 DB 업데이트 실패(확정 거부 — 변경 없음): ${dbUpdateError.message}` });
        }
        if (!updRows || updRows.length !== 1) {
            return res.status(500).json({ error: '갱신 영향 행수가 1이 아닙니다 — 부분 상태 불명확, HOLD. 수동 확인 필요' });
        }
        }

        // 7. Auth.users 비밀번호 및 메타데이터 갱신 (후행) — 실패 유형별 처리
        const authUpdates = {};
        if (password) authUpdates.password = password; // 새 비밀번호가 넘어온 경우만 해시 변경
        if (name) authUpdates.user_metadata = { name };

        let updateAuthError = null;
        try {
            const r = await supabaseAdmin.auth.admin.updateUserById(auth_id, authUpdates);
            updateAuthError = r.error;
        } catch (netEx) {
            console.error('Auth 결과 불명확(예외):', netEx);
            return res.status(500).json({ error: 'Auth 결과 불명확(네트워크) — 부분 상태 불명확, HOLD. 수동 확인 필요' });
        }
        if (updateAuthError && isUncertainAuthErr(updateAuthError)) {
            console.error('Auth 결과 불명확(재시도류):', updateAuthError);
            return res.status(500).json({ error: `Auth 결과 불명확 — 부분 상태 불명확, HOLD. 수동 확인 필요 (${updateAuthError.message})` });
        }
        if (updateAuthError) {
            console.error('Auth User Update Error → CAS 원복 시도:', updateAuthError);
            if (dbKeys.length === 0) {
                return res.status(500).json({ error: `비밀번호 변경 실패(프로필 변경 없음): ${updateAuthError.message}` });
            }
            const restore = {};
            dbKeys.forEach(k => { restore[k] = beforeRow[k]; });
            let cas = supabaseAdmin.from('users').update(restore).eq('auth_id', auth_id);
            for (const k of dbKeys) {
                cas = (dbUpdates[k] === null) ? cas.is(k, null) : cas.eq(k, dbUpdates[k]);
            }
            let resRows = null, resErr = null;
            try {
                const r = await cas.select();
                resRows = r.data; resErr = r.error;
            } catch (netEx2) {
                return res.status(500).json({ error: `보상 원복 결과 불명확 — 부분 상태 불명확, HOLD. 수동 확인 필요 (${updateAuthError.message})` });
            }
            if (resErr) {
                return res.status(500).json({ error: `보상 원복 실패 — 부분 상태 불명확, HOLD. 수동 확인 필요 (${updateAuthError.message})` });
            }
            if (!resRows || resRows.length === 0) {
                return res.status(500).json({ error: `Auth 실패 후 행이 그 사이 변경됨 — 원복 보류, HOLD. 수동 확인 필요 (${updateAuthError.message})` });
            }
            const backRow = resRows.length === 1 ? resRows[0] : null;
            const restored = backRow && dbKeys.every(k => String(backRow[k]) === String(beforeRow[k]));
            if (!restored) {
                return res.status(500).json({ error: `보상 원복 read-back 불일치 — 부분 상태 불명확, HOLD. 수동 확인 필요 (${updateAuthError.message})` });
            }
            return res.status(500).json({ error: `비밀번호 변경 실패 — 프로필 변경도 원복됐습니다(전체 실패): ${updateAuthError.message}` });
        }

        // 8. 최종 성공 반환
        return res.status(200).json({ success: true, message: '직원 정보 및 비밀번호가 성공적으로 변경되었습니다.' });

    } catch (error) {
        console.error('Unexpected Backend Error:', error);
        return res.status(500).json({ error: '서버 내부 처리 중 알 수 없는 오류가 발생했습니다.' });
    }
}
