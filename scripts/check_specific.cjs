const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envLocal = fs.readFileSync('.env.local', 'utf8');
const envMap = {};

envLocal.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
        envMap[match[1].trim()] = match[2].trim();
    }
});

const supabaseUrl = envMap['VITE_SUPABASE_URL'];
const supabaseKey = envMap['VITE_SUPABASE_ANON_KEY'];
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('Fetching v0.19.0...');
    const { data: v19notes } = await supabase.from('dev_notes').select('*').in('version', ['v0.19.0', '# v0.19.0']);
    console.log('--- v0.19.0 Records ---');
    console.log(JSON.stringify(v19notes, null, 2));

    console.log('Fetching v3.1.0...');
    const { data: v31notes } = await supabase.from('dev_notes').select('*').in('version', ['v3.1.0', '# v3.1.0']);
    console.log('\n--- v3.1.0 Records ---');
    console.log(JSON.stringify(v31notes, null, 2));
}

run();
