const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

// executeSql removed

async function prepareSchema() {
    console.log('Schema should be prepared manually by user via SQL Editor.');
}

async function readCSV(filePath) {
    return new Promise((resolve, reject) => {
        const results = [];
        if (!fs.existsSync(filePath)) {
            resolve([]);
            return;
        }
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => {
                resolve(results);
            })
            .on('error', reject);
    });
}

function parseBoolean(val) {
    if (val === 'true') return true;
    if (val === 'false') return false;
    return val;
}

function parseIntClean(val) {
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? 0 : parsed;
}

async function importData() {
    try {
        await prepareSchema();

        const noticesPath = path.join(__dirname, '..', 'notices_rows.csv');
        const devNotesPath = path.join(__dirname, '..', 'dev_notes_rows.csv');

        console.log('Reading notices_rows.csv...');
        const noticesRows = await readCSV(noticesPath);
        console.log(`Found ${noticesRows.length} notices.`);

        if (noticesRows.length > 0) {
            // Clean up rows
            const cleanNotices = noticesRows.map(row => {
                const clean = { ...row };
                clean.important = parseBoolean(clean.important);
                clean.views = parseIntClean(clean.views);
                delete clean.files; // Ignoring files JSONB for now to avoid parsing errors
                return clean;
            });
            
            // Insert in chunks
            const chunkSize = 50;
            for (let i = 0; i < cleanNotices.length; i += chunkSize) {
                const chunk = cleanNotices.slice(i, i + chunkSize);
                const { error } = await supabase.from('notices').upsert(chunk);
                if (error) console.error('Error inserting notices chunk:', error);
            }
            console.log('Notices import complete!');
        }

        console.log('Reading dev_notes_rows.csv...');
        const devNotesRows = await readCSV(devNotesPath);
        console.log(`Found ${devNotesRows.length} dev notes.`);

        if (devNotesRows.length > 0) {
            // Because dev_notes id is SERIAL, mapping the CSV id might work, but it's safe to just upsert.
            // But we need to ensure the id from CSV is an integer.
            const cleanDevNotes = devNotesRows.map(row => {
                const clean = { ...row };
                delete clean.id;
                return clean;
            });

             // We first clear existing seed data so we don't duplicate/conflict with ID sequence
             const { error: truncateError } = await supabase.from('dev_notes').delete().neq('id', -1);
             if (truncateError) console.error('Error truncating dev_notes:', truncateError);

            const chunkSize = 50;
            for (let i = 0; i < cleanDevNotes.length; i += chunkSize) {
                const chunk = cleanDevNotes.slice(i, i + chunkSize);
                const { error } = await supabase.from('dev_notes').upsert(chunk);
                if (error) console.error('Error inserting dev_notes chunk:', error);
            }
            console.log('Dev Notes import complete!');
        }

        console.log('All imports finished successfully.');

    } catch (e) {
        console.error('Import process failed:', e);
    }
}

importData();
