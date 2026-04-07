require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function checkProdUsers() {
    const prodClient = new Client({ connectionString: process.env.PROD_DB_URL });
    await prodClient.connect();
    try {
        const res = await prodClient.query('SELECT * FROM public.users LIMIT 1');
        console.log("PROD users schema:", Object.keys(res.rows[0] || {}));
    } finally {
        await prodClient.end();
    }
}
checkProdUsers();
