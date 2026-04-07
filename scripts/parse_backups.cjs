const fs = require('fs');
const path = require('path');

const BACKUP_DIR = path.join(__dirname, '../DB_BACKUPS');
const OUT_DIR = path.join(__dirname, '../DB_PARSED');

if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
}

const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.txt') || f.endsWith('.sql'));

let allInserts = [];

files.forEach(file => {
    const filePath = path.join(BACKUP_DIR, file);
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Better regex for INSERT
    const insertRegex = /INSERT\s+INTO\s+[\s\S]*?(?:;|$)/gi;
    
    let match;
    while ((match = insertRegex.exec(content)) !== null) {
        let stmt = match[0].trim();
        if (stmt.endsWith(';')) stmt = stmt.slice(0, -1).trim();
        
        const conflictRegex = /\s+ON\s+CONFLICT[\s\S]*$/i;
        stmt = stmt.replace(conflictRegex, '');
        
        stmt += '\nON CONFLICT DO NOTHING;';
        
        const tableMatch = /INSERT\s+INTO\s+["']?(?:public\.)?["']?([a-zA-Z0-9_]+)["']?/i.exec(stmt);
        const tableName = tableMatch ? tableMatch[1].toLowerCase() : 'unknown';
        
        allInserts.push({ tableName, stmt, sourceFile: file });
    }
});

console.log(`총 ${allInserts.length}개의 INSERT 구문 추출 완료.`);

const PRIORITY_1 = ['users', 'item_master', 'inspections'];
const PRIORITY_2 = ['process_inspections', 'weekly_reports', 'inquiries'];

let group1 = [];
let group2 = [];
let group3 = [];

allInserts.forEach(item => {
    if (PRIORITY_1.includes(item.tableName)) {
        group1.push(item);
    } else if (PRIORITY_2.includes(item.tableName)) {
        group2.push(item);
    } else {
        group3.push(item);
    }
});

const writeGroup = (filename, group) => {
    if (group.length === 0) return;
    const filepath = path.join(OUT_DIR, filename);
    let ddl = `-- ==========================================================\n`;
    ddl += `-- 파일명: ${filename}\n`;
    ddl += `-- 메인 테이블: ${[...new Set(group.map(g => g.tableName))].join(', ')}\n`;
    ddl += `-- ==========================================================\n\nBEGIN;\n\n`;
    
    group.forEach(g => {
        ddl += `-- Source: ${g.sourceFile}\n`;
        ddl += `${g.stmt}\n\n`;
    });
    ddl += `COMMIT;\n`;
    fs.writeFileSync(filepath, ddl, 'utf8');
};

writeGroup('01_Priority1_Master.sql', group1);
writeGroup('02_Priority2_Transaction.sql', group2);
writeGroup('03_Priority3_Others.sql', group3);
