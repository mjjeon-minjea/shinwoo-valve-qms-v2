const fs = require('fs');
const db = JSON.parse(fs.readFileSync('db.json', 'utf8'));
Object.keys(db).forEach(k => {
    console.log(k + ': ' + (Array.isArray(db[k]) ? db[k].length : 'not array'));
});
