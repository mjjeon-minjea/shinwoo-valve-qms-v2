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

        // 3. 요청자가 '차장' 직급인지 DB 교차 검증
        const { data: callerData, error: callerError } = await supabaseAdmin
            .from('users')
            .select('rank, role')
            .eq('auth_id', user.id)
            .single();

        if (callerError || !callerData) {
            return res.status(403).json({ error: '권한 검증 실패: 사용자 정보를 찾을 수 없습니다.' });
        }

        if (callerData.rank !== '차장' && callerData.role !== 'director') {
            return res.status(403).json({ error: '접근 불가: 관리자(차장급) 전용 기능입니다.' });
        }

        // 4. 업데이트 대상 데이터 수신
        const { auth_id, password, name, role, rank, company, status } = req.body;

        if (!auth_id) {
            return res.status(400).json({ error: '대상 직원의 auth_id가 누락되었습니다.' });
        }

        // 5. Supabase Auth 비밀번호 강제 갱신 (Service Role 권한 사용)
        const authUpdates = {};
        if (password && password.trim()) authUpdates.password = password.trim();
        if (name) authUpdates.user_metadata = { name };

        if (Object.keys(authUpdates).length > 0) {
            const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(auth_id, authUpdates);
            if (authErr) {
                console.error('[Admin Update] Auth 갱신 오류:', authErr);
                return res.status(500).json({ error: `Auth 서버 오류: ${authErr.message}` });
            }
        }

        // 6. public.users 정보 동기화
        const dbPayload = {};
        if (name !== undefined) dbPayload.name = name;
        if (role !== undefined) dbPayload.role = role;
        if (rank !== undefined) dbPayload.rank = rank;
        if (company !== undefined) dbPayload.company = company;
        if (status !== undefined) dbPayload.status = status;
        if (password && password.trim()) dbPayload.password = password.trim(); // 레거시 컬럼 동기화

        if (Object.keys(dbPayload).length > 0) {
            const { error: dbErr } = await supabaseAdmin
                .from('users')
                .update(dbPayload)
                .eq('auth_id', auth_id);

            if (dbErr) {
                console.error('[Admin Update] DB 갱신 오류:', dbErr);
                return res.status(500).json({ error: `DB 오류: ${dbErr.message}` });
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
