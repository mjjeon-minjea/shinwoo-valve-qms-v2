const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const publishDate = new Date().toLocaleString('ko-KR', { 
    year: 'numeric', month: '2-digit', day: '2-digit', 
    hour: '2-digit', minute: '2-digit', hour12: false 
}).replace(/\. /g, '-').replace(/\./g, '');

async function finalize() {
    console.log('🏁 [DNAS 3단계] 최종 승인 및 실서버 배포를 시작합니다...');

    const { data: drafts, error: fetchError } = await supabase
        .from('dev_notes')
        .select('id, version')
        .eq('status', 'draft');

    if (fetchError) {
        console.error('Error fetching drafts:', fetchError.message);
        return;
    }

    if (!drafts || drafts.length === 0) {
        console.log('No drafts to publish.');
    } else {
        for (const draft of drafts) {
            const { error: updateError } = await supabase
                .from('dev_notes')
                .update({ status: 'published', date: publishDate })
                .eq('id', draft.id);

            if (updateError) {
                console.error(`Error publishing ${draft.version}:`, updateError.message);
            } else {
                console.log(`[${draft.version}] Published successfully.`);
            }
        }
    }

    // 로컬 db.json 업데이트
    const db = JSON.parse(fs.readFileSync('db.json', 'utf8'));
    let count = 0;
    db.dev_notes.forEach(n => {
        if (n.status === 'draft') {
            n.status = 'published';
            n.date = publishDate;
            count++;
        }
    });

    if (count > 0) {
        fs.writeFileSync('db.json', JSON.stringify(db, null, 2));
        console.log(`Local db.json updated (${count} records).`);
    }

    console.log('✅ 모든 공정이 완료되었습니다.');
}

finalize();
