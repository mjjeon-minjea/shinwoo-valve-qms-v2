import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const client = new Client({ connectionString: process.env.STAGING_DB_URL });

async function fixAuthSchema() {
  await client.connect();
  try {
    const res = await client.query(`
      SELECT column_name, ordinal_position 
      FROM information_schema.columns 
      WHERE table_schema = 'auth' AND table_name = 'users'
      ORDER BY ordinal_position;
    `);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error("DB Error:", err);
  } finally {
    process.exit();
  }
}

fixAuthSchema();
