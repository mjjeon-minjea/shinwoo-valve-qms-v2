const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function getColumns(tableName) {
    // A quick hack to get columns, select 1 and return keys of first item OR use RPC if we have to.
    const { data, error } = await supabase.from(tableName).select('*').limit(1);
    if (data && data.length > 0) {
        return Object.keys(data[0]);
    }
    
    // If table is empty, we insert a fake row, get its columns, and rollback... but wait, we can just look up information_schema via RPC
    const { data: d2, error: e2 } = await supabase.rpc('execute_sql', { sql_query: `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='${tableName}'` });
    if(d2) return d2.map(x=>x.column_name);

    return error;
}

async function run() {
    console.log('notices:', await getColumns('notices'));
    console.log('dev_notes:', await getColumns('dev_notes'));
}
run();
