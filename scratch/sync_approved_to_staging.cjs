const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// 1. .env.local 환경변수 로드
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase 설정 로드 실패. .env.local을 확인하십시오.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function syncToStaging() {
    try {
        // 2. 로컬 DB에서 승인 완료되었으나 동기화되지 않은 개발자 노트 조회
        const res = await fetch('http://localhost:3001/dev_notes');
        if (!res.ok) throw new Error(`로컬 DB 조회 실패: ${res.status}`);
        
        const allNotes = await res.json();
        const pendingSync = allNotes.filter(n => n.status === 'published' && !n.is_synced);

        if (pendingSync.length === 0) {
            console.log('✅ Staging으로 전송할 신규 승인 완료 건이 없습니다.');
            return;
        }

        console.log(`총 ${pendingSync.length}건의 로컬 승인 노트를 발견했습니다. Staging DB 전송을 개시합니다...`);

        let successCount = 0;

        for (const note of pendingSync) {
            // 3. Supabase 스키마에 맞게 데이터 정제 (is_synced 필드 및 local uuid 제거)
            const syncData = { ...note };
            delete syncData.is_synced; // Supabase에 존재하지 않는 컬럼 제거
            
            // id 필드가 만약 UUID가 아니거나 임의의 숫자 문자열이면 Supabase에서 충돌이 날 수 있음
            // Supabase dev_notes의 id가 UUID 타입인지, 혹은 serial int 타입인지 검사해야함
            // schema cache 에러가 나면 id도 제거하고 upsert(onConflict: 'version') 또는 upsert(onConflict: 'id') 시도
            
            console.log(`[Staging] ${note.version} (${note.title}) 전송 시도...`);

            // PK (id) 기준으로 upsert
            const { error: syncErr } = await supabase
                .from('dev_notes')
                .upsert([syncData], { onConflict: 'id' });

            if (syncErr) {
                console.error(`❌ Staging 전송 실패: ${note.version} - Code: ${syncErr.code}, Message: ${syncErr.message}`);
                continue;
            }

            // 로컬 DB 동기화 플래그 업데이트
            const patchRes = await fetch(`http://localhost:3001/dev_notes/${note.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_synced: true })
            });

            if (patchRes.ok) {
                successCount++;
                console.log(`🚀 전송 성공: ${note.version} - ${note.title}`);
            } else {
                console.error(`⚠️ 로컬 동기화 플래그 업데이트 실패: ${note.version}`);
            }
        }

        console.log(`\n🎉 Staging 동기화 완료! 총 ${pendingSync.length}개 중 ${successCount}개 배포 완료.`);
    } catch (err) {
        console.error(`🚨 치명적 오류 발생: ${err.message}`);
    }
}

syncToStaging();
