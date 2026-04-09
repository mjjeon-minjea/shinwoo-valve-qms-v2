const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const { data: users, error } = await supabase.from('users').select('name, rank, role').order('role', { ascending: false });
    
    if (error) {
        console.error('Error fetching users:', error);
        return;
    }
    
    console.log(JSON.stringify(users, null, 2));
}

run();
