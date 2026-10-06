/* ─────────────────────────────────────────────────────────────────────────────
   inboundSpc.js — 인수검사 SPC 데이터 어댑터  (플랜 042 / P9 r9)

   P9 r9 이 여기에 **더한** 것 — 파일 아래쪽의 riYmd / reportDateMap / rowDate /
   rowsInRange 넷뿐이다. **기존 계산 규칙은 한 글자도 안 바꿨다.** 넷 다 "측정값 한 줄이
   며칠 것이냐"를 답하는 함수고, 그걸로 협력업체 화면의 기간 필터가 Cpk 에도 걸린다.

   P7 r7 이 여기서 고친 것 — **null 방어 세 줄뿐**이다. 계산 규칙은 한 글자도 안 바꿨다.
   09-02 스냅샷의 측정값기록서에는 품번·품명이 빈(null) 줄이 11개 있다. 그걸 그대로
   spcCore.buildD 에 넘기면 `Array.from(r.name)` 이 null 을 돌다가 터지고, 영역 4
   「공정능력(Cpk)」이 통째로 「불러오지 못했다」로 뜬다. r6 에서도 같은 자료면 똑같이
   터진다 — 이 판이 만든 문제가 아니라, 새 자료가 드러낸 예전 구멍이다.

   개발웹 표 2개를 읽어 spc_core.load() 와 **동일한 규칙**으로 rows 를 만들고
   spcCore.buildD(rows) 에 넣어 화면이 쓰는 D 를 돌려준다.

   ※ spcCore.js 는 P2 에서 대조 검증(파이썬 원본과 값 일치)이 끝난 파일이다. 손대지 말 것.
   ※ 여기서 하는 일은 "표 → rows" 뿐이다. 계산은 전부 spcCore 가 한다.

   rows 규칙 (spc_core.load 이식 — 이 4줄이 값의 정확도를 좌우한다)
     0) (P8e r3) **missing_confirmed_at 이 채워진 행만** 뺀다 — 「최초 부재로부터
        24시간이 지난 뒤의 정상 수집에서도 여전히 시트에 없었다」가 확인된 줄이다.
        그 칸이 비었으면 **예전과 완전히 같게** 남긴다. 열이 아예 없어도 같다.
     1) kind === '수치' 인 행만 쓴다.
     2) nominal(T) · tol_upper · tol_lower 가 모두 숫자여야 한다. 하나라도 없으면 그 행은 버린다.
     3) x1..x5 중 null·빈칸·비수치는 **빼고** 담는다. 0 으로 바꾸지 않는다(0 은 실측값이다).
        남은 xs 가 비면 그 행은 버린다.
     4) usl = T + max(tol_upper, tol_lower),  lsl = T + min(tol_upper, tol_lower)
     5) vendor 는 inspections 대장에서 inspectionReportNo → supplier 로 찾는다.
        대장에 없으면 '(대장미연결)', 대장엔 있는데 업체명이 비었으면 '(미상)'.

   행 순서: source_row 오름차순. api.fetch 는 id 내림차순으로 받아오므로 반드시 되돌려야
   원본(엑셀) 순서가 되고, 같은 RI 안의 로트 순서가 P2 대조표와 어긋나지 않는다.
   ───────────────────────────────────────────────────────────────────────────── */

import { buildD, normPct, pyRound, pyMean, pyStdev, grade } from './spcCore';
import { loadInspections, loadMeasurements, ymd } from './inboundStats';

/* ── 등급 5색 (v3 시안 팔레트). 정적 매핑이라 tailwind safelist 가 필요 없다 ── */
export const GRADE_ORDER = ['특급', '1등급', '2등급', '3등급', '4등급'];
export const GRADE_COLOR = {
    '특급': { bar: '#00704a', text: '#005a3b', bg: '#e2efe9' },
    '1등급': { bar: '#4fa872', text: '#256b45', bg: '#e8f3ec' },
    '2등급': { bar: '#1f7ab6', text: '#185f8e', bg: '#e7f0f7' },
    '3등급': { bar: '#c2841a', text: '#875a10', bg: '#f7efe1' },
    '4등급': { bar: '#c0393c', text: '#9b2f31', bg: '#f8e9e9' },
};
/** 회사 공식 5등급 경계 (SSOT: [신우밸브]cpk 기준.pdf) */
export const GRADE_BOUND = [0.67, 1.00, 1.33, 1.67];
/** 랭킹 막대 가로축 도메인 (v3 시안과 동일) */
export const PPK_DOMAIN = 1.8;

export const gradeOf = (idx) =>
    idx >= 1.67 ? '특급' : idx >= 1.33 ? '1등급' : idx >= 1.00 ? '2등급' : idx >= 0.67 ? '3등급' : '4등급';

export const colorOf = (g) => GRADE_COLOR[g] || GRADE_COLOR['4등급'];

/* ── (042 P8e r3) 시트에서 「사라진 줄」을 언제 계산에서 뺄 것인가 ──────────
   동기화는 시트에서 없어진 줄을 **지우지 않는다**. 대신 —
     · 없어진 시각                                   → missing_since
     · 정상 수집에서 없던 것으로 확인된 횟수          → missing_seen
     · **최초 부재로부터 24시간이 지난 뒤의 정상 수집에서도 여전히 없었음**
                                                     → **missing_confirmed_at**
   을 적어 둔다(sql/07).

   ── 여기서 빼는 조건은 **missing_confirmed_at 이 있다** 하나뿐이다 ──────────
   r2 는 「missing_since 가 24시간 초과 **AND** missing_seen >= 2」였다.
   예림 3차 회신(2026-09-10 12:41) 이 그 구멍을 짚었다 :
   「횟수는 괜찮으나 **두 번째 이후의 정상 부재 확인이 「최초 부재로부터 24시간
    지난 뒤」에 있어야 한다.** 초기에 부재를 두 번 확인한 뒤 수집 장애가 이어지면,
    단순히 「24시간 초과 AND missing_seen>=2」만으로는 **시간 경과 후 제외될 수
    있다.**」

   실제로 그렇다 — 두 조건이 서로 **다른 시점**을 보기 때문이다.
       09:00 정상 수집, 부재 1회  → missing_since=09:00, missing_seen=1
       09:10 정상 수집, 부재 2회  → missing_seen=2 (아직 24시간 전이다)
       09:20 부터 수집 장애가 계속 → 보류된 판은 표를 안 건드린다(아무 것도 안 는다)
       이틀 뒤                      → 24시간도 넘었고 seen 도 2 다 → **빠진다.**
                                      그런데 **24시간 뒤에 확인한 사람은 아무도 없다.**

   그래서 r3 은 「24시간 뒤의 정상 수집에서도 여전히 없었다」를 **사실로 기록**한
   칸(missing_confirmed_at)을 보고, **그 칸이 있을 때만** 뺀다. 동기화는 이 칸을
     ㉠ 검증을 통과한 **정상 수집**에서,
     ㉡ 그 줄이 이번에도 시트에 **없고**,
     ㉢ now() >= missing_since + 24시간
   일 때 **처음 한 번만** 채운다(보류·차단된 판은 표를 아예 안 건드린다).
   시트에 다시 나타나면 세 칸을 **전부 초기화**한다.

   **missing_seen >= 2 를 함께 두지 않는 이유** — 위 ㉠㉡㉢ 를 만족한 판이 곧
   「부재 확인」이고, missing_since 를 찍은 판이 그 앞에 반드시 있었으므로
   「정상 수집에서 2회 이상 확인」은 이 칸 하나에 이미 들어 있다(중복 조건이다).
   조건을 더 얹으면 오히려, missing_since 는 있는데 missing_seen 이 비어 있는
   **옛 배포 잔재 행**에서 진짜 삭제가 한 판 더 늦게까지 남는다. 판정 근거를
   **한 칸**으로 모으는 편이 맞다. missing_seen 은 사람이 「몇 번 확인됐나」를
   보기 위한 값으로 남는다.

   왜 즉시 빼지 않나 — 「시트에서 안 보인다」에는 두 가지가 섞여 있다.
     ㉮ 검사원이 그 줄을 정말로 지웠다        → 계산에서 빠져야 맞다
     ㉯ 그 판만 수집이 잘못됐다               → 다음 판이면 돌아온다
   24시간이면 10분짜리 크론이 144판을 도는 시간이라, 일시적 실패는 그 안에 복구된다.

   **열이 아직 없는 DB(마이그레이션 07 전)** 에서는 값이 undefined 라 조건이
   성립하지 않는다 → 예전과 완전히 똑같이 전부 포함한다(회귀 0).

   ※ (r3 ③) review_reason(「정정 확인 대상」) 이 붙은 줄은 **여기서 아무 영향도
     받지 않는다.** 그 표시는 차장이 볼 표시일 뿐이고, 그 줄의 값·규격은 그대로라
     Cpk 에도 예전 그대로 들어간다. */
export const MISSING_GRACE_MS = 24 * 60 * 60 * 1000;   // 동기화 쪽 MEAS_MISSING_CONFIRM_MS 와 같은 값이어야 한다
export const MISSING_SEEN_REQUIRED = 2;                // (참고용) 화면 판정에는 더 이상 쓰지 않는다

/* 「시트에서 진짜로 없어진 줄」인가 — **missing_confirmed_at 하나만** 본다.
   **NULL·없음·못 읽는 값은 전부 false** — 즉 지금과 완전히 똑같이 포함한다.
   (열이 아직 없는 DB 에서는 undefined 가 오므로 화면이 깨지지 않는다.) */
function isConfirmedGone(confirmedAt) {
    if (confirmedAt === null || confirmedAt === undefined || confirmedAt === '') return false;
    return Number.isFinite(Date.parse(String(confirmedAt)));
}

/* ── 숫자 변환: 숫자면 그대로, 문자열이면 trim 후 Number. 못 읽으면 null ── */
function num(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    const s = String(v).trim();
    if (s === '') return null;
    const f = Number(s);
    return Number.isFinite(f) ? f : null;
}

/** inspections 대장 → { 성적서번호: 업체명 } */
export function vendorMap(inspections) {
    const m = new Map();
    for (const r of inspections || []) {
        const no = r && r.inspectionReportNo;
        if (!no || no === '-') continue;
        const sup = String(r.supplier || '').trim();
        m.set(String(no), sup || '(미상)');
    }
    return m;
}

/**
 * 측정값 표 + 대장 → spcCore.buildD 가 먹는 rows
 * @returns {{rows: Array, stat: {read:number, used:number, dropKind:number, dropSpec:number, dropX:number, unlinked:number}}}
 */
export function buildRows(measurements, inspections) {
    const vmap = vendorMap(inspections);
    const stat = { read: 0, used: 0, dropKind: 0, dropSpec: 0, dropX: 0, dropMissing: 0, unlinked: 0 };
    /* (r3) '지금'을 여기서 읽던 줄을 없앴다 — 제외 판정이 시각 계산을 하지 않고
       missing_confirmed_at 이 **있는지만** 보므로 더 이상 필요 없다. */

    const src = (measurements || []).slice().sort((a, b) => {
        const x = Number(a && a.source_row), y = Number(b && b.source_row);
        if (Number.isFinite(x) && Number.isFinite(y)) return x - y;
        return 0;                                   // source_row 가 없으면 받은 순서 유지
    });

    const rows = [];
    for (const r of src) {
        stat.read++;
        if (isConfirmedGone(r.missing_confirmed_at)) { stat.dropMissing++; continue; }  // 규칙 0 (P8e r3)
        if (r.kind !== '수치') { stat.dropKind++; continue; }              // 규칙 1

        const T = num(r.nominal), tu = num(r.tol_upper), tl = num(r.tol_lower);
        if (T === null || tu === null || tl === null) { stat.dropSpec++; continue; }  // 규칙 2

        const xs = [];                                                     // 규칙 3
        for (const k of ['x1', 'x2', 'x3', 'x4', 'x5']) {
            const v = num(r[k]);
            if (v !== null) xs.push(v);            // null/비수치는 건너뛴다 (0 으로 채우지 않는다)
        }
        if (xs.length === 0) { stat.dropX++; continue; }

        const ri = String(r.ri_no || '');
        let vendor = vmap.get(ri);
        if (vendor === undefined) { vendor = '(대장미연결)'; stat.unlinked++; }  // 규칙 5

        rows.push({
            ri,
            /* P7 r7 — 시트에서 온 값이 null 일 수 있다. 09-02 스냅샷에는 품번·품명이 빈
               줄이 11개 있고, 그대로 넘기면 spcCore.buildD 의 `Array.from(r.name)` 이
               null 을 돌다가 터진다(영역 4 가 통째로 「불러오지 못했다」가 된다).
               자료를 지어내지 않고, **글자로만** 맞춰 준다 — 빈 값은 빈 글자다. */
            part: r.part_no === null || r.part_no === undefined ? '' : String(r.part_no),
            name: r.item_name === null || r.item_name === undefined ? '' : String(r.item_name),
            point: r.inspect_point === null || r.inspect_point === undefined ? '' : String(r.inspect_point),
            T,
            usl: T + Math.max(tu, tl),                                     // 규칙 4
            lsl: T + Math.min(tu, tl),
            xs,
            vendor,
            judg: r.judgment,
        });
        stat.used++;
    }
    return { rows, stat };
}

/* ── 캐시 (모듈 변수). 화면 네 개가 같은 D 를 쓰므로 한 번만 계산한다 ──
   표 원본(inspections · inspection_measurements)은 inboundStats.js 의 캐시 로더가
   들고 있다. 여기서 다시 받지 않는다 — 화면을 몇 개 열든 표당 요청은 한 번이다. */
let _cache = null;      // { D, stat, rows, loadedAt }
let _inflight = null;   // 동시 호출 합치기

/**
 * 인수검사 SPC 결과를 얻는다.
 * @param {{force?: boolean}} opt force 면 캐시를 버리고 다시 받는다.
 * @returns {Promise<{D:{overall:Object, vendors:Array}, stat:Object, rows:Array, loadedAt:Date}>}
 *   rows 는 buildD 에 넣은 그 rows 다 (ri·part·point·T·usl·lsl·xs·vendor).
 *   「품목·부적합」의 규격외 로트 표가 실측값을 그대로 보여주려면 이게 필요하다.
 */
export async function loadInboundSpc(opt) {
    const force = !!(opt && opt.force);
    if (!force && _cache) return _cache;
    if (!force && _inflight) return _inflight;

    _inflight = (async () => {
        const [meas, insp] = await Promise.all([
            loadMeasurements({ force }),
            loadInspections({ force }),
        ]);
        const { rows, stat } = buildRows(meas, insp);
        if (rows.length === 0) throw new Error('[inboundSpc] 쓸 수 있는 측정값이 없다 (표가 비었거나 kind/규격 값이 없다)');
        const D = buildD(rows);
        _cache = { D, stat, rows, loadedAt: new Date() };
        return _cache;
    })();

    try {
        return await _inflight;
    } finally {
        _inflight = null;
    }
}

export function clearInboundSpcCache() { _cache = null; _inflight = null; }

/* ── (P4 r4) 품번별 Ppk · 등급 ─────────────────────────────────────────────
   buildD 는 **업체 단위**로만 묶는다. 시안의 「품번별 Cpk 등급 분포(237 품번)」는
   같은 규칙을 품번(part_no) 단위로 다시 적용한 **파생값**이다. 계산 규칙은
   buildD([D:155-165], [D:195-202]) 를 그대로 따른다 — 새로 짜지 않았다.
     1) 로트마다 xs → normPct 로 %정규화. ±무한대가 나오는 로트는 통째로 버린다.
     2) pct = round(p, 1) 로 반올림한 값들을 품번 단위로 모은다.
     3) ppk = min(100-mu, mu+100) / (3σ),  σ = statistics.stdev(pct)  (n<2 면 null)
     4) 등급은 **반올림 전 ppk** 로 판정한다(buildD [D:202] 와 동일).
   ※ 대조 확인(2026-08-21 스냅샷, 측정값 752행): 237 품번 ·
      특급 43 / 1등급 14 / 2등급 24 / 3등급 31 / 4등급 125 — 시안 값과 일치.
   @param {Array} rows loadInboundSpc().rows
   @returns {Array<{key,name,n,lots,oos,idx,grade}>} idx 내림차순(값 없는 품번은 뒤)
*/
export function partGrades(rows) {
    const m = new Map();
    for (const r of rows || []) {
        const raw = r.xs.map((x) => normPct(x, r.T, r.usl, r.lsl));
        if (!raw.every((p) => -1e308 < p && p < 1e308)) continue;
        const pct = raw.map((p) => pyRound(p, 1));
        const k = String(r.part || '').trim() || '(미상)';
        if (!m.has(k)) m.set(k, { key: k, name: String(r.name || ''), pct: [], lots: 0, oos: 0 });
        const o = m.get(k);
        o.pct.push(...pct);
        o.lots += 1;
        o.oos += pct.filter((p) => Math.abs(p) > 100).length;
    }
    const out = [];
    for (const o of m.values()) {
        const mu = pyMean(o.pct);
        const so = o.pct.length >= 2 ? pyStdev(o.pct) : null;
        const ppk = so ? Math.min(100 - mu, mu + 100) / (3 * so) : null;
        out.push({
            key: o.key, name: o.name, n: o.pct.length, lots: o.lots, oos: o.oos,
            idx: ppk === null ? null : pyRound(ppk, 2),
            grade: grade(ppk === null ? 0 : ppk)[0],
        });
    }
    out.sort((a, b) => {
        if (a.idx === null && b.idx === null) return 0;
        if (a.idx === null) return 1;
        if (b.idx === null) return -1;
        return b.idx - a.idx;
    });
    return out;
}

/* ═════════════════════════════════════════════════════════════════════════════
   P9 r9 — 측정값에도 **기간 필터**가 걸린다  (차장 확정 09-02)

   r8 까지 SPC 화면은 「기간 필터와 무관한 전체 스냅샷」이었다. 그런데 잴 수 있다 —
   측정값기록서의 성적서번호(RI)가 인수검사 대장의 inspectionReportNo 와 같은 값이고,
   대장에는 검사일이 있다. 그러니 **RI → 검사일**로 이어 붙이면 측정값 한 줄 한 줄에
   날짜가 생기고, 기간 필터를 그대로 걸 수 있다.

     1순위 : 대장에서 찾은 검사일           (RI-260901-21 → 대장의 date)
     2순위 : RI 번호에 박힌 날짜            (RI-**260901**-21 → 2026-09-01)
             — 대장에 그 성적서가 없을 때만 쓴다. RI 번호 규칙은 spcCore.riDate 와 같다.
     못 읽으면 그 줄은 **날짜 없음**이다. 기간을 좁히면 빠지고, 화면이 몇 줄이
     빠졌는지 적는다 — 조용히 버리지 않는다.

   기간을 좁힌 뒤에는 **buildD 를 그 줄들로 다시 돌린다**. 전체로 낸 Ppk 를 잘라 쓰는
   게 아니다 — 표준편차는 부분집합에서 다시 계산해야 맞는 값이 나온다.
   ═════════════════════════════════════════════════════════════════════════════ */

/** 'RI-260901-21' → '2026-09-01'. 규칙에 안 맞으면 '' */
export function riYmd(ri) {
    const m = /^RI-(\d{2})(\d{2})(\d{2})-/.exec(String(ri === null || ri === undefined ? '' : ri));
    if (!m) return '';
    return `20${m[1]}-${m[2]}-${m[3]}`;
}

/** inspections 대장 → { 성적서번호: 'YYYY-MM-DD' } */
export function reportDateMap(inspections) {
    const m = new Map();
    for (const r of inspections || []) {
        const no = r && r.inspectionReportNo;
        if (!no || no === '-' || no === '없음') continue;
        const d = ymd(r.date);
        if (d === '') continue;
        const k = String(no);
        /* 같은 성적서가 여러 줄이면 가장 이른 날을 쓴다 — 그 성적서가 만들어진 날이다 */
        if (!m.has(k) || d < m.get(k)) m.set(k, d);
    }
    return m;
}

/** 측정값 rows 한 줄의 날짜 (대장 우선 · RI 번호 차선). 없으면 '' */
export function rowDate(row, dmap) {
    const ri = String((row && row.ri) || '');
    const got = dmap ? dmap.get(ri) : undefined;
    return got || riYmd(ri);
}

/**
 * 기간으로 측정값 rows 를 거른다.
 * @param {Array} rows  loadInboundSpc().rows
 * @param {Map} dmap    reportDateMap() 결과
 * @param {{start:string,end:string}} range  빈 값이면 '제한 없음'(전부 통과)
 * @returns {{rows:Array, undated:number, span:{min:string,max:string}}}
 *          undated = 날짜를 못 찾아 빠진 줄 수 (기간을 지정했을 때만 0 보다 크다)
 */
export function rowsInRange(rows, dmap, range) {
    const all = rows || [];
    const r = range || {};
    const s = r.start || '', e = r.end || '';
    let min = '', max = '';
    for (const row of all) {
        const d = rowDate(row, dmap);
        if (d === '') continue;
        if (min === '' || d < min) min = d;
        if (max === '' || d > max) max = d;
    }
    if (!s && !e) return { rows: all.slice(), undated: 0, span: { min, max } };
    let undated = 0;
    const out = [];
    for (const row of all) {
        const d = rowDate(row, dmap);
        if (d === '') { undated += 1; continue; }
        if (s && d < s) continue;
        if (e && d > e) continue;
        out.push(row);
    }
    return { rows: out, undated, span: { min, max } };
}

/** 등급 배열/목록 → {등급: 개수} (없는 등급도 0 으로 채운다) */
export function gradeCounts(list) {
    const c = {};
    GRADE_ORDER.forEach((g) => { c[g] = 0; });
    for (const x of list || []) {
        const g = typeof x === 'string' ? x : (x && x.grade);
        if (g && c[g] !== undefined) c[g] += 1;
    }
    return c;
}

export default {
    loadInboundSpc, clearInboundSpcCache, buildRows, vendorMap, gradeOf, colorOf,
    partGrades, gradeCounts, GRADE_COLOR, GRADE_ORDER, GRADE_BOUND, PPK_DOMAIN,
    riYmd, reportDateMap, rowDate, rowsInRange,
};
