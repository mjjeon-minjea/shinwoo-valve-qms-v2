const { Client } = require('pg');

async function testConnection() {
  console.log('🔄 Production DB 연결 시도 중: zuahpjdsypovxdplxryw...');
  const prodConnectionString = 'postgresql://postgres:!alswo6305@db.zuahpjdsypovxdplxryw.supabase.co:5432/postgres';
  const client = new Client({
    connectionString: prodConnectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to Production DB successfully!');
    
    // 1. inspections 테이블 컬럼 정보 조회 및 생성
    const resColumns = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'inspections' AND column_name = 'item_code';
    `);
    
    if (resColumns.rows.length > 0) {
      console.log('✅ item_code column already exists!');
    } else {
      console.log('❌ item_code column does not exist. Creating column...');
      await client.query(`ALTER TABLE inspections ADD COLUMN IF NOT EXISTS item_code TEXT;`);
      console.log('✅ item_code column created successfully!');
    }

    // 2. auth.users 이메일 인증 강제 처리
    console.log('🔄 Confirming emails for migrated users in auth.users...');
    const resAuth = await client.query(`
      UPDATE auth.users 
      SET email_confirmed_at = NOW(), confirmed_at = NOW(), last_sign_in_at = NOW()
      WHERE email IN (
        'jslee@shinwoovalve.com',
        'shcho@shinwoovalve.com',
        'hchwang@shinwoovalve.com',
        'ysson@shinwoovalve.com',
        'bskwon@shinwoovalve.com',
        'mjjeon@shinwoovalve.com'
      )
      RETURNING email, email_confirmed_at;
    `);
    console.log('✅ Updated users count:', resAuth.rowCount);
    resAuth.rows.forEach(r => {
      console.log(`- ${r.email}: confirmed at ${r.email_confirmed_at}`);
    });

  } catch (err) {
    console.error('❌ Connection or query failed:', err.message);
  } finally {
    await client.end();
  }
}

testConnection();
