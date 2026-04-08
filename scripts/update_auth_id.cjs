const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const UUID_MAP = {
  'mjjeon@shinwoovalve.com': '6a40cb30-1c44-4404-bb1e-433344028380',
  'hchwang@shinwoovalve.com': '2d6931a2-66f3-4b60-951f-95c1dee8f488',
  'ysson@shinwoovalve.com': '33bf8c0a-30e4-4d8b-851c-db411dce4778',
  'bskwon@shinwoovalve.com': '0d64f734-ba3f-4a84-ab7a-e753c4c8aed9',
  'jslee@shinwoovalve.com': '46e5f64c-04f7-4eb7-8c72-70bc0515b867',
  'shcho@shinwoovalve.com': 'b2b1c978-b1ac-43ee-8854-1932aec2091c'
};

async function executeMapping() {
  console.log("=== 2. Mapping auth_id via REST API ===");
  for (const [email, uuid] of Object.entries(UUID_MAP)) {
    const { data: user, error } = await supabaseAdmin.from('users').update({ auth_id: uuid }).eq('email', email).select();
    if (error) {
      console.error(`❌ ${email}: auth_id 매핑 실패 (오류: ${error.message})`);
    } else if (user && user.length > 0) {
      console.log(`✅ ${email} -> auth_id: ${uuid} 매핑 성공!`);
    } else {
      console.log(`⚠️ ${email}: 레코드를 찾을 수 없음.`);
    }
  }

  // 3. Verification
  console.log("\n=== 3. Verification ===");
  const { data: finalRes } = await supabaseAdmin.from('users').select('id, auth_id, email, name').order('created_at', { ascending: false });
  console.dir(finalRes, { depth: null });
}

executeMapping().catch(console.error);
