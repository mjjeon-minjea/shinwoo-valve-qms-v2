const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// 환경변수 로드
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const docPath = 'docs';
const mappings = [
  { file: 'dev_notes_v0.21.0_P10.md', version: 'v0.21.0', title: '[P10] DB 자동 동기화 엔진 구축 (sync-db.js)' },
  { file: 'dev_notes_v0.22.0_P11.md', version: 'v0.22.0', title: '[P11] 초기 비밀번호 강제 변경 UI 구현' },
  { file: 'dev_notes_v0.22.1_P11.md', version: 'v0.22.1', title: '[P11] 보안 UI 고도화 및 Auth-DB 이중 동기화' },
  { file: 'dev_notes_v0.23.0_P12.md', version: 'v0.23.0', title: '[P12] DNAS(개발자 노트 자동화 및 승인 시스템) 이식' }
];

async function sync() {
  console.log('🚀 개발자 노트 Full Content 정밀 동기화 시작...');

  // 1. 기존 Draft 삭제 (중복 방지)
  const { data: currentDrafts } = await supabase.from('dev_notes').select('id').eq('status', 'draft');
  if (currentDrafts && currentDrafts.length > 0) {
    for (const d of currentDrafts) {
      await supabase.from('dev_notes').delete().eq('id', d.id);
    }
    console.log(`🗑️ 기존 초안 ${currentDrafts.length}건 삭제 완료.`);
  }

  // 2. 로컬 db.json 로드
  const db = JSON.parse(fs.readFileSync('db.json', 'utf8'));
  db.dev_notes = db.dev_notes.filter(n => n.status !== 'draft');

  // 3. 파일 -> DB 동기화
  for (const map of mappings) {
    const filePath = path.join(docPath, map.file);
    if (fs.existsSync(filePath)) {
      const fullContent = fs.readFileSync(filePath, 'utf8');
      
      const newNote = {
        id: require('crypto').randomUUID(),
        title: map.title,
        content: fullContent, // 전체 내용 주입
        version: map.version,
        status: 'draft',
        author: '시스템 AI',
        date: '2026-04-10',
        type: '개발자 노트',
        source: 'DNAS',
        created_at: new Date().toISOString()
      };

      // 로컬 db.json 업데이트
      db.dev_notes.unshift(newNote);

      // Supabase 업데이트
      const { error } = await supabase.from('dev_notes').insert(newNote);
      if (error) {
        console.error(`❌ [${map.version}] 삽입 실패: ${error.message}`);
      } else {
        console.log(`✅ [${map.version}] 전체 내용 동기화 완료.`);
      }
    } else {
        console.error(`❌ 파일을 찾을 수 없음: ${filePath}`);
    }
  }

  // 로컬 db.json 저장
  fs.writeFileSync('db.json', JSON.stringify(db, null, 2));
  console.log('🎉 모든 동기화 공정 종료.');
}

sync();
