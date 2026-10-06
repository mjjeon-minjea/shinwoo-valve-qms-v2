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
// 검증된 단일 사이트 관리자; serverless와 같은 handler/maintenance barrier.
// =====================================================
server.post('/api/admin-update-member', async (req, res) => {
    const { default: handler } = await import('./api/admin-update-member.js');
    return handler(req, res);
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

// raw json-server의 신원 변경/비공개 노트 우회는 router 전에 거부한다.
export async function localIdentityBoundary(req, res, next) {
    if (['/', '/db'].includes(req.path)) return res.status(403).json({ error: 'raw DB 조회 금지' });
    if (!/^\/(users|dev_notes)(\/|$)/.test(req.path)) return next();
    try {
        const { verifiedProfile } = await import('./api/admin-update-member.js');
        const actor = await verifiedProfile(req);
        if (!actor) return res.status(401).json({ error: 'Active 세션 필요' });
        if (/^\/users(\/|$)/.test(req.path)) {
            if (req.method !== 'GET') return res.status(403).json({ error: '검증된 프로필/관리 API만 사용' });
            if (Object.keys(req.query || {}).some(k => !['id', 'email', 'auth_id'].includes(k))) return res.status(400).json({ error: '지원하지 않는 조회 조건' });
            const safe = ['id', 'email', 'auth_id', 'name', 'company', 'role', 'rank', 'date', 'status', 'created_at', 'is_admin', 'weekly_review_enabled', 'legacy_post_manager'];
            let rows = router.db.get('users').value() || [];
            rows = rows.filter(row => (!req.params?.id || String(row.id) === req.params.id) && Object.entries(req.query || {}).every(([k,v]) => String(row[k]) === String(v)));
            const id = req.path.split('/')[2];
            if (id) rows = rows.filter(row => String(row.id) === id);
            const projected = rows.map(row => Object.fromEntries(safe.filter(k => k in row).map(k => [k, row[k]])));
            return res.json(id ? projected[0] || null : projected);
        }
        if (actor.legacy_post_manager === true) return next();
        if (req.method !== 'GET') return res.status(403).json({ error: '기존 게시 관리자 전용' });
        const id = req.path.split('/')[2];
        const rows = (router.db.get('dev_notes').value() || []).filter(row => row.status === 'published' && (!id || String(row.id) === id));
        return res.json(id ? rows[0] || null : rows);
    } catch { return res.status(503).json({ error: '권한 조회 실패: HOLD' }); }
}
server.use(localIdentityBoundary);
server.use(router);

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Custom JSON Server with Batch support is running on port ${PORT}`);
});
