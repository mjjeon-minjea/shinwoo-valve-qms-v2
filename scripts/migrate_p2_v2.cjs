const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const UUID_MAP = {
  '전민재': { email: 'mjjeon@shinwoovalve.com', uuid: '6a40cb30-1c44-4404-bb1e-433344028380' },
  '황희찬': { email: 'hchwang@shinwoovalve.com', uuid: '2d6931a2-66f3-4b60-951f-95c1dee8f488' },
  '손양수': { email: 'ysson@shinwoovalve.com', uuid: '33bf8c0a-30e4-4d8b-851c-db411dce4778' },
  '권병수': { email: 'bskwon@shinwoovalve.com', uuid: '0d64f734-ba3f-4a84-ab7a-e753c4c8aed9' },
  '이종선': { email: 'jslee@shinwoovalve.com', uuid: '46e5f64c-04f7-4eb7-8c72-70bc0515b867' },
  '조승현': { email: 'shcho@shinwoovalve.com', uuid: 'b2b1c978-b1ac-43ee-8854-1932aec2091c' }
};

const pgClient = new Client({
  host: 'aws-0-ap-northeast-2.pooler.supabase.com',
  port: 6543,
  user: 'postgres.srzaanvojyhwzugoaimk',
  password: '!alswo6305',
  database: 'postgres',
});

async function run() {
  try {
    await pgClient.connect();
    console.log("DB Connected via IPv4 Pooler.");

    // 1. Add auth_id column
    console.log("\n=== 1. Adding auth_id column to public.users ===");
    await pgClient.query(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_id uuid;`);
    console.log("Column auth_id added successfully (if not already present).");

    // 2. Update mappings
    console.log("\n=== 2. Mapping Auth UUIDs ===");
    for (const [name, target] of Object.entries(UUID_MAP)) {
      const res = await pgClient.query(`UPDATE public.users SET auth_id = $1 WHERE email = $2`, [target.uuid, target.email]);
      if (res.rowCount > 0) {
        console.log(`✅ ${name} (${target.email}) -> auth_id 매핑 성공: ${target.uuid}`);
      } else {
        console.log(`⚠️ ${name} 계정을 찾을 수 없거나 매핑 실패.`);
      }
    }

    // 3. Verify
    console.log("\n=== 3. Verification ===");
    const finalRes = await pgClient.query(`SELECT id, auth_id, email, name FROM public.users ORDER BY created_at DESC;`);
    console.table(finalRes.rows);

  } catch (err) {
    console.error("Migration Error:", err);
  } finally {
    await pgClient.end();
  }
}

run();
