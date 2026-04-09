/**
 * [주간보고 정상화] authorId 타입 충돌 해소 마이그레이션 스크립트 (supabase-js 버전)
 * pg 포트(5432) 차단 환경 대응 — Supabase REST API 방식으로 전환
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

async function run() {
    console.log('[마이그레이션] supabase-js 방식으로 시작...\n');

    // ─────────────────────────────────────────
    // Step 1. UUID 매핑 업데이트 (REST API로 가능한 UPDATE)
    // ─────────────────────────────────────────
    const migrations = [
        { name: '전민재',  oldId: '1',              newUuid: '6a40cb30-1c44-4404-bb1e-433344028380' },
        { name: '이종선',  oldId: '2',              newUuid: '46e5f64c-04f7-4eb7-8c72-70bc0515b867' },
        { name: '손양수',  oldId: '1769999551878',  newUuid: '33bf8c0a-30e4-4d8b-851c-db411dce4778' },
        { name: '황희찬',  oldId: '1769999649940',  newUuid: '7f56f495-b4b0-4b50-90b2-81de82e11336' },
        { name: '조승현',  oldId: '1769999734858',  newUuid: 'b2b1c978-b1ac-43ee-8854-1932aec2091c' }
    ];

    console.log('[Step 1] UUID 매핑 업데이트...');
    for (const m of migrations) {
        const { data, error } = await supabase
            .from('weekly_reports')
            .update({ authorId: m.newUuid })
            .eq('authorId', m.oldId)
            .select('id');
        if (error) {
            console.error(`  ❌ ${m.name} 업데이트 실패:`, error.message);
        } else {
            console.log(`  ✅ ${m.name}: ${m.oldId} → ${m.newUuid} (${data.length}건 갱신)`);
        }
    }

    // ─────────────────────────────────────────
    // Step 2. 불량 데이터(Hack) 삭제
    // ─────────────────────────────────────────
    console.log('\n[Step 2] 불량 데이터 삭제...');
    const { data: delData, error: delErr } = await supabase
        .from('weekly_reports')
        .delete()
        .eq('authorId', 'null')
        .select('id');
    if (delErr) {
        console.error('  ❌ 삭제 실패:', delErr.message);
    } else {
        console.log(`  ✅ Hack 데이터 ${delData.length}건 삭제 완료`);
    }

    // ─────────────────────────────────────────
    // Step 3. 검증
    // ─────────────────────────────────────────
    console.log('\n[Step 3] 마이그레이션 결과 검증...');
    const { data: rows, error: checkErr } = await supabase
        .from('weekly_reports')
        .select('authorId, authorName');

    if (checkErr) {
        console.error('  ❌ 검증 조회 실패:', checkErr.message);
        return;
    }

    // distinct by authorId
    const seen = new Set();
    const distinct = rows.filter(r => {
        if (seen.has(r.authorId)) return false;
        seen.add(r.authorId);
        return true;
    });

    console.log('  현재 weekly_reports distinct authorId 목록:');
    distinct.forEach(r => {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(r.authorId);
        console.log(`  ${isUuid ? '✅' : '❌ [잔여 구형ID]'} ${r.authorName}: ${r.authorId}`);
    });

    // ─────────────────────────────────────────
    // Step 4. ALTER TABLE 안내 (REST API로 불가, SQL Editor 필요)
    // ─────────────────────────────────────────
    console.log('\n════════════════════════════════════════════');
    console.log('⚠️  [필수 후속 작업] Supabase SQL Editor 실행 필요');
    console.log('  아래 SQL을 Supabase 대시보드 > SQL Editor에 붙여넣기 하세요:');
    console.log('────────────────────────────────────────────');
    console.log(`ALTER TABLE public.weekly_reports`);
    console.log(`  ALTER COLUMN "authorId" TYPE text USING "authorId"::text;`);
    console.log(``);
    console.log(`ALTER TABLE public.calendar_events`);
    console.log(`  ALTER COLUMN "authorId" TYPE text USING "authorId"::text;`);
    console.log('════════════════════════════════════════════');
    console.log('\n🎉 UPDATE/DELETE 마이그레이션 완료!');
}

run();
