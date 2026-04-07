import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkUsersTable() {
    const { data, error } = await supabase.from('users').select('*').limit(1);
    console.log("public.users fetch:", error || data);
}
checkUsersTable();
