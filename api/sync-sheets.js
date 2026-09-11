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
/* ── 042 P8d : 측정값기록서 동기화 상수 (2026-09-10 추가) ───────────────────
   아래 세 상수는 **측정값 덩이 전용**이다. 위의 대장(gid 0) 상수·별칭표·통과조건은
   한 줄도 건드리지 않았다.                                                        */

/* 측정값기록서 탭의 gid. 시트 id 는 대장과 **같은 시트**이므로 재사용한다
   (GOOGLE_SHEETS_CSV_URL 의 gid 만 갈아 끼운다 — buildMeasurementCsvUrl 참조).
   주소를 통째로 따로 주고 싶으면 GOOGLE_SHEETS_MEAS_CSV_URL 을 쓰면 된다. */
const MEAS_SHEET_GID = String(process.env.GOOGLE_SHEETS_MEAS_GID || '40080222');

/* sql/08 이 만드는 부분 유일 인덱스의 이름. 23505 가 **이 인덱스 충돌일 때만**
   「이미 실행 중」으로 읽는다(createSyncLog 참조). 이름이 바뀌면 여기도 바꾼다. */
const SYNC_RUNNING_INDEX = 'sync_logs_one_running_per_gid';

/* ── 안전장치 임계값 ───────────────────────────────────────────────────────
   시트에서 받아 읽은 **유효 행 수**가 **기준선**의 이 비율보다 적으면
   **inspection_measurements 에 아무것도 쓰지 않고** 오류로 멈춘다.

   기준선이 무엇인지는 resolveMeasurementGuardBaseline() 에 적었다 —
   r0 은 「DB 전체 행수」였고, r1 부터는 「직전 정상 수집의 유효 행 수」다
   (예림 지적 2026-09-10 : 미삭제 행이 쌓이면 DB 행수 기준은 언젠가 정상
    수집까지 막는다).

   왜 0.8 인가 :
     · 구글 시트는 권한 만료·점검·로그인 리다이렉트 때 **빈 CSV 나 HTML 로그인
       페이지를 200 OK 로** 돌려준다. 그대로 진행하면 "0행 처리 성공"이 되어
       고장이 성공으로 기록되고, 아무도 며칠 동안 눈치채지 못한다.
     · 우리는 DELETE 를 하지 않으므로 자료가 즉시 날아가지는 않지만, **새 값이
       옛 값 위에 안 덮이는** 상태가 조용히 이어진다 — 지금 210행이 밀린 것과
       똑같은 사고가 자동으로 재발한다.
     · 정상 운영에서 시트가 한 판(10분) 사이에 20% 넘게 **줄어드는** 일은 없다.
       하루 증가분이 +2% 안팎이므로 0.8 은 오탐이 사실상 없는 값이다.
   시트를 정말로 크게 줄인 경우에만, 이 상수를 잠시 낮춰 한 판 돌린 뒤 되돌린다. */
const MEAS_MIN_ROW_RATIO = 0.8;

/* 「사라진 줄」 표시를 한 번에 몇 개씩 고칠지. UPDATE ... IN (...) 의 목록 길이다. */
const MEAS_MARK_CHUNK = 200;

/* 표를 통째로 훑을 때 한 번에 받는 줄 수. PostgREST 는 한 번에 1,000줄까지만
   준다 — 그보다 크게 잡으면 조용히 잘린 목록으로 판단하게 된다. */
const MEAS_SCAN_PAGE = 1000;

/* ── (r2 ②) 안전장치 기준선을 만드는 두 상수 ───────────────────────────────
   예림 2차 회신(2026-09-10 11:25) : 「직전 성공분만 쓰면 잘린 결과가 연속 통과할 때
   기준선도 따라 내려간다. ⓑ 최근 N판 최댓값 + ⓒ 절대 하한을 권한다. ⓑ 만으로도
   부족하다 — 정상 큰 값이 최근 N판에서 빠지면 결국 내려간다.」

   최종 임계 = **max( 최근 N판 성공기록의 processed_rows 최댓값 , 절대 하한 ) × 0.8**

   ── N = 50 을 고른 근거 ────────────────────────────────────────────────
     · 크론은 10분마다 돈다 → 50판 = **약 8시간 20분**이다. 근무일 아침에 난 사고가
       퇴근까지 이어져도 그 전의 「정상 큰 값」이 창 안에 그대로 남아 있다.
     · 이보다 짧으면(예: 20판 ≈ 3시간 20분) 반나절짜리 사고에 창이 밀려 나간다.
     · 이보다 길게 잡아도 조회 비용은 같지만(한 번에 50줄), 정상적으로 자료를
       크게 줄인 뒤 복구가 늦어지는 값이라 8시간대에서 끊었다.
     · 값 한 줄만 읽어 오므로 PostgREST 의 1,000행 페이지 제한과 무관하다.

   ── 절대 하한 = 986 을 고른 근거 (전부 실측) ────────────────────────────
     · **986** = 스테이징 `inspection_measurements` 의 현재 행수이자, 정본
       측정값기록서 09-02 스냅샷의 행수다. 곧 「우리가 눈으로 확인한 정상 수집량」이다.
     · 오늘(09-10) 같은 시트의 유효 행은 **1,196**, DB 는 **1,197** 이다.
       표는 RI 가 쌓이며 **한 방향으로만 커진다** — 8일 만에 986 → 1,196(+21%).
     · 하한 986 → 하한이 만드는 임계 = floor(986 × 0.8) = **788행**.
       이는 오늘 유효 행 1,196 의 **65.9%** 다.
       ㉮ **너무 높지 않은가** : 정상적으로 자료를 34% 넘게 줄이는 일(대량 삭제·
          보관 이관)은 사람이 결정하는 사건이다. 그때만 이 상수를 확인 후 낮춘다
          (발주서에 명시). 평상시 하루 증가분은 +2% 안팎이라 걸릴 일이 없다.
       ㉯ **너무 낮지 않은가** : 잘린 CSV 사고에서 실제로 온 값은 700줄·955줄
          수준이었다(시공보고 r1 §3 시험 4). 788 은 그 위에 있어 **실제로 막는다**.
          하한을 예컨대 300 으로 두면 700줄짜리 잘린 CSV 가 통과해 무의미해진다.
     · 이 두 상수는 **발주서에 그대로 적는다.** 정상적인 대량 삭제로 하한을
       낮춰야 할 때만 예림 확인 뒤 조정한다. */
const MEAS_GUARD_RECENT_N = 50;
const MEAS_GUARD_ABS_FLOOR = 986;

/* ── (r2 ⑤) 「없어진 줄」을 몇 번 확인해야 진짜로 없어진 것으로 보나 ────────
   예림 2차 회신 : 「수집 장애가 이어지는 동안 시간만 흘렀다는 이유로 계산에서
   제외되지 않도록, 24시간 뒤에도 **정상 수집에서 부재가 확인되는지**를 조건으로
   두는 편이 안전합니다.」

   그래서 시각(missing_since) 하나로 판단하지 않고, **검증을 통과한 정상 수집에서
   그 줄이 없었던 횟수**(missing_seen)를 따로 센다. 화면은
   **24시간 초과 AND missing_seen >= 2** 일 때만 계산에서 뺀다.

   왜 2회인가 (실측 근거) :
     · 이 횟수는 **보류·차단된 판에서는 늘지 않는다**(그 판은 표를 아예 안 건드린다).
       그러니 「2회」는 **검증을 통과한 정상 수집이 두 번 있었다**는 뜻이다.
     · 크론 10분 주기에서 24시간은 144판이다. 24시간 조건을 이미 만족한 줄이라면
       그 사이 정상 수집이 두 번 있었을 개연성이 매우 높다 → 진짜 삭제는 하루 뒤
       예정대로 빠진다(시험 8-ⓑ 로 확인).
     · 1회로 두면 「장애 뒤 첫 복구 판」 한 번에 바로 빠져 버린다. 3회 이상으로
       두면 진짜 삭제가 화면에서 사라지는 시점이 흐려진다. 둘 사이에서 2를 골랐다.
   숫자가 2 에 닿으면 **더 올리지 않는다** — 갱신 묶음이 무한히 늘지 않게 하려는 것이다.

   ── (r3 ①) 예림 3차 회신(2026-09-10 12:41) 으로 **판정 조건이 바뀌었다** ──────
   「횟수는 괜찮으나 **두 번째 이후의 정상 부재 확인이 「최초 부재로부터 24시간 지난
    뒤」에 있어야 한다.** 초기에 부재를 두 번 확인한 뒤 수집 장애가 이어지면, 단순히
    「24시간 초과 AND missing_seen>=2」만으로는 시간 경과 후 제외될 수 있다.」

   **맞는 지적이다.** r2 의 두 조건은 서로 **다른 시점**을 본다 —
     · missing_seen>=2 는 「장애가 나기 **전에** 이미 세어 둔 값」일 수 있고,
     · 24시간은 그 뒤로 **그냥 흐른 시간**이다.
   그래서 아래 순서가 실제로 성립한다(시험 11-ⓐ 로 재현했다) :
     09:00 정상 수집 — 부재 1회      → missing_since=09:00, missing_seen=1
     09:10 정상 수집 — 부재 2회      → missing_seen=2   (아직 24시간 전)
     09:20~ 수집 장애가 계속(보류)   → 표를 안 건드리니 아무 것도 안 는다
     이틀 뒤                          → **24시간 초과 AND seen>=2 가 둘 다 참**
                                        = 아무도 24시간 뒤에 확인한 적이 없는데 제외된다.

   r3 은 그래서 **「24시간 뒤의 정상 수집에서도 여전히 부재였다」는 사실 자체를 기록**
   한다 — missing_confirmed_at. 이 칸은 아래 셋이 모두 맞을 때 **처음 한 번만** 채운다 :
     ㉠ 여기(reconcileMeasurementMissing)까지 온 판 = **검증을 통과한 정상 수집**,
     ㉡ 그 줄이 이번 시트에도 **없다**,
     ㉢ now() - missing_since >= MEAS_MISSING_CONFIRM_MS(24시간).
   이미 값이 있으면 **덮지 않는다.** 시트에 다시 나타나면 세 칸을 **전부 초기화**한다.

   **화면 제외 조건은 이제 「missing_confirmed_at 이 있다」 하나뿐이다.**
   missing_seen >= 2 를 AND 로 함께 두지 **않는** 이유 :
     · 이 칸은 ㉠㉡㉢ 를 다 만족한 정상 수집에서만 쓰인다. 그 판 자체가 「부재 확인」
       이고, missing_since 를 찍은 판이 그 앞에 반드시 있었다 → **정상 수집에서의
       부재 확인이 2회 이상**이라는 뜻을 이 칸 하나가 이미 품고 있다(중복 조건이다).
     · 조건을 하나 더 얹으면 오히려 구멍이 생긴다 — missing_since 는 있는데
       missing_seen 이 비어 있는 **옛 배포 잔재 행**은 seen 이 1 로 보정되는 판에
       confirmed_at 이 함께 찍힐 수 있고, 그때 seen>=2 를 요구하면 진짜 삭제가
       한 판 더 늦게까지 화면에 남는다. 판정 근거를 **한 칸**으로 모으는 편이 맞다.
     · missing_seen 은 그대로 둔다 — 사람이 「몇 번 확인됐나」를 보기 위한 값이다. */
const MEAS_MISSING_SEEN_REQUIRED = 2;

/* (r3 ①) 「최초 부재로부터 이만큼 지난 뒤의 정상 수집」에서 재확인해야 제외한다.
   화면(inboundSpc.js MISSING_GRACE_MS)과 **같은 24시간**이다. 두 곳의 값이 다르면
   「화면은 뺐는데 DB 에는 확인 기록이 없는」 상태가 생기므로 같이 고쳐야 한다. */
const MEAS_MISSING_CONFIRM_MS = 24 * 60 * 60 * 1000;

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
  // 042 P8d — 측정값 덩이 결과. 대장 결과와 섞이지 않게 따로 담는다.
  let measResult = null;

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

    /* ── (r12) **잠금을 CSV 읽기보다 먼저 잡는다** (예림 5차 예고) ───────────
       r11 까지는 CSV 를 먼저 읽고 그 다음에 이 줄을 넣었다. 그러면 —
         · A 가 **옛 CSV** 를 읽고 지연된다(잠금은 아직 없다)
         · 그 사이 B 가 **새 CSV** 를 읽고 전부 반영하고 끝난다
         · 그제야 A 가 잠금을 얻어 **옛 값으로 덮는다**
       쓰기 자체는 직렬인데 **입력 순서가 뒤집힌다.** 잠금을 앞으로 옮기면 A 가
       CSV 를 읽는 동안 B 는 **시작조차 못 하므로** 그 구간이 사라진다.
       코드를 더한 것이 아니라 **이 블록을 위로 옮긴 것**이다.

       **대가(의도한 동작)** : 잠금을 쥐고 있는 시간이 **CSV 를 받는 시간만큼**
       길어진다. 그 동안 겹친 판은 건너뛴다 — 시트가 느린 날 한 판을 거르는 쪽이,
       옛 값이 새 값을 덮는 쪽보다 낫다. 크론은 10분 주기라 다음 판이 곧 온다.

       **CSV 를 못 읽으면** : 아래 throw 가 catch 로 가서 이 줄을 `failed` 로 닫는다.
       **읽기 실패는 「미확인」이 아니다** — 이 잠금 아래에서 **쓴 것이 하나도 없으므로**
       나중에 반영될 것도 없다. 미확인은 **쓰기**에만 쓴다(throwWriteFailure).
       시트가 느리다고 잠금을 열어 둔 채 사람을 부르면 운영이 멈춘다.

       행 수 관련 칸(processed_rows·nonempty_defect_rows·unique_*_terms)은 CSV 를
       읽어야 알 수 있으므로 **마무리(success) 때 적는다** — 값과 뜻은 그대로다. */
    syncLogId = await createSyncLog({
      status: 'running',
      sheet_url: sheetUrl,
      sheet_gid: extractGid(sheetUrl)
    }, log);

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
      /* (r12) 잠금이 이제 이 앞에 있으므로 **여기서 반드시 닫는다.** 안 닫으면
         빈 CSV 한 번에 다음 판들이 영영 막힌다. 쓴 것이 없으니 미확인이 아니다. */
      await finalizeSyncLog(syncLogId, {
        status: 'failed',
        finished_at: new Date().toISOString(),
        error_message: 'CSV에 데이터가 존재하지 않습니다.',
        upsert_count: 0
      }, log);
      return res.status(200).json({ success: true, message: 'CSV에 데이터가 존재하지 않습니다.', logs });
    }

    const termMap = buildNormalizedTermMap(rows);
    const rawTerms = [...new Set(rows.map(r => (r['부적합 유형'] || '').trim()).filter(Boolean))];
    const nonemptyDefectRows = rows.filter(r => (r['부적합 유형'] || '').trim()).length;

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
          throwWriteFailure(fallbackError, `대장 fallback upsert(${fallbackInspections.length}행)`, 'inspections · onConflict id');
        }
        log('[SUCCESS] Emergency fallback sync completed without schema error.');
      } else {
        /* (r11) 대장 쓰기도 **측정값과 같은 기준**을 탄다(예림 5차 ⑶). */
        throwWriteFailure(error, `대장 upsert(${inspectionsToUpsert.length}행)`, 'inspections · onConflict id');
      }
    } else {
      log('Supabase batch Upsert successfully completed.');
    }

    await finalizeSyncLog(syncLogId, {
      status: 'success',
      finished_at: new Date().toISOString(),
      /* (r12) 행 수 칸은 시작 때 알 수 없어 여기서 적는다 — 값·뜻은 r11 과 같다. */
      processed_rows: rows.length,
      nonempty_defect_rows: nonemptyDefectRows,
      unique_raw_terms: rawTerms.length,
      unique_normalized_terms: termMap.size,
      cache_hits: Object.keys(cachedMap).length,
      new_terms: missingTerms.length,
      upsert_count: inspectionsToUpsert.length
    }, log);

    /* ── 042 P8d : 측정값기록서 덩이 (2026-09-10 추가) ─────────────────────
       위 대장 동기화는 **여기까지로 이미 끝났고** sync_logs 에 success 로 적혔다.
       아래는 그 뒤에 이어 붙는 **별개의 덩이**다. syncMeasurements 는 예외를 밖으로
       던지지 않으므로, 측정값이 실패해도 대장 결과와 이 요청의 성공 여부는 바뀌지
       않는다 — 측정값 실패는 자기 sync_logs 줄과 아래 응답의 measurements 칸에만
       남는다. 순서를 대장 먼저로 둔 이유도 같다(설계안 §7 「한 판에 두 표」). */
    try {
      measResult = await syncMeasurements(sheetUrl, log);
    } catch (measFatal) {
      // syncMeasurements 는 자기 오류를 스스로 다 잡는다. 여기 오면 그 바깥의 사고다.
      log(`[measurements][ERROR] 예상 밖 오류: ${measFatal.message} (대장 결과에는 영향 없음)`);
      measResult = { status: 'failed', error: measFatal.message };
    }

    return res.status(200).json({
      success: true,
      message: '구글 스프레드시트 동기화 완수 완료',
      processedCount: inspectionsToUpsert.length,
      measurements: measResult,   // 042 P8d — 측정값 덩이 결과(대장 값은 위 그대로다)
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
    /* (r11) 대장도 **미확인이면 이 줄을 닫지 않는다**(응답 status ≠ DB status).
       error_message 한 칸만 고쳐 다음 판이 자동으로 건너뛰게 한다(예림 5차 ⑴·⑶). */
    await finalizeSyncLog(syncLogId, error.code === 'WRITE_UNVERIFIED' ? {
      error_message: error.message
    } : {
      status: blocked ? 'blocked' : 'failed',
      finished_at: new Date().toISOString(),
      blocked_reason: blocked ? error.code : null,
      error_message: error.message,
      upsert_count: 0
    }, log);

    if (blocked) {
      /* (r10) **이미 실행 중 → 조용히 정상 종료한다.** 오류가 아니다.
         r7 까지는 「최근 5분 running 조회」가 이 자리를 지켰고 429 를 돌려줬다.
         그 조회는 잠금이 아니어서(조회와 INSERT 사이가 빈다) 지웠고, 이제 같은
         일을 sql/08 의 유일 인덱스가 **INSERT 그 자체로** 막는다 — 대장이 잃은
         보호를 DB 유일성으로 돌려받는 것이지 새 제약이 생기는 것이 아니다.
         크론이 10분마다 도는데 겹쳤다고 429 를 쌓으면 경보만 시끄러워지므로,
         측정값 경로와 **같은 동작**(조용히 건너뜀)으로 맞춘다. */
      log('이미 실행 중, 건너뜀 : 같은 시트의 running 기록이 이미 있어 DB 가 이번 판의 시작 기록을 거절했다(sql/08). 아무것도 쓰지 않고 정상 종료한다.');
      return res.status(200).json({
        success: true,
        skipped: true,
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
    /* (r10) 중복 실행 방지를 **DB 가 한다.** sql/08 의 부분 유일 인덱스
       — (sheet_gid) WHERE status='running' — 때문에, 같은 시트의 running 이 이미
       있으면 이 INSERT 자체가 거절된다(PostgreSQL unique_violation = 23505).
       조회와 잠금이 한 문장이라 사이가 빌 자리가 없고, 잠금의 수명이 그 판의
       running 줄이 살아 있는 구간 = **실제 쓰기 범위**와 정확히 같다.
       **판정을 여기 한 곳에만 둔다** — 대장과 측정값이 같은 함수를 쓰므로 두
       경로가 저절로 같은 동작을 한다(경로마다 따로 쓰면 그게 갈린다).

       (r11) 23505 는 **모든 UNIQUE 위반**을 뜻한다. PostgREST 는 DB 가 거절하면
       본문에 `{code:'23505', message:'duplicate key value violates unique
       constraint "<이름>"', details:'Key (…)=(…) already exists.'}` 를 준다 —
       그 **이름이 우리 인덱스일 때만** 「이미 실행 중」으로 본다. 다른 유일성
       오류를 skip 으로 숨기면 진짜 고장이 조용히 묻힌다(예림 5차 ⑷).
       이름을 못 읽으면 **보수적으로 그냥 오류로 올린다.** */
    const e = new Error(`sync_logs start write failed: ${error.message}`);
    const detail = `${error.message || ''} ${error.details || ''}`;
    if (error.code === '23505' && detail.includes(SYNC_RUNNING_INDEX)) e.code = 'SYNC_ALREADY_RUNNING';
    throw e;
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

/* ── (r11) **잠금 아래의 모든 쓰기**가 지나는 한 곳 (예림 5차 ⑵·⑶) ─────────
   running 잠금이 걸린 동안 하는 쓰기 — 측정값 upsert · 부재/정정 표시 UPDATE ·
   대장 upsert — 는 **전부 이 두 함수**를 지난다. 경로마다 복붙하면 그때부터 갈린다.

   **왜 형식(SQLSTATE 5글자)으로 가르면 안 되나** — 공식 코드에
   `08007 transaction_resolution_unknown` 과 `40003 statement_completion_unknown`
   이 있다. 둘 다 「다섯 글자」를 통과하지만 뜻은 **완료 여부를 모른다**이다.
   그래서 **형식이 아니라 뜻으로** 가른다 : 아래 목록에 든 부류만 「확정 거절」이고
   **나머지는 전부 미확인**이다(모르는 코드·코드가 없는 응답 포함). 안전한 쪽으로
   틀리게 만든 것이다 — 확정으로 잘못 보면 잠금이 풀리고, 미확인으로 잘못 보면
   사람이 한 번 확인하면 된다. */
const DB_REJECT_CLASSES = [
  '22',   // 자료 예외 (자료형·값 · 예 22P02 invalid_text_representation)
  '23',   // 무결성 제약 위반 (예 23505 unique · 23502 not null · 23503 fk)
  '42'    // 문법 오류·접근 규칙 위반 (예 42703 열 없음 · 42P01 표 없음)
];
/* 위에 **없으면 전부 미확인**이다. 특히 —
     08xxx 연결 예외(**08007 transaction_resolution_unknown** 포함) ·
     **40003 statement_completion_unknown** · 53xxx 자원 부족 ·
     57xxx 운영자 개입·종료(57014 취소 · 57P01 종료) · 목록에 없는 모든 코드 ·
     게이트웨이 502·504 처럼 **본문이 JSON 이 아니라 code 자체가 없는 응답**. */
function isDefiniteDbRejection(error) {
  const code = String((error && error.code) || '');
  if (!/^[0-9A-Z]{5}$/.test(code)) return false;
  return DB_REJECT_CLASSES.includes(code.slice(0, 2));
}

/* 쓰기가 실패했을 때 **어느 쪽인지 정해서 던진다.**
     · 확정 거절  → 보통 오류. 이 판은 닫힌다(잠금이 풀린다). 반영은 참말로 0행이다.
     · 그 밖      → code='WRITE_UNVERIFIED'. **이 판의 sync_logs 행을 닫지 않는다**
                    (status·finished_at 을 손대지 않는다) → 다음 판이 자동으로
                    건너뛰고, 사람이 확인한 뒤 그 행을 푼다. */
function throwWriteFailure(error, what, scope) {
  const code = String((error && error.code) || '');
  if (isDefiniteDbRejection(error)) {
    throw new Error(`${what} : **DB 가 거절**(SQLSTATE ${code} · 그 문장이 통째로 물러났으므로 **반영 0행**) — ${error.message}`);
  }
  const e = new Error(`${what} : 결과 **미확인**(응답 코드 ${code || '(없음)'}) — ${error.message}. **반영 여부 미확인 · 지연 커밋 가능** — 아직 처리 중인 요청이 나중에 커밋할 수 있으므로 「안 들어갔다」고 단정하지 않는다. **이 판의 running 행을 닫지 않는다**(다음 판은 자동으로 건너뛴다. 확인 뒤 사람이 닫을 것). 마지막으로 시도한 범위 : ${scope}`);
  e.code = 'WRITE_UNVERIFIED';
  throw e;
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

/* ══════════════════════════════════════════════════════════════════════════
   042 P8d — 측정값기록서(gid 40080222) → inspection_measurements 동기화
   2026-09-10 추가. 위쪽 대장(inspections) 경로는 **한 줄도 고치지 않았다**.

   규칙 (설계안 [260910]측정값_자동동기화_설계안_r0.md §6·§7 그대로)
     · 덮어쓰기/새로넣기 열쇠 = (ri_no, seq).  seq = 같은 RI 안의 순번(1부터).
       source_row(시트 행번호)는 **화면 정렬용으로 계속 채우되 열쇠에서는 뺀다**
       — 시트 중간에 한 줄만 끼어도 뒤가 전부 밀려 엉뚱한 제품 값으로 덮어써지기
       때문이다(inboundSpc.js:85~89 가 source_row 로 줄을 세운다).
     · TRUNCATE·DELETE 를 **절대 하지 않는다**. 표가 한순간이라도 비면 그 순간
       화면을 연 사람은 영역 4(공정능력)가 통째로 죽는다(inboundSpc.js:155).
     · 빈 칸은 **NULL** 로 넣는다. 0 으로 채우지 않는다(sql/02:30~31).
     · kind 는 시트 글자를 그대로 넣는다('수치'를 '숫자'로 바꾸면 Cpk 가 사라진다).
   ══════════════════════════════════════════════════════════════════════════ */

/* 측정값 CSV 주소 — 대장 주소(GOOGLE_SHEETS_CSV_URL)의 **gid 값만** 갈아 끼운다.

   예림 확인(2026-09-10 10:18) : 스테이징 주소는 `/export?format=csv&gid=0` 꼴이다.
   그래서 gid 만 바꾸면 측정값 탭이 그대로 읽힌다 — **새 환경변수가 필요 없다**.
   다만 그 환경변수 값은 Sensitive 라 평문으로 다시 볼 수 없으므로, 여기서
   **주소를 새로 조립하지 않는다**. 받은 글자에서 `gid=` 뒤의 숫자만 바꾸고
   나머지(시트 id·format·single·output 등)는 **한 글자도 건드리지 않는다**.

   `gid=` 가 없거나 모양이 다르면 **말없이 넘기지 않고 멈춘다**. 조용히 대장
   주소를 그대로 쓰면 측정값 표에 대장 CSV 가 들어가 표가 통째로 상한다 —
   그것이 이 함수가 막아야 할 최악이다. */
function buildMeasurementCsvUrl(ledgerSheetUrl) {
  const explicit = String(process.env.GOOGLE_SHEETS_MEAS_CSV_URL || '').trim();
  if (explicit) return explicit;                       // 통째로 지정하는 탈출구(그대로 둔다)

  const raw = String(ledgerSheetUrl === null || ledgerSheetUrl === undefined ? '' : ledgerSheetUrl).trim();
  if (!raw) {
    throw new Error('[measurements] 대장 시트 주소(GOOGLE_SHEETS_CSV_URL)가 비어 있다. gid 를 바꿀 대상이 없다.');
  }

  // gid 파라미터가 **정확히 하나** 있어야 한다. 없거나 여럿이면 가정이 깨진 것이다.
  const hits = raw.match(/([?&])gid=([^&#]*)/g) || [];
  if (hits.length !== 1) {
    throw new Error(
      `[measurements] 대장 주소에서 gid 파라미터를 ${hits.length}개 찾았다(1개여야 한다). ` +
      'gid 만 바꾸는 방식이 통하지 않는 주소다. 아무것도 쓰지 않고 중단한다. ' +
      '주소 형태를 확인하거나 GOOGLE_SHEETS_MEAS_CSV_URL 로 측정값 주소를 통째로 지정할 것.'
    );
  }

  // 값만 바꾼다. 시트 id·format·single·output 등 나머지 글자는 그대로 남는다.
  const replaced = raw.replace(/([?&])gid=([^&#]*)/, (m, sep) => `${sep}gid=${MEAS_SHEET_GID}`);
  if (!new RegExp('[?&]gid=' + MEAS_SHEET_GID + '(&|#|$)').test(replaced)) {
    throw new Error('[measurements] gid 값을 바꾸지 못했다. 아무것도 쓰지 않고 중단한다.');
  }
  return replaced;
}

/* ── 측정값 전용 머리글 정리 ───────────────────────────────────────────────
   측정값 탭 머리글은 대장과 이름이 전부 다르고, 사람이 읽으라고 붙인 글자가
   섞여 있다 —  '제품명 (자동)' · '기준치수 ⌨️' · 'X1 ⌨️' · 첫 칸은 **공백 한 칸**.
   그래서 ① 괄호 표기를 통째로 버리고 ② 글자·숫자가 아닌 것(이모지·변형선택자·
   공백)을 전부 지운 뒤 ③ 대문자로 맞춰 별칭표를 찾는다.
   대장의 HEADER_ALIASES 는 **쓰지 않는다** — 그 표는 빈 머리글을 '품목번호'로
   바꾸는데, 측정값 탭의 빈 머리글은 **RI 번호**다. */
function measHeaderKey(header) {
  return String(header === null || header === undefined ? '' : header)
    .replace(/^﻿/, '')
    .replace(/\([^)]*\)/g, ' ')          // '(자동)' 같은 괄호 표기 제거
    .replace(/[^0-9A-Za-z가-힣]/g, '')   // 키보드 그림·이모지·변형선택자·공백 제거
    .toUpperCase();
}

const MEAS_HEADER_ALIASES = {
  '': 'ri_no',            // 첫 칸 머리글은 공백 한 칸 → 내용은 RI 번호다
  'RI번호': 'ri_no',      // 시트 주인이 나중에 이름을 붙여도 견디게
  '인수검사보고서번호': 'ri_no',
  '품번': 'part_no',
  '제품명': 'item_name',
  '검사포인트': 'inspect_point',
  '측정유형': 'kind',
  '기준치수': 'nominal',
  '공차상': 'tol_upper',
  '공차하': 'tol_lower',
  'X1': 'x1',
  'X2': 'x2',
  'X3': 'x3',
  'X4': 'x4',
  'X5': 'x5',
  '판정': 'judgment',
  '비고': 'note'
};

/* ── 측정값 전용 한 줄 쪼개기 ──────────────────────────────────────────────
   대장의 parseCSVLine 은 큰따옴표를 **켜고 끄는 스위치로만** 쓰기 때문에,
   CSV 규칙(RFC4180)의 `""`(따옴표 안의 진짜 따옴표)를 **지워 버린다**.
   측정값 탭에는 인치 표기 품명이 있어서 그대로 쓰면 값이 상한다 —
     시트 :  W-PICV-SS-T BODY CF8M 1"(25A) …
     기존 파서 : W-PICV-SS-T BODY CF8M 1(25A) …   ← 인치 기호가 사라진다
   실측으로 8줄이 이렇게 상했다(09-02 적재본과 대조). 그래서 측정값은 이 함수를
   쓴다. **대장의 parseCSVLine 은 한 글자도 고치지 않았다**(대장 동작 보존).
   ※ 정본 측정값 탭에는 칸 안에 줄바꿈이 든 곳이 없다(따옴표 홀수 줄 0개 — 실측).
     그래서 줄 단위로 끊어도 시트 행번호가 밀리지 않는다. */
function parseMeasCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }  // "" → 진짜 따옴표
      else inQuotes = !inQuotes;
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

/* 측정값 탭 CSV → 줄 목록.
   대장의 parseCSV 와 따로 두는 이유 둘 —
     ① 통과 조건이 다르다. 대장은 '제품명 || 업체명' 인데 측정값 탭에는 '업체명'
        열이 아예 없고 제품명 열 이름도 '제품명 (자동)' 이다. 그대로 쓰면
        **모든 줄이 버려진다**.
     ② 시트 **원본 행번호**(__source_row)를 들고 나와야 한다. 대장 파서는
        빈 줄을 건너뛰면서 행번호를 잃어버린다.
   통과 조건 = 첫 칸(RI 번호)이 비어 있지 않다. 이러면 시트 뒤쪽의 빈 줄
   2,780개도 자동으로 걸러진다. */
function parseMeasurementCSV(text) {
  const lines = String(text === null || text === undefined ? '' : text).split(/\r?\n/);
  if (lines.length <= 1) return [];

  const rawHeaders = parseMeasCSVLine(lines[0]);
  const headers = rawHeaders.map(h => MEAS_HEADER_ALIASES[measHeaderKey(h)] || null);

  // 첫 칸 머리글이 비어 별칭표에 안 걸리는 경우에도 RI 번호로 읽는다.
  if (headers.length > 0 && !headers.includes('ri_no')) {
    headers[0] = 'ri_no';
  }

  // 머리글이 통째로 달라졌으면 **조용히 0행**이 되지 않게 큰 소리로 멈춘다.
  for (const need of ['ri_no', 'kind', 'nominal', 'x1']) {
    if (!headers.includes(need)) {
      throw new Error(
        `측정값 탭 머리글을 알아볼 수 없다(필수 열 '${need}' 없음). 받은 머리글: ${JSON.stringify(rawHeaders)}`
      );
    }
  }

  const results = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;                  // 뒤쪽 빈 줄
    const values = parseMeasCSVLine(lines[i]);
    const row = { __source_row: i + 1 };             // 머리글=1 → lines[i] 는 시트 i+1 행
    headers.forEach((key, index) => {
      if (key) row[key] = (values[index] || '').trim();
    });
    if (row.ri_no) results.push(row);                // 통과 조건
  }
  return results;
}

/* 빈 글자는 **빈 값(NULL)** 이다. 0 도 '미지정'도 아니다. */
function measBlankToNull(value) {
  const s = String(value === null || value === undefined ? '' : value).trim();
  return s === '' ? null : s;
}

/* 숫자로 못 읽으면 **0 이 아니라 빈 값**이다(0 은 실측값이므로 지어내면 안 된다). */
function measToNumberOrNull(value) {
  const s = String(value === null || value === undefined ? '' : value).trim().replace(/,/g, '');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/* ── (r2 ④) 「내용으로 짝짓는」 열쇠 ───────────────────────────────────────
   예림 2차 회신 : 「seq 를 매번 시트 행순서로 다시 매기면 행번호 의존 문제가
   되살아납니다.」 — 실제로 그랬다. r1 판으로 RI 블록 **중간에 한 줄을 끼워 넣은
   시트**를 물렸더니 그 RI 의 기존 3줄 중 **2줄의 seq 가 밀리고 값이 새 줄 값으로
   덮였다**(시험 7 참조). 대장에서 열쇠를 source_row 에서 (ri_no, seq) 로 옮긴
   이유가 바로 그 사고였는데, 코드가 seq 를 매번 새로 매기는 바람에 같은 사고가
   그대로 되살아나 있었다.

   그래서 들어온 줄을 **기존 줄과 내용으로 먼저 짝지어** 그 줄이 쓰던 seq 를
   그대로 물려받게 한다. 짝이 없는 새 줄만 그 RI 의 max(seq)+1 부터 받는다.

   무엇으로 짝짓나 — **RI 안에서 잘 안 변하는 열**만 쓴다 :
       검사포인트(inspect_point) · 측정유형(kind) · 기준치수(nominal)
       · 공차상(tol_upper) · 공차하(tol_lower)
   측정값 x1~x5·판정·비고는 **일부러 뺐다.** 값이 고쳐졌다고 「다른 줄」이 되면
   안 되기 때문이다(값 정정은 같은 줄의 갱신이어야 한다).

   왜 이 조합인가 — 오늘 시트(유효 1,196행 · RI 455개)로 잰 **모호도 실측** :
       · 검사포인트만              : 고유키 923   · 중복에 걸린 행 508 (42.47%) ← 못 쓴다
       · 검사포인트+기준치수        : 고유키 1,172 · 중복행 48 (4.01%)
       · **위 5열**                : 고유키 1,173 · 중복행 46 (**3.85%**) ← 가장 낮다
       · 위 5열 + 품번             : 고유키 1,173 · 중복행 46 (3.85%) — 품번은 RI 안에서
                                     늘 같아 도움이 안 된다. 그래서 넣지 않았다.
   숫자는 글자 그대로가 아니라 **숫자로 정규화**해 비교한다('74' 와 '74.0' 이 다른
   줄이 되면 안 된다). */
function measContentKey(row) {
  const t = (v) => (measBlankToNull(v) || '');
  const n = (v) => { const x = measToNumberOrNull(v); return x === null ? '' : String(x); };
  return [t(row.inspect_point), t(row.kind), n(row.nominal), n(row.tol_upper), n(row.tol_lower)]
    .join('\u0001');   // 자료에 나올 수 없는 글자로 칸을 가른다
}

/* 「아직 기준치수·공차가 안 적힌 줄」인가 — 검사원이 검사포인트만 먼저 적어 둔
   **미완성 자리**다. 실측 : 09-02 정본 986행 중 이런 줄이 6줄 있었고, 09-10 시트
   에는 그 자리에 기준·공차·측정값이 채워져 있다.

   이런 줄은 내용열쇠(기준·공차를 포함한다)로는 절대 짝이 맞지 않는다. 그대로 두면
   「채워 넣은 줄 = 새 줄」이 되고 원래 자리는 사라진 줄로 표시된다. 자료가 상하지는
   않지만(값을 덮지 않으므로) 유령 행이 공연히 늘어난다.

   그래서 짝짓기 **1.5차**에서만, 남은 미완성 자리에 한해 **검사포인트로** 짝을 맞춘다.
   검사포인트 하나로 맞추는 것은 원래 모호하지만(실측 42.47%), 여기서는 —
     · 대상이 **기준·공차가 전부 빈 줄**로 좁혀져 있고,
     · 그런 줄은 화면 규칙 2(기준·공차 필수)에서 **어차피 Cpk 계산에 안 들어간다.**
   그래서 설령 잘못 짝지어도 **Cpk 값이 틀어질 수 없다.** 「어느 빈 자리를 채우느냐」만
   갈릴 뿐이다. 짝이 여럿이면 1차와 같이 **선착순**으로 가른다. */
function measIsPlaceholder(row) {
  return measToNumberOrNull(row.nominal) === null
      && measToNumberOrNull(row.tol_upper) === null
      && measToNumberOrNull(row.tol_lower) === null;
}

/* (r3 ③) 규격 세 칸을 사람이 읽을 수 있게 한 줄로. review_reason 에 그대로 들어간다. */
function measSpecText(row) {
  const f = (v) => { const x = measToNumberOrNull(v); return x === null ? '(빈칸)' : String(x); };
  return `기준 ${f(row.nominal)} / 공차상 ${f(row.tol_upper)} / 공차하 ${f(row.tol_lower)}`;
}

/* ── (r4 ②) 「정정 확인 대상」 기록 문구 ────────────────────────────────────
   예림 4차 회신(2026-09-10 14:22) :
   「로그에 RI·검사포인트만 남기는 것은 부족합니다. **동일 규격 행이 있기 때문에**
    최소한 다음을 함께 남겨 주세요 — 기존 행 식별자 `id` 또는 `(ri_no, seq)` /
    정정 의심 사유 / 기존 규격과 시트에서 관측한 규격 / 여러 행이 후보라면
    후보 식별자와 「짝짓기 미확정」 표시.」

   **새 표·새 열은 만들지 않는다**(예림 지시). 이 문구 하나에 다 담고,
   `review_reason` 열·동기화 응답·`sync_logs`(로그 본문)에 **같은 문자열**을 쓴다.

   글자 규칙 (기계가 가를 수 있게 **한 가지로 고정**한다) —
     · 맨 앞은 늘 `[정정확인] `
     · 칸과 칸 사이는 **` | `**(공백-막대-공백). 값 안에는 이 세 글자가 안 나온다.
     · 칸 안은 **`이름=값`**. 이름에는 `=` 이 없다.
     · 후보 목록은 `RI#seq(id …)` 를 **`, `** 로 잇는다.
   즉  text.split(' | ') → 각 조각을 첫 `=` 에서 자르면 그대로 표가 된다.

   **길이가 늘지 않는다** — 같은 문제가 반복돼도 **덧붙이지 않고** 이 함수가
   만든 문구로 **통째로 교체**한다(예림 4차 ②). 값이 그대로면 아예 쓰지 않는다.

   ── (r5 ①) **`RI` · `무리` · `영향행수` 를 못 박아 남긴다** ──────────────
   예림 최종 회신(2026-09-10 15:44) :
   「자료를 보존한다고 최신 시트와 계산 결과까지 일치하는 것은 아닙니다.
    **실제 삭제된 옛 측정값이 계산에 남을 수 있으므로, 해당 RI·무리·영향 행수를
    기존 정정 확인 기록에 남겨 운영자가 확인**할 수 있어야 합니다.」

   r4 는 `행=RI-…#seq` 안에 RI 가 섞여 있고 무리는 `검사포인트`·`측정유형` 두
   칸으로 흩어져 있었으며, **영향 행수는 아예 없었다**(`무리크기` 는 짝짓기가
   모호할 때만 나왔다). r5 는 세 가지를 **늘 같은 이름의 칸**으로 남긴다 —
     · `RI=…`       그 무리가 속한 검사성적서 번호
     · `무리=…`     검사포인트/측정유형 (무리를 가르는 열쇠 그대로)
     · `영향행수=N` **이 보류 때문에 이번 판 누락 판정에서 빠진 옛 행 수.**
                    곧 「실제로 삭제됐더라도 옛 규격·옛 측정값 그대로 Cpk 에
                    남아 있을 수 있는 줄 수」다. 같은 무리의 모든 줄이 같은 N 을
                    갖는다(무리 단위로 통째로 빠지기 때문이다).
   **새 표도 새 열도 만들지 않는다**(예림 지시) — 이 문구 한 칸이 전부다. */
function measReviewText(v) {
  const group = `${v.point || '(빈칸)'}/${v.kind || '(빈칸)'}`;
  const parts = [
    `[정정확인] id=${v.id}`,
    `행=${v.ri}#${v.seq}`,
    `RI=${v.ri}`,
    `무리=${group}`,
    `영향행수=${v.heldRows}`,
    `검사포인트=${v.point || '(빈칸)'}`,
    `측정유형=${v.kind || '(빈칸)'}`,
    '사유=기준치수·공차가 시트에서 달라져 기존 행과 짝이 끊겼다',
    `기존규격=${v.oldSpec}`,
    `시트규격=${v.newSpec === null || v.newSpec === undefined ? '(이번 시트에 짝이 될 줄이 없다)' : v.newSpec}`,
    `시트행=${v.sheetRow === null || v.sheetRow === undefined ? '(없음)' : v.sheetRow}`,
    `짝짓기=${v.ambiguous ? '미확정' : '확정'}`
  ];
  if (v.ambiguous) {
    parts.push(`후보기존행=${v.candidates}`);
    parts.push(`후보시트행=${v.sheetCandidates || '(없음)'}`);
    parts.push(`무리크기=기존 ${v.groupOld} : 시트 ${v.groupSheet}`);
  }
  parts.push(`조치=새 행을 만들지 않았고 이 줄의 값·표시도 그대로 두었다. 이 무리의 옛 행 ${v.heldRows}줄은 이번 판 누락 판정에서 빠졌으므로 실제로 삭제된 줄이 섞여 있으면 옛 규격·옛 측정값이 계산에 남는다. 차장 확인 필요`);
  return parts.join(' | ');
}

/* 줄 목록 → DB 기록.
   seq 는 **기존 줄에서 물려받는다**(위 measContentKey 참조). 짝이 없는 새 줄만
   그 RI 의 max(seq)+1 부터 새로 받는다. existing 이 없으면(첫 실행·새 RI)
   시트 순서대로 1,2,3… 이 되어 예전과 같다.
   content_hash 는 기존 986행과 **같은 계산식**을 쓴다
   (base64(`RI|품번|검사포인트`) 앞 24자 + '_' + 시트행번호 — 986행 전부 재현 확인). */
function buildMeasurementRecords(rows, batchId, existing) {
  const byKey = new Map();
  let duplicateKeys = 0;
  let seqInherited = 0;
  let seqNew = 0;
  let seqFilledPlaceholder = 0;
  let ambiguousRows = 0;
  /* (r3 ③) 기준치수·공차만 달라져 짝이 끊긴 건 — 「정정 확인 대상」 */
  const specReview = [];

  /* ① RI 별로 시트 줄을 모은다(시트에 나온 순서 그대로). */
  const riOrder = [];
  const riRows = new Map();
  for (const r of rows) {
    const ri = String(r.ri_no || '').trim();
    if (!ri) continue;
    if (!riRows.has(ri)) { riRows.set(ri, []); riOrder.push(ri); }
    riRows.get(ri).push(r);
  }

  const assignedSeq = new Map();   // 시트 줄(객체) -> 정해진 seq
  for (const ri of riOrder) {
    const sheetRows = riRows.get(ri);
    const prev = (existing && existing.byRi && existing.byRi.get(ri)) || null;

    /* 기존 줄 목록(seq 오름차순)과 「아직 안 쓴 자리」 표시. */
    const slots = prev ? prev.entries.map(e => ({ ...e, used: false })) : [];
    const maxSeq = prev ? prev.maxSeq : 0;

    /* 같은 RI 안에 내용이 똑같은 줄이 여러 개인지 세어 둔다(로그용). */
    const keyCount = new Map();
    for (const r of sheetRows) {
      const k = measContentKey(r);
      keyCount.set(k, (keyCount.get(k) || 0) + 1);
    }
    for (const c of keyCount.values()) if (c > 1) ambiguousRows += c;

    const taken = new Set();
    const chosen = new Array(sheetRows.length).fill(null);

    /* ② 1차 — 내용이 같은 기존 줄이 있으면 그 seq 를 **물려받는다**.
          같은 RI 안에 내용이 똑같은 줄이 여럿일 때(오늘 실측 46행)는
          **시트에 나온 순서대로 작은 seq 부터 차례로** 가져간다(선착순).
          누가 누구인지 자료만으로는 가릴 수 없는 자리이므로, 「늘 같은
          결과가 나오는 규칙」을 택한 것이다. 어느 쪽으로 붙어도 두 줄의
          기준·공차가 같으므로 Cpk 규격선은 달라지지 않는다. */
    for (let i = 0; i < sheetRows.length; i++) {
      const k = measContentKey(sheetRows[i]);
      const slot = slots.find(s => !s.used && s.key === k);
      if (slot) {
        slot.used = true;
        chosen[i] = slot.seq;
        taken.add(slot.seq);
        seqInherited++;
      }
    }

    /* ②-2 1.5차 — 아직 짝이 없는 줄을, 남은 **미완성 자리**(기준·공차가 전부
          빈 기존 줄)에 **검사포인트로** 맞춘다. 근거는 measIsPlaceholder 주석에
          적었다 — 이 자리는 Cpk 계산에 안 들어가므로 잘못 맞아도 값이 안 틀어진다. */
    for (let i = 0; i < sheetRows.length; i++) {
      if (chosen[i] !== null) continue;
      const pt = measBlankToNull(sheetRows[i].inspect_point) || '';
      const slot = slots.find(s => !s.used && s.placeholder && s.point === pt);
      if (slot) {
        slot.used = true;
        chosen[i] = slot.seq;
        taken.add(slot.seq);
        seqInherited++;
        seqFilledPlaceholder++;
      }
    }

    /* ②-3 (r3 ③) **규격이 바뀌어 짝이 끊긴 건 — 자동으로 새 행이라고 확정하지
          않는다.** 예림 3차 회신(2026-09-10 12:41) :
          「기준치수·공차 정정 — 현재 자동 처리는 권하지 않는다. 새 줄과 옛 줄을
           **동시에 계산에 남기면 유예 기간 동안 같은 측정을 서로 다른 규격으로
           중복 반영**할 수 있다. 고유번호 도입 전이라면, 규격이 바뀌어 짝이 끊긴
           건은 자동으로 새 행이라고 확정하지 말고 해당 건만 「정정 확인 대상」으로
           분리하는 편이 안전하다.」

          r2 는 이 자리에서 **새 행을 만들고 옛 행을 사라짐으로 표시**했다. 그러면
          24시간 유예 동안 **같은 측정이 옛 규격·새 규격 두 벌로 Cpk 에 들어간다.**

          r3 의 규칙 — 같은 RI 안에서 **검사포인트·측정유형이 같은데** 아직 짝이
          없는 시트 줄과, 아직 안 쓰인 기존 줄이 함께 남아 있으면(1차·1.5차에서
          이미 안 맞았으므로 **기준치수·공차가 다르다는 뜻이다**) 그 둘을 묶어
            · 시트 줄은 **새 행으로 넣지 않는다**(chosen = -1),
            · 기존 줄은 **사라짐으로 표시하지 않는다**(값·표시 전부 그대로 둔다),
            · 대신 기존 줄의 review_reason 에 **「정정 확인 대상」**을 적는다.
          한쪽이 여러 개면 1차와 같이 **시트에 나온 순서대로 선착순**으로 묶고,
          짝이 없는 나머지는 예전 규칙 그대로(새 행 / 사라짐 표시) 간다. */
    {
      /* (r4 ②④) **검사포인트+측정유형 무리(그룹) 단위**로 본다.
         r3 은 시트 줄 하나에 옛 줄 하나를 선착순으로 붙이고 **거기서 끝냈다.**
         그래서 옛 줄이 시트 줄보다 많은 무리에서는 **남은 옛 줄이 「이번 시트에
         없다」는 이유로 그 판에서 곧바로 missing_since 를 받았다**(예림 4차 ③
         이 짚은 두 경로 충돌 — 로컬에서 실제로 재현했다 : 시험 15-B).
         정정 확인 중인 무리의 옛 줄을 「사라졌다」고 찍는 것은 모순이다.

         r4 규칙 —
           · 무리에 남은 **옛 줄 전부**를 「정정 확인 대상」으로 잡는다(후보).
             → 그 판의 **누락 판정에서 통째로 빠진다**(heldKeys).
           · 시트 줄은 선착순으로 옛 줄에 붙여 **새 행으로 넣지 않는다**(chosen=-1).
             옛 줄이 모자라면 남는 시트 줄은 예전 그대로 **진짜 새 줄**이 된다.
           · **후보가 1:1 이 아니면 「짝짓기 미확정」**으로 적고 **후보 식별자를
             전부 남긴다**(예림 4차 ②). 자료만으로 어느 줄인지 확정할 수 없기
             때문이다. */
      const slotsByPk = new Map();
      for (const sl of slots) {
        if (sl.used) continue;
        const g = `${sl.point}\u0001${sl.kind}`;
        if (!slotsByPk.has(g)) slotsByPk.set(g, []);
        slotsByPk.get(g).push(sl);
      }
      const sheetByPk = new Map();
      for (let i = 0; i < sheetRows.length; i++) {
        if (chosen[i] !== null) continue;
        const r = sheetRows[i];
        const g = `${measBlankToNull(r.inspect_point) || ''}\u0001${measBlankToNull(r.kind) || ''}`;
        if (!slotsByPk.has(g)) continue;          // 짝이 될 옛 줄이 없다 → 진짜 새 줄
        if (!sheetByPk.has(g)) sheetByPk.set(g, []);
        sheetByPk.get(g).push(i);
      }
      for (const [g, idxs] of sheetByPk) {
        const arr = slotsByPk.get(g);
        if (!arr || arr.length === 0) continue;
        /* 후보 식별자 목록 — 이 무리의 옛 줄 전부. 사람이 바로 찾을 수 있게
           `RI#seq(id …)` 로 적고, 기계가 가르도록 쉼표+공백으로만 잇는다. */
        const candText = arr.map(s2 => `${ri}#${s2.seq}(id ${s2.id})`).join(', ');
        const sheetText = idxs
          .map(i2 => `${sheetRows[i2].__source_row}행(${measSpecText(sheetRows[i2])})`)
          .join(', ');
        /* 1:1 일 때만 「확정」이다. 그 밖에는 자료만으로 못 가른다. */
        const ambiguous = !(arr.length === 1 && idxs.length === 1);

        const pairCount = Math.min(arr.length, idxs.length);
        for (let k = 0; k < pairCount; k++) {
          chosen[idxs[k]] = -1;     // **새 행으로 넣지 않는다**는 표시
        }
        for (let k = 0; k < arr.length; k++) {
          const sl = arr[k];
          const r = (k < idxs.length) ? sheetRows[idxs[k]] : null;
          sl.used = true;
          taken.add(sl.seq);        // 이 seq 는 새 줄에 다시 나눠 주면 안 된다
          specReview.push({
            ri, seq: sl.seq, id: sl.id, point: sl.point, kind: sl.kind,
            oldSpec: sl.specText,
            newSpec: r ? measSpecText(r) : null,
            sheetRow: r ? r.__source_row : null,
            ambiguous,
            candidates: candText,
            sheetCandidates: sheetText,
            groupOld: arr.length,
            groupSheet: idxs.length,
            /* (r5 ①) **영향 행수** — 이 무리에서 누락 판정이 보류된 옛 행 수.
               무리 단위로 통째로 빠지므로 그 무리의 옛 줄 수(arr.length)와 같고,
               heldKeys 에 들어가는 줄 수와도 **정확히 같다**(시험으로 대조한다). */
            heldRows: arr.length
          });
        }
      }
    }

    /* ③ 2차 — 짝이 없는 **새 줄만** max(seq)+1 부터 새로 받는다.
          이미 물려받은 번호와 겹치지 않게 건너뛴다. */
    let next = maxSeq;
    for (let i = 0; i < sheetRows.length; i++) {
      if (chosen[i] !== null) continue;
      do { next++; } while (taken.has(next));
      chosen[i] = next;
      taken.add(next);
      seqNew++;
    }

    for (let i = 0; i < sheetRows.length; i++) assignedSeq.set(sheetRows[i], chosen[i]);
  }

  for (const r of rows) {
    const ri = String(r.ri_no || '').trim();
    if (!ri) continue;

    const seq = assignedSeq.get(r);
    /* (r3 ③) 「정정 확인 대상」으로 분리된 줄은 **표에 쓰지 않는다.**
       옛 줄의 값도, 사라짐 표시도 건드리지 않는다. */
    if (seq === -1) continue;

    const partNo = measBlankToNull(r.part_no);
    const point = measBlankToNull(r.inspect_point);
    const rawHash = `${ri}|${partNo || ''}|${point || ''}`;

    const record = {
      ri_no: ri,
      seq,
      part_no: partNo,
      item_name: measBlankToNull(r.item_name),
      inspect_point: point,
      kind: measBlankToNull(r.kind),
      nominal: measToNumberOrNull(r.nominal),
      tol_upper: measToNumberOrNull(r.tol_upper),
      tol_lower: measToNumberOrNull(r.tol_lower),
      x1: measBlankToNull(r.x1),
      x2: measBlankToNull(r.x2),
      x3: measBlankToNull(r.x3),
      x4: measBlankToNull(r.x4),
      x5: measBlankToNull(r.x5),
      judgment: measBlankToNull(r.judgment),
      note: measBlankToNull(r.note),
      content_hash: Buffer.from(rawHash).toString('base64')
        .replace(/[^a-zA-Z0-9]/g, '').substring(0, 24) + `_${r.__source_row}`,
      source_row: r.__source_row,
      sync_batch_id: batchId
      // synced_at 은 DDL 기본값 now() 에 맡긴다. assignee 는 손대지 않는다
      // (upsert 는 여기 적은 열만 갱신하므로 사람이 넣은 담당자가 지워지지 않는다).
    };

    const key = `${ri} ${seq}`;
    if (byKey.has(key)) duplicateKeys++;   // 설계상 나올 수 없다. 나오면 로그로 드러낸다
    byKey.set(key, record);
  }

  return {
    records: [...byKey.values()],
    duplicateKeys,
    seqInherited,      // 기존 줄에서 seq 를 물려받은 줄 수
    seqFilledPlaceholder,  // 그중 「기준·공차가 비어 있던 미완성 자리」를 채운 줄 수
    seqNew,            // 새로 seq 를 받은 줄 수
    ambiguousRows,     // 같은 RI 안에 내용이 똑같은 줄이 여럿이라 선착순으로 가른 줄 수
    specReview         // (r3 ③) 기준치수·공차만 달라져 「정정 확인 대상」으로 뺀 건
  };
}

/* ── 안전장치 기준선 (예림 지적 ①·②, 2026-09-10 2차 회신) ──────────────────
   r0 은 「시트 유효행 ÷ **DB 전체 행수**」로 쟀다. 우리는 시트에서 지워진 줄을
   DB 에서 지우지 않으므로 DB 행수는 **한 방향으로만 커진다** — 유령 행이 쌓일수록
   임계가 올라가고 언젠가는 **정상 수집도 막힌다**(실측 : DB 1,500 · 시트 1,196 → 차단).

   r1 은 그것을 「**직전** 정상 수집의 processed_rows」로 바꿨다. 그러자 반대쪽
   구멍이 생겼다 — **잘린 시트가 한 번 통과하면 다음 판의 기준선이 그만큼
   내려앉는다**(실측 : 임계 956 → 764 → …). 계단으로 계속 내려갈 수 있다.

   r2 는 예림 권고대로 **ⓑ 최근 N판 최댓값 + ⓒ 절대 하한**을 함께 쓴다.

       기준선 = max( 최근 N판 성공기록의 processed_rows **최댓값** , 절대 하한 )
       임계   = floor( 기준선 × MEAS_MIN_ROW_RATIO )
                = floor( max(최근 N판 최댓값, MEAS_GUARD_ABS_FLOOR) × 0.8 )

   ⓑ 만으로는 부족하다(예림) — 정상 큰 값이 최근 N판에서 밀려 나가면 결국
   내려간다. 그래서 ⓒ 하한이 **바닥을 받친다**. N 과 하한의 근거는 위 상수 주석에
   실측과 함께 적었고, 발주서에도 같은 숫자를 적는다.

   **후보를 무엇으로 한정하나** (예림 : 「측정값 수집·반영까지 완료된 기록으로 한정」)
     · `sheet_gid = '40080222'` — 이 열은 **text** 다(예림 확인). 그래서 **문자열로**
       비교한다.
     · `status = 'success'` — 성공 줄은 upsert 와 missing 정리까지 다 끝난 뒤에만
       기록된다. 중단·차단·보류된 판은 failed 로 남아 여기 안 들어온다.
     · `processed_rows > 0` — 「반영이 끝난 판」을 한 겹 더 못 박는다.
       **(r3 ②) r2 는 여기에 `upsert_count > 0` 을 썼다.** 예림 3차 회신 :
       「`upsert_count>0` 가 **실제 변경 건수**라면, 정상적인 **무변경 동기화**가
        기준선 후보에서 빠진다. 그 필드의 의미도 명시할 것.」
       → **실측으로 재현해 봤다(시험 12-ⓐ). 이 코드에서는 그 일이 안 일어난다.**
         2회차 멱등 실행의 `upsert_count` 는 **1,196** 이었다(0 이 아니다).
         이 코드의 `upsert_count` 는 **「upsert 로 보낸 줄 수」(전송 건수)** 이지
         「실제로 바뀐 줄 수」가 아니기 때문이다 — 값이 하나도 안 바뀌어도
         1,196줄을 그대로 보내므로 1,196 이 적힌다.
       → 그래도 **고쳤다.** 뜻이 흐린 칸에 판별을 맡기면, 언젠가 그 칸의 의미가
         바뀌는 순간(예: 실제 변경 건수로 바꾸는 개선) **안전장치가 조용히 무너진다.**
         「반영이 끝난 판」의 뜻에 정확히 맞는 칸은 `processed_rows` 다.

     ── 두 칸의 뜻 (주석·보고서·발주서에 같은 문장으로 적는다) ──────────────
     · **`processed_rows`** = 그 판이 **검증을 통과시킨 고유 (ri_no, seq) 줄 수**.
       기준선이 재는 값과 **같은 값**이다. 보류·차단된 판은 **0** 을 적는다.
     · **`upsert_count`**  = 그 판이 **upsert 요청으로 보낸 줄 수(전송 건수)**.
       실제로 값이 바뀐 줄 수가 아니다. 멱등 실행에서도 0 이 되지 않는다.
     · 정렬은 `started_at` 내림차순 + **보조 기준으로 `id` 내림차순**(예림 권고).
       같은 시각에 두 줄이 있어도 최근 N판이 늘 같은 집합이 되게 하려는 것이다.

   되돌아가는 자리 둘 —
     ① **그런 줄이 아직 없다**(첫 실행) → max(DB 행수, 절대 하한) 을 기준선으로 쓴다.
        (r0/r1 과 같은 동작이고, 하한이 986 이라 스테이징 986행에서는 값이 같다.)
     ② **기준선을 못 읽는다**(표 없음·권한·통신) → **막지 않고 진행하지 않는다.**
        r1 의 「경고만 남기고 진행」은 **틀린 판단이었다**(예림 지적 ③) — 안전 확인이
        실패한 바로 그 순간에 보호장치가 사라지기 때문이다. r2 는 그 판의
        **측정값 반영과 missing 갱신을 통째로 보류**하고, 대장(gid 0)은 그대로
        처리한다. 자세한 것은 syncMeasurements 의 보류 자리에 적었다.
   읽기만 한다. */
async function resolveMeasurementGuardBaseline(log) {
  try {
    const { data, error } = await supabase
      .from('sync_logs')
      .select('id, processed_rows, upsert_count, started_at')
      .eq('sheet_gid', MEAS_SHEET_GID)      // text 열이다 → 문자열로 비교한다(예림 확인)
      .eq('status', 'success')
      .gt('processed_rows', 0)              // (r3 ②) 반영이 끝난 판만 후보로 삼는다
                                            //        NULL 은 `> 0` 에서 자동으로 빠진다
      .order('started_at', { ascending: false })
      .order('id', { ascending: false })    // 시각이 같아도 결과가 일정하도록 보조 기준
      .limit(MEAS_GUARD_RECENT_N);

    if (error) throw new Error(error.message);

    const list = (data || [])
      .map(r => Number(r.processed_rows))
      .filter(n => Number.isFinite(n) && n > 0);

    if (list.length > 0) {
      const recentMax = Math.max(...list);
      const value = Math.max(recentMax, MEAS_GUARD_ABS_FLOOR);
      log(`[measurements] Guard baseline = max(최근 ${list.length}판(최대 ${MEAS_GUARD_RECENT_N}판) 최댓값 ${recentMax}행, 절대 하한 ${MEAS_GUARD_ABS_FLOOR}행) = ${value}행.`);
      return { source: 'recent_max', value, recentMax, sampleCount: list.length, warning: null };
    }
    log(`[measurements] Guard baseline : 측정값 탭의 완료된 성공 기록이 아직 없다 → max(현재 DB 행수, 절대 하한 ${MEAS_GUARD_ABS_FLOOR}행) 을 기준선으로 쓴다(첫 실행).`);
    return { source: 'db_rowcount', value: null, recentMax: null, sampleCount: 0, warning: null };
  } catch (e) {
    const w = `기준선(sync_logs)을 읽지 못했다: ${e.message}`;
    log(`[measurements][WARNING] ${w}`);
    return { source: 'unavailable', value: null, recentMax: null, sampleCount: 0, warning: w };
  }
}

/* ── (r2) 표를 **한 번만** 통째로 훑는다 ───────────────────────────────────
   두 가지에 같은 스냅샷을 쓴다 —
     ㉮ seq 물려주기(④) : RI 별 (내용열쇠 -> seq 목록) 과 max(seq)
     ㉯ 「사라진 줄」 표시(⑤) : id · missing_since · missing_seen · missing_confirmed_at
     ㉰ (r3 ③) 「정정 확인 대상」 : 검사포인트·측정유형·규격 세 칸 · review_reason
   r1 은 ㉯ 때문에만 훑었다. 한 번으로 합쳐 왕복을 늘리지 않는다.

   **열이 없는 DB(마이그레이션 07 전) 대비** — 먼저 missing_* 를 포함해 읽어 보고,
   그것이 실패하면 missing_* 를 뺀 목록으로 다시 읽는다. 그러면 ㉮(seq 안정성)는
   07 전에도 그대로 작동하고 ㉯ 만 건너뛴다. **두 번째 읽기까지 실패하면 그때는
   진짜로 표를 못 읽는 것이므로 위로 던져 그 판을 보류시킨다**(예림 지적 ③). */
const MEAS_SNAPSHOT_COLS_FULL =
  'id, ri_no, seq, inspect_point, kind, nominal, tol_upper, tol_lower, '
  + 'missing_since, missing_seen, missing_confirmed_at, review_reason';
const MEAS_SNAPSHOT_COLS_BASE =
  'id, ri_no, seq, inspect_point, kind, nominal, tol_upper, tol_lower';

async function loadMeasurementSnapshot(log) {
  async function scan(cols) {
    const out = [];
    for (let from = 0; from < 200000; from += MEAS_SCAN_PAGE) {
      const { data, error } = await supabase
        .from('inspection_measurements')
        .select(cols)
        .order('id', { ascending: true })
        .range(from, from + MEAS_SCAN_PAGE - 1);
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) break;
      out.push(...data);
      if (data.length < MEAS_SCAN_PAGE) break;
    }
    return out;
  }

  let rows;
  let hasMissingCols = true;
  let warning = null;
  try {
    rows = await scan(MEAS_SNAPSHOT_COLS_FULL);
  } catch (e) {
    hasMissingCols = false;
    warning = `표시 열(missing_since / missing_seen / missing_confirmed_at / review_reason)을 읽지 못했다: ${e.message} (sql/07 을 아직 안 돌렸을 수 있다). 「사라진 줄」 표시와 「정정 확인 대상」 표시만 건너뛴다 — 수집·seq 안정성·정정 확인 대상 **분리 자체**는 그대로다.`;
    log(`[measurements][WARNING] ${warning}`);
    rows = await scan(MEAS_SNAPSHOT_COLS_BASE);   // 여기서 또 실패하면 위로 던진다 → 보류
  }

  const byRi = new Map();
  for (const r of rows) {
    const ri = String(r.ri_no || '').trim();
    if (!ri) continue;
    let e = byRi.get(ri);
    if (!e) { e = { entries: [], maxSeq: 0 }; byRi.set(ri, e); }
    const s = Number(r.seq);
    if (!Number.isFinite(s)) continue;
    if (s > e.maxSeq) e.maxSeq = s;
    e.entries.push({
      seq: s,
      id: r.id,
      key: measContentKey(r),
      point: measBlankToNull(r.inspect_point) || '',
      kind: measBlankToNull(r.kind) || '',
      specText: measSpecText(r),                 // (r3 ③) 정정 확인 대상 기록용
      reviewReason: (r.review_reason === undefined) ? undefined : (r.review_reason || null),
      placeholder: measIsPlaceholder(r)
    });
  }
  // seq 오름차순으로 정렬해 둔다 — 짝짓기가 **작은 번호부터 선착순**이 되게 한다.
  for (const e of byRi.values()) e.entries.sort((a, b) => a.seq - b.seq);

  return { rows, byRi, hasMissingCols, warning, count: rows.length };
}

/* ── 「사라진 줄」 표시 (예림 지적 ②, 차장 승인 2026-09-10) ─────────────────
   시트에서 없어진 줄을 **지우지 않는다.** 대신 표시만 한다.
     · 이번 시트에 **있는** 줄  → missing_since 를 **NULL 로 되돌린다**(복귀).
     · 이번 시트에 **없는** 줄  → missing_since 가 NULL 일 때만 **지금 시각**을 찍는다.
       이미 찍혀 있으면 **덮지 않는다** — 덮으면 「사라진 시점」이 판마다 밀려
       24시간이 영영 오지 않는다.
     · (r3 ①) 이번 시트에 **없고** 최초 부재로부터 **24시간이 지난** 줄
       → **missing_confirmed_at 을 처음 한 번만 찍는다.** 이 함수는 검증을 통과한
         정상 수집에서만 불리므로, 이 칸이 채워졌다는 것은 「24시간 뒤의 정상
         수집에서도 여전히 없었다」는 **사실 기록**이다. 화면은 이 칸만 본다.
     · (r3 ①) 시트에 **다시 나타난** 줄 → 세 칸(missing_since·missing_seen·
       missing_confirmed_at)을 **전부 초기화**한다.
     · (r3 ③) 「정정 확인 대상」으로 묶인 줄 → **아무것도 건드리지 않는다.**
     · DELETE 는 **절대** 하지 않는다.
   화면(inboundSpc.js)은 **missing_confirmed_at 이 있는 줄만** Cpk 계산에서 뺀다.
   즉시 빼지 않는 이유는 거기 주석에 적었다(일시적 수집 실패와 진짜 삭제 구분).

   실패해도 **측정값 동기화 전체를 실패로 만들지 않는다**(경고만 남긴다).
   마이그레이션 07 을 아직 안 돌린 DB 에서도 동기화가 죽지 않게 하려는 것이다 —
   그 경우 missing_since 열이 없어 여기서 오류가 나는데, 표시가 안 되는 것과
   수집이 멈추는 것 중에서는 **표시가 안 되는 쪽이 훨씬 가볍다**. */
async function reconcileMeasurementMissing(sheetKeys, snapshot, log, result, heldKeys, specReview) {
  const now = Date.now();
  const stamp = new Date(now).toISOString();
  const held = heldKeys || new Set();
  const reviewList = specReview || [];

  const toClear = [];    // 시트에 다시 나타났다 → 세 칸을 **전부** 되돌린다
  const toMark = [];     // 처음 없어졌다 → 지금 시각을 찍고 **횟수 1**
  const toSeen1 = [];    // 이미 표시돼 있는데 횟수가 비었다(옛 배포 잔재) → 1 로 맞춘다
  const toSeen2 = [];    // 이미 1회 확인 → **2회**로 올린다. 시각은 **안 건드린다**
  const toConfirm = [];  // (r3 ①) 24시간 뒤의 이 정상 수집에서도 여전히 없다 → 재확인 시각을 **처음 한 번만** 찍는다
  const toHoldReset = []; // (r5 ②) 보류에 들어간 줄의 **부재 시계를 0 으로 되돌린다**
  let alreadyMarked = 0;
  let alreadyConfirmed = 0;
  let heldSkipped = 0;

  /* (r3 ③) 「정정 확인 대상」으로 묶인 기존 줄은 이번 판에서 **아무것도 건드리지
     않는다** — 사라짐으로 표시하지도, 표시를 지우지도, 횟수를 올리지도 않는다.
     시트에서 그 줄이 「없다」고 보이는 것은 규격이 바뀌었기 때문이지 지워졌기
     때문이 아니다. 값·표시 전부 그대로 두고 review_reason 만 따로 적는다. */
  const reviewById = new Map(reviewList.map(v => [v.id, v]));

  for (const r of snapshot.rows) {
    if (held.has(`${r.ri_no} ${r.seq}`)) {
      heldSkipped++;
      /* ── (r5 ②) **보류 기간을 근거로 부재 확인을 소급 확정하지 않는다** ────
         예림 최종 회신(2026-09-10 15:44) :
         「시간이 지났다는 이유로 자동 삭제·누락 확정하지 않고, 정정 완료 또는
          정상 수집에서 짝이 명확해진 뒤 일반 처리로 복귀합니다. **보류 기간을
          근거로 부재 확인을 소급 확정하지 않는** 편이 안전합니다.」

         r4 는 보류된 줄을 **아무것도 건드리지 않고 건너뛰기만** 했다. 그래서
         보류에 들어가기 **전에** 이미 missing_since 가 찍혀 있던 줄은, 보류로
         며칠이 흐른 뒤 짝이 맞아 일반 처리로 복귀하는 **바로 그 판에서**
         「24시간이 지났다」가 성립해 missing_confirmed_at 이 곧바로 찍혔다.
         그 24시간은 **정정 확인을 기다리느라 흘러간 시간**이지 「정상 수집에서
         계속 없었다」가 아니다 — 소급 확정이다. 로컬에서 실제로 재현했다
         (시험 25 : 72시간 경과 + 정상 수집 5판 뒤 복귀판에서 mConfNew=1).

         r5 의 처리 — 보류에 들어간 줄은 **부재 시계를 0 으로 되돌린다.**
           · missing_since → NULL · missing_seen → 0
           · 복귀 뒤 그 줄이 실제로 없으면 **그때 처음 표시**되고, 거기서부터
             다시 24시간 + 정상 수집 재확인을 **처음부터** 거친다.
         **이미 확정된 줄(missing_confirmed_at 이 있는 줄)은 건드리지 않는다** —
         그 확정은 보류 전에 정상 수집으로 이미 성립한 사실이고, 되돌리면
         오히려 옛 규격 줄이 Cpk 로 되돌아온다. 보류를 근거로 **새로** 확정하지
         않는 것이 요구사항이지, 지난 확정을 지우라는 것이 아니다.
         첫 판에 한 번 되돌린 뒤에는 값이 이미 NULL/0 이므로 **다시 쓰지 않는다.** */
      const heldConfirmed = !(r.missing_confirmed_at === null || r.missing_confirmed_at === undefined);
      const heldRawSeen = Number(r.missing_seen);
      const heldSeen = Number.isFinite(heldRawSeen) ? heldRawSeen : 0;
      const heldMarked = !(r.missing_since === null || r.missing_since === undefined);
      if (!heldConfirmed && (heldMarked || heldSeen > 0)) toHoldReset.push(r.id);
      continue;
    }

    const marked = !(r.missing_since === null || r.missing_since === undefined);
    const rawSeen = Number(r.missing_seen);
    const seen = Number.isFinite(rawSeen) ? rawSeen : 0;
    const confirmed = !(r.missing_confirmed_at === null || r.missing_confirmed_at === undefined);

    if (sheetKeys.has(`${r.ri_no} ${r.seq}`)) {
      if (marked || seen > 0 || confirmed) toClear.push(r.id);
    } else if (marked) {
      alreadyMarked++;                       // **시각은 절대 덮어쓰지 않는다**
      if (seen >= MEAS_MISSING_SEEN_REQUIRED) alreadyConfirmed++;
      else if (seen <= 0) toSeen1.push(r.id);
      else toSeen2.push(r.id);               // seen === 1 → 2

      /* (r3 ①) **핵심** — 「최초 부재로부터 24시간이 지난 뒤에 이뤄진 정상 수집에서도
         여전히 없었다」를 여기서 **사실로 기록**한다. 이 함수에 들어왔다는 것 자체가
         「검증을 통과한 정상 수집」이라는 뜻이므로(보류·차단된 판은 여기 못 온다),
         조건은 「이미 찍혀 있지 않다 + 24시간이 지났다」 둘뿐이다.
         이미 찍혀 있으면 **덮지 않는다**(가장 이른 재확인 시각을 남긴다). */
      if (!confirmed) {
        const t0 = Date.parse(String(r.missing_since));
        if (Number.isFinite(t0) && (now - t0) >= MEAS_MISSING_CONFIRM_MS) toConfirm.push(r.id);
      }
    } else {
      toMark.push(r.id);
    }
  }

  async function apply(ids, patch, what) {
    for (let i = 0; i < ids.length; i += MEAS_MARK_CHUNK) {
      const slice = ids.slice(i, i + MEAS_MARK_CHUNK);
      const { error } = await supabase
        .from('inspection_measurements')
        .update(patch)
        .in('id', slice);
      /* (r11) **잠금 아래의 쓰기는 전부 같은 판별을 탄다**(예림 5차 ⑶).
         표시 UPDATE 도 응답이 유실되면 나중에 반영될 수 있으므로, upsert 와
         똑같이 「확정 거절 ↔ 미확인」으로 갈라 미확인이면 잠금을 유지한다. */
      if (error) throwWriteFailure(error, `${what} 실패`, `id ${slice.length}건 (${what})`);
    }
  }

  /* 시트에 돌아온 줄은 **세 칸을 전부 초기화**한다(예림 3차 회신 ①). */
  await apply(toClear,   { missing_since: null, missing_seen: 0, missing_confirmed_at: null }, 'missing 해제');
  await apply(toMark,    { missing_since: stamp, missing_seen: 1, missing_confirmed_at: null }, 'missing 표시');
  await apply(toSeen1,   { missing_seen: 1 }, 'missing 횟수 보정');
  await apply(toSeen2,   { missing_seen: MEAS_MISSING_SEEN_REQUIRED }, 'missing 횟수 증가');
  await apply(toConfirm, { missing_confirmed_at: stamp }, 'missing 24시간 뒤 재확인 기록');
  /* (r5 ②) 보류에 들어간 줄의 부재 시계를 0 으로. 확정된 줄은 여기 오지 않는다. */
  await apply(toHoldReset, { missing_since: null, missing_seen: 0 }, '보류 중 부재 시계 초기화');

  /* ── (r3 ③) 「정정 확인 대상」 표시 — 이번 판에서 새로 잡힌 것만 적고,
        더 이상 대상이 아닌 줄은 **NULL 로 되돌린다.** 이 칸은 표시일 뿐이라
        값·판정·missing 표시·Cpk 계산에는 아무 영향이 없다. */
  const toReviewSet = [];
  const toReviewClear = [];
  let reviewUnchanged = 0;   // (r4 ③) 같은 문제가 이어져 **그대로 둔** 줄
  let reviewKept = 0;        // (r4 ③) 대상에서 빠졌지만 **해제 조건이 아니라 남긴** 줄
  for (const r of snapshot.rows) {
    const want = reviewById.get(r.id);
    const cur = (r.review_reason === undefined) ? undefined : (r.review_reason || null);
    if (cur === undefined) continue;                       // 열이 없는 DB → 아무것도 안 한다
    if (want) {
      /* (r4 ②③) 문구는 **덧붙이지 않는다.** 같은 문제가 이어지면 같은 문자열이
         나오므로 아무것도 쓰지 않고(reviewUnchanged), 관측한 시트 규격이 바뀌었으면
         **최신 문구로 통째로 교체**한다. 그래서 길이가 판마다 자라지 않는다. */
      const text = measReviewText(want);
      if (cur !== text) toReviewSet.push({ id: r.id, text });
      else reviewUnchanged++;
    } else if (cur !== null) {
      /* ── (r4 ③) **해제 조건** ────────────────────────────────────────────
         예림 4차 회신 : 「해제는 **정상 자료로 문제가 해소됐음을 확인**하거나
         별도 정정이 완료됐을 때 하십시오. **수집 실패·원본 누락만으로 지우지는
         않는** 편이 안전합니다.」

         이 함수는 **검증을 통과한 정상 수집에서만** 불린다(수집 실패·차단·보류된
         판은 여기 오지 못한다) → 「수집 실패로 지움」은 구조적으로 일어나지 않는다.
         남은 것은 **원본 누락**이다. r3 은 「이번 판 대상이 아니면 지운다」였으므로,
         시트에서 그 줄이 통째로 없어지기만 해도 표시가 사라졌다.

         r4 는 **짝이 다시 맞았을 때만** 지운다 — 그 줄의 (ri_no, seq) 가 이번
         시트 줄로 다시 잡혔다는 것은 ㉠ 시트가 옛 규격으로 되돌아왔거나
         ㉡ 차장이 정정을 마쳐 기존 행이 시트와 같아졌다는 뜻이고, 둘 다
         「정상 자료로 문제가 해소됨」이다. 그 밖(원본 누락)에는 **남긴다**. */
      if (sheetKeys.has(`${r.ri_no} ${r.seq}`)) toReviewClear.push(r.id);
      else reviewKept++;
    }
  }
  /* 같은 문구끼리 묶어 한 번에 보낸다(건수가 적어 사실상 건별이다). */
  const byText = new Map();
  for (const v of toReviewSet) {
    if (!byText.has(v.text)) byText.set(v.text, []);
    byText.get(v.text).push(v.id);
  }
  for (const [text, ids] of byText) await apply(ids, { review_reason: text }, '정정 확인 대상 표시');
  await apply(toReviewClear, { review_reason: null }, '정정 확인 대상 해제');

  result.missingCleared = toClear.length;
  result.missingMarked = toMark.length;
  result.missingKept = alreadyMarked;
  result.missingSeenBumped = toSeen1.length + toSeen2.length;
  result.missingConfirmed = alreadyConfirmed + toSeen2.length;
  result.missingConfirmedNew = toConfirm.length;
  result.missingHeldForReview = heldSkipped;
  result.missingHoldReset = toHoldReset.length;   // (r5 ②) 보류에 들어가 부재 시계를 0 으로 되돌린 줄
  result.specReviewSet = toReviewSet.length;
  result.specReviewCleared = toReviewClear.length;
  result.specReviewUnchanged = reviewUnchanged;   // (r4 ③) 내용이 같아 그대로 둔 줄
  result.specReviewKeptStale = reviewKept;        // (r4 ③) 원본 누락이라 지우지 않고 남긴 줄
  log(`[measurements] missing : 복귀 ${toClear.length}건 · 새로 표시 ${toMark.length}건 · 이미 표시돼 시각을 그대로 둔 것 ${alreadyMarked}건 · 부재 확인 횟수를 올린 것 ${result.missingSeenBumped}건 · **24시간 뒤 정상 수집에서 재확인된 것 ${toConfirm.length}건(새로 기록)** · 정정 확인 대상이라 손대지 않은 줄 ${heldSkipped}건 · **보류라서 부재 시계를 0 으로 되돌린 줄 ${toHoldReset.length}건(보류 기간을 근거로 소급 확정하지 않는다)** (삭제 0건).`);
  log(`[measurements] 정정 확인 표시 : 새로 적거나 최신으로 교체 ${toReviewSet.length}건 · 내용이 같아 그대로 둔 것 ${reviewUnchanged}건 · **정상 자료로 짝이 다시 맞아 해제** ${toReviewClear.length}건 · 원본 누락이라 지우지 않고 남긴 것 ${reviewKept}건.`);
  /* (r5 ①) 예림 최종 회신 — 「해당 RI·무리·영향 행수를 기존 정정 확인 기록에
     남겨 운영자가 확인할 수 있어야」. 문구(review_reason)에 칸으로 넣었고,
     로그에도 무리별 합계를 한 줄로 남긴다. 새 표·새 열은 만들지 않는다. */
  if (reviewList.length > 0) {
    const byGroup = new Map();
    for (const v of reviewList) {
      const k = `RI=${v.ri} | 무리=${v.point || '(빈칸)'}/${v.kind || '(빈칸)'}`;
      if (!byGroup.has(k)) byGroup.set(k, v.heldRows);
    }
    let total = 0;
    for (const n of byGroup.values()) total += n;
    log(`[measurements] 정정 확인 영향 행수 : 무리 ${byGroup.size}개 · **영향행수 합계 ${total}줄** (= 이번 판 누락 판정에서 빠진 옛 행 수. 실제 보류된 줄 ${heldSkipped}줄과 같아야 한다). 무리별 :`);
    for (const [k, n] of byGroup) log(`[measurements]   · ${k} | 영향행수=${n}`);
  }
}

/* 지금 표에 몇 줄이 있나 — 첫 실행 때의 기준값. 읽기만 한다.
   (r8) batchId 를 주면 **그 판이 실제로 쓴 줄만** 센다(sync_batch_id 는 upsert 가
   같이 적는 칸이다). 응답이 유실됐을 때 「반영 여부」를 재조회하는 데 쓴다 —
   새 표도 새 열도 만들지 않고 이 함수 하나를 그대로 다시 쓴다. */
async function countMeasurementRows(batchId = null) {
  let q = supabase
    .from('inspection_measurements')
    .select('id', { count: 'exact', head: true });
  if (batchId) q = q.eq('sync_batch_id', batchId);
  const { count, error } = await q;
  if (error) {
    throw new Error(`inspection_measurements 행수 확인 실패: ${error.message}`);
  }
  return count || 0;
}

/* ── 측정값 덩이 본체 ──────────────────────────────────────────────────────
   **절대 예외를 밖으로 던지지 않는다.** 측정값이 실패해도 대장 동기화 결과는
   이미 성공으로 기록돼 있어야 하기 때문이다(설계안 §7 「한 판에 두 표」).
   기록은 sync_logs 에 **자기 줄을 따로** 남긴다 — 열을 새로 더하지 않고
   (sheet_gid = 40080222 로 구분) 대장 줄과 건수가 섞이지 않게 한다. */
async function syncMeasurements(ledgerSheetUrl, log) {
  const result = {
    status: 'failed',
    gid: MEAS_SHEET_GID,
    sheetUrl: null,
    parsedRows: 0,
    upsertCount: 0,
    dbRowsBefore: null,
    dbRowsAfter: null,
    uniqueKeys: 0,
    guardThreshold: null,
    guardBaseline: null,
    guardBaselineSource: null,
    guardRecentMax: null,
    guardSampleCount: null,
    guardAbsFloor: MEAS_GUARD_ABS_FLOOR,
    guardRecentN: MEAS_GUARD_RECENT_N,
    guardWarning: null,
    held: false,
    seqInherited: null,
    seqNew: null,
    seqAmbiguous: null,
    seqFilledPlaceholder: null,
    missingCleared: null,
    missingMarked: null,
    missingKept: null,
    missingSeenBumped: null,
    missingConfirmed: null,
    missingConfirmedNew: null,     // (r3 ①) 이번 판에 24시간 뒤 재확인이 기록된 줄 수
    missingHeldForReview: null,    // (r3 ③) 정정 확인 대상이라 missing 판정을 안 한 줄 수
    missingHoldReset: null,        // (r5 ②) 보류에 들어가 **부재 시계를 0 으로 되돌린** 줄 수
    specReview: null,              // (r3 ③) 「정정 확인 대상」으로 분리한 건수
    specReviewAffectedRows: null,  // (r5 ①) **영향 행수 합계** — 보류 때문에 누락 판정에서 빠진 옛 행 수
    specReviewSet: null,           // 그중 이번 판에 표시를 새로 적은(=교체한) 건수
    specReviewCleared: null,       // **정상 자료로 짝이 다시 맞아** 표시를 지운 건수
    specReviewUnchanged: null,     // (r4 ③) 내용이 같아 **그대로 둔** 건수(덧붙이지 않는다)
    specReviewKeptStale: null,     // (r4 ③) 원본 누락이라 **지우지 않고 남긴** 건수
    specReviewAmbiguous: null,     // (r4 ②) 그중 「짝짓기 미확정」 건수
    specReviewSample: null,        // 차장이 바로 볼 수 있게 앞 몇 건(전체 기록 문구)
    missingWarning: null,
    syncLogId: null,
    error: null
  };
  let measLogId = null;

  try {
    const url = buildMeasurementCsvUrl(ledgerSheetUrl);
    if (!url) throw new Error('측정값 CSV 주소를 만들 수 없다(대장 주소가 URL 형태가 아니다). GOOGLE_SHEETS_MEAS_CSV_URL 을 지정할 것.');
    result.sheetUrl = url;

    /* 기록 줄을 **시트를 받기 전에** 연다. 시트 접근 자체가 실패했을 때
       (403·404·로그인 리다이렉트) sync_logs 에 아무 흔적도 안 남으면 아무도
       고장을 눈치채지 못한다 — 그게 지금 210행이 밀린 사고의 본질이다.

       ── (r10) 이 INSERT 가 **잠금 그 자체**다 ────────────────────────────
       sql/08 의 부분 유일 인덱스가 같은 gid 의 두 번째 running 을 거절한다.
       판정은 createSyncLog() 안에 한 곳만 있고(대장과 공용), 여기서는 그 결과를
       받아 **측정값 경로에 맞는 마무리**만 한다.

       **인덱스가 아직 없어도 그대로 돈다.** 거절이 안 나면 예전처럼 진행할 뿐이다
       — 다만 그것은 **호환성**이지 보호가 아니다. 인덱스가 붙기 전 구간에는 보호가
       없다. 그래서 전환은 **크론 중지·수동/API 호출 통제를 맨 앞에** 두고
       06 → 07 → 코드 배포·READY → 08 검증을 끝낸 뒤 크론을 재개한다.
       **공백이 없는 이유는 그 사이 아무도 돌지 않기 때문**이다 — 앞 판의
       「코드 먼저라 공백 없음」 설명은 철회한다(예림 6차 지적으로 정정). */
    try {
      measLogId = await createSyncLog({
        status: 'running',
        sheet_url: url,
        sheet_gid: MEAS_SHEET_GID,
        processed_rows: 0
      }, log);
    } catch (startError) {
      if (startError.code !== 'SYNC_ALREADY_RUNNING') throw startError;
      /* ── 이미 열린 판이 있다 → **건너뛴다. 잠금은 절대 자동으로 풀지 않는다.**
         「15분을 넘겼으면 죽은 판」은 추측이고, 틀리면 **아직 살아 있는 판의 잠금을
         풀어** 두 판이 다시 함께 쓴다(예림 4차 ⑴). 오래됐다는 사실만으로 끝났다고
         확정할 수 없으므로 **닫는 코드를 지웠다.** 대신 누가 언제부터 열어 두었는지만
         남긴다 — 푸는 것은 **사람**이 한다(sql/08 머리말 ③). */
      const open = await supabase
        .from('sync_logs')
        .select('id, started_at')
        .eq('sheet_gid', MEAS_SHEET_GID)
        .eq('status', 'running')
        .order('started_at', { ascending: true })
        .limit(1);
      const o = (open.data && open.data[0]) || null;
      result.status = 'skipped';
      result.error = `측정값 경로 건너뜀 : 이전 판이 **아직 열려 있다**(sync_logs.id=${o ? o.id : '(조회 실패)'} · 시작 ${o ? new Date(o.started_at).toISOString() : '(조회 실패)'}). 잠금은 자동으로 풀지 않는다 — 그 판이 끝났는지 확인한 뒤 사람이 그 행을 닫아야 다음 판이 진행된다. 이번 판은 측정값 표를 한 줄도 건드리지 않았다(대장 동기화는 정상 처리됐다).`;
      log(`[measurements] ${result.error}`);
      return result;
    }
    result.syncLogId = measLogId;

    log(`[measurements] Fetching measurement sheet CSV (gid=${MEAS_SHEET_GID})...`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`측정값 시트를 받지 못했다. Status: ${response.status}`);
    }
    const csvData = await response.text();
    log(`[measurements] CSV load success. Byte size: ${csvData.length}`);

    const rows = parseMeasurementCSV(csvData);
    result.parsedRows = rows.length;
    log(`[measurements] Parsed ${rows.length} valid rows (RI 번호가 있는 줄만).`);

    /* ── (r2 ③) 표를 먼저 읽는다. **못 읽으면 그 판을 보류한다** ──────────
       예림 2차 회신 : 「『기준선을 못 읽으면 진행』은 수정 권고드립니다.
       안전 확인이 실패한 순간에 보호장치가 사라집니다.」 — 맞는 지적이다.
       r1 의 「경고만 남기고 진행」은 **틀린 판단이었다.**

       그래서 조회가 실패하면 **측정값 표와 missing 표시를 이번 판에는 아예 안
       건드린다.** 대신 —
         · **대장(gid 0) 경로는 그대로 다 처리된다.** 이 함수는 예외를 밖으로
           던지지 않고, 대장은 이 함수가 불리기 **전에** 이미 success 로 적혔다.
           대장 서비스는 어떤 경우에도 멈추지 않는다.
         · sync_logs 에 측정값 줄이 **failed 로 남는다**(경고 기록). 고장이 조용히
           묻히지 않는다.
         · 이 판은 성공 기록이 아니므로 **다음 판의 기준선을 오염시키지 않는다**.
         · DELETE 를 하지 않으므로 **있던 자료는 그대로다.** 최악이 「이번 판만
           측정값이 안 들어옴」이고, 다음 판(10분 뒤)에 다시 시도된다. */
    let snapshot;
    try {
      snapshot = await loadMeasurementSnapshot(log);
    } catch (snapError) {
      const e = new Error(
        `측정값 보류 : 표(inspection_measurements)를 읽지 못했다 — ${snapError.message}. ` +
        '안전 확인을 못 했으므로 이번 판은 측정값 반영과 missing 갱신을 **하지 않는다**. ' +
        '(대장 동기화는 정상 처리됐다. 자료는 그대로다.)'
      );
      e.code = 'MEAS_GUARD_UNAVAILABLE';
      throw e;
    }
    const before = snapshot.count;
    result.dbRowsBefore = before;
    if (snapshot.warning) result.missingWarning = snapshot.warning;

    const baseline = await resolveMeasurementGuardBaseline(log);
    result.guardBaselineSource = baseline.source;
    result.guardRecentMax = baseline.recentMax;
    result.guardSampleCount = baseline.sampleCount;
    result.guardWarning = baseline.warning;

    if (baseline.source === 'unavailable') {
      const e = new Error(
        `측정값 보류 : ${baseline.warning}. ` +
        '안전 확인을 못 했으므로 이번 판은 측정값 반영과 missing 갱신을 **하지 않는다**. ' +
        '(대장 동기화는 정상 처리됐다. 자료는 그대로다.)'
      );
      e.code = 'MEAS_GUARD_UNAVAILABLE';
      throw e;
    }

    /* 첫 실행(성공 기록이 아직 없다)에도 절대 하한을 함께 적용한다. */
    const baseValue = baseline.source === 'db_rowcount'
      ? (Number.isFinite(Number(before)) ? Math.max(Number(before), MEAS_GUARD_ABS_FLOOR) : null)
      : baseline.value;
    result.guardBaseline = Number.isFinite(Number(baseValue)) ? Number(baseValue) : null;

    /* ── (r2 ④) 기존 줄과 **내용으로 짝지어** seq 를 물려받는다 ────────── */
    const built = buildMeasurementRecords(rows, measLogId, snapshot);
    if (built.duplicateKeys > 0) {
      log(`[measurements][WARNING] (ri_no, seq) 열쇠가 ${built.duplicateKeys}건 겹쳤다. 뒤엣것만 남긴다.`);
    }
    result.uniqueKeys = built.records.length;
    result.seqInherited = built.seqInherited;
    result.seqNew = built.seqNew;
    result.seqAmbiguous = built.ambiguousRows;
    result.seqFilledPlaceholder = built.seqFilledPlaceholder;

    /* ── (r3 ③) 「정정 확인 대상」 — 새 행을 만들지 않았고 옛 행도 안 건드렸다 ── */
    result.specReview = built.specReview.length;
    result.specReviewAmbiguous = built.specReview.filter(v => v.ambiguous).length;
    /* (r5 ①) **영향 행수 합계** — 무리마다 「그 무리에서 누락 판정이 보류된 옛 행 수」를
       한 번씩만 더한다. 무리 단위로 통째로 빠지므로 이 값은 heldKeys 의 줄 수와 같다. */
    {
      const seenGroup = new Set();
      let affected = 0;
      for (const v of built.specReview) {
        const k = `${v.ri}${v.point}${v.kind}`;
        if (seenGroup.has(k)) continue;
        seenGroup.add(k);
        affected += v.heldRows;
      }
      result.specReviewAffectedRows = affected;
    }
    /* (r4 ②) 응답·로그·`review_reason` 열에 **같은 문자열**을 쓴다. 세 곳의 내용이
       갈리면 차장이 어느 쪽을 믿어야 할지 알 수 없기 때문이다. 새 표·새 열은 없다. */
    result.specReviewSample = built.specReview.slice(0, 20).map(measReviewText);
    if (built.specReview.length > 0) {
      log(`[measurements][검토] 정정 확인 대상 ${built.specReview.length}건(그중 짝짓기 미확정 ${result.specReviewAmbiguous}건 · **영향행수 합계 ${result.specReviewAffectedRows}줄**) : 같은 RI 안에서 검사포인트·측정유형은 같은데 **기준치수·공차만 달라진** 무리다. 새 행을 만들지 않았고, 그 무리의 기존 줄은 **이번 판 누락 판정에서 통째로 뺐다**(값·표시 전부 그대로). 차장 확인 대상 :`);
      for (const line of result.specReviewSample) log(`[measurements][검토]   · ${line}`);
      if (built.specReview.length > result.specReviewSample.length) {
        log(`[measurements][검토]   · … 외 ${built.specReview.length - result.specReviewSample.length}건. 전체 목록 : SELECT id, ri_no, seq, inspect_point, kind, nominal, tol_upper, tol_lower, review_reason FROM public.inspection_measurements WHERE review_reason IS NOT NULL ORDER BY ri_no, seq;`);
      }
    }
    log(`[measurements] seq : 기존 줄에서 물려받음 ${built.seqInherited}(그중 미완성 자리를 채운 것 ${built.seqFilledPlaceholder}) · 새로 받음 ${built.seqNew} · 같은 내용이 겹쳐 선착순으로 가른 줄 ${built.ambiguousRows} (고유 (ri_no,seq) ${built.records.length}).`)

    /* ── 안전장치. 여기서 던지면 표에는 **한 줄도 쓰이지 않는다** ─────────
       (r2 ②) 재는 값을 **검증을 통과한 고유 (ri_no, seq) 수**로 맞췄다.
       기준선(processed_rows)에도 같은 값을 적으므로 **같은 표본끼리** 비교된다
       (예림 권고). r1 은 파싱 줄 수를 재고 파싱 줄 수를 적어, 중복 열쇠가
       생기는 순간 둘이 어긋날 수 있었다. */
    const measured = built.records.length;
    //    ㉮ 「유효 행 0」은 기준선과 **무관하게** 언제나 막는다.
    //       빈 CSV·머리글만 있는 CSV·403·로그인 페이지가 전부 여기서 걸린다.
    if (measured === 0) {
      const e = new Error('측정값 안전장치 작동 : 시트에서 읽은 유효 행이 0 이다. 아무것도 쓰지 않고 중단한다.');
      e.code = 'MEAS_ROWCOUNT_GUARD';
      throw e;
    }
    //    ㉯ 비율 검사. 기준선은 **늘 있다**(못 읽으면 위에서 이미 보류했다).
    if (Number.isFinite(Number(baseValue)) && Number(baseValue) > 0) {
      const threshold = Math.floor(Number(baseValue) * MEAS_MIN_ROW_RATIO);
      result.guardThreshold = threshold;
      const baseLabel = baseline.source === 'recent_max'
        ? `max(최근 ${baseline.sampleCount}판 최댓값 ${baseline.recentMax}행, 절대 하한 ${MEAS_GUARD_ABS_FLOOR}행)=${baseValue}행`
        : `max(현재 DB ${before}행, 절대 하한 ${MEAS_GUARD_ABS_FLOOR}행)=${baseValue}행(첫 실행 기준선)`;
      if (measured < threshold) {
        const e = new Error(
          `측정값 안전장치 작동 : 시트 유효 고유행 ${measured} 이 ${baseLabel} 의 ` +
          `${Math.round(MEAS_MIN_ROW_RATIO * 100)}%(=${threshold}행) 미만이다. ` +
          '시트 접근 실패·권한 문제로 빈/잘린 CSV 가 왔을 수 있다. 아무것도 쓰지 않고 중단한다.'
        );
        e.code = 'MEAS_ROWCOUNT_GUARD';
        throw e;
      }
      log(`[measurements] Row guard passed: ${measured} >= ${threshold} (${baseLabel} x ${MEAS_MIN_ROW_RATIO}).`);
    }

    log(`[measurements] Upserting ${built.records.length} records into "inspection_measurements" (key = ri_no, seq)...`);
    /* (r6) **한 요청으로 보낸다 — 쪼개기를 지웠다**(예림 HOLD ① · 시험 T4 로 재현).
       500행씩 쪼개면 두 번째 묶음이 실패할 때 **첫 묶음의 반영만 남는다**. 되돌릴
       방법이 없고, 로그는 그 사실을 담지 못했다. PostgREST 는 **한 요청 = 한
       트랜잭션**이므로 한 번에 보내면 실패해도 **한 줄도 안 남는다** — 부분 반영이
       코드를 지우면서 사라진다.
       실측 : 1,112행 **455,708 B** · 정본 1,196행 환산 **490,132 B(0.47 MiB)**.
       같은 파일의 대장(gid 0) upsert 가 이미 619행 **204,946 B** 를 쪼개지 않고
       한 요청으로 보내고 있다 — 새 방식이 아니라 **이 파일에 이미 있던 방식**이다.
       ponytail: 천장은 요청 본문 크기다. 시트가 지금의 4배(약 4,800행 ≈ 1.9 MiB)를
       넘어 요청이 거부되기 시작하면 그때 다시 쪼개되, **반영된 건수를 로그에 적는
       것**을 함께 만든다(그게 이번에 없어서 난 사고다). */
    const { error: upsertError, status: upsertStatus } = await supabase
      .from('inspection_measurements')
      .upsert(built.records, { onConflict: 'ri_no,seq' });
    if (upsertError) {
      /* ── (r11) 판별은 **공용 헬퍼 한 곳**에서 한다(throwWriteFailure · 위 정의).
         여기서 더 하는 일은 하나뿐 — **모를 때 한 번 재조회**해서 이 판이 실제로
         쓴 줄 수를 세는 것이다(`sync_batch_id` 는 upsert 가 모든 줄에 이미 적는 칸).
         재조회가 **양수**면 들어간 것이 보이므로 그 수를 실제 반영 건수로 적고 판을
         닫는다. **0건은 확정이 아니다** — 아직 처리 중인 요청이 나중에 커밋할 수
         있으므로 그대로 미확인 경로로 보낸다(예림 4차·5차 ⑵). */
      let scope = `고유 (ri_no,seq) ${built.records.length}행 · sync_batch_id=${measLogId}`;
      if (!isDefiniteDbRejection(upsertError)) {
        let observed = null;
        try {
          observed = await countMeasurementRows(measLogId);
        } catch (recheckError) {
          log(`[measurements][WARNING] 반영 재조회도 실패했다: ${recheckError.message}`);
        }
        if (observed > 0) {
          /* 들어간 것이 **보인다** → 그 수를 실제 반영 건수로 적고 판을 닫는다. */
          result.upsertCount = observed;
          throw new Error(`측정값 upsert 결과를 응답으로 확인하지 못했다(${built.records.length}행 전량 · 응답 ${upsertStatus ?? '(없음)'}): ${upsertError.message}. 재조회로 확인한 **실제 반영 ${observed}행** (${scope})`);
        }
        scope += ` · 관측 ${observed === null ? '실패(재조회 불가)' : observed + '건'}`;
      }
      throwWriteFailure(upsertError, `측정값 upsert(${built.records.length}행 전량 · 응답 ${upsertStatus ?? '(없음)'})`, scope);
    }
    result.upsertCount = built.records.length;

    /* 사라진 줄 표시 — upsert **뒤**에 한다. 그래야 이번에 새로 들어온 줄도
       「시트에 있는 줄」로 잡혀 표시 대상에서 빠진다.
       (r2 ⑤) 여기까지 온 판은 **검증을 통과한 정상 수집**이다. 그러니 여기서
       세는 부재 횟수만이 「정상 수집에서 확인된 부재」다. 보류·차단된 판은
       이 자리에 오지도 못하므로 **횟수가 늘지 않는다.**
       열이 없어 표시를 못 해도 수집 결과는 성공이다(경고만 남긴다). */
    if (!snapshot.hasMissingCols) {
      log('[measurements][WARNING] 사라진 줄 표시·정정 확인 대상 표시를 건너뛴다: 표시 열(missing_since / missing_seen / missing_confirmed_at / review_reason)이 없다 (수집 결과는 그대로 성공이고, 정정 확인 대상 **분리**는 그대로 작동했다. sql/07 을 아직 안 돌렸을 수 있다)');
    } else {
      {
        const sheetKeys = new Set(built.records.map(r => `${r.ri_no} ${r.seq}`));
        /* (r3 ③ · r4 ④) 정정 확인 대상 무리의 **기존 줄 전부**를 missing 판정에서
           통째로 뺀다. r3 은 짝지어진 한 줄만 뺐고, 같은 무리의 나머지 후보 줄은
           같은 실행에서 「시트에 없음 → 누락」으로 찍혔다(시험 15-B 에서 재현).
           예림 4차 회신 ③ 이 짚은 두 경로 충돌이다. r4 는 무리째 뺀다. */
        const heldKeys = new Set(built.specReview.map(v => `${v.ri} ${v.seq}`));
        /* (r6) **실패를 삼키지 않는다**(예림 HOLD ②). 여기 여러 UPDATE 는 하나로
           묶을 수 없다 — 묶음마다 적는 값이 다르다. 그래서 중간에 하나가 실패하면
           **일부 표시만 바뀐 상태**가 남는데, r5 는 그것을 경고만 남기고 success 로
           끝냈다. 이제 그대로 밖으로 던진다 → 아래 catch 가 sync_logs 를
           **failed** 로 적고 error_message 에 무엇이 실패했는지 남긴다.
           **롤백은 만들지 않는다** : 이 표시들(missing_since·missing_seen·
           missing_confirmed_at·review_reason)은 **멱등**하고 다음 판(10분 뒤)에
           스냅샷으로부터 통째로 다시 계산된다 — 자료(측정값)는 상하지 않는다. */
        await reconcileMeasurementMissing(sheetKeys, snapshot, log, result, heldKeys, built.specReview);
      }
    }

    result.dbRowsAfter = await countMeasurementRows();
    result.status = 'success';
    log(`[measurements] Done. ${before} -> ${result.dbRowsAfter} rows (upsert ${result.upsertCount}).`);

    /* (r2 ②) processed_rows 에는 **검증을 통과한 고유 (ri_no, seq) 수**를 적는다.
       다음 판의 기준선이 이 값을 읽으므로, 재는 값과 적는 값이 같아야 한다. */
    await finalizeSyncLog(measLogId, {
      status: 'success',
      finished_at: new Date().toISOString(),
      processed_rows: result.uniqueKeys,
      upsert_count: result.upsertCount
    }, log);

  } catch (error) {
    const held = error.code === 'MEAS_GUARD_UNAVAILABLE';
    result.status = 'failed';
    result.held = held;
    result.error = error.message;
    log(`[measurements][${held ? 'WARNING' : 'ERROR'}] 측정값 ${held ? '보류' : '동기화 중단'}: ${error.message} (대장 동기화 결과에는 영향 없음)`);
    console.error('[Sync Engine][measurements]', error);
    /* ── (r11) **응답 status ≠ DB status** (예림 5차 ⑴) ─────────────────────
       미확인 판에서 두 가지를 **따로** 다룬다 —
         · **응답 객체**(이 함수가 돌려주는 JSON) : `status='failed'` · error 에 미확인
           문구. 부른 쪽은 「이 판은 성공하지 않았다」를 바로 안다.
         · **DB `sync_logs` 행** : **`status` 는 `running` 그대로 · `finished_at` 도
           안 찍는다.** 인덱스 조건이 `status='running'` 이므로 failed 로 바꾸는
           순간 **잠금이 풀린다** — 늦게 커밋하는 그 요청과 다음 판이 함께 쓴다.
           `processed_rows` 도 손대지 않는다(시작 때 적은 **0** 이 그대로 남는다).
           **`error_message` 한 칸만** 고친다.
       이 UPDATE 마저 실패하면 finalizeSyncLog 가 경고만 남기고 지나간다 —
       행이 running 으로 남는 쪽이 안전하므로 **아무것도 더 하지 않는다.** */
    await finalizeSyncLog(measLogId, error.code === 'WRITE_UNVERIFIED' ? {
      error_message: `${error.message} [파싱 줄 수 ${result.parsedRows} · 검증 통과 고유 (ri_no,seq) ${result.uniqueKeys}]`
    } : {
      status: 'failed',
      finished_at: new Date().toISOString(),
      /* (r6) **실제로 반영된 건수를 적는다**(예림 HOLD ①·③). r5 는 여기에 늘 0 을
         적었다 — 측정값이 이미 반영된 뒤 표시 단계에서 실패한 판까지 「0건」으로
         남아 **복구 판단이 틀어졌다.** 이제 `result.upsertCount` 를 그대로 적는다 :
           · 안전장치·보류로 **아무것도 안 쓴 판** → upsertCount 는 **0** 이다
             (r3 ② 가 지키려던 성질이 값 그대로 유지된다).
           · 측정값은 들어갔는데 표시에서 실패한 판 → **실제 반영 건수**가 남는다.
         **기준선이 오염되지 않는 근거** — resolveMeasurementGuardBaseline() 의 후보
         조건은 `status='success'` **AND** `processed_rows > 0` 두 겹이다. 이 판은
         status 가 **failed** 이므로 첫 겹에서 이미 빠진다(시험 12-r6 으로 실측). */
      processed_rows: result.upsertCount,
      error_message: `${error.message} [파싱 줄 수 ${result.parsedRows} · 검증 통과 고유 (ri_no,seq) ${result.uniqueKeys} · **실제 반영 ${result.upsertCount}행**]`,
      upsert_count: result.upsertCount
    }, log);
  }

  return result;
}
