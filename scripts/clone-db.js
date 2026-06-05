/**
 * clone-db.js — 메인 DB → 테스트 DB 단방향 데이터 복제 스크립트
 * 
 * 용도: 메인(prod) Supabase의 핵심 테이블 데이터를 테스트(staging) Supabase로 복제합니다.
 * 방향: Prod → Staging (단방향, Read-Only)
 * 방어: 메인 DB에 대한 쓰기(insert/update/upsert/delete)는 Proxy 래퍼로 물리 차단됩니다.
 * 
 * 필수 환경변수 (.env.local):
 *   PROD_SUPABASE_URL       — 메인 DB HTTP URL (W1에서 확정)
 *   PROD_SERVICE_ROLE_KEY    — 메인 DB service-role JWT
 *   VITE_SUPABASE_URL        — 테스트 DB HTTP URL
 *   SUPABASE_SERVICE_ROLE_KEY — 테스트 DB service-role JWT
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// ── 환경변수 로드 ──
const prodUrl = process.env.PROD_SUPABASE_URL;
const prodKey = process.env.PROD_SERVICE_ROLE_KEY;
const stagingUrl = process.env.VITE_SUPABASE_URL;
const stagingKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!prodUrl || !prodKey) {
  console.error('❌ 메인 DB 좌표 미설정. W1 완료 후 .env.local에 PROD_SUPABASE_URL·PROD_SERVICE_ROLE_KEY를 설정하세요.');
  process.exit(1);
}
if (!stagingUrl || !stagingKey) {
  console.error('❌ 테스트 DB 좌표 미설정. .env.local에 VITE_SUPABASE_URL·SUPABASE_SERVICE_ROLE_KEY를 확인하세요.');
  process.exit(1);
}

// ── 메인 DB 읽기전용 보호 래퍼 (Proxy 방어) ──
function createReadOnlyClient(url, key) {
  const client = createClient(url, key, { auth: { persistSession: false } });

  const originalFrom = client.from.bind(client);
  client.from = (table) => {
    const queryBuilder = originalFrom(table);
    const BLOCKED = ['insert', 'update', 'upsert', 'delete'];
    for (const method of BLOCKED) {
      queryBuilder[method] = () => {
        throw new Error(`🚫 [BLOCKED] 메인 DB(prod)에 대한 ${method}() 호출이 물리 차단되었습니다. table=${table}`);
      };
    }
    return queryBuilder;
  };

  return client;
}

// ── 클라이언트 생성 ──
const prodDb = createReadOnlyClient(prodUrl, prodKey);
const stagingDb = createClient(stagingUrl, stagingKey, { auth: { persistSession: false } });

// ── 복제 대상 테이블 ──
const TARGET_TABLES = [
  'users',
  'weekly_reports',
  'inspections',
  'item_master',
  'process_inspections',
  'calendar_events',
  'inquiries',
  'resources',
  'suggestions',
];

// ── 메인 실행 ──
async function main() {
  console.log('🔄 [clone-db] 메인 DB → 테스트 DB 단방향 복제를 시작합니다.');
  console.log(`   소스(prod):   ${prodUrl}`);
  console.log(`   타겟(staging): ${stagingUrl}`);
  console.log('');

  let totalRows = 0;

  for (const table of TARGET_TABLES) {
    process.stdout.write(`  📋 ${table} ... `);

    // prodDb: select('*')만 호출 (읽기 전용)
    const { data, error } = await prodDb.from(table).select('*');

    if (error) {
      console.log(`⚠️ 읽기 실패: ${error.message}`);
      continue;
    }

    if (!data || data.length === 0) {
      console.log('(0건 — 빈 테이블)');
      continue;
    }

    // stagingDb: upsert만 호출 (쓰기 대상)
    const { error: upsertErr } = await stagingDb.from(table).upsert(data, {
      onConflict: 'id',
      ignoreDuplicates: false,
    });

    if (upsertErr) {
      console.log(`❌ 쓰기 실패: ${upsertErr.message}`);
    } else {
      console.log(`✅ ${data.length}건 복제 완료`);
      totalRows += data.length;
    }
  }

  console.log('');
  console.log(`🎉 [clone-db 완료] ${TARGET_TABLES.length}개 테이블, 총 ${totalRows}건 복제.`);
  console.log('   prodDb 쓰기 시도: 0건 (Proxy 물리 차단 활성)');
}

main().catch((err) => {
  console.error('❌ 치명 오류:', err.message);
  process.exit(1);
});
