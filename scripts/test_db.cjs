const { Client } = require('pg');
async function test() {
    const stg = new Client({ connectionString: 'postgresql://postgres:!alswo6305@db.srzaanvojyhwzugoaimk.supabase.co:5432/postgres' });
    try {
        await stg.connect();
        const res = await stg.query('SELECT count(*) FROM public.users');
        console.log("Users count:", res.rows[0].count);
        await stg.end();
    } catch(e) {
        console.log("Error:", e);
    }
}
test();
