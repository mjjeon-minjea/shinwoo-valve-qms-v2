
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    console.log("🔍 Checking Weekly Reports in Supabase...");
    const { data, error } = await supabase.from('weekly_reports').select('*');
    if (error) {
        console.error("❌ Error fetching reports:", error.message);
        return;
    }
    
    console.log(`✅ Found ${data.length} reports in total.`);
    if (data.length > 0) {
        console.log("--- Report Details ---");
        data.forEach(r => {
            console.log(`📄 ID: ${r.id} | Author: ${r.authorName} (${r.authorId}) | Week: ${r.weekStartDate} | Status: ${r.status}`);
        });
        console.log("----------------------");
    } else {
        console.log("⚠️ No reports found in the database.");
    }
}

check();
