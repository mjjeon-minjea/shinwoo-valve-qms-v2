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
const supabaseKey = envMap['SUPABASE_SERVICE_ROLE_KEY'] || envMap['VITE_SUPABASE_ANON_KEY'];
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('--- Cleaning Up Dummy Dev Notes ---');

    const { data: targets, error: targetError } = await supabase
        .from('dev_notes')
        .select('*')
        .is('author_id', null)
        .in('version', ['v3.1.0', '# v3.1.0', 'v0.19.0', '# v0.19.0']);

    if (targetError) {
        console.error('Failed to detect targets:', targetError.message);
        return;
    }

    if (!targets || targets.length === 0) {
        console.log('No dummy testing records found to delete. The DB is clean.');
        return;
    }

    for (const note of targets) {
        // Safe check to not delete genuine AI notes like the auth reset
        if (note.title.includes('데이터 동기화 완료') || note.title.includes('업데이트 내역')) {
            console.log(`Deleting Dummy Note -> ID: ${note.id}, Title: ${note.title}, Version: ${note.version}`);
            const { error: delErr } = await supabase.from('dev_notes').delete().eq('id', note.id);
            if (delErr) {
                console.error(`Error deleting ID ${note.id}:`, delErr.message);
            } else {
                console.log(`Successfully deleted ${note.id}`);
            }
        }
    }
    
    console.log('Cleanup Finished!');
}

run();
