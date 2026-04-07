const { Client } = require('pg');
const client = new Client('postgresql://postgres.srzaanvojyhwzugoaimk:!alswo6305@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres');
client.connect().then(() => {
    return client.query("SELECT tgname, pg_get_triggerdef(oid) FROM pg_trigger WHERE tgname LIKE '%auth%' OR tgname LIKE '%user%';");
}).then(r => {
    console.log("Triggers:", r.rows);
    return client.query("SELECT id, email FROM auth.users WHERE email = 'mjjeon@shinwoovalve.com'");
}).then(r => {
    console.log("Auth Users:", r.rows);
    return client.query("SELECT id, email FROM public.users WHERE email = 'mjjeon@shinwoovalve.com'");
}).then(r => {
    console.log("Public Users:", r.rows);
}).catch(console.error).finally(() => client.end());
