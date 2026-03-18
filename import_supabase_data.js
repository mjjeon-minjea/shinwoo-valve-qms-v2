import 'dotenv/config.js';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function importData() {
    try {
        console.log('Loading db.json...');
        const db = JSON.parse(fs.readFileSync('db.json', 'utf8'));
        
        console.log('Authenticating...');
        let { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
            email: 'mjjeon@shinwoovalve.com',
            password: 'mjjeon1234'
        });
        
        if (authErr) {
            console.log('Login failed (' + authErr.message + '), creating a temporary admin for importing...');
            const tempEmail = `import_admin_${Date.now()}@shinwoovalve.com`;
            const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
                email: tempEmail,
                password: 'import_admin1234!'
            });
            if (signUpErr) {
                console.error('Failed to create temp admin:', signUpErr.message);
            } else {
                console.log('Successfully created and authenticated temp admin.');
            }
        } else {
            console.log('Successfully authenticated as mjjeon.');
        }

        const collectionsToImport = ['process_inspections', 'weekly_reports', 'notices', 'resources'];
        
        for (const table of collectionsToImport) {
            const items = db[table] || [];
            console.log(`Starting import for ${table}... (${items.length} items)`);
            if (items.length === 0) continue;
            
            await supabase.from(table).delete().neq('id', '0');
            console.log(`Cleared existing data in ${table}`);

            const BATCH_SIZE = 500;
            for (let i = 0; i < items.length; i += BATCH_SIZE) {
                const batch = items.slice(i, i + BATCH_SIZE);
                
                // try with original
                const { error } = await supabase.from(table).insert(batch);
                if (error) {
                    console.error(`Batch insert error for ${table} [${i}]:`, error.message);
                    console.log('Retrying without ID...');
                    const noIdBatch = batch.map(b => {
                        const { id, ...rest } = b;
                        return rest;
                    });
                    const fallback = await supabase.from(table).insert(noIdBatch);
                    if (fallback.error) {
                         console.error(`Fallback failed too:`, fallback.error.message);
                    } else {
                         console.log(`Fallback success [${i} to ${i + BATCH_SIZE}]`);
                    }
                } else {
                    console.log(`Batch insert success for ${table} [${i} to ${i + BATCH_SIZE}]`);
                }
            }
        }
        
        console.log('Import completed!');
    } catch(err) {
        console.error('Fatal Import Error:', err);
    }
}

importData();
