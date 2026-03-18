import fs from 'fs';

const data = JSON.parse(fs.readFileSync('db.json', 'utf-8'));
let sql = '-- 데이터 마이그레이션 스크립트 (스키마 보정 및 중복 방지 적용)\n\n';

// 스키마 보정 구문 추가 (누락된 컬럼 자동 생성)
sql += '-- resources 테이블 스키마 보정\n';
sql += 'ALTER TABLE public."resources" ADD COLUMN IF NOT EXISTS "originalFilename" text;\n\n';

function escapeString(str) {
    if (str === null || str === undefined) return 'NULL';
    return "'" + String(str).replace(/'/g, "''") + "'";
}

function processTable(tableName, rows) {
    if (!rows || rows.length === 0) return;
    
    const keys = new Set();
    rows.forEach(r => Object.keys(r).forEach(k => keys.add(k)));
    const columns = Array.from(keys);
    
    const hasId = columns.includes('id');
    
    sql += `-- Table: ${tableName} (${rows.length} rows)\n`;
    
    for (const row of rows) {
        let cols = [];
        let vals = [];
        for (const col of columns) {
            if (row[col] !== undefined) {
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
        let conflictClause = hasId ? ' ON CONFLICT ("id") DO NOTHING' : '';
        sql += `INSERT INTO public."${tableName}" (${cols.join(', ')}) VALUES (${vals.join(', ')})${conflictClause};\n`;
    }
    sql += '\n';
}

processTable('weekly_reports', data.weekly_reports);
processTable('inquiries', data.inquiries);
processTable('notices', data.notices);
processTable('resources', data.resources);
processTable('process_inspections', data.process_inspections);

const noticeSql = `\n-- v3.0 업데이트 공지사항 추가\nINSERT INTO public."notices" ("id", "title", "type", "author", "content", "date", "views") VALUES (floor(extract(epoch from now()) * 1000)::text, '[업데이트] 신우밸브 QMS 시스템 보안 및 성능 강화 안내 (v3.0)', '공지', '최고관리자', '안녕하십니까, 품질보증부입니다.\n사내 QMS(품질관리시스템)의 데이터 보안 및 처리 속도를 강화하기 위해 대규모 시스템 업데이트가 적용되었습니다.\n\n[주요 변경 사항]\n1. 클라우드 기반 보안 데이터베이스 전면 도입\n2. 계정 비밀번호 규정 강화 및 마이그레이션 안내\n3. 시스템 로딩 속도 및 대시보드 검사 이력 최적화\n\n본 업데이트 이후 최초 로그인 시 표시되는 안내에 따라 반드시 비밀번호를 갱신해 주시기 바랍니다.', to_char(now(), 'YYYY-MM-DD'), 0) ON CONFLICT ("id") DO NOTHING;\n`;
sql += noticeSql;

fs.writeFileSync('migrate_data.sql', sql);
console.log('migrate_data.sql generated with Alter Table and Conflict handling.');
