const fs = require('fs');
const path = require('path');

const BACKUP_DIR = path.join(__dirname, '../DB_BACKUPS');
const OUT_DIR = path.join(__dirname, '../DB_PARSED');

if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
}

// 1. 단순하면서도 꽤 안정적인 CSV 파서 (정규식 기반)
function parseCSV(text) {
    const lines = [];
    let currentRow = [];
    let currentCell = '';
    let inQuotes = false;

    // Normalize newlines
    text = text.replace(/\r\n/g, '\n');

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        
        if (inQuotes) {
            if (char === '"') {
                if (i + 1 < text.length && text[i + 1] === '"') {
                    currentCell += '"'; // Escaped quote
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                currentCell += char;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
            } else if (char === ',') {
                currentRow.push(currentCell);
                currentCell = '';
            } else if (char === '\n') {
                currentRow.push(currentCell);
                lines.push(currentRow);
                currentRow = [];
                currentCell = '';
            } else {
                currentCell += char;
            }
        }
    }
    // Push the last remaining cell and row
    if (currentCell !== '' || currentRow.length > 0) {
        currentRow.push(currentCell);
        lines.push(currentRow);
    }
    return lines;
}

const escapeSql = (val) => {
    if (val === undefined || val === null || val === '') return 'NULL';
    // 만약 숫자만 있다면 원래대로(하지만 안전하게 문자열로 취급해도 Postgres는 자동 변환됨)
    const escaped = val.replace(/'/g, "''");
    return `'${escaped}'`;
};

// 2. CSV -> SQL INSERT 변환 함수 (Batching 적용)
function generateSqlForTable(tableName, csvData) {
    if (csvData.length < 2) return ''; // 헤더만 있거나 빈 파일

    const headers = csvData[0].map(h => `"${h.trim()}"`);
    const rows = csvData.slice(1).filter(r => r.length === headers.length && r.some(cell => cell.trim() !== ''));

    if (rows.length === 0) return ''; // 유효한 데이터가 없음

    let sql = `/* ----------------- ${tableName} (${rows.length} row(s)) ----------------- */\n`;
    const BATCH_SIZE = 500; // 500개씩 끊어서 처리 (브라우저 과부하 완벽 방지)

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const valuesSql = batch.map(row => {
            const rowValues = row.map(cell => escapeSql(cell.trim())).join(', ');
            return `(${rowValues})`;
        }).join(',\n');

        sql += `INSERT INTO public."${tableName}" (${headers.join(', ')}) VALUES \n${valuesSql}\nON CONFLICT DO NOTHING;\n\n`;
    }

    return sql;
}

// 3. 파일 읽기 및 우선순위 분할
const priority1Tables = ['users', 'item_master', 'inspections'];
const priority2Tables = ['process_inspections', 'weekly_reports', 'inquiries'];

let sqlPhase1 = `-- ==========================================================\n`;
sqlPhase1 += `-- [1차 주입 스크립트] 기준 정보 (Master Data)\n`;
sqlPhase1 += `-- ==========================================================\nBEGIN;\n\n`;

let sqlPhase2 = `-- ==========================================================\n`;
sqlPhase2 += `-- [2차 주입 스크립트] 트랜잭션 데이터 (Transaction Data)\n`;
sqlPhase2 += `-- ==========================================================\nBEGIN;\n\n`;

let phase1Count = 0;
let phase2Count = 0;

const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.csv'));

files.forEach(file => {
    const tableName = file.replace('.csv', '');
    const content = fs.readFileSync(path.join(BACKUP_DIR, file), 'utf8');
    const parsedData = parseCSV(content);
    
    console.log(`[분석 중] ${file} -> 총 ${parsedData.length - 1}줄 데이터 발견`);
    const sqlChunk = generateSqlForTable(tableName, parsedData);

    if (priority1Tables.includes(tableName)) {
        sqlPhase1 += sqlChunk;
        phase1Count++;
    } else if (priority2Tables.includes(tableName)) {
        sqlPhase2 += sqlChunk;
        phase2Count++;
    }
});

sqlPhase1 += `COMMIT;\n`;
sqlPhase2 += `COMMIT;\n`;

if (phase1Count > 0) fs.writeFileSync(path.join(OUT_DIR, '01_Phase1_Master.sql'), sqlPhase1, 'utf8');
if (phase2Count > 0) fs.writeFileSync(path.join(OUT_DIR, '02_Phase2_Transaction.sql'), sqlPhase2, 'utf8');

console.log(`\n완료! 1차 파일(${phase1Count}개 테이블), 2차 파일(${phase2Count}개 테이블) 분할 생성 성공.`);
