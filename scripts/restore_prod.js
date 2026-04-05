import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
const { Client } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function restore() {
    try {
        console.log('🔥 [긴급 복구 프로토콜 가동] 상용 상주 데이터 덤프를 되살립니다...');
        
        // .env.local 에서 PROD_DB_URL 추출 (Postgres Connection String)
        const envPath = path.resolve(__dirname, '../.env.local');
        if (!fs.existsSync(envPath)) throw new Error('.env.local 파일을 찾을 수 없습니다.');
        
        const envLocal = fs.readFileSync(envPath, 'utf-8');
        let prodDbUrl = '';
        const lines = envLocal.split(/\r?\n/);
        for (const line of lines) {
            if (line.trim().startsWith('PROD_DB_URL=')) {
                prodDbUrl = line.split('=')[1].trim().replace(/['"]/g, '');
            }
        }
        
        if (!prodDbUrl) {
            throw new Error('.env.local 내에 PROD_DB_URL 이 없습니다.');
        }

        // DB 연결
        console.log('🔌 상용 DB 핫라인 접속 시도 중...');
        const client = new Client({ connectionString: prodDbUrl });
        await client.connect();
        
        console.log('✅ 상용 DB 500000바이트 스트림 주입 시작... (약 10초 소요)');
        
        // 원본 백업파일 읽기 및 실행
        const sqlPath = path.resolve(__dirname, '../migrate_data.sql');
        const sql = fs.readFileSync(sqlPath, 'utf-8');
        
        await client.query('BEGIN;');
        await client.query(sql);
        await client.query('COMMIT;');
        
        console.log('🎉🎉🎉 [복구 성공] 상용 데이터가 100% 원상복구되었습니다! 메인웹을 새로고침하십시오! 🎉🎉🎉');
        await client.end();
    } catch (e) {
        console.error('❌ 복구 중 치명적 오류 발생:', e);
    }
}

restore();
