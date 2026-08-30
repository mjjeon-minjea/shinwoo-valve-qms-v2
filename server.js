import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const jsonServer = require('json-server');
const path = require('path');
const fs = require('fs');

// .env.local 환경변수 로드 (SUPABASE_SERVICE_ROLE_KEY 접근용)
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const server = jsonServer.create();
const router = jsonServer.router('db.json');
const middlewares = jsonServer.defaults();

const PORT = 3001;

const multer = require('multer');

// Configure Multer for file uploads
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Handle Korean characters by decoding from latin1 to utf8
        const decodedName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        cb(null, Date.now() + '-' + decodedName);
    }
});

const upload = multer({ storage: storage });

server.use(middlewares);
server.use(jsonServer.bodyParser);

// =====================================================
// [DNAS Validator] 개발자 노트 필수 포맷 검증 통제망
// =====================================================
server.use((req, res, next) => {
    if ((req.method === 'POST' || req.method === 'PATCH' || req.method === 'PUT') && 
        (req.path === '/dev_notes' || req.path.startsWith('/dev_notes/'))) {
        
        // 💡 반려(rejected) 상태의 패치노트는 필수 품질 검증 키워드 검사 제외
        console.log('[DNAS 디버그] req.body:', req.body);
        if (req.body && req.body.status === 'rejected') {
            return next();
        }

        // 데이터 본문(content) 수정이 포함된 요청에만 DNAS 포맷 검증 수행
        if (req.body.content !== undefined) {
            const content = req.body.content || '';
            const requiredKeywords = ['원인', '대책', '결과', '물리적 증빙'];
            const missing = requiredKeywords.filter(kw => !content.includes(kw));

            if (missing.length > 0) {
                console.error(`🚨 [DNAS Validator 발동] 데이터 변이 감지. 누락된 키워드: ${missing.join(', ')}`);
                return res.status(400).json({ 
                    error: `[시스템 락] DNAS 포맷 위반. 필수 키워드 누락: ${missing.join(', ')}` 
                });
            }
        }
    }
    next();
});

// Serve uploads statically
server.use('/uploads', require('express').static(uploadDir));

// File Upload Route
server.post('/upload', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send('No file uploaded.');
        }
        // Also decode for the response so frontend displays it correctly immediately
        const decodedOriginalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
        res.json({ filename: req.file.filename, originalName: decodedOriginalName });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).send(error.message);
    }
});

// Custom Batch Insert Route
// Method: POST
// Endpoint: /inspections/batch
server.post('/inspections/batch', (req, res) => {
    try {
        const db = router.db; // Access lowdb instance
        const inspections = req.body;

        if (!Array.isArray(inspections)) {
            return res.status(400).send('Request body must be an array of inspections.');
        }

        // Get current inspections array
        const currentInspections = db.get('inspections').value();

        // Append new items
        // We set the entire array to avoid overhead of repeated `.push().write()` calls
        const newInspections = currentInspections.concat(inspections);

        db.set('inspections', newInspections).write();

        console.log(`[Batch Upload] Successfully added ${inspections.length} items.`);
        res.jsonp({ success: true, count: inspections.length });
    } catch (error) {
        console.error('[Batch Upload Error]', error);
        res.status(500).send(error.message);
    }
});

// Custom Clear Route (Batch Delete/Truncate)
// Method: DELETE
// Endpoint: /inspections
// This overrides the default 'DELETE /inspections/:id' if we are not careful, 
// but '/inspections' (collection root) usually doesn't support DELETE in standard json-server, so this is fine.
server.delete('/inspections', (req, res) => {
    try {
        const db = router.db;
        db.set('inspections', []).write();

        console.log('[Batch Delete] All inspections cleared.');
        res.jsonp({ success: true, count: 0 });
    } catch (error) {
        console.error('[Batch Delete Error]', error);
        res.status(500).send(error.message);
    }
});

// =====================================================
// Process Inspections Batch Routes
// =====================================================

// Batch Insert for Process Inspections
server.post('/process_inspections/batch', (req, res) => {
    try {
        const db = router.db;
        const items = req.body;

        if (!Array.isArray(items)) {
            return res.status(400).send('Request body must be an array.');
        }

        const current = db.get('process_inspections').value() || [];
        const merged = current.concat(items);
        db.set('process_inspections', merged).write();

        console.log(`[Process Batch Upload] Added ${items.length} items.`);
        res.jsonp({ success: true, count: items.length });
    } catch (error) {
        console.error('[Process Batch Upload Error]', error);
        res.status(500).send(error.message);
    }
});

// Batch Delete (Truncate) for Process Inspections
server.delete('/process_inspections', (req, res) => {
    try {
        const db = router.db;
        db.set('process_inspections', []).write();

        console.log('[Process Batch Delete] All process_inspections cleared.');
        res.jsonp({ success: true, count: 0 });
    } catch (error) {
        console.error('[Process Batch Delete Error]', error);
        res.status(500).send(error.message);
    }
});

// =====================================================
// [P3] 관리자 전용 비밀번호/정보 변경 API
// POST /api/admin-update-member
// 호출자의 JWT 검증 → rank='차장' 확인 → Supabase Admin으로 passwd 강제 갱신
// =====================================================
server.post('/api/admin-update-member', async (req, res) => {
    const { createClient } = await import('@supabase/supabase-js');

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
        return res.status(500).json({ error: '서버 환경변수 누락. .env.local을 확인하십시오.' });
    }

    // 1. Authorization 헤더에서 JWT 추출
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: '인증 토큰이 없습니다.' });
    }
    const token = authHeader.split(' ')[1];

    // 2. 일반 클라이언트로 JWT 해독하여 요청자 식별
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });

    try {
        const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
        if (userError || !user) {
            return res.status(401).json({ error: '유효하지 않거나 만료된 세션입니다.' });
        }

        // 3. 요청자가 시스템 관리자인지 DB 교차 검증
        /* v10.2 관리자 축 분리(260830) — 종전 「직급 차장 OR role director」 판정은
   ①실무 차장(예: 정준길)도 통과시키고 ②NCR 도입으로 director가 늘면 부서장 전원이 통과하며
   ③정작 최고관리자(admin)는 차장도 director도 아니라 차단되는 3중 결함이 있었다.
   시스템 관리자 축(role=admin 또는 is_admin=true)으로만 판정한다.
   select('*') 를 쓰는 이유 — is_admin 컬럼이 아직 없는 DB(코드 선배포)에서 42703으로
   전면 장애가 나지 않게 하기 위함이다. 없으면 undefined→false로 안전하게 떨어진다. */
        const { data: callerData, error: callerError } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('auth_id', user.id)
            .single();

        if (callerError || !callerData) {
            return res.status(403).json({ error: '권한 검증 실패: 사용자 정보를 찾을 수 없습니다.' });
        }

        if (callerData.is_admin !== true) { // 차장 확정(260830): is_admin 단독 판정
            return res.status(403).json({ error: '접근 불가: 시스템 관리자 전용 기능입니다.' });
        }

        // 4. 업데이트 대상 데이터 수신
        const { auth_id, password, name, role, rank, company, status, is_admin } = req.body;

        if (!auth_id) {
            return res.status(400).json({ error: '대상 직원의 auth_id가 누락되었습니다.' });
        }

        /* r7(260830) 순서 교정 — DB(users) 갱신을 Auth 갱신보다 먼저 한다.
           종전엔 Auth 비밀번호를 먼저 바꾼 뒤 users 갱신이 방패 트리거 등에서 거부되면
           「실패했는데 비밀번호만 바뀐」 부분 완료가 남았다. 이제 users가 거부되면 Auth는 건드리지 않고,
           Auth 쪽이 실패하면 프로필만 반영되고 비밀번호는 그대로임을 응답에 명시한다. */
        /* r8(260830) 보상 원복 — 예림 조건 6항:
           ①대상 행 사전조회 1행 ②갱신 영향 1행 ③Auth 확정 실패 시 사전값 보상
           ④보상 후 read-back 일치 시에만 「원복됨」 ⑤불명확(네트워크 예외)·보상실패는 HOLD 응답
           ⑥원복 전 「지금 값 = 우리가 쓴 값」 확인(동시 수정 보호) */
        // 5-0. 대상 행 사전조회 — 정확히 1행이 아니면 아무것도 바꾸지 않고 중단
        const { data: beforeRows, error: preErr } = await supabaseAdmin
            .from('users').select('*').eq('auth_id', auth_id);
        if (preErr || !beforeRows || beforeRows.length !== 1) {
            return res.status(409).json({ error: '대상 행이 정확히 1행이 아닙니다 — 변경 없이 중단' });
        }
        const beforeRow = beforeRows[0];

        // 5. public.users 정보 동기화 (선행)
        const dbPayload = {};
        if (name !== undefined) dbPayload.name = name;
        if (role !== undefined) dbPayload.role = role;
        if (rank !== undefined) dbPayload.rank = rank;
        if (company !== undefined) dbPayload.company = company;
        if (status !== undefined) dbPayload.status = status;
        if (is_admin !== undefined) dbPayload.is_admin = is_admin === true; // v10.2 관리자 축
        if (password && password.trim()) dbPayload.password = password.trim(); // 레거시 컬럼 동기화(제거는 별건)

        /* r9(260830) — 오류 분류: 확정 거부만 원복하고, 결과가 불명확한 오류(네트워크·5xx·재시도류)는
           원복하지 않고 「부분 상태 불명확—HOLD」로 응답한다 (예림 High ①).
           DB 오류는 SQLSTATE code 보유 = 확정 거부(변경 없음 확실), code 부재 = 불명확. */
        // code 가 SQLSTATE(5자리)나 PGRST 코드일 때만 「DB가 요청을 받고 거부한 확정 응답」으로 본다.
        // (일부 런타임은 네트워크 errno(ECONNREFUSED 등)를 code에 싣는다 — 그건 불확실로 분류해야 한다)
        const isUncertainDbErr = (e) => !!e && !(typeof e.code === 'string' && /^([0-9A-Z]{5}|PGRST\d+)$/.test(e.code));
        const isUncertainAuthErr = (e) => !!e && (
            e.name === 'AuthRetryableFetchError' || typeof e.status !== 'number' || e.status === 0 || e.status >= 500
        );

        const dbKeys = Object.keys(dbPayload);
        if (dbKeys.length > 0) {
            let updRows = null, dbErr = null;
            try {
                const r = await supabaseAdmin.from('users').update(dbPayload).eq('auth_id', auth_id).select();
                updRows = r.data; dbErr = r.error;
            } catch (netEx) {
                console.error('[Admin Update] DB 결과 불명확(예외):', netEx);
                return res.status(500).json({ error: 'DB 결과 불명확(네트워크) — 부분 상태 불명확, HOLD. 수동 확인 필요' });
            }
            if (dbErr) {
                console.error('[Admin Update] DB 갱신 오류:', dbErr);
                if (isUncertainDbErr(dbErr)) {
                    return res.status(500).json({ error: `DB 결과 불명확 — 부분 상태 불명확, HOLD. 수동 확인 필요 (${dbErr.message})` });
                }
                return res.status(500).json({ error: `DB 오류(확정 거부 — 변경 없음): ${dbErr.message}` });
            }
            if (!updRows || updRows.length !== 1) {
                return res.status(500).json({ error: '갱신 영향 행수가 1이 아닙니다 — 부분 상태 불명확, HOLD. 수동 확인 필요' });
            }
        }

        // 6. Supabase Auth 비밀번호 강제 갱신 (후행) — 실패 유형별 처리
        const authUpdates = {};
        if (password && password.trim()) authUpdates.password = password.trim();
        if (name) authUpdates.user_metadata = { name };

        if (Object.keys(authUpdates).length > 0) {
            let authErr = null;
            try {
                const r = await supabaseAdmin.auth.admin.updateUserById(auth_id, authUpdates);
                authErr = r.error;
            } catch (netEx) {
                console.error('[Admin Update] Auth 결과 불명확(예외):', netEx);
                return res.status(500).json({ error: 'Auth 결과 불명확(네트워크) — 부분 상태 불명확, HOLD. 수동 확인 필요' });
            }
            if (authErr && isUncertainAuthErr(authErr)) {
                console.error('[Admin Update] Auth 결과 불명확(재시도류):', authErr);
                return res.status(500).json({ error: `Auth 결과 불명확 — 부분 상태 불명확, HOLD. 수동 확인 필요 (${authErr.message})` });
            }
            if (authErr) {
                /* Auth 확정 거부(4xx) → 원자적 CAS 원복 (예림 High ②):
                   「지금 값 = 우리가 쓴 값」인 경우에만 원복되도록 조건을 UPDATE 한 문장에 싣는다.
                   0행 = 그 사이 다른 수정 개입 → 원복 보류 HOLD. */
                console.error('[Admin Update] Auth 갱신 확정 실패 → CAS 원복 시도:', authErr);
                if (dbKeys.length > 0) {
                    const restore = {};
                    dbKeys.forEach(k => { restore[k] = beforeRow[k]; });
                    let cas = supabaseAdmin.from('users').update(restore).eq('auth_id', auth_id);
                    for (const k of dbKeys) {
                        cas = (dbPayload[k] === null) ? cas.is(k, null) : cas.eq(k, dbPayload[k]);
                    }
                    let resRows = null, resErr = null;
                    try {
                        const r = await cas.select();
                        resRows = r.data; resErr = r.error;
                    } catch (netEx2) {
                        return res.status(500).json({ error: `보상 원복 결과 불명확 — 부분 상태 불명확, HOLD. 수동 확인 필요 (${authErr.message})` });
                    }
                    if (resErr) {
                        return res.status(500).json({ error: `보상 원복 실패 — 부분 상태 불명확, HOLD. 수동 확인 필요 (${authErr.message})` });
                    }
                    if (!resRows || resRows.length === 0) {
                        return res.status(500).json({ error: `Auth 실패 후 행이 그 사이 변경됨 — 원복 보류, HOLD. 수동 확인 필요 (${authErr.message})` });
                    }
                    const backRow = resRows.length === 1 ? resRows[0] : null;
                    const restored = backRow && dbKeys.every(k => String(backRow[k]) === String(beforeRow[k]));
                    if (!restored) {
                        return res.status(500).json({ error: `보상 원복 read-back 불일치 — 부분 상태 불명확, HOLD. 수동 확인 필요 (${authErr.message})` });
                    }
                }
                return res.status(500).json({ error: `비밀번호 변경 실패 — 프로필 변경도 원복됐습니다(전체 실패): ${authErr.message}` });
            }
        }

        console.log(`[Admin Update] auth_id(${auth_id}) 정보/비밀번호 갱신 완료.`);
        return res.status(200).json({ success: true, message: '직원 정보가 성공적으로 변경되었습니다.' });

    } catch (err) {
        console.error('[Admin Update] 예상치 못한 오류:', err);
        return res.status(500).json({ error: '서버 내부 오류가 발생했습니다.' });
    }
});

// =====================================================
// [보안 조치] 로컬 API 동기화 라우트 (Vercel Serverless Function 호출 대행)
// POST /api/sync-sheets
// =====================================================
server.post('/api/sync-sheets', async (req, res) => {
    try {
        const syncSheets = await import('./api/sync-sheets.js');
        await syncSheets.default(req, res);
    } catch (error) {
        console.error('[Local Sync Route Error]', error);
        res.status(500).json({ error: error.message });
    }
});

server.use(router);

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Custom JSON Server with Batch support is running on port ${PORT}`);
});
