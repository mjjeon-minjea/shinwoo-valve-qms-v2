const fs = require('fs');
const path = require('path');

const BACKUP_DIR = path.join(__dirname, '../DB_BACKUPS');
const OUT_DIR = path.join(__dirname, '../DB_PARSED');

if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
}

// 1. 단순 파서
function parseCSV(text) {
    const lines = [];
    let currentRow = [];
    let currentCell = '';
    let inQuotes = false;
    text = text.replace(/\r\n/g, '\n');

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (inQuotes) {
            if (char === '"') {
                if (i + 1 < text.length && text[i + 1] === '"') {
                    currentCell += '"'; i++;
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
                currentRow.push(currentCell); currentCell = '';
            } else if (char === '\n') {
                currentRow.push(currentCell); lines.push(currentRow); currentRow = []; currentCell = '';
            } else {
                currentCell += char;
            }
        }
    }
    if (currentCell !== '' || currentRow.length > 0) {
        currentRow.push(currentCell); lines.push(currentRow);
    }
    return lines;
}

const escapeSql = (val) => {
    if (val === undefined || val === null || val === '') return 'NULL';
    const escaped = val.replace(/'/g, "''");
    return `'${escaped}'`;
};

// 2. CSV 파싱 및 파일 쪼개기 엔진
const BATCH_SIZE = 500;   // 한 번의 INSERT 구문에 들어갈 ROW 수
const MAX_ROWS_PER_FILE = 5000; // 수파베이스 에디터 에러 방지용: 파일 1개당 최대 ROW 한계치

function processTable(tableName, csvData, filePrefix) {
    if (csvData.length < 2) return; 

    const headers = csvData[0].map(h => `"${h.trim()}"`);
    const rows = csvData.slice(1).filter(r => r.length === headers.length && r.some(cell => cell.trim() !== ''));
    if (rows.length === 0) return;

    let fileIndex = 1;
    let sqlChunk = `BEGIN;\n\n`;
    let currentRowCountInFile = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const valuesSql = batch.map(row => {
            const rowValues = row.map(cell => escapeSql(cell.trim())).join(', ');
            return `(${rowValues})`;
        }).join(',\n');

        sqlChunk += `INSERT INTO public."${tableName}" (${headers.join(', ')}) VALUES \n${valuesSql}\nON CONFLICT DO NOTHING;\n\n`;
        currentRowCountInFile += batch.length;

        // 지정된 행 수를 초과하거나, 마지막 배치를 처리했을 때 파일로 저장
        if (currentRowCountInFile >= MAX_ROWS_PER_FILE || (i + BATCH_SIZE) >= rows.length) {
            sqlChunk += `COMMIT;\n`;
            const fileName = `${filePrefix}_${tableName}_파트${fileIndex}.sql`;
            fs.writeFileSync(path.join(OUT_DIR, fileName), sqlChunk, 'utf8');
            console.log(`[분할생성] ${fileName} (${currentRowCountInFile} rows)`);
            
            // 초기화
            sqlChunk = `BEGIN;\n\n`;
            currentRowCountInFile = 0;
            fileIndex++;
        }
    }
}

// 3. 메인 실행
const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.csv'));

// 기존 생성된 구버전 sql 파일들 청소
const existingSqls = fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.sql'));
existingSqls.forEach(f => fs.unlinkSync(path.join(OUT_DIR, f)));

files.forEach(file => {
    const tableName = file.replace('.csv', '');
    const content = fs.readFileSync(path.join(BACKUP_DIR, file), 'utf8');
    const parsedData = parseCSV(content);
    
    // 외래키 우선순위 구분을 위한 접두사
    let prefix = '03_Etc';
    if (['users', 'item_master', 'inspections'].includes(tableName)) prefix = '01_Master';
    if (['process_inspections', 'weekly_reports', 'inquiries'].includes(tableName)) prefix = '02_Tx';

    processTable(tableName, parsedData, prefix);
});

console.log(`\n🎉 에디터 과부하 방지용 쪼개기 완료.`);
