
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testSave() {
    console.log('Testing Save to weekly_reports...');

    // Mock Report Data (matches WeeklyReport.jsx structure)
    const mockReport = {
        authorId: 123456789, // Mock ID, ensure it's bigint compatible
        authorName: 'Debug User',
        weekStartDate: '2026-02-02',
        status: 'draft',
        schedule: [],
        projects: [],
        issues: [],
        samples: [],
        createdDate: new Date().toISOString()
    };

    console.log('1. Attempting POST (Insert)...');
    const { data: inserted, error: insertError } = await supabase
        .from('weekly_reports')
        .insert(mockReport)
        .select()
        .single();

    if (insertError) {
        console.error('❌ POST Failed:', insertError);
        return;
    }

    console.log('✅ POST Success. ID:', inserted.id);

    // Test UPDATE
    console.log('2. Attempting PUT (Update)...');
    const updateData = { ...mockReport, status: 'submitted' };
    delete updateData.id; // Usually removed in api.js

    const { data: updated, error: updateError } = await supabase
        .from('weekly_reports')
        .update(updateData)
        .eq('id', inserted.id)
        .select()
        .single();

    if (updateError) {
        console.error('❌ PUT Failed:', updateError);
    } else {
        console.log('✅ PUT Success.');
    }

    // CLEANUP
    console.log('3. Cleaning up...');
    await supabase.from('weekly_reports').delete().eq('id', inserted.id);
    console.log('Done.');
}

testSave();
