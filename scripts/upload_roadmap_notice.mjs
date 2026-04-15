import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const reportPath = 'C:/Users/mjjeon/.gemini/antigravity/brain/73960e09-be20-4dec-9142-d9c358081bdc/REPORT_QMS_AI_ROADMAP.md';
    let content = '';
    try {
        content = fs.readFileSync(reportPath, 'utf-8');
    } catch (e) {
        console.error('Error reading report file:', e);
        return;
    }
    
    const d = new Date();
    d.setHours(d.getHours() + 9); // KST
    const dateStr = d.toISOString().split('T')[0].replace(/-/g, '').substring(2); // YYMMDD
    const todayDate = d.toISOString().split('T')[0];
    
    const { data: todayNotices } = await supabase
        .from('notices')
        .select('*')
        .like('id', `AADM${dateStr}%`);
        
    const seq = String((todayNotices ? todayNotices.length : 0) + 1).padStart(3, '0');
    const newId = `AADM${dateStr}${seq}`;
    
    const payload = {
        id: newId,
        type: '공지',
        title: '[정식오픈] v1.0.0을 위한 QMS 로드맵',
        author: '관리자',
        date: todayDate,
        views: 0,
        content: content
    };

    console.log('Uploading notice...');
    const { error } = await supabase.from('notices').insert([payload]);
    if (error) {
        console.error('Failed to insert notice:', error);
    } else {
        console.log('Successfully added notice ID:', newId);
    }
}

main();
