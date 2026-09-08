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
    const stat = { read: 0, used: 0, dropKind: 0, dropSpec: 0, dropX: 0, unlinked: 0 };

    const src = (measurements || []).slice().sort((a, b) => {
        const x = Number(a && a.source_row), y = Number(b && b.source_row);
        if (Number.isFinite(x) && Number.isFinite(y)) return x - y;
        return 0;                                   // source_row 가 없으면 받은 순서 유지
    });

    const rows = [];
    for (const r of src) {
        stat.read++;
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
