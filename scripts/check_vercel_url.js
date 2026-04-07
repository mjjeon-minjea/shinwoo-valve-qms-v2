const https = require('https');
https.get('https://shinwoo-qms-test.vercel.app', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log(data.includes('ynqtezladgqtmidnewxn') ? "OLD_DB_FOUND" : "NEW_DB_FOUND"));
});
