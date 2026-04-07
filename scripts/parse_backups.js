const fs = require('fs');
const path = require('path');

const BACKUP_DIR = path.join(__dirname, '../DB_BACKUPS');
const OUT_DIR = path.join(__dirname, '../DB_PARSED');

if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
}

// 1. Read all files
const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.txt') || f.endsWith('.sql'));

let allInserts = [];

files.forEach(file => {
    const filePath = path.join(BACKUP_DIR, file);
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Split by semicolon, but this is a naive split.
    // A better naive split is to find "INSERT INTO" and capture until ";"
    // But since DDL might be mixed, let's just use naive semicolon split 
    // and ignore anything inside strings? No, let's just split by ';' for now.
    // Actually, safer regex for INSERT INTO:
    const insertRegex = /INSERT\s+INTO\s+[\s\S]*?(?:;|$)/gi;
    
    let match;
    while ((match = insertRegex.exec(content)) !== null) {
        let stmt = match[0].trim();
        if (stmt.endsWith(';')) stmt = stmt.slice(0, -1).trim(); // remove semicolon
        
        // Remove existing ON CONFLICT if any to avoid duplication
        const conflictRegex = /\s+ON\s+CONFLICT[\s\S]*$/i;
        stmt = stmt.replace(conflictRegex, '');
        
        // Add ON CONFLICT DO NOTHING
        stmt += '\nON CONFLICT DO NOTHING;';
        
        // Find table name
        const tableMatch = /INSERT\s+INTO\s+["']?(?:public\.)?["']?([a-zA-Z0-9_]+)["']?/i.exec(stmt);
        const tableName = tableMatch ? tableMatch[1].toLowerCase() : 'unknown';
        
        allInserts.push({ tableName, stmt, sourceFile: file });
    }
});

console.log(`총 ${allInserts.length}개의 INSERT 구문 추출 완료.`);

// Grouping
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
    ddl += `-- 포함 테이블: ${[...new Set(group.map(g => g.tableName))].join(', ')}\n`;
    ddl += `-- ==========================================================\n\nBEGIN;\n\n`;
    
    group.forEach(g => {
        ddl += `-- Source: ${g.sourceFile}\n`;
        ddl += `${g.stmt}\n\n`;
    });
    ddl += `COMMIT;\n`;
    fs.writeFileSync(filepath, ddl, 'utf8');
    console.log(`${filename}: ${group.length}개 쿼리 작성 완료.`);
};

writeGroup('01_Priority1_Master.sql', group1);
writeGroup('02_Priority2_Transaction.sql', group2);
writeGroup('03_Priority3_Others.sql', group3);
