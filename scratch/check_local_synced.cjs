const fs = require('fs');

function compareVersions(a, b) {
    const parse = (v) => (v || 'v0.0.0').replace(/[^\d.]/g, '').split('.').map(Number);
    const [ma, mia, pa] = parse(a.version);
    const [mb, mib, pb] = parse(b.version);
    
    if (ma !== mb) return mb - ma;
    if (mia !== mib) return mib - mia;
    if (pa !== pb) return pb - pa;
    
    return new Date(b.created_at || b.date) - new Date(a.created_at || a.date);
}

try {
    const db = JSON.parse(fs.readFileSync('db.json', 'utf8'));
    const notes = db.dev_notes || [];
    
    // published 이고 is_synced 가 true 인 건들 필터링
    const syncedNotes = notes
        .filter(n => n.status === 'published' && n.is_synced === true)
        .sort(compareVersions);
        
    console.log('=== 로컬 DB 기준 실서버(Supabase) 동기화 완료 목록 ===');
    syncedNotes.forEach((n, idx) => {
        console.log(`[${idx + 1}] 버전: ${n.version} | 제목: ${n.title} | 날짜: ${n.date}`);
    });
} catch (err) {
    console.error('에러:', err.message);
}
