const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase 설정 로드 실패. .env.local을 확인하십시오.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const dbPath = path.join(__dirname, '..', 'db.json');

const dateMap = {
    "v0.24.0": { date: "2026-04-12", created: "2026-04-12T00:46:00Z" },
    "v0.24.1": { date: "2026-04-12", created: "2026-04-12T00:46:00Z" },
    "v0.25.0": { date: "2026-04-12", created: "2026-04-12T00:46:00Z" },
    "v0.25.1": { date: "2026-04-13", created: "2026-04-13T10:00:00Z" },
    "v0.25.2": { date: "2026-04-16", created: "2026-04-16T10:00:00Z" },
    "v0.26.0": { date: "2026-04-23", created: "2026-04-23T10:00:00Z" },
    "v1.0.0": { date: "2026-04-28", created: "2026-04-28T10:00:00Z" },
    "v1.0.1": { date: "2026-05-08", created: "2026-05-08T10:00:00Z" },
    "v1.0.2": { date: "2026-05-15", created: "2026-05-15T10:00:00Z" },
    "v1.1.0": { date: "2026-05-18", created: "2026-05-18T10:00:00Z" },
    "v1.1.1": { date: "2026-05-22", created: "2026-05-22T10:00:00Z" },
    "v2.0.0": { date: "2026-05-26", created: "2026-05-26T10:00:00Z" },
    "v2.1.0": { date: "2026-05-27", created: "2026-05-27T10:00:00Z" },
    "v2.2.0": { date: "2026-05-28", created: "2026-05-28T10:00:00Z" },
    "v2.3.0": { date: "2026-06-04", created: "2026-06-04T13:30:00Z" }
};

async function backdateAll() {
    try {
        // 1. 로컬 db.json 수정
        if (!fs.existsSync(dbPath)) throw new Error('db.json 파일을 찾을 수 없습니다.');
        const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

        console.log('🔄 [로컬 DB] 작성일 소급 보정을 시작합니다...');
        let localFixCount = 0;

        for (let note of db.dev_notes) {
            if (dateMap[note.version]) {
                const target = dateMap[note.version];
                note.date = target.date;
                note.created_at = target.created;
                note.updated_at = target.created;
                localFixCount++;
            }
        }

        fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
        console.log(`✅ [로컬 DB] ${localFixCount}건의 소급 보정 완료.`);

        // 2. Supabase Staging DB 수정
        console.log('\n🔄 [Staging DB] 작성일 소급 보정을 시작합니다...');
        let remoteFixCount = 0;

        for (const [version, target] of Object.entries(dateMap)) {
            const { error } = await supabase
                .from('dev_notes')
                .update({
                    date: target.date,
                    created_at: target.created,
                    updated_at: target.created
                })
                .eq('version', version);

            if (error) {
                console.error(`❌ [Staging] ${version} 보정 실패: ${error.message}`);
            } else {
                remoteFixCount++;
                console.log(`🚀 [Staging] ${version} -> ${target.date} 보정 성공`);
            }
        }

        console.log(`\n🎉 소급 적용 완수! 로컬: ${localFixCount}건 / Staging: ${remoteFixCount}건`);
    } catch (err) {
        console.error(`🚨 오류 발생: ${err.message}`);
    }
}

backdateAll();
