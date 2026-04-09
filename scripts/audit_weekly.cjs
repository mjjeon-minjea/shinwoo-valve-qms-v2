const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    // 1. weekly_reports 전체 authorId 유형 확인
    const { data: reports } = await supabase.from('weekly_reports').select('id, "authorId", "authorName"');
    console.log('\n=== weekly_reports authorId 전수 조사 ===');
    console.log(JSON.stringify(reports, null, 2));

    // 2. public.users 에서 id(bigint) <-> auth_id(UUID) 매핑 현황
    const { data: users } = await supabase.from('users').select('id, auth_id, name, email');
    console.log('\n=== public.users id <-> auth_id 매핑 현황 ===');
    console.log(JSON.stringify(users, null, 2));
}

run();
