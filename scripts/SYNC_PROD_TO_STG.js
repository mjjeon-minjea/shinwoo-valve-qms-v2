import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import pg from 'pg';
const { Client } = pg;

async function sync() {
    console.log("🚀 상용 DB -> 스테이징 DB 데이터 복사 브릿지 가동 시작...\n");
    const prod = new Client({ connectionString: process.env.PROD_DB_URL });
    const stg = new Client({ connectionString: process.env.STAGING_DB_URL });

    try {
        await prod.connect();
        await stg.connect();
    } catch(e) {
        console.error("❌ DB 연결 실패:", e.message);
        return;
    }

    // 통째로 복사해올 '순수 웹 데이터 + 시스템 데이터' 목록
    const tables = [
        'dev_notes',
        'suggestions',
        'weekly_reports',
        'notices',
        'resources',
        'inquiries',
        'calendar_events',
        'item_master',
        'settings'
    ];

    for (const table of tables) {
        console.log(`⏳ [${table}] 테이블 내용물 펌프 중...`);
        try {
            // 1. 스테이징 테이블의 실제 구조(컬럼) 확인
            const stgSchemaRes = await stg.query(`SELECT column_name FROM information_schema.columns WHERE table_name = '${table}'`);
            if (stgSchemaRes.rows.length === 0) {
                console.log(`   - ⚠️ 스테이징에 ${table} 테이블이 없어 건너뜁니다.`);
                continue;
            }
            const stgColumns = stgSchemaRes.rows.map(r => r.column_name);

            // 2. 상용 데이터 조회
            const prodRes = await prod.query(`SELECT * FROM public.${table}`);
            const rows = prodRes.rows;
            
            if (rows.length === 0) {
                console.log(`   - 📭 상용에 데이터가 비어있어 패스.`);
                continue;
            }

            // 3. 스테이징 초기화 (충돌 방지)
            await stg.query(`TRUNCATE TABLE public.${table} CASCADE`);
            
            // 4. 데이터 밀어넣기 (스테이징에 존재하는 컬럼만 매칭시켜서 넣음)
            let inserted = 0;
            for (const row of rows) {
                const colsToInsert = stgColumns.filter(c => Object.prototype.hasOwnProperty.call(row, c));
                if (colsToInsert.length === 0) continue;

                const vals = colsToInsert.map(c => row[c]);
                const placeholders = colsToInsert.map((_, i) => `$${i + 1}`).join(', ');
                const colNames = colsToInsert.map(c => `"${c}"`).join(', ');
                
                await stg.query(`INSERT INTO public.${table} (${colNames}) VALUES (${placeholders})`, vals);
                inserted++;
            }
            console.log(`   - ✅ 복사 성공: 총 ${inserted}건의 데이터 전송 완료.`);
        } catch (e) {
            console.log(`   - ❌ 에러: ${e.message}`);
        }
    }
    
    console.log(`\n⏳ [users] (사용자 계정 정보) 업데이트 중...`);
    try {
        const prodRes = await prod.query(`SELECT * FROM public.users`);
        let inserted = 0;
        let updated = 0;
        for (const row of prodRes.rows) {
            const stgCheck = await stg.query(`SELECT * FROM public.users WHERE email = $1`, [row.email]);
            if (stgCheck.rows.length === 0) {
                await stg.query(
                    `INSERT INTO public.users (id, email, password, name, role, rank, status) VALUES ($1, $2, '1', $3, $4, $5, $6)`,
                    [row.id, row.email, row.name, row.role || 'user', row.rank, row.status || 'Active']
                );
                inserted++;
            } else {
                 await stg.query(
                    `UPDATE public.users SET name=$1, role=$2, rank=$3, status=$4 WHERE email=$5`,
                    [row.name, row.role || 'user', row.rank, row.status || 'Active', row.email]
                );
                updated++;
            }
        }
        console.log(`   - ✅ 계정 최신화 완료: ${inserted}명 추가, ${updated}명 정보 업데이트.`);
    } catch (e) {
        console.log(`   - ❌ 에러: ${e.message}`);
    }

    await prod.end();
    await stg.end();
    console.log("\n🎯 1차 데이터 동기화(복제) 작업이 모두 끝났습니다! 이제 새로고침해보십시오!");
}

sync();
