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

async function audit() {
    console.log('Fetching dev_notes from Supabase...');
    // We fetch all records to audit them
    const { data: devNotes, error } = await supabase
        .from('dev_notes')
        .select('*')
        .order('id', { ascending: false });

    if (error) {
        console.error('Error fetching dev_notes:', error);
        return;
    }

    console.log(`Found ${devNotes.length} dev_notes. Analyzing versions...`);
    
    // Find all versions containing '3.1.0' or '0.19.0' or look for duplicates
    const versionMap = {};
    const jumpRecords = [];
    
    for (const note of devNotes) {
        if (!versionMap[note.version]) {
            versionMap[note.version] = [];
        }
        versionMap[note.version].push(note);
        
        if (note.version === 'v3.1.0' || note.version.includes('3.1')) {
            jumpRecords.push(note);
        }
    }
    
    console.log('\n--- Duplicates found ---');
    for (const [ver, notes] of Object.entries(versionMap)) {
        if (notes.length > 1) {
            console.log(`Version ${ver} has ${notes.length} copies:`);
            notes.forEach(n => console.log(`  ID: ${n.id}, CreatedAt: ${n.created_at}, Author: ${n.author}, Title: ${n.title}, Status: ${n.status}`));
        }
    }
    
    console.log('\n--- Jump Records (v3.1.0) ---');
    jumpRecords.forEach(n => {
        console.log(`ID: ${n.id}, CreatedAt: ${n.created_at}, Author: ${n.author}, Title: ${n.title}, Status: ${n.status}`);
    });
    
}

audit();
