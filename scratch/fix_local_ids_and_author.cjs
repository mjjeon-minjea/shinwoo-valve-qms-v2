const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dbPath = path.join(__dirname, '..', 'db.json');

if (!fs.existsSync(dbPath)) {
    console.error('db.json 파일을 찾을 수 없습니다.');
    process.exit(1);
}

const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

if (!db.dev_notes) {
    db.dev_notes = [];
}

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
let idFixCount = 0;
let authorFixCount = 0;

for (let note of db.dev_notes) {
    // 1. UUID 포맷이 아니면 UUID로 강제 마이그레이션
    if (!uuidRegex.test(note.id)) {
        const oldId = note.id;
        note.id = crypto.randomUUID();
        idFixCount++;
        console.log(`🔧 ID 갱신: ${note.version} (${oldId} -> ${note.id})`);
    }

    // 2. 담당자 항목 "Antigravity"로 고정 통일
    if (note.author !== "Antigravity") {
        const oldAuthor = note.author;
        note.author = "Antigravity";
        authorFixCount++;
    }
}

fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');

console.log(`\n🎉 로컬 DB 마이그레이션 작업 완료!`);
console.log(`- UUID 수정: ${idFixCount}건`);
console.log(`- 담당자 명칭("Antigravity") 고정 수정: ${authorFixCount}건`);
