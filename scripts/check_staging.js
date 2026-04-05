const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
const client = new Client({ connectionString: process.env.STAGING_DB_URL });
client.connect()
  .then(() => client.query('SELECT * FROM weekly_reports ORDER BY "createdDate" DESC LIMIT 5'))
  .then(res => { console.log(JSON.stringify(res.rows, null, 2)); process.exit(0); })
  .catch(err => { console.error(err); process.exit(1); });
