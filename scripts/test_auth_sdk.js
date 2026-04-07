import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testLogin() {
    const { data, error } = await supabase.auth.signInWithPassword({
        email: 'mjjeon@shinwoovalve.com',
        password: '1'
    });
    if (error) {
        console.error("LOGIN ERROR:", error.message, error.status);
    } else {
        console.log("LOGIN SUCCESS:", data.user.id);
    }
}
testLogin();
