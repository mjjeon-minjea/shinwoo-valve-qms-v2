import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
const { Client } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fixStaging() {
    try {
        console.log('💊 [스테이징 긴급 수리] 사라진 테이블들을 다시 생성합니다...');
        
        const envPath = path.resolve(__dirname, '../.env.local');
        const envLocal = fs.readFileSync(envPath, 'utf-8');
        let stagingDbUrl = '';
        
        const lines = envLocal.split(/\r?\n/);
        for (const line of lines) {
            if (line.trim().startsWith('STAGING_DB_URL=')) {
                stagingDbUrl = line.split('=')[1].trim().replace(/['"]/g, '');
            }
        }
        
        if (!stagingDbUrl) throw new Error('STAGING_DB_URL을 .env.local에서 찾을 수 없습니다.');

        const client = new Client({ connectionString: stagingDbUrl });
        await client.connect();
        console.log('🔌 스테이징 DB 접속 성공!');

        const sqlPath = path.resolve(__dirname, './FINAL_STAGING_MIGRATION.sql');
        const originalSql = fs.readFileSync(sqlPath, 'utf-8');
        
        // 트랜잭션 수동 제어
        await client.query('BEGIN;');
        console.log('🏗️ 스키마 재구축 중 (Step 1~9)...');
        await client.query(originalSql);
        await client.query('COMMIT;');
        
        console.log('✅ [수리 완료] 모든 테이블이 정상적으로 생성되었습니다!');
        await client.end();
    } catch (e) {
        console.error('❌ 수리 실패:', e.message);
    }
}

fixStaging();
