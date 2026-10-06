import { createClient } from '@supabase/supabase-js';

// Vercel 환경에서는 일반적인 process.env를 통해 환경 변수를 읽어옵니다.
// Vite 로컬 .env.local과 호환을 위해 VITE_ 접두어가 붙은 변수를 그대로 활용합니다.
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const fields = ['name', 'role', 'rank', 'company', 'status'];
const columns = 'id,email,auth_id,is_admin,status,name,role,rank,company';
export async function verifiedProfile(req) {
    const token = /^Bearer (\S+)$/.exec(req.headers.authorization || '')?.[1];
    if (!token || !supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) return null;
    const client = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await client.auth.getUser(token);
    if (error || !data?.user) return null;
    const result = await client.from('users').select('id,auth_id,status,is_admin,legacy_post_manager').eq('auth_id', data.user.id).single();
    return result.error || result.data?.status !== 'Active' ? null : result.data;
}

export default async function handler(req, res) {
    const hold = () => res.status(503).json({ error: '부분 상태 불명확, HOLD. 재시도 전 수동 확인 필요' });
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
    if (process.env.QMS_USERS_MAINTENANCE !== 'off') return res.status(503).json({ error: '회원 변경 유지보수 중' });
    try {
        const actor = await verifiedProfile(req);
        if (!actor) return res.status(401).json({ error: '유효한 Active 세션 필요' });
        if (actor.is_admin !== true) return res.status(403).json({ error: '사이트 관리자 전용' });
        const body = req.body;
        if (!body || Array.isArray(body) || Object.keys(body).some(k => !['auth_id', 'password', ...fields].includes(k))
            || typeof body.auth_id !== 'string' || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(body.auth_id)
            || fields.some(k => k in body && (typeof body[k] !== 'string' || body[k].length > 200))
            || ('role' in body && !['employee', 'manager', 'director', 'admin'].includes(body.role))
            || ('status' in body && !['Active', 'Pending', 'Inactive'].includes(body.status))
            || ('password' in body && (typeof body.password !== 'string' || (body.password.trim() && body.password.length < 6)))) {
            return res.status(400).json({ error: '허용 필드/값 또는 대상 Auth 식별자 오류' });
        }
        const client = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false, autoRefreshToken: false } });
        const before = await client.from('users').select(columns).eq('auth_id', body.auth_id).single();
        if (before.error || !before.data) return res.status(409).json({ error: '대상 정확 1행 필요' });
        const row = before.data;
        if (row.is_admin && body.status && body.status !== 'Active') return res.status(409).json({ error: '단일 관리자 비활성화 금지' });
        const updates = Object.fromEntries(fields.filter(k => k in body).map(k => [k, body[k]]));
        const keys = Object.keys(updates);
        const cas = (payload, expected) => {
            let q = client.from('users').update(payload).eq('id', row.id).eq('auth_id', row.auth_id).eq('email', row.email);
            for (const k of keys) q = expected[k] === null ? q.is(k, null) : q.eq(k, expected[k]);
            return q.select(columns);
        };
        if (keys.length) {
            const result = await cas(updates, row);
            if (result.error) {
                // Same conservative rejection classes as sync-sheets; format alone proves no outcome.
                if (!/^(22|23|42)[0-9A-Z]{3}$/.test(result.error.code || '')) return hold();
                return res.status(409).json({ error: 'DB 확정 거부: 변경 없음' });
            }
            if (result.data?.length !== 1 || !keys.every(k => result.data[0][k] === updates[k])) return hold();
        }
        if (!body.password?.trim()) return res.status(200).json({ success: true }); // blank => Auth 0
        let result;
        try { result = await client.auth.admin.updateUserById(row.auth_id, { password: body.password }); }
        catch { return hold(); }
        if (result.error) {
            if (!Number.isInteger(result.error.status) || result.error.status < 400 || result.error.status >= 500
                || result.error.name === 'AuthRetryableFetchError') return hold();
            if (keys.length) {
                const back = await cas(Object.fromEntries(keys.map(k => [k, row[k]])), updates);
                if (back.error || back.data?.length !== 1 || !keys.every(k => back.data[0][k] === row[k])) return hold();
                const check = await client.from('users').select(columns).eq('id', row.id).single();
                if (check.error || !keys.every(k => check.data?.[k] === row[k])) return hold();
            }
            return res.status(409).json({ error: 'Auth 확정 거부: 프로필 원복 확인됨' });
        }
        if (result.data?.user?.id !== row.auth_id) return hold();
        return res.status(200).json({ success: true });
    } catch { return hold(); } // provider 예외/payload/credential 출력 금지
}
