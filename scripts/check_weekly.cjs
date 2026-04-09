require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    console.log("=== 1. Schema Info (columns and types) ===");
    // Get column types from postgres schema
    const { data: cols, error: colsErr } = await supabase
        .rpc('hello_world'); // We don't have direct access to information_schema easily via JS client, but we can query standard REST endpoint using HEAD or just fetch 1 row.
        
    const { data: sample, error } = await supabase
        .from('weekly_reports')
        .select('authorId')
        .limit(5);
        
    console.log("Sample authorId data:", sample);
    if(error) console.log("Error:", error);
}

run();
