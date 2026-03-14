import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const jsonServer = require('json-server');
const path = require('path');
const fs = require('fs');

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

server.use(router);

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Custom JSON Server with Batch support is running on port ${PORT}`);
});
