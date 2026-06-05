import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// 1. 환경변수 우선순위 로드 (.env.local 우선, 후 .env 폴백)
dotenv.config({ path: path.resolve(rootDir, '.env.local') });
dotenv.config({ path: path.resolve(rootDir, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ 환경변수에서 Supabase URL 또는 키를 찾을 수 없습니다 (.env.local 확인 요망).");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const DB_JSON_PATH = path.resolve(rootDir, 'db.json');

// 2. 동기화 타겟 7대 핵심 테이블 (차장님 지시 사항 반영)
const TARGET_TABLES = [
  'users',
  'dev_notes',
  'notices',
  'weekly_reports',
  'process_inspections',
  'receiving_inspections',
  'system_settings'
];

async function pullData() {
  console.log("⬇️ [Pull] Supabase 테스트 DB에서 로컬 모래놀이터로 데이터 추출을 시작합니다...");
  
  // 방어막: 기존 db.json 파일 백업 생성 (Timestamp 기준)
  if (fs.existsSync(DB_JSON_PATH)) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 15);
    const backupPath = `${DB_JSON_PATH}.bak_${timestamp}`;
    fs.copyFileSync(DB_JSON_PATH, backupPath);
    console.log(`📁 기존 db.json 안전 백업 파일 생성 완료: ${path.basename(backupPath)}`);
  }

  const dbData = {};
  for (const table of TARGET_TABLES) {
    console.log(`- Fetching table: ${table}...`);
    const { data, error } = await supabase.from(table).select('*');
    if (error) {
      console.warn(`⚠️ [${table}] 가져오기 오류 (권한 부족 또는 미존재): ${error.message}`);
      dbData[table] = [];
    } else {
      dbData[table] = data || [];
      console.log(`  ✅ ${data?.length || 0}개 레코드 추출 성공`);
    }
  }

  fs.writeFileSync(DB_JSON_PATH, JSON.stringify(dbData, null, 2), 'utf-8');
  console.log(`🎉 [Pull 완료] ${TARGET_TABLES.length}개 핵심 테이블 모래놀이터 세팅이 완료되었습니다.`);
}

async function pushData() {
  console.log("⬆️ [Push] 로컬 db.json의 변경 사항을 Supabase 테스트 DB에 덮어씌웁니다.");
  
  if (!fs.existsSync(DB_JSON_PATH)) {
    console.error("❌ 로컬 db.json 파일이 존재하지 않습니다. 먼저 db:pull을 실행하여 환경을 구성하십시오.");
    process.exit(1);
  }

  // 방어막: 덮어쓰기 전 2차 확인 프롬프트 Y/N
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question(`\n⚠️ [주의] 로컬 데이터를 테스트 DB로 덮어씌우시겠습니까? (Y/N): `, async (answer) => {
    rl.close();
    if (answer.toLowerCase() === 'y') {
      console.log("🚀 메인 DB Upsert(덮어쓰기) 작업 진행 중...");
      
      const rawData = fs.readFileSync(DB_JSON_PATH, 'utf-8');
      let dbData;
      try {
        dbData = JSON.parse(rawData);
      } catch (e) {
        console.error("❌ db.json 파싱 오류. JSON 형식을 확인하십시오:", e);
        process.exit(1);
      }

      for (const table of TARGET_TABLES) {
        const records = dbData[table];
        if (!records || records.length === 0) continue;
        
        console.log(`- Upserting ${table}... (${records.length}건 대기)`);
        
        // Upsert 방식 적용 (기존 PK와 충돌 시 덮어쓰기)
        const { error } = await supabase.from(table).upsert(records);
        if (error) {
          console.error(`❌ [${table}] 덮어쓰기 실패: ${error.message}`);
        } else {
          console.log(`  ✅ [${table}] 서버 반영 성공`);
        }
      }
      console.log("🎉 [Push 완료] 덮어쓰기 작업이 모두 안전하게 종료되었습니다.");
    } else {
      console.log("⛔ 작업이 취소되었습니다. 실서버 데이터는 보존됩니다.");
    }
  });
}

const command = process.argv[2];
if (command === 'pull') {
  pullData();
} else if (command === 'push') {
  pushData();
} else {
  console.error("❌ 알 수 없는 명령어입니다. 사용법: node scripts/sync-db.js [pull/push]");
  process.exit(1);
}
