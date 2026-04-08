const { Client } = require('pg');
const client = new Client('postgresql://postgres.srzaanvojyhwzugoaimk:!alswo6305@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres');
client.connect().then(() => {
    return client.query("SELECT id, email, email_confirmed_at FROM auth.users WHERE email = 'mjjeon@shinwoovalve.com'");
}).then(r => {
    console.log("Auth Users:", r.rows);
}).catch(console.error).finally(() => client.end());
