import fs from 'fs';

const data = JSON.parse(fs.readFileSync('db.json', 'utf-8'));
let sql = '-- 회원(users) 테이블 마이그레이션 (추가분)\n\n';

function escapeString(str) {
    if (str === null || str === undefined) return 'NULL';
    return "'" + String(str).replace(/'/g, "''") + "'";
}

const rows = data.users;
if (rows && rows.length > 0) {
    const columns = ['id', 'email', 'password', 'name', 'company', 'role', 'status', 'rank', 'date'];
    
    for (const row of rows) {
        let cols = [];
        let vals = [];
        for (const col of columns) {
            if (row[col] !== undefined) {
                cols.push(`"${col}"`);
                vals.push(escapeString(row[col]));
            }
        }
        sql += `INSERT INTO public."users" (${cols.join(', ')}) VALUES (${vals.join(', ')}) ON CONFLICT ("id") DO NOTHING;\n`;
    }
}
fs.writeFileSync('migrate_users.sql', sql);
console.log('migrate_users.sql generated.');
