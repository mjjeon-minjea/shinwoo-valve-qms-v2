import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const { Client } = pg;

async function migrate() {
    console.log("🚧 계정 암묵적 복제 파이프라인 (auth.users & public.users) 가동...");

    // Staging and Prod DB clients
    const prodClient = new Client({ connectionString: process.env.PROD_DB_URL });
    const stgClient = new Client({ connectionString: process.env.STAGING_DB_URL });

    try {
        await prodClient.connect();
        await stgClient.connect();

        // 1. auth.users 테이블 복제 (Authentication 핵심)
        const { rows: authUsers } = await prodClient.query('SELECT * FROM auth.users;');
        console.log(`[1] 상용 인증(auth.users) 데이터 감지: ${authUsers.length}개 계정 병합 중...`);
        
        for (const user of authUsers) {
            const keys = Object.keys(user).map(k => `"${k}"`).join(', ');
            const placeholders = Object.values(user).map((_, i) => `$${i + 1}`).join(', ');
            const values = Object.values(user);
            await stgClient.query({
                text: `INSERT INTO auth.users (${keys}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING;`,
                values
            });
        }

        // 2. auth.identities 복제 (Supabase Auth 종속성 해결)
        const { rows: identities } = await prodClient.query('SELECT * FROM auth.identities;');
        console.log(`[2] 상용 신원(identities) 데이터 감지: ${identities.length}개 레코드 병합 중...`);
        for (const idty of identities) {
            const keys = Object.keys(idty).map(k => `"${k}"`).join(', ');
            const placeholders = Object.values(idty).map((_, i) => `$${i + 1}`).join(', ');
            const values = Object.values(idty);
            await stgClient.query({
                text: `INSERT INTO auth.identities (${keys}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING;`,
                values
            });
        }

        // 3. public.users 테이블 복제 (유저 프로필)
        const { rows: publicUsers } = await prodClient.query('SELECT * FROM public.users;');
        console.log(`[3] 상용 공개(public.users) 데이터 감지: ${publicUsers.length}개 프로필 병합 중...`);
        for (const user of publicUsers) {
            const keys = Object.keys(user).map(k => `"${k}"`).join(', ');
            const placeholders = Object.values(user).map((_, i) => `$${i + 1}`).join(', ');
            const values = Object.values(user);
            await stgClient.query({
                text: `INSERT INTO public.users (${keys}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING;`,
                values
            });
        }

        console.log("✅ 인증/사용자 데이터 완전 복제(Clone) 100% 성공!");
    } catch (e) {
        console.error("❌ 마이그레이션 실패:", e.message);
    } finally {
        await prodClient.end();
        await stgClient.end();
    }
}

migrate();
