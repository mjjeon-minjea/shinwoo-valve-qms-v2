const { Client } = require('pg');

async function checkDevNotes() {
  const prodConnectionString = 'postgresql://postgres:!alswo6305@db.zuahpjdsypovxdplxryw.supabase.co:5432/postgres';
  const client = new Client({
    connectionString: prodConnectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    // status가 published인 최신 5개 개발자 노트를 가져옴
    const res = await client.query(`
      SELECT version, title, date, status, created_at 
      FROM dev_notes 
      WHERE status = 'published'
      ORDER BY created_at DESC, version DESC 
      LIMIT 10;
    `);
    
    console.log('=== Supabase 실서버(Production) 배포 완료 목록 ===');
    res.rows.forEach((r, idx) => {
      console.log(`[${idx + 1}] 버전: ${r.version} | 제목: ${r.title} | 날짜: ${r.date} | 생성일: ${r.created_at}`);
    });
  } catch (err) {
    console.error('❌ 쿼리 실패:', err.message);
  } finally {
    await client.end();
  }
}

checkDevNotes();
