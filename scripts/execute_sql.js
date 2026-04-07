import pg from 'pg';
import fs from 'fs';

const connectionString = 'postgresql://postgres:!alswo6305@db.srzaanvojyhwzugoaimk.supabase.co:5432/postgres';

const client = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const sql = fs.readFileSync('C:\\Users\\mjjeon\\Desktop\\QMS 프로젝트\\shinwoo-valve-qms\\STAGING_DATA_SYNC.sql', 'utf8');
  console.log('SQL 파일 로드 완료. 크기/길이:', sql.length, 'bytes');
  console.log('🚀 원격 스테이징 DB에 주입 중... (10~20초 소요)');
  try {
    await client.query(sql);
    console.log('✅ 완벽 성공: SQL 구문이 원격 데이터베이스에 적용되었습니다!');
  } catch (err) {
    console.error('❌ 에러 발생:', err.message);
  } finally {
    await client.end();
  }
}

main();
