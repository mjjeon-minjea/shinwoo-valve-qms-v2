import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing Supabase credentials in .env file');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TABLES_TO_MIGRATE = [
    'weekly_reports',
    'process_inspections',
    'inspections',
    'notices',
    'inquiries',
    'calendar_events'
];

// Definition of valid columns for each table to strip rogue data from db.json
const ALLOWED_COLUMNS = {
    weekly_reports: ["id","authorId","authorName","weekStartDate","status","schedule","projects","issues","samples","createdDate","reviewerComment","approverComment"],
    process_inspections: ["id","workOrderNo","processCode","workplaceFull","inspectionDate","plannedQuantity","inspectedQuantity","failedQuantity","passedQuantity","orderNo","resolution","workplaceCode","modelName","modelCategory","workplace","equipmentName","isResolutionEntered"],
    inspections: ["id","date","supplier","itemName","totalQuantity","inspectionQuantity","defectQuantity","result","defectType","itemType","inspectionReportNo"],
    notices: ["id","title","type","author","content","date","views"],
    resources: ["id","title","type","author","content","date","attachment","views"],
    inquiries: ["id","type","title","content","author","date","status","messages"],
    calendar_events: ["id","authorId","authorName","title","date","type","content"]
};

async function migrateData() {
    try {
        console.log('Reading db.json...');
        const dbContent = fs.readFileSync(path.join(__dirname, 'db.json'), 'utf8');
        const db = JSON.parse(dbContent);

        for (const table of TABLES_TO_MIGRATE) {
            if (!db[table] || db[table].length === 0) {
                console.log(`Table ${table} is empty or not found. Skipping...`);
                continue;
            }

            const records = db[table];
            console.log(`Found ${records.length} records for table '${table}'. Migrating in batches...`);

            // To avoid huge payloads, let's process them in small batches
            const BATCH_SIZE = 500;
            for (let i = 0; i < records.length; i += BATCH_SIZE) {
                const batchRaw = records.slice(i, i + BATCH_SIZE);
                
                // Sanitize each record against the ALLOWED_COLUMNS
                const batch = batchRaw.map(rawRecord => {
                    const cleanRecord = {};
                    const allowed = ALLOWED_COLUMNS[table] || [];
                    for (const key of Object.keys(rawRecord)) {
                        if (allowed.includes(key)) {
                            cleanRecord[key] = rawRecord[key];
                        }
                    }
                    return cleanRecord;
                });

                const { error } = await supabase.from(table).upsert(batch);

                if (error) {
                    console.error(`Batch insert failed for ${table} (records ${i} to ${i + batch.length}):`, error.message);
                } else {
                    console.log(`Successfully migrated records ${i} to ${i + batch.length} for ${table}.`);
                }
            }

            console.log(`Completed migration for table '${table}'.`);
        }

        console.log('--- All migrations completed successfully! ---');

    } catch (err) {
        console.error('Migration failed:', err);
    }
}

migrateData();
