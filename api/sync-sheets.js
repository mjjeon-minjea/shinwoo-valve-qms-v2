import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

// Node.js 환경변수 로드
dotenv.config({ path: './.env.local' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_KEY = SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;
/* 042 P8 — 잠금 창을 15분에서 **5분**으로 줄였다.
   크론이 10분마다 도는데 잠금이 15분이면, 앞 실행이 running 으로 남은 순간
   그 다음 두 판이 통째로 막힌다. 창은 주기보다 짧아야 한다. */
const SYNC_LOCK_WINDOW_MINUTES = Number(process.env.SYNC_LOCK_WINDOW_MINUTES || 5);

const STANDARD_CATEGORIES = new Set([
  '외관부적합',
  '가공부적합',
  '주물치수부적합',
  '조립부적합',
  '재질부적합',
  '합격',
  '기타'
]);

// Supabase 클라이언트 생성. RLS-enabled cache/log tables require service_role access.
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 로컬 검증 단계(STAGE 1)용 가상 Mock CSV 데이터 (구글 시트가 없을 때의 폴백)
const MOCK_CSV = `품목번호,제품명,입고일,업체명,입고,검사(함수),부적합,인수검사 보고서 번호,업태(함수),부적합 유형
ITEM-SW-V01,게이트밸브 100A,2026-05-29,강남금속,150,150,2,SR-20260529-001,외주가공,주물치수부적합
ITEM-SW-V02,글로브밸브 50A,2026-05-29,신우산업,80,80,0,SR-20260529-002,주물류,
ITEM-SW-V03,체크밸브 80A,2026-05-29,한성정밀,120,120,5,SR-20260529-003,외주가공,흠집 및 도장 불량
ITEM-SW-V04,스트레이너 65A,2026-05-29,삼영금속,200,200,3,SR-20260529-004,주물류,주물부적합
ITEM-SW-V05,감압밸브 40A,2026-05-29,신우정밀,50,50,1,SR-20260529-005,외주가공,나사산 가공 오류
ITEM-SW-V06,버터플라이밸브 150A,2026-05-29,동양금속,90,90,4,SR-20260529-006,외주가공,조립 뻑뻑함`;

/* ── 042 P8 : 호출 인증 ────────────────────────────────────────────────────────
   이 함수는 그전까지 **아무나 부를 수 있었다**. 인증 코드가 한 줄도 없었고,
   서비스롤 키로 inspections 를 통째로 덮어쓴다. 크론(vercel.json)을 붙이는 김에
   문을 닫는다. 통과 조건은 둘 중 하나다 — 둘 다 아니면 401.

     ① 크론 :  Authorization: Bearer <CRON_SECRET>
               Vercel Cron 이 붙여 보내는 헤더다. CRON_SECRET 이 비어 있으면
               이 경로는 **열리지 않는다**(빈 문자열끼리 맞아떨어지는 사고 방지).
     ② 사람 :  Authorization: Bearer <로그인 사용자의 Supabase access_token>
               화면의 「지금 동기화」 버튼이 이 토큰을 실어 보낸다.
               검증 방식은 api/admin-update-member.js 와 **같다**(anon 클라이언트로
               auth.getUser(token)). 새 방식을 만들지 않았다.

   ②를 is_admin=true 로 더 좁힐지는 열어 둔다 — 지금 「지금 동기화」 버튼은
   로그인한 사람 모두에게 보이므로, 좁히면 그 버튼이 일반 사용자에게서 401 이 된다.
   좁히기로 하면 이 함수의 주석 아래 한 곳만 고치면 된다. (README_P8 §3 참조)          */
async function authorize(req) {
  const header = req.headers?.authorization || '';

  // ① 크론 비밀키
  if (CRON_SECRET && header === `Bearer ${CRON_SECRET}`) {
    return { ok: true, via: 'cron' };
  }

  // ② 로그인 사용자 토큰
  if (header.startsWith('Bearer ')) {
    const token = header.slice('Bearer '.length).trim();
    if (token && SUPABASE_URL && SUPABASE_ANON_KEY) {
      try {
        const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: { autoRefreshToken: false, persistSession: false }
        });
        const { data, error } = await authClient.auth.getUser(token);
        if (!error && data?.user) {
          // ↓ 관리자만 허용하려면 여기서 users.is_admin 을 한 번 더 확인하면 된다.
          return { ok: true, via: 'user', userId: data.user.id };
        }
      } catch (e) {
        // 검증 실패는 곧 미인증이다. 이유는 서버 로그에만 남긴다.
        console.error('[Sync Engine] token verify failed:', e.message);
      }
    }
  }

  return { ok: false, via: null };
}

// Vercel Serverless Function 핸들러
export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  // 042 P8 — Authorization 헤더를 받기 위해 허용 목록에 추가
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 042 P8 — 인증 게이트. 통과하지 못하면 시트도 읽지 않고 즉시 끝낸다.
  const auth = await authorize(req);
  if (!auth.ok) {
    console.warn('[Sync Engine] unauthorized sync attempt blocked.');
    return res.status(401).json({
      success: false,
      message: '인증되지 않은 동기화 요청입니다. (크론 비밀키 또는 로그인 토큰 필요)'
    });
  }

  console.log(`[Sync Engine] Starting Google Sheets Synchronization... (via ${auth.via})`);
  const logs = [];
  let syncLogId = null;

  const log = (msg) => {
    console.log(`[Sync Engine] ${msg}`);
    logs.push(`[${new Date().toISOString()}] ${msg}`);
  };

  try {
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY가 없어 sync cache/log 테이블에 접근할 수 없습니다. Staging 환경변수에 service_role 키를 설정해 주세요.');
    }

    let csvData = '';
    const sheetUrl = process.env.GOOGLE_SHEETS_CSV_URL || 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSz-OGELs_8JhV7Vrf14kdF8rrdx-VdcJXLAAc-Tr2FvdC32E4Flol7QeMoJbCVnr32SOpCX5kDsZPo/pub?gid=2043099098&single=true&output=csv';

    if (sheetUrl) {
      log('Fetching remote Google Sheet CSV from URL...');
      const response = await fetch(sheetUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch sheet. Status: ${response.status}`);
      }
      csvData = await response.text();
      log(`Remote CSV load success. Byte size: ${csvData.length}`);
    } else {
      log('[WARNING] GOOGLE_SHEETS_CSV_URL is empty! Falling back to Local Mock CSV for simulation.');
      csvData = MOCK_CSV;
    }

    // 간단하고 강력한 CSV 파서 구현 (따옴표 내 쉼표 보존)
    const rows = parseCSV(csvData);
    log(`Parsed ${rows.length} rows from CSV.`);

    if (rows.length === 0) {
      return res.status(200).json({ success: true, message: 'CSV에 데이터가 존재하지 않습니다.', logs });
    }

    const termMap = buildNormalizedTermMap(rows);
    const rawTerms = [...new Set(rows.map(r => (r['부적합 유형'] || '').trim()).filter(Boolean))];
    const nonemptyDefectRows = rows.filter(r => (r['부적합 유형'] || '').trim()).length;

    syncLogId = await createSyncLog({
      status: 'running',
      sheet_url: sheetUrl,
      sheet_gid: extractGid(sheetUrl),
      processed_rows: rows.length,
      nonempty_defect_rows: nonemptyDefectRows,
      unique_raw_terms: rawTerms.length,
      unique_normalized_terms: termMap.size
    }, log);

    await enforceNoRecentRunningSync(log, syncLogId);

    const cachedMap = await loadCachedCategories([...termMap.keys()]);
    await touchCacheHits(cachedMap, log);

    let missingTerms = [...termMap.keys()].filter(key => !cachedMap[key]);
    const seededMap = await seedCachedCategoriesFromExistingInspections(missingTerms, termMap, log);
    Object.assign(cachedMap, seededMap);
    missingTerms = [...termMap.keys()].filter(key => !cachedMap[key]);

    /* 042 P8 — 캐시에도 없고 기존 inspections 에도 없는 말은 **규칙표**로 분류한다.
       이 규칙표는 예전에도 있었다(외부 분류가 실패했을 때의 되돌림 자리).
       이제는 그것이 유일한 분류기다. 규칙은 결정적이라 같은 말은 늘 같은 값이 되고,
       계산이 공짜라 **캐시에 적어 두지 않는다** — 규칙이 틀렸을 때 그 오답이
       표에 굳어 버리는 편이 훨씬 나쁘다. defect_category_map 에는 예전처럼
       '기존 inspections 에서 되찾은 값'만 쌓인다. */
    const ruleResult = classifyMissingTermsByRule(missingTerms, termMap, log);

    const defectCategoryMap = {
      '': '합격',
      ...expandToOriginalMap(termMap, cachedMap, ruleResult.categories)
    };

    log(`Defect category resolve: total=${termMap.size}, cacheHit=${Object.keys(cachedMap).length}, ruleClassified=${missingTerms.length}`);

    // 2단계: 데이터 가공 및 Supabase Upsert 리스트 생성
    const inspectionsToUpsert = rows.map((row, index) => {
      const supplier = (row['업체명'] || '').trim();
      const itemName = (row['제품명'] || '').trim();
      const date = (row['입고일'] || '').trim();
      const totalQuantity = parseInt((row['입고'] || '0').replace(/,/g, ''), 10);
      const inspectionQuantity = parseInt((row['검사(함수)'] || '0').replace(/,/g, ''), 10);
      const defectQuantity = parseInt((row['부적합'] || '0').replace(/,/g, ''), 10);
      const inspectionReportNo = (row['인수검사 보고서 번호'] || '없음').trim();
      const itemType = (row['업태(함수)'] || '외주가공').trim();
      const originalDefectType = (row['부적합 유형'] || '').trim();
      const itemCode = (row['품목번호'] || '').trim();

      const rawId = `${supplier}_${itemName}_${date}_${totalQuantity}`;
      const hashPart = Buffer.from(rawId).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
      const safeId = `${hashPart}_${index}`;

      // 분류 맵에서 카테고리 획득
      const defectCategory = defectCategoryMap[originalDefectType] || '합격';

      return {
        id: safeId,
        date: date || new Date().toISOString().split('T')[0],
        supplier: supplier || '미지정업체',
        itemName: itemName || '미지정제품',
        totalQuantity: isNaN(totalQuantity) ? 0 : totalQuantity,
        inspectionQuantity: isNaN(inspectionQuantity) ? 0 : inspectionQuantity,
        defectQuantity: isNaN(defectQuantity) ? 0 : defectQuantity,
        result: defectQuantity > 0 ? '불합격' : '합격',
        defectType: originalDefectType ? `[${defectCategory}] ${originalDefectType}` : '',
        inspectionReportNo: inspectionReportNo || '없음',
        itemType: itemType || '외주가공',
        item_code: itemCode // 추가된 신규 컬럼 (차장님 DDL 마이그레이션 필요)
      };
    });

    log(`Upserting ${inspectionsToUpsert.length} records into Supabase "inspections" table...`);

    // Supabase Upsert 쿼리 가동 (중복 키는 UPDATE 처리)
    const { error } = await supabase
      .from('inspections')
      .upsert(inspectionsToUpsert, { onConflict: 'id' });

    if (error) {
      // 만약 'item_code' 컬럼이 DB 스키마에 없어서 42703 에러가 날 경우,
      // 예외 대응으로 item_code 컬럼을 뺀 안전본으로 2차 Upsert를 롤백 수행합니다. (피드백 루프 작동)
      if (error.code === '42703' || error.code === 'PGRST204' || (error.message && error.message.includes('item_code'))) {
        log('[EMERGENCY ROLLBACK] Column "item_code" does not exist! Running secondary fallback sync...');
        const fallbackInspections = inspectionsToUpsert.map(item => {
          const cleanItem = { ...item };
          // 임시방편: item_code가 없으므로 inspectionReportNo 필드 뒤에 품목번호를 병합 저장하여 데이터를 보존함
          if (cleanItem.item_code) {
            cleanItem.inspectionReportNo = `${cleanItem.inspectionReportNo} [품목:${cleanItem.item_code}]`;
          }
          delete cleanItem.item_code;
          return cleanItem;
        });

        const { error: fallbackError } = await supabase
          .from('inspections')
          .upsert(fallbackInspections, { onConflict: 'id' });

        if (fallbackError) {
          throw new Error(`Fallback sync failed: ${fallbackError.message}`);
        }
        log('[SUCCESS] Emergency fallback sync completed without schema error.');
      } else {
        throw error;
      }
    } else {
      log('Supabase batch Upsert successfully completed.');
    }

    await finalizeSyncLog(syncLogId, {
      status: 'success',
      finished_at: new Date().toISOString(),
      cache_hits: Object.keys(cachedMap).length,
      new_terms: missingTerms.length,
      upsert_count: inspectionsToUpsert.length
    }, log);

    return res.status(200).json({
      success: true,
      message: '구글 스프레드시트 동기화 완수 완료',
      processedCount: inspectionsToUpsert.length,
      classification: {
        totalTerms: termMap.size,
        cacheHits: Object.keys(cachedMap).length,
        ruleClassified: missingTerms.length
      },
      logs
    });

  } catch (error) {
    console.error('[Sync Engine Error]', error);
    log(`[ERROR] Sync aborted: ${error.message}`);

    const blocked = error.code === 'SYNC_ALREADY_RUNNING';
    await finalizeSyncLog(syncLogId, {
      status: blocked ? 'blocked' : 'failed',
      finished_at: new Date().toISOString(),
      blocked_reason: blocked ? error.code : null,
      error_message: error.message,
      upsert_count: 0
    }, log);

    if (blocked) {
      return res.status(429).json({
        success: false,
        blocked: true,
        reason: error.code,
        message: error.message,
        logs
      });
    }

    return res.status(500).json({
      success: false,
      message: '구글 동기화 엔진 장애 발생',
      error: error.message,
      logs
    });
  }
}

function normalizeDefectTerm(value) {
  return String(value || '').trim().replace(/\s+/g, '');
}

function normalizeStandardCategory(value) {
  const category = String(value || '').trim();
  return STANDARD_CATEGORIES.has(category) ? category : '기타';
}

function buildNormalizedTermMap(rows) {
  const termMap = new Map();
  for (const row of rows) {
    const original = (row['부적합 유형'] || '').trim();
    if (!original) continue;
    const normalized = normalizeDefectTerm(original);
    if (!normalized) continue;
    const item = termMap.get(normalized) || { representativeOriginal: original, originals: new Set() };
    item.originals.add(original);
    termMap.set(normalized, item);
  }
  return termMap;
}

async function loadCachedCategories(normalizedTerms) {
  if (normalizedTerms.length === 0) return {};
  const { data, error } = await supabase
    .from('defect_category_map')
    .select('normalized_term, standard_category, use_count')
    .in('normalized_term', normalizedTerms);

  if (error) {
    throw new Error(`defect_category_map cache read failed: ${error.message}`);
  }

  return Object.fromEntries((data || []).map(row => [row.normalized_term, {
    standardCategory: normalizeStandardCategory(row.standard_category),
    useCount: row.use_count || 0,
    source: 'cache'
  }]));
}

async function touchCacheHits(cachedMap, log) {
  const entries = Object.entries(cachedMap);
  if (entries.length === 0) return;

  for (const [normalizedTerm, row] of entries) {
    const { error } = await supabase
      .from('defect_category_map')
      .update({
        last_used_at: new Date().toISOString(),
        use_count: (row.useCount || 0) + 1,
        updated_at: new Date().toISOString()
      })
      .eq('normalized_term', normalizedTerm);

    if (error) {
      log(`[WARNING] cache hit touch failed for "${normalizedTerm}": ${error.message}`);
    }
  }
}

async function seedCachedCategoriesFromExistingInspections(missingTerms, termMap, log) {
  if (missingTerms.length === 0) return {};
  const wanted = new Set(missingTerms);
  const seeded = {};
  let from = 0;
  const pageSize = 1000;

  while (from < 20000 && wanted.size > 0) {
    const { data, error } = await supabase
      .from('inspections')
      .select('defectType')
      .range(from, from + pageSize - 1);

    if (error) {
      log(`[WARNING] existing inspection seed skipped: ${error.message}`);
      break;
    }
    if (!data || data.length === 0) break;

    for (const row of data) {
      const match = String(row.defectType || '').match(/^\[([^\]]+)\]\s*(.+)$/);
      if (!match) continue;
      const standardCategory = normalizeStandardCategory(match[1]);
      const original = match[2].trim();
      const normalized = normalizeDefectTerm(original);
      if (!wanted.has(normalized)) continue;

      const termInfo = termMap.get(normalized);
      seeded[normalized] = { standardCategory, source: 'existing_inspections' };
      wanted.delete(normalized);

      const { error: upsertError } = await supabase
        .from('defect_category_map')
        .upsert({
          original_term: termInfo?.representativeOriginal || original,
          normalized_term: normalized,
          standard_category: standardCategory,
          source: 'existing_inspections',
          model: null,
          first_classified_at: new Date().toISOString(),
          last_used_at: new Date().toISOString(),
          use_count: 1,
          updated_at: new Date().toISOString()
        }, { onConflict: 'normalized_term' });

      if (upsertError) {
        log(`[WARNING] existing inspection seed upsert failed for "${original}": ${upsertError.message}`);
      }
    }

    if (data.length < pageSize) break;
    from += pageSize;
  }

  log(`Existing inspection seed reused ${Object.keys(seeded).length} categories from the inspections table.`);
  return seeded;
}

async function enforceNoRecentRunningSync(log, currentSyncLogId = null) {
  const since = new Date(Date.now() - SYNC_LOCK_WINDOW_MINUTES * 60 * 1000).toISOString();
  let query = supabase
    .from('sync_logs')
    .select('id, started_at')
    .eq('status', 'running')
    .gte('started_at', since);

  if (currentSyncLogId) {
    query = query.neq('id', currentSyncLogId);
  }

  const { data, error } = await query.limit(1);

  if (error) {
    throw new Error(`sync lock check failed: ${error.message}`);
  }

  if (data && data.length > 0) {
    const lockError = new Error(`최근 ${SYNC_LOCK_WINDOW_MINUTES}분 내 sync 실행이 아직 running 상태입니다. 중복 실행 방지를 위해 이번 요청을 중단합니다.`);
    lockError.code = 'SYNC_ALREADY_RUNNING';
    throw lockError;
  }
  log(`Sync lock clear: no running sync in last ${SYNC_LOCK_WINDOW_MINUTES} minutes.`);
}

/* 042 P8 — 규칙표 분류기. 외부 호출이 하나도 없다(네트워크·키·요금 없음).
   말 안에 든 낱말로만 정한다. 어디에도 맞지 않으면 '기타'다 — 지어내지 않는다. */
function classifyDefectTypeByRule(defectType) {
  const text = String(defectType || '').toLowerCase();
  if (text.includes('외관') || text.includes('도장') || text.includes('흠집') || text.includes('사출')) return '외관부적합';
  if (text.includes('가공') || text.includes('나사') || text.includes('리머') || text.includes('홀')) return '가공부적합';
  if (text.includes('치수') || text.includes('공차') || text.includes('금형') || text.includes('주물')) return '주물치수부적합';
  if (text.includes('조립') || text.includes('뻑뻑') || text.includes('유격')) return '조립부적합';
  if (text.includes('재질') || text.includes('성적') || text.includes('강도')) return '재질부적합';
  return '기타';
}

function classifyMissingTermsByRule(missingTerms, termMap, log) {
  const categories = {};

  if (missingTerms.length > 0) {
    log(`Classifying ${missingTerms.length} new normalized defect terms by rule table...`);
  }

  for (const normalizedTerm of missingTerms) {
    const original = termMap.get(normalizedTerm)?.representativeOriginal || normalizedTerm;
    const standardCategory = normalizeStandardCategory(classifyDefectTypeByRule(original));
    categories[normalizedTerm] = { standardCategory, originalTerm: original, source: 'rule' };
    log(`Mapping resolved: "${original}" ➔ "${standardCategory}" (rule)`);
  }

  return { categories };
}

function expandToOriginalMap(termMap, cachedMap, newClassifications) {
  const result = {};
  for (const [normalizedTerm, item] of termMap.entries()) {
    const category = cachedMap[normalizedTerm]?.standardCategory || newClassifications[normalizedTerm]?.standardCategory || '합격';
    for (const original of item.originals) {
      result[original] = normalizeStandardCategory(category);
    }
  }
  return result;
}

async function createSyncLog(payload, log) {
  const { data, error } = await supabase
    .from('sync_logs')
    .insert(payload)
    .select('id')
    .single();

  if (error) {
    throw new Error(`sync_logs start write failed: ${error.message}`);
  }

  log(`sync_logs started: ${data.id}`);
  return data.id;
}

async function finalizeSyncLog(id, patch, log = () => {}) {
  if (!id) return;
  const { error } = await supabase
    .from('sync_logs')
    .update(patch)
    .eq('id', id);

  if (error) {
    log(`[WARNING] sync_logs finalize failed: ${error.message}`);
  }
}

function extractGid(sheetUrl) {
  try {
    return new URL(sheetUrl).searchParams.get('gid') || null;
  } catch {
    return null;
  }
}

/* ── 042 P8r2 : 헤더 별칭 정규화 (09-04) ──────────────────────────────────────
   정본 시트(2026 탭)와 옛 시트는 같은 뜻의 열을 다른 이름으로 부른다.
   아래 표는 **열 이름만** 표준명으로 바꾼다. 행 변환·id 계산식은 손대지 않았다.
     · 정본의 첫 열 머리글은 공백 한 칸이라 trim 하면 빈 문자열이 된다 → 품목번호
     · 정본에는 '업태'가 두 번 나온다(10열 세분류 · 11열 대분류). 이 표는 이름만
       바꾸므로 「뒤 열이 앞 열을 덮어쓴다」는 기존 동작이 그대로 남는다
       = 대분류(외주가공/원자재(주물)/중국공장/가공 구매품)가 채택된다. 의도대로다.
     · 표에 없는 열 이름은 건드리지 않는다('부적합 유형'·'부적합 발행' 등 그대로). */
const HEADER_ALIASES = {
  '': '품목번호',
  '품목번호': '품목번호',
  '입고수량': '입고',
  '입고': '입고',
  '검사수량': '검사(함수)',
  '검사(함수)': '검사(함수)',
  '부적합수량': '부적합',
  '부적합': '부적합',
  '업태': '업태(함수)',
  '업태(함수)': '업태(함수)'
};

function normalizeHeaderName(header) {
  return Object.prototype.hasOwnProperty.call(HEADER_ALIASES, header)
    ? HEADER_ALIASES[header]
    : header;
}

// 쉼표와 큰따옴표가 꼬여있는 정규화 CSV 파서
function parseCSV(text) {
  const lines = text.split(/\r?\n/);
  if (lines.length <= 1) return [];

  // 헤더 추출 및 청소 (BOM 문자거르기)
  // 042 P8r2 — BOM 제거 · 공백 정리 뒤에 별칭을 표준명으로 바꾼다.
  const headers = parseCSVLine(lines[0]).map(h => normalizeHeaderName(h.replace(/^\uFEFF/, '').trim()));
  const results = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    const row = {};

    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });

    if (row['제품명'] || row['업체명']) {
      results.push(row);
    }
  }

  return results;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}
