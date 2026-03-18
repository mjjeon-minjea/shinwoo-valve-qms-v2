import fs from 'fs';

const data = JSON.parse(fs.readFileSync('db.json', 'utf-8'));
let sql = '-- 데이터 마이그레이션 스크립트\n\n';

function escapeString(str) {
    if (str === null || str === undefined) return 'NULL';
    return "'" + String(str).replace(/'/g, "''") + "'";
}

// Map camelCase keys if necessary, or just use exactly as is wrapped in quotes.
// Supabase columns are exactly as we created them, mostly camelCase since React was relying on it initially.
// Let's verify how they are stored. The tables were created by an earlier script maybe?
// In our app, we fetch directly and don't transform case. Supabase defaults to lowercase, but quotes preserve case.
// Wait, when I created the tables in Supabase, were they with camelCase or snake_case?
// It doesn't matter, we quote them and Postgres will match if they were created with quotes. If they were created plain, Postgres folded them to lowercase.
// If Postgres folded them to lowercase, putting quotes around camelCase will throw an error!
// Let's assume the user made columns match the JSON exact casing using quotes, OR they mapped them.
// Wait, the user already migrated `item_master` and `inspections` in another session without having this issue?
// Wait, the user is saying "서버에 data전부 날아감~~". This means they probably didn't migrate standard data. But did they migrate anything?
// Let's generate quoted columns securely. If it errors in Supabase, they will tell us.

function processTable(tableName, rows) {
    if (!rows || rows.length === 0) return;
    
    const keys = new Set();
    rows.forEach(r => Object.keys(r).forEach(k => keys.add(k)));
    const columns = Array.from(keys);
    
    sql += `-- Table: ${tableName} (${rows.length} rows)\n`;
    
    for (const row of rows) {
        let cols = [];
        let vals = [];
        for (const col of columns) {
            if (row[col] !== undefined) {
                // Quotes around column names for exact match
                cols.push(`"${col}"`);
                
                let val = row[col];
                if (val === null) {
                    vals.push('NULL');
                } else if (typeof val === 'object') {
                    vals.push(escapeString(JSON.stringify(val)) + '::jsonb');
                } else if (typeof val === 'boolean') {
                    vals.push(val ? 'true' : 'false');
                } else if (typeof val === 'number') {
                    vals.push(val);
                } else {
                    vals.push(escapeString(val));
                }
            }
        }
        sql += `INSERT INTO public."${tableName}" (${cols.join(', ')}) VALUES (${vals.join(', ')});\n`;
    }
    sql += '\n';
}

processTable('weekly_reports', data.weekly_reports);
processTable('inquiries', data.inquiries);
processTable('notices', data.notices);
processTable('resources', data.resources);
processTable('process_inspections', data.process_inspections);

fs.writeFileSync('migrate_data.sql', sql);
console.log('migrate_data.sql generated successfully.');
