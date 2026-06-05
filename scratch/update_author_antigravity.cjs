async function updateAllAuthors() {
    try {
        // 1. 전체 개발자 노트 가져오기
        const getRes = await fetch('http://localhost:3001/dev_notes');
        if (!getRes.ok) throw new Error(`목록 조회 실패: ${getRes.status}`);
        
        const notes = await getRes.json();
        console.log(`총 ${notes.length}개의 개발자 노트를 감지했습니다. 수정을 시작합니다...`);

        let successCount = 0;
        
        // 2. 루프를 돌며 각각 author 필드를 "Antigravity"로 업데이트 (PATCH)
        for (const note of notes) {
            const patchRes = await fetch(`http://localhost:3001/dev_notes/${note.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    author: "Antigravity"
                })
            });

            if (patchRes.ok) {
                successCount++;
            } else {
                const errText = await patchRes.text();
                console.error(`❌ 수정 실패: ${note.version} (ID: ${note.id}) - Status: ${patchRes.status}, Error: ${errText}`);
            }
        }

        console.log(`\n🎉 작업 완료! 총 ${notes.length}개 중 ${successCount}개의 개발자 노트 담당자를 "Antigravity"로 통일했습니다.`);
    } catch (err) {
        console.error(`🚨 치명적 에러 발생: ${err.message}`);
    }
}

updateAllAuthors();
