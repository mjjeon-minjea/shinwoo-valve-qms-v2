
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
(async () => {
    const { data: users } = await supabase.from('users').select('id, email');
    console.log('Users:', users);
    const { data: reports } = await supabase.from('weekly_reports').select('id, authorId').limit(2);
    console.log('Reports:', reports);
})();

