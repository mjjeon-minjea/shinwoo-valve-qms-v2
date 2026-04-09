const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const envMap = {};
fs.readFileSync('.env.local', 'utf8').split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) envMap[match[1].trim()] = match[2].trim();
});
const supabase = createClient(envMap['VITE_SUPABASE_URL'], envMap['SUPABASE_SERVICE_ROLE_KEY']);

async function run() {
    const { data: notes } = await supabase.from('dev_notes').select('version');
    const versions = [...new Set(notes.map(n => n.version))];
    console.log(versions);
}
run();
