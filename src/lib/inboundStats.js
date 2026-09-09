/* ─────────────────────────────────────────────────────────────────────────────
   inboundStats.js — 인수검사 대장(inspections) 통계 공용 함수   (플랜 042 / P3 r3)

   차장 피드백 반영: "Cpk 는 인수검사 중 일부 항목이다. 인수검사 통계치도 있어야지."
   → SPC(측정값) 쪽은 inboundSpc.js 가 맡고, 이 파일은 **대장 표 통계**만 맡는다.

   여기에 모아 두는 이유
     · 한눈에 / 협력업체 / 품목·부적합 / 기록·기준 네 화면이 같은 정의로 세야 한다.
       화면마다 따로 세면 같은 이름의 숫자가 화면마다 달라진다.
     · 표 원본(inspections · inspection_measurements)은 한 번만 받아 캐시한다.
       inboundSpc.js 도 이 로더를 쓰므로 표당 요청은 화면 몇 개를 열든 한 번이다.

   ── 숫자 정의 (화면 어디서든 이 정의다. 바꾸려면 여기만 고친다) ──────────────
     입고 건수   = 대장 행 수                       (행 1개 = 입고 1건)
     입고 수량   = Σ totalQuantity                  (EA)
     검사 수량   = Σ inspectionQuantity             (EA, 샘플링 검사분)
     부적합 건수 = result === '불합격' 인 행 수
     부적합 수량 = Σ defectQuantity                 (EA)
     불량률      = 부적합 수량 / 입고 수량 × 100    (%)  ★ 분모는 '입고 수량'이다.
                   (r3 / 차장 확정 09-01) 검사 수량 분모는 폐기했다. 받은 물량 대비
                   얼마가 불량이었나가 현업이 쓰는 값이다. 샘플링 검사분(검사 수량)을
                   분모로 쓰면 표본 크기에 따라 같은 불량이 다른 %로 보인다.
     PPM         = 부적합 수량 / 입고 수량 × 1,000,000       ★ 불량률과 **같은 분수**다.
                   (r8 / 차장 확정 09-02) 목표 관리선이 100 PPM 으로 정해졌다. 0.63% 같은
                   작은 %는 소수점 뒤에서 판이 갈려 눈으로 못 읽는다. 그래서 화면은
                   불량률이 나오는 자리마다 **% 와 PPM 을 함께** 적는다(fmtRate()).
     검사율      = 검사 수량 / 입고 수량 × 100      (%)  ← 이건 그대로다. 얼마나 봤나.
     합격률      = (입고 건수 − 부적합 건수) / 입고 건수 × 100  (%)  ★ 이쪽은 '건수' 기준
     검사 건수   = inspectionReportNo 가 있고 '-'/'없음' 이 아닌 행 수 (성적서 발급 기준)

   분모가 0이면 비율은 null 이다. 0 으로 적으면 "불량 없음"으로 잘못 읽힌다.
   ───────────────────────────────────────────────────────────────────────────── */

import { api, LOCAL_API_URL, supabase } from './api';

/* ── 날짜 정규화 (구 InboundAnalysis.formatDate 이식) ─────────────────────────
   대장의 date 는 'YYYY-MM-DD' 문자열이지만, 엑셀에서 흘러온 일련번호(45992)가
   섞여 들어온 이력이 있다. 두 경우 모두 'YYYY-MM-DD' 로 맞춘다. 못 읽으면 '' 다.
   (구 코드는 못 읽을 때 '2025-01-01' 을 넣었다. 없는 날짜를 지어내면 기간 필터가
    거짓말을 하므로 여기서는 빈 문자열로 두고 기간 필터에서 제외한다.) */
export function ymd(val) {
    if (val === null || val === undefined || val === '') return '';
    if (typeof val === 'number') {
        const d = new Date(Math.round((val - 25569) * 86400 * 1000));
        return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
    }
    const s = String(val).trim();
    if (s === '') return '';
    if (!s.includes('-') && !Number.isNaN(Number(s))) {
        const d = new Date(Math.round((Number(s) - 25569) * 86400 * 1000));
        return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
    }
    return s.slice(0, 10);
}

const n0 = (v) => {
    const x = Number(v);
    return Number.isFinite(x) ? x : 0;
};
const pct = (a, b) => (b > 0 ? (a / b) * 100 : null);

/* ── 기간 필터 ────────────────────────────────────────────────────────────── */
export const PERIODS = [
    { key: 'all', label: '전체' },
    { key: 'year', label: '올해' },
    { key: 'month', label: '이번달' },
    { key: 'd30', label: '최근 30일' },
];

const two = (n) => String(n).padStart(2, '0');
const local = (d) => `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;

/** @returns {{start:string,end:string}|null} null 이면 '전체'(제한 없음) */
export function periodRange(key, today) {
    const t = today || new Date();
    if (key === 'year') return { start: `${t.getFullYear()}-01-01`, end: `${t.getFullYear()}-12-31` };
    if (key === 'month') {
        const last = new Date(t.getFullYear(), t.getMonth() + 1, 0);
        return { start: `${t.getFullYear()}-${two(t.getMonth() + 1)}-01`, end: local(last) };
    }
    if (key === 'd30') {
        const from = new Date(t.getFullYear(), t.getMonth(), t.getDate() - 29);
        return { start: local(from), end: local(t) };
    }
    return null;
}

export function filterByPeriod(rows, key, today) {
    const r = periodRange(key, today);
    if (!r) return (rows || []).slice();
    return (rows || []).filter((x) => {
        const d = ymd(x && x.date);
        return d !== '' && d >= r.start && d <= r.end;
    });
}

/* ── 합계 ─────────────────────────────────────────────────────────────────── */
/**
 * @returns {{count:number,inQty:number,inspQty:number,ngCount:number,ngQty:number,
 *            reportCount:number,passCount:number,defectRate:number|null,passRate:number|null}}
 */
export function summarize(rows) {
    const s = { count: 0, inQty: 0, inspQty: 0, ngCount: 0, ngQty: 0, reportCount: 0 };
    for (const r of rows || []) {
        s.count += 1;
        s.inQty += n0(r.totalQuantity);
        s.inspQty += n0(r.inspectionQuantity);
        s.ngQty += n0(r.defectQuantity);
        if (r.result === '불합격') s.ngCount += 1;
        const no = r.inspectionReportNo;
        if (no && no !== '-' && no !== '없음') s.reportCount += 1;
    }
    s.passCount = s.count - s.ngCount;
    s.defectRate = pct(s.ngQty, s.inQty);       // 부적합 수량 ÷ 입고 수량 (r3)
    s.ppm = ppm(s.ngQty, s.inQty);              // 같은 분자·분모의 PPM (r8)
    s.passRate = pct(s.passCount, s.count);     // 건수 기준
    return s;
}

/* ── 월별 추이 (YYYY-MM 오름차순, 빈 달은 만들지 않는다) ──────────────────── */
export function monthly(rows) {
    const m = new Map();
    for (const r of rows || []) {
        const d = ymd(r && r.date);
        if (!d) continue;
        const k = d.slice(0, 7);
        if (!m.has(k)) m.set(k, { ym: k, count: 0, inQty: 0, inspQty: 0, ngCount: 0, ngQty: 0 });
        const o = m.get(k);
        o.count += 1;
        o.inQty += n0(r.totalQuantity);
        o.inspQty += n0(r.inspectionQuantity);
        o.ngQty += n0(r.defectQuantity);
        if (r.result === '불합격') o.ngCount += 1;
    }
    return Array.from(m.values()).sort((a, b) => (a.ym < b.ym ? -1 : 1));
}

/* ── 키별 묶음 (업체 · 품목유형 · 품번 공용) ──────────────────────────────── */
export function groupBy(rows, keyOf, emptyLabel) {
    const m = new Map();
    for (const r of rows || []) {
        const k = String(keyOf(r) || '').trim() || emptyLabel;
        if (!m.has(k)) m.set(k, { key: k, name: k, count: 0, inQty: 0, inspQty: 0, ngCount: 0, ngQty: 0 });
        const o = m.get(k);
        o.count += 1;
        o.inQty += n0(r.totalQuantity);
        o.inspQty += n0(r.inspectionQuantity);
        o.ngQty += n0(r.defectQuantity);
        if (r.result === '불합격') o.ngCount += 1;
    }
    const out = Array.from(m.values());
    out.forEach((o) => { o.defectRate = pct(o.ngQty, o.inQty); o.ppm = ppm(o.ngQty, o.inQty); });
    return out;
}

export const bySupplier = (rows) => groupBy(rows, (r) => r.supplier, '(미상)');
export const byItemType = (rows) => groupBy(rows, (r) => r.itemType, '(미분류)');

/** 품번별. item_code 가 비면 품명으로 묶는다(둘 다 없으면 '(미상)'). */
export function byItemCode(rows) {
    const out = groupBy(rows, (r) => r.item_code || r.itemName, '(미상)');
    const nameOf = new Map();
    for (const r of rows || []) {
        const k = String(r.item_code || r.itemName || '').trim() || '(미상)';
        if (!nameOf.has(k)) nameOf.set(k, String(r.itemName || '').trim());
    }
    /* P9 r9 : 품명에서 모델명·사이즈를 같이 뽑아 둔다(화면마다 다시 뽑지 않게).
       parseItem 은 아래쪽에 있지만 호이스팅되는 function 선언이라 여기서 불러도 된다. */
    out.forEach((o) => {
        o.itemName = nameOf.get(o.key) || '';
        const P = parseItem(o.itemName);
        o.model = P.model;
        o.size = P.size;
    });
    return out;
}

/** 불량유형 Top — '-' · 빈칸은 유형이 아니라 '없음'이므로 뺀다. */
export function topDefectTypes(rows, n) {
    const m = new Map();
    for (const r of rows || []) {
        const t = String((r && r.defectType) || '').trim();
        if (t === '' || t === '-') continue;
        if (!m.has(t)) m.set(t, { name: t, count: 0, ngQty: 0, suppliers: {} });
        const o = m.get(t);
        o.count += 1;
        o.ngQty += n0(r.defectQuantity);
        const sup = String(r.supplier || '').trim() || '(미상)';
        o.suppliers[sup] = (o.suppliers[sup] || 0) + 1;
    }
    return Array.from(m.values()).sort((a, b) => b.count - a.count || b.ngQty - a.ngQty).slice(0, n || 10);
}

/** 부적합 건수 상위 업체. 부적합 0건 업체는 넣지 않는다. */
export function topDefectSuppliers(rows, n) {
    return bySupplier(rows)
        .filter((o) => o.ngCount > 0)
        .sort((a, b) => b.ngCount - a.ngCount || b.ngQty - a.ngQty)
        .slice(0, n || 5);
}

/* ── 표 원본 로더 (모듈 캐시 — 화면이 여럿이어도 표당 1회) ────────────────── */
async function _get(path) {
    const res = await api.fetch(path);
    if (!res || !res.ok) throw new Error(`[inboundStats] ${path} 응답 실패`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
}

function cachedLoader(path, tag) {
    let cache = null, inflight = null;
    const fn = async (opt) => {
        const force = !!(opt && opt.force);
        if (!force && cache) return cache;
        if (!force && inflight) return inflight;
        inflight = (async () => {
            const rows = await _get(path);
            cache = rows;
            return rows;
        })();
        try { return await inflight; } finally { inflight = null; }
    };
    fn.clear = () => { cache = null; inflight = null; };
    fn.tag = tag;
    return fn;
}

export const loadInspections = cachedLoader('/inspections', 'inspections');
export const loadMeasurements = cachedLoader('/inspection_measurements', 'measurements');

/* P11 r11 — 동기화 기록표. **없어도 되는 표**다.
   개발웹·구판 스테이징에는 이 표가 아직 없을 수 있고, 그 경우 api.fetch 가 던진다.
   그래서 이 로더를 부르는 쪽은 반드시 try 로 감싸고, 실패하면 예전 방식
   (측정값 행의 synced_at)으로 되돌아간다. 표가 없다고 대시보드가 죽으면 안 된다. */
export const loadSyncLogs = cachedLoader('/sync_logs', 'sync_logs');

export function clearInboundStatsCache() {
    loadInspections.clear();
    loadMeasurements.clear();
    loadSyncLogs.clear();
}

/* ── 마지막 동기화 시각 ──────────────────────────────────────────────────────
   P11 r11 에서 **원천이 둘**이 됐다. 앞엣것이 있으면 앞엣것을 쓴다.
     1순위 : sync_logs 의 성공 행    (동기화가 실제로 언제 끝났는지를 아는 유일한 표)
     2순위 : 측정값 행의 synced_at   (r5~r10 이 쓰던 값. 표가 없을 때의 되돌림)
     없으면 null → 화면은 「동기화 시각 없음」이다. 값을 지어내지 않는다.

   sync_logs 의 칸 이름은 환경마다 갈릴 수 있어 하나로 못 박지 않았다.
   시각은 finished_at → created_at → started_at → synced_at 순으로 찾고,
   status 는 '성공으로 읽히는 값' 또는 **비어 있으면** 센다(칸이 없는 판이 있다).
   실패 행만 있으면 시각을 내지 않는다 — 실패한 시각을 '마지막 동기화'로 적으면
   다들 최신인 줄 안다. */

const SYNC_OK_WORDS = ['success', 'succeeded', 'ok', 'done', 'complete', 'completed', 'finished', '성공', '완료'];
const SYNC_BAD_WORDS = ['fail', 'failed', 'error', 'aborted', 'cancel', 'canceled', 'cancelled', 'running', 'pending', 'started', '실패', '오류', '진행'];

/** sync_logs 한 행이 '성공한 실행'인가. status 칸이 없으면 성공으로 본다(구 스키마). */
export function isSyncOkRow(r) {
    if (!r) return false;
    const raw = r.status !== undefined && r.status !== null ? r.status
        : (r.result !== undefined && r.result !== null ? r.result : undefined);
    if (raw === undefined || raw === '') return true;
    if (raw === true) return true;
    if (raw === false) return false;
    const s = String(raw).trim().toLowerCase();
    if (SYNC_BAD_WORDS.some((w) => s.includes(w))) return false;
    if (SYNC_OK_WORDS.some((w) => s.includes(w))) return true;
    return false;
}

/** sync_logs 한 행의 시각 (없으면 null) */
export function syncRowTime(r) {
    if (!r) return null;
    for (const k of ['finished_at', 'completed_at', 'ended_at', 'created_at', 'started_at', 'synced_at']) {
        const v = r[k];
        if (v === undefined || v === null || v === '') continue;
        return String(v);
    }
    return null;
}

/** sync_logs 에서 가장 최근 **성공** 시각. 쓸 값이 없으면 null. */
export function lastSyncLogAt(logs) {
    let best = null;
    for (const r of logs || []) {
        if (!isSyncOkRow(r)) continue;
        const t = syncRowTime(r);
        if (!t) continue;
        const ms = Date.parse(t);
        if (!Number.isFinite(ms)) continue;
        if (best === null || ms > Date.parse(best)) best = t;
    }
    return best;
}

/**
 * 마지막 동기화 시각.
 *   lastSyncedAt(measurements)        ← r10 까지의 호출. 그대로 돈다(InboundRecords).
 *   lastSyncedAt(measurements, logs)  ← r11. logs 에 쓸 성공 행이 있으면 그쪽이 이긴다.
 */
export function lastSyncedAt(measurements, logs) {
    const fromLog = lastSyncLogAt(logs);
    if (fromLog) return fromLog;
    let best = null;
    for (const r of measurements || []) {
        const v = r && r.synced_at;
        if (!v) continue;
        const s = String(v);
        if (best === null || s > best) best = s;
    }
    return best;
}

/* ── 「지금 동기화」 (구글시트 → DB) ─────────────────────────────────────────
   P11 r11. 구화면(InboundHistory.jsx)이 쓰던 주소 규칙을 **그대로** 옮겼다 —
     · localhost / 127.0.0.1  → `${LOCAL_API_URL}/api/sync-sheets`  (로컬 백엔드)
     · 그 밖(Vercel 등)       → `/api/sync-sheets`                   (같은 오리진)
   주소를 새로 만들지 않았다. 새로 만들면 스테이징에서 404 가 난다.

   개발웹에는 이 백엔드가 없다. 그래서 실패가 **정상**이고, 그 실패는
   NO_SYNC_SERVER 한 문장으로 사람이 읽을 말이 되어야 한다. 화면이 깨지면 안 된다. */

export const SYNC_PATH = '/api/sync-sheets';
export const SYNC_TIMEOUT_MS = 90000;
export const NO_SYNC_SERVER = '이 환경에는 동기화 서버가 없다 (스테이징에서 동작)';

export function syncEndpoint() {
    const h = (typeof window !== 'undefined' && window.location && window.location.hostname) || '';
    return (h === 'localhost' || h === '127.0.0.1') ? `${LOCAL_API_URL}${SYNC_PATH}` : SYNC_PATH;
}

/** 응답 본문에서 건수를 찾는다. 못 찾으면 null — 0 으로 적으면 '0건 처리'로 잘못 읽힌다. */
export function syncCountOf(body) {
    if (!body || typeof body !== 'object') return null;
    for (const k of ['upserted', 'processedCount', 'processed', 'count', 'inserted', 'updated', 'rows', 'total', 'affected']) {
        const v = body[k];
        if (v === undefined || v === null || v === '') continue;
        const n = Number(v);
        if (Number.isFinite(n)) return n;
    }
    return null;
}

/**
 * 동기화를 한 번 돌린다. 성공하면 { ok:true, count, url }, 실패하면 **던진다**.
 * 던지는 Error 의 message 는 그대로 화면에 뜨는 한국어 한 문장이다.
 */
export async function runSheetSync(opt) {
    const url = syncEndpoint();
    const ms = (opt && Number(opt.timeoutMs)) || SYNC_TIMEOUT_MS;
    const ac = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    const timer = ac ? setTimeout(() => { try { ac.abort(); } catch (e) { /* 무시 */ } }, ms) : null;

    /* 042 P8 (스테이징) — /api/sync-sheets 가 인증을 요구한다.
       통과 조건은 둘 뿐이다: 크론 비밀키(서버끼리) 또는 **로그인 토큰**(사람).
       버튼을 누르는 사람은 이미 로그인해 있으므로 그 토큰을 실어 보낸다.
       세션을 못 읽으면 헤더 없이 보낸다 — 그러면 서버가 401 로 답하고
       그 문장이 그대로 화면에 뜬다. 여기서 조용히 삼키지 않는다.
       개발웹에는 이 백엔드가 없어 어차피 NO_SYNC_SERVER 로 떨어진다. */
    const headers = { 'Content-Type': 'application/json' };
    try {
        const sess = await supabase.auth.getSession();
        const token = sess && sess.data && sess.data.session && sess.data.session.access_token;
        if (token) headers.Authorization = `Bearer ${token}`;
    } catch (e) { /* 세션을 못 읽어도 요청은 보낸다 — 판단은 서버가 한다 */ }

    let res = null;
    try {
        res = await fetch(url, {
            method: 'POST',
            headers,
            signal: ac ? ac.signal : undefined,
        });
    } catch (e) {
        const aborted = e && (e.name === 'AbortError' || String(e.message || '').includes('abort'));
        throw new Error(aborted
            ? `동기화 서버가 ${Math.round(ms / 1000)}초 안에 답하지 않았다`
            : NO_SYNC_SERVER);
    } finally {
        if (timer) clearTimeout(timer);
    }
    if (!res || !res.ok) {
        const code = res ? res.status : 0;
        /* 404·405·501 = 그 자리에 백엔드가 아예 없다는 뜻이다(개발웹이 여기다). */
        if (code === 404 || code === 405 || code === 501) throw new Error(NO_SYNC_SERVER);
        /* 042 P8 — 401 = 로그인 토큰이 없거나 만료됐다. 서버 잘못이 아니다. */
        if (code === 401) throw new Error('동기화 권한이 없다 — 다시 로그인한 뒤 눌러라');
        let msg = '';
        try {
            const j = await res.json();
            msg = (j && (j.error || j.message)) || '';
        } catch (e) { msg = ''; }
        throw new Error(msg || `동기화 서버 오류 ${code}`);
    }
    let body = null;
    try { body = await res.json(); } catch (e) { body = null; }
    return { ok: true, count: syncCountOf(body), url };
}

/* ═════════════════════════════════════════════════════════════════════════════
   P4 r4 — 기간 필터 A안 (차장 확정 09-01)

   진짜 상태는 {start, end} **한 쌍뿐**이다.
     · 빠른기간 칩은 그 한 쌍을 채워 넣는 버튼일 뿐이다 (칩 자체가 상태가 아니다).
     · 날짜를 직접 고치면 칩 강조만 풀린다. 기간 값은 여전히 {start,end} 하나다.
     · 「묶음(일별/월별/년별)」은 추이 차트 X축만 바꾼다. KPI·도넛·Top5·품목유형·SPC 는
       전부 기간 합계를 쓴다. (배치안 r0 「동작 규칙」 표 그대로)
   위쪽 PERIODS/periodRange/filterByPeriod 는 지우지 않았다 — 다른 화면이 쓰고 있을 수 있다.
   ═════════════════════════════════════════════════════════════════════════════ */

/** 빠른기간 칩 5개 (A안 확정: 연/월 셀렉트는 넣지 않는다) */
export const QUICK_PERIODS = [
    { key: 'all', label: '전체' },
    { key: 'year', label: '올해' },
    { key: 'month', label: '이번달' },
    { key: 'd30', label: '최근 30일' },
    { key: 'd7', label: '최근 7일' },
];

/** 묶음 단위 3개 */
export const GROUPS = [
    { key: 'day', label: '일별' },
    { key: 'month', label: '월별' },
    { key: 'year', label: '년별' },
];

/** 대장에서 실제 자료가 있는 첫날/끝날. 자료가 없으면 둘 다 '' 다. */
export function dataSpan(rows) {
    let min = '', max = '';
    for (const r of rows || []) {
        const d = ymd(r && r.date);
        if (!d) continue;
        if (min === '' || d < min) min = d;
        if (max === '' || d > max) max = d;
    }
    return { min, max };
}

const _u = (s) => Date.parse(String(s) + 'T00:00:00Z');
const _s = (ms) => new Date(ms).toISOString().slice(0, 10);
/** 'YYYY-MM-DD' 에 n일 더한다(음수 가능). 못 읽으면 '' */
export function addDays(d, n) {
    const t = _u(d);
    return Number.isFinite(t) ? _s(t + n * 86400000) : '';
}
/** 시작~종료 일수 (양 끝 포함). 못 읽으면 0 */
export function daySpan(start, end) {
    const a = _u(start), b = _u(end);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
    return Math.floor((b - a) / 86400000) + 1;
}

/**
 * 빠른기간 칩 → {start, end}
 * '전체' 는 **자료가 있는 전 구간**이다(빈 값이 아니다). 날짜칸에 그대로 찍혀야 하기 때문이다.
 * @param {string} key  QUICK_PERIODS 의 key
 * @param {{min?:string,max?:string,today?:Date}} opt  min/max = dataSpan 결과
 */
export function quickRange(key, opt) {
    const o = opt || {};
    const min = o.min || '', max = o.max || '';
    const t = o.today || new Date();
    const y = t.getFullYear();
    if (key === 'all') return { start: min, end: max };
    if (key === 'year') return { start: `${y}-01-01`, end: `${y}-12-31` };
    if (key === 'month') {
        const last = new Date(y, t.getMonth() + 1, 0);
        return { start: `${y}-${two(t.getMonth() + 1)}-01`, end: local(last) };
    }
    const base = local(t);
    if (key === 'd30') return { start: addDays(base, -29), end: base };
    if (key === 'd7') return { start: addDays(base, -6), end: base };
    return { start: min, end: max };
}

/** {start,end} 로 거른다. 빈 값은 '제한 없음'이다. 날짜가 비어 있는 행은 언제나 빠진다. */
export function rangeFilter(rows, range) {
    const r = range || {};
    const s = r.start || '', e = r.end || '';
    if (!s && !e) return (rows || []).slice();
    return (rows || []).filter((x) => {
        const d = ymd(x && x.date);
        if (d === '') return false;
        if (s && d < s) return false;
        if (e && d > e) return false;
        return true;
    });
}

/**
 * 자동 묶음 — 기간 ≤ 62일 일별 / ≤ 24개월 월별 / 그 이상 년별.
 * (손으로 고르면 그 선택이 이긴다. 그 판단은 화면이 한다 — 여기는 추천값만 낸다.)
 */
export function autoGroup(start, end) {
    if (!start || !end) return 'day';
    const days = daySpan(start, end);
    if (days <= 62) return 'day';
    const sy = Number(start.slice(0, 4)), sm = Number(start.slice(5, 7));
    const ey = Number(end.slice(0, 4)), em = Number(end.slice(5, 7));
    const months = (ey - sy) * 12 + (em - sm) + 1;
    return months <= 24 ? 'month' : 'year';
}

/** 묶음 단위별 집계 (키 오름차순, 빈 칸은 만들지 않는다) */
export function bucketBy(rows, group) {
    const cut = group === 'year' ? 4 : group === 'month' ? 7 : 10;
    const m = new Map();
    for (const r of rows || []) {
        const d = ymd(r && r.date);
        if (!d) continue;
        const k = d.slice(0, cut);
        if (!m.has(k)) m.set(k, { key: k, count: 0, inQty: 0, inspQty: 0, ngCount: 0, ngQty: 0 });
        const o = m.get(k);
        o.count += 1;
        o.inQty += n0(r.totalQuantity);
        o.inspQty += n0(r.inspectionQuantity);
        o.ngQty += n0(r.defectQuantity);
        if (r.result === '불합격') o.ngCount += 1;
    }
    const out = Array.from(m.values()).sort((a, b) => (a.key < b.key ? -1 : 1));
    out.forEach((o) => {
        o.passCount = o.count - o.ngCount;
        o.defectRate = pct(o.ngQty, o.inQty);
        o.ppm = ppm(o.ngQty, o.inQty);
    });
    return out;
}

/** 같은 길이의 직전 구간 */
export function previousRange(range) {
    const r = range || {};
    if (!r.start || !r.end) return { start: '', end: '' };
    const len = daySpan(r.start, r.end);
    return { start: addDays(r.start, -len), end: addDays(r.start, -1) };
}

/* ═════════════════════════════════════════════════════════════════════════════
   P14 r14 — 기록 방식이 바뀐 날 = **2026-07-14**  (차장 승인 09-04)

   09-04 에 옛 인수검사 기록(1/2 ~ 7/13, 2,687행)을 대장에 한 번 병합했다.
   그 앞뒤는 같은 표에 있지만 **같은 방식으로 적힌 기록이 아니다** —
     · 7/13 까지(옛 시트)  : 판정·수량만 있다. 치수 측정값이 없다.
     · 7/14 부터(정본 시트) : 측정값기록서가 붙는다. 공정능력(Cpk)은 여기서부터만 나온다.
   그래서 추이 그래프는 그 날에 **세로 점선 한 줄**을 그어 앞뒤를 가르고,
   공정능력 화면은 제목 옆에 「측정 데이터 7/14~」를 적는다.
   숫자는 하나도 바꾸지 않는다 — **어디서 방식이 갈렸는지만** 그림에 표시한다.
   모르고 보면 7월 앞뒤를 같은 자로 읽게 된다.

   ※ 날짜를 바꾸려면 **이 한 줄**만 고친다. 화면 셋이 이 상수를 본다.
   ═════════════════════════════════════════════════════════════════════════════ */
export const RECORD_CHANGE_DATE = '2026-07-14';
/** 추이 그래프의 세로 점선 딱지 */
export const RECORD_CHANGE_NOTE = '기록 방식 변경 7/14';
/** 공정능력(Cpk) 화면의 안내 문구 */
export const MEASURE_SINCE_NOTE = '측정 데이터 7/14~';

/**
 * 구간 키 목록에서 **새 방식이 시작되는 첫 구간**의 자리(index). 그을 곳이 없으면 -1.
 * 키 모양으로 묶음을 알아본다 — 'YYYY-MM-DD'(일별) · 'YYYY-MM'(월별) · 'YYYY'(년별).
 *   · 년별      : -1. 한 해 **안**에서 갈리므로 해와 해 사이에 선을 그을 수 없다.
 *   · 구간 1개  : -1. 앞뒤가 없으면 가를 것도 없다.
 *   · 전부 변경 앞 / 전부 변경 뒤 : -1. 표시 기간에 그 날이 걸치지 않는다는 뜻이다.
 * 일별에서 7/14 자리에 자료가 없으면 **그 다음 구간** 앞에 선다(없는 날을 지어내지 않는다).
 * @param {Array<string>} keys  bucketBy() 가 낸 구간 키(오름차순)
 */
export function changeIndexOf(keys, date) {
    const list = keys || [];
    if (list.length < 2) return -1;
    const k0 = String(list[0] === null || list[0] === undefined ? '' : list[0]);
    if (k0.length !== 7 && k0.length !== 10) return -1;
    const k = String(date || RECORD_CHANGE_DATE).slice(0, k0.length);
    if (k0 >= k) return -1;
    for (let i = 1; i < list.length; i += 1) {
        if (String(list[i]) >= k) return i;
    }
    return -1;
}

/* ═════════════════════════════════════════════════════════════════════════════
   P8 r8 — 「vs 이전」 비교 기준  (차장 확정 09-02)

   r7 까지의 규칙은 "같은 길이의 직전 구간, 없으면 기간을 반으로 갈라 후반↔전반" 이었다.
   **버렸다.** 「기간 후반 vs 전반」은 같은 자료를 둘로 쪼개 스스로와 견준 값이라
   무엇과 비교한 건지 화면만 봐서는 알 수 없다. 이제 규칙은 묶음이 정한다.

     · 묶음 일별 / 월별 → 선택 기간의 **일평균** vs **직전 달(전월)의 일평균**
                          전월 = 선택 기간의 **끝날이 속한 달의 바로 앞 달**(달력 기준).
                          일평균의 분모 '일수' = 그 구간에서 **검사가 1건이라도 있던 날 수**다.
                          (달력 일수로 나누면 주말·휴무일이 분모를 부풀려 늘 좋아 보인다.)
     · 묶음 년별        → **전년 동기** = 같은 날짜 폭을 **1년 앞으로** 민 구간. 합계끼리 견준다
                          (폭이 같으므로 일평균으로 나눌 이유가 없다).

   기준 구간에 자료가 한 줄도 없으면 kind='none' 이다. 화면은 그때 「— 비교 자료 없음」을
   적는다 — 없는 비교를 0 으로 채우지 않는다.

   칩에 **기준 이름을 반드시 적는다**: 「▲ 12.3% vs 전월 일평균」 / 「▼ 5.0% vs 전년 동기」
   ═════════════════════════════════════════════════════════════════════════════ */

/** 그 줄들에 **검사가 1건이라도 있던 날**의 수. 일평균의 분모다. */
export function activeDays(rows) {
    const s = new Set();
    for (const r of rows || []) {
        const d = ymd(r && r.date);
        if (d) s.add(d);
    }
    return s.size;
}

/** 'YYYY-MM-DD' 가 속한 달의 **바로 앞 달** 전체 {start,end} */
export function prevMonthOf(day) {
    const d = String(day || '');
    if (d.length < 7) return { start: '', end: '' };
    const y = Number(d.slice(0, 4)), m = Number(d.slice(5, 7));
    if (!Number.isFinite(y) || !Number.isFinite(m)) return { start: '', end: '' };
    const py = m === 1 ? y - 1 : y;
    const pm = m === 1 ? 12 : m - 1;
    const last = new Date(Date.UTC(py, pm, 0)).getUTCDate();
    return { start: `${py}-${two(pm)}-01`, end: `${py}-${two(pm)}-${two(last)}` };
}

/** 'YYYY-MM-DD' 를 n년 앞뒤로. 2월 29일은 그 해에 없으면 28일로 자른다. */
export function addYears(day, n) {
    const d = String(day || '');
    if (d.length < 10) return '';
    const y = Number(d.slice(0, 4)) + n;
    const m = Number(d.slice(5, 7));
    const dd = Number(d.slice(8, 10));
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return `${y}-${two(m)}-${two(Math.min(dd, last))}`;
}

/**
 * 「vs 이전」 비교 기준 한 벌.
 * @param {Array} rows  대장 전체(기간을 안 자른 원본이어야 한다 — 기준 구간이 밖에 있다)
 * @param {{start:string,end:string}} range  화면이 고른 기간
 * @param {'day'|'month'|'year'} group  묶음
 * @returns {{cur:Array, prev:Array, curDays:number, prevDays:number,
 *            label:string, kind:'daily'|'yoy'|'none', prevRange:{start,end}}}
 */
export function comparisonBasis(rows, range, group) {
    const cur = rangeFilter(rows, range);
    const r = range || {};
    if (group === 'year') {
        const pr = { start: addYears(r.start, -1), end: addYears(r.end, -1) };
        const prev = rangeFilter(rows, pr);
        return {
            cur, prev, curDays: 1, prevDays: prev.length ? 1 : 0,
            label: 'vs 전년 동기', rateLabel: 'vs 전년 동기',
            kind: prev.length ? 'yoy' : 'none', prevRange: pr,
        };
    }
    /* '기간의 끝날'은 **그 기간 안에서 자료가 있는 마지막 날**이다.
       왜 range.end 를 그대로 안 쓰나: TV 현황판은 기간이 「올해」로 고정이라 끝날이
       12-31(아직 오지 않은 날)이다. 그대로 쓰면 기준이 늘 11월 → 자료 0 →
       현황판의 칩이 전부 「비교 자료 없음」이 된다. 화면에 그려진 기간의 끝은
       12-31 이 아니라 마지막 자료가 있는 날이므로, 그 날을 기준으로 삼는 게 맞다.
       (자료가 기간 안에 꽉 찬 보통의 경우에는 range.end 와 같은 값이다.) */
    const endEff = dataSpan(cur).max || r.end;
    const pr = prevMonthOf(endEff);
    const prev = rangeFilter(rows, pr);
    const prevDays = activeDays(prev);
    return {
        cur, prev, curDays: activeDays(cur), prevDays,
        label: 'vs 전월 일평균',
        /* 비율(불량률·PPM·합격률)은 일수로 나누지 않는다. 그래서 그 칩의 기준 이름도
           「일평균」이 아니라 그냥 「전월」이다 — 칩이 제 기준을 정확히 말해야 한다. */
        rateLabel: 'vs 전월',
        kind: prevDays > 0 ? 'daily' : 'none', prevRange: pr,
    };
}

/**
 * 합계를 **일평균으로 나눈** 통계. days=1 이면 합계 그대로다(년별 = 전년 동기).
 * 비율(불량률·PPM·합격률)은 나누지 않는다 — 비율을 일수로 또 나누면 뜻이 없어진다.
 * days 가 0 이면 개수 칸이 전부 null 이다 → 증감 칩이 「— 비교 자료 없음」으로 뜬다.
 */
export function avgStats(rows, days) {
    const s = summarize(rows);
    const d = Number(days) > 0 ? Number(days) : 0;
    const per = (v) => (d > 0 ? v / d : null);
    return {
        ...s,
        days: d,
        count: per(s.count), inQty: per(s.inQty), inspQty: per(s.inspQty),
        ngCount: per(s.ngCount), ngQty: per(s.ngQty), passCount: per(s.passCount),
        /* 합계는 각주·검산용으로 그대로 들고 다닌다 */
        sum: s,
    };
}

/* ═════════════════════════════════════════════════════════════════════════════
   P8 r8 — 목표 관리선 = **100 PPM**  (차장 확정 09-02)

   r7 까지는 관리선이 없어 화면이 「관리선 미설정」이라고 적고 회색으로 두었다.
   이제 값이 정해졌다. **여기 한 줄이 그 값의 유일한 자리다** — 화면 다섯 개가
   전부 이 상수를 본다. 바꾸려면 이 줄만 고친다.

     PPM = 부적합 수량 ÷ 입고 수량 × 1,000,000
           (불량률 % 와 같은 분자·분모다. 자릿수만 다르다 — 0.01% = 100 PPM)

   상태는 **두 개뿐이다.** 가운데(주의/amber)를 두지 않는다 —
   "100 PPM 이내인가 아닌가"가 현업이 묻는 전부이고, 세 칸으로 나누면
   경계값을 또 지어내야 한다.
     · ≤ 100 PPM → 'ok'   「목표 이내」 (초록)
     · > 100 PPM → 'over' 「목표 초과」 (빨강)
     · 분모(입고 수량)가 0 → 'none' 「—」 (색을 칠하지 않는다)
   ═════════════════════════════════════════════════════════════════════════════ */
export const PPM_TARGET = 100;

/** 부적합 수량 ÷ 입고 수량 × 1,000,000. 분모가 0이면 null 이다(0 으로 적으면 거짓말이다). */
export function ppm(defect, total) {
    const d = n0(defect), t = n0(total);
    return t > 0 ? (d / t) * 1000000 : null;
}

/** PPM 값 → 'ok' | 'over' | 'none' */
export function ppmState(value, target) {
    const T = target === undefined || target === null ? PPM_TARGET : target;
    if (value === null || value === undefined || Number.isNaN(value)) return 'none';
    return value <= T ? 'ok' : 'over';
}

/** 부적합/입고 → 'ok' | 'over' | 'none' (분자·분모를 그대로 넘기는 판) */
export const rateState = (defect, total) => ppmState(ppm(defect, total));

export const PPM_STATE_TEXT = { ok: '목표 이내', over: '목표 초과', none: '—' };

/**
 * 불량률 한 줄 표기 — **% 와 PPM 을 늘 함께 적는다.**
 *   fmtRate(770, 122917)  →  '0.63% · 6,264 PPM'
 * 분모가 0이면 '—' 다. 0.00% 로 적으면 "불량 없음"으로 잘못 읽힌다.
 * ※ 화면 어디서든 이 함수를 쓴다 — 카드마다 자리수가 다르게 나오는 일을 막는다.
 */
export function fmtRate(defect, total, opt) {
    const p = ppm(defect, total);
    if (p === null) return '—';
    const o = opt || {};
    const pctStr = `${(n0(defect) / n0(total) * 100).toFixed(o.dec === undefined ? 2 : o.dec)}%`;
    const ppmStr = `${Math.round(p).toLocaleString('ko-KR')} PPM`;
    return o.ppmOnly ? ppmStr : `${pctStr} · ${ppmStr}`;
}

/** PPM 만 (막대·축 라벨용) */
export const fmtPpm = (defect, total) => {
    const p = ppm(defect, total);
    return p === null ? '—' : `${Math.round(p).toLocaleString('ko-KR')} PPM`;
};

/* ═════════════════════════════════════════════════════════════════════════════
   P5 r5 — 「대시보드」 4영역용 파생 함수 4개

   전부 bucketBy() 위에 얹은 얇은 껍데기다. 여기서 다시 세지 않는다 —
   같은 숫자가 카드마다 달라지는 일을 막으려고 집계는 한 군데(bucketBy)만 쓴다.
   묶음(day/month/year)은 화면이 고른 값을 그대로 받는다.
   ═════════════════════════════════════════════════════════════════════════════ */

/**
 * 불량률 추이 — 묶음 구간별 불량률(% 와 PPM 을 **함께**).
 * 입고 수량이 0인 구간은 rate·ppm 이 둘 다 null 이다(0 으로 적으면 "불량 없음"이 된다).
 * r8 : 차트가 그리는 축은 PPM 이다(목표선 100 PPM 과 같은 자로 재야 하니까). % 도
 *      같이 들고 다닌다 — 툴팁이 둘 다 보여 준다.
 * @returns {Array<{key:string,rate:number|null,ppm:number|null,ngQty:number,inQty:number}>}
 */
export function rateByBucket(rows, group) {
    return bucketBy(rows, group).map((b) => ({
        key: b.key, rate: b.defectRate, ppm: b.ppm, ngQty: b.ngQty, inQty: b.inQty, count: b.count,
    }));
}

/**
 * 판정 추이 — 묶음 구간별 합격/불합격 **건수**.
 * (도넛을 대신한다. 합계는 언제나 summarize().passCount / ngCount 와 같다.)
 * @returns {Array<{key:string,pass:number,ng:number,count:number}>}
 */
export function verdictByBucket(rows, group) {
    return bucketBy(rows, group).map((b) => ({
        key: b.key, pass: b.passCount, ng: b.ngCount, count: b.count,
    }));
}

/**
 * 협력업체 Top N 불량률 추이.
 * 상위 N 은 **선택 기간의 검사 건수** 순이다(전체 기간이 아니다 — 지금 보고 있는 기간의 주력 업체여야
 * 비교가 뜻이 있다). 값은 업체별 구간 불량률(%)이고, 그 구간에 입고가 없으면 null 이다
 * (Recharts 는 null 을 선 끊김으로 그린다 — 0 으로 이으면 없는 개선을 그린 게 된다).
 * @returns {{vendors:string[], data:Array<Object>}} data 원소 = {key, [업체명]: number|null}
 */
export function topVendorTrend(rows, group, n) {
    const top = bySupplier(rows)
        .sort((a, b) => b.count - a.count || b.inQty - a.inQty)
        .slice(0, n || 3)
        .map((o) => o.name);
    const keys = bucketBy(rows, group).map((b) => b.key);
    const nameOf = (r) => (String((r && r.supplier) || '').trim() || '(미상)');
    const byV = new Map();
    for (const v of top) {
        const mine = (rows || []).filter((r) => nameOf(r) === v);
        const m = new Map();
        for (const b of bucketBy(mine, group)) m.set(b.key, b.defectRate);
        byV.set(v, m);
    }
    const data = keys.map((k) => {
        const o = { key: k };
        for (const v of top) {
            const got = byV.get(v).get(k);
            o[v] = got === undefined ? null : got;
        }
        return o;
    });
    return { vendors: top, data };
}

/* ═════════════════════════════════════════════════════════════════════════════
   P9 r9 — 품명 한 줄에서 **모델명 · 사이즈**를 뽑는다  (차장 확정 09-02)

   현업이 불합격 목록에서 찾는 것은 품번(55910308004)도 보고서번호(RI-260901-21)도
   아니라 「무슨 모델의 몇 A 짜리냐」다. 대장에는 그 두 칸이 따로 없고 품명 한 줄에
   붙어 있다. 그래서 **읽기만 한다** — 자료를 새로 만들지 않는다.

     모델명 = 품명의 **첫 공백 토큰**              (TOV-A12 · SFP-NP22 · W-PICV-SS-TB · S550)
     사이즈 = **토큰 하나가 통째로** (\d+X)?\d+A 인 것 (250X150A · 125A · 100A)
              · 토큰의 괄호 앞부분만 본다           (80A(가공구매품) → 80A)
              · 범위꼴도 크기다                     (150~200A · 25~32A)
              · 쉼표로 여러 크기가 붙으면 첫 것     (400X400A,500X450A → 400X400A)
              없으면 괄호 안이 크기꼴인 토큰        (1 1/4"(25~32A) → 25~32A)
              그것도 없으면 '—'

   ※ 왜 토큰을 '통째로' 보나 : 「1",1 1/4"(25~32A)」에서 \d+A 를 그냥 찾으면 32A 가
     먼저 걸려 「25~32A」가 아니라 「32A」로 잘못 읽힌다. 실제 값은 범위(25~32A)다.
   ※ 원래 품명은 화면에서 title 툴팁으로 통째로 보여 준다 — 뽑기가 틀려도 원본이 남는다.
   ※ 09-02 스냅샷 고유 품명 496개 중 사이즈를 못 뽑는 것은 50개(10.1%)다. 그 칸은
     '—' 로 둔다 — 없는 값을 지어내지 않는다. (남은 건 25/80A 같은 빗금 범위나
     Φ7x35L 처럼 애초에 A 규격 표기가 없는 가공품이다.)
   ═════════════════════════════════════════════════════════════════════════════ */

/** 토큰 하나가 통째로 크기꼴인가 — 250X150A · 125A · 15A · 2.5A · 25~32A */
const SIZE_TOKEN = /^(?:\d+(?:\.\d+)?[~\-−])?(?:\d+(?:\.\d+)?[Xx×*])?\d+(?:\.\d+)?A$/;
/** 괄호 안이 크기꼴인가 — 25~32A · 25-32A · 25A */
const SIZE_PAREN = /^[0-9.\s/~\-−]*\d+(?:\.\d+)?A$/;
const TRIM_TAIL = /[,;:.]+$/;

/**
 * 품명 → { model, size, full }
 * @param {string} itemName 대장의 itemName 한 줄
 * @returns {{model:string,size:string,full:string}} 못 뽑으면 '—'
 */
export function parseItem(itemName) {
    const full = String(itemName === null || itemName === undefined ? '' : itemName).trim();
    if (full === '') return { model: '—', size: '—', full: '' };
    const toks = full.split(/\s+/).filter((t) => t !== '');
    const model = (toks[0] || '').replace(TRIM_TAIL, '') || '—';

    let size = '';
    for (const t of toks) {
        const c = t.replace(TRIM_TAIL, '');
        const head = c.split('(')[0].replace(TRIM_TAIL, '');
        const cand = [c, head].concat(head.indexOf(',') >= 0 ? head.split(',') : []);
        let hit = '';
        for (const raw of cand) {
            const q = String(raw).replace(TRIM_TAIL, '').trim();
            if (q !== '' && SIZE_TOKEN.test(q)) { hit = q; break; }
        }
        if (hit !== '') { size = hit; break; }
    }
    if (size === '') {
        for (const t of toks) {
            const m = /\(([^()]*)\)/.exec(t);
            const inner = m ? m[1].trim() : '';
            if (inner !== '' && SIZE_PAREN.test(inner)) { size = inner; break; }
        }
    }
    return { model, size: size || '—', full };
}

/**
 * 최근 불합격 목록 — result === '불합격' 인 행을 **최신순**으로.
 * 보고서번호가 비었거나 '-' 면 '없음' 으로 적는다(빈칸은 "안 봤다"로 읽힌다).
 * P9 r9 : 품명에서 뽑은 model · size 를 같이 담는다(화면이 다시 뽑지 않게).
 * @returns {Array<{date,supplier,itemCode,itemName,model,size,ngQty,reportNo,defectType}>}
 */
export function recentFails(rows, n) {
    const out = (rows || [])
        .filter((r) => r && r.result === '불합격')
        .map((r) => {
            const no = String((r.inspectionReportNo === null || r.inspectionReportNo === undefined) ? '' : r.inspectionReportNo).trim();
            const nm = String(r.itemName || '').trim();
            const P = parseItem(nm);
            return {
                key: String(r.id || `${ymd(r.date)}-${r.item_code || ''}-${r.inspectionReportNo || ''}`),
                date: ymd(r.date),
                supplier: String(r.supplier || '').trim() || '(미상)',
                itemCode: String(r.item_code || '').trim() || '—',
                itemName: nm || '—',
                model: P.model,
                size: P.size,
                ngQty: n0(r.defectQuantity),
                defectType: String(r.defectType || '').trim(),
                reportNo: (no === '' || no === '-' || no === '없음') ? '없음' : no,
            };
        })
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    return n ? out.slice(0, n) : out;
}

/* ═════════════════════════════════════════════════════════════════════════════
   P6 r6 — 영역 0 「오늘 현황」용 파생 함수

   운영 화면이 묻는 것은 딱 세 가지다. **오늘 무슨 일이 있었나 · 어제보다 나은가 ·
   이번 주/달은 어디까지 왔나.** 아래 함수들은 그 셋을 재는 자다.

   ── 이 자료로 잴 수 없는 것 (지어내지 않는다) ───────────────────────────────
     · 대장의 date 는 **날짜뿐이다**(시각이 없다). 그래서 '오늘'은 언제나
       `date === 기준일` 인 줄들이지, '지금부터 몇 시간 전'이 아니다.
     · 입고 예정·검사 대기 자료가 없다. 「남은 건수」 같은 칸을 만들지 않는다.
     · 목표치(일일 목표 건수 등)가 없다. 달성률을 만들지 않는다.
   전부 여기 한 군데의 정의를 화면이 그대로 쓴다 — 카드마다 다시 세지 않는다.
   ═════════════════════════════════════════════════════════════════════════════ */

/** 오늘(브라우저 로컬 시간) 'YYYY-MM-DD'. 자료에 시각이 없으므로 날짜만 쓴다. */
export function todayYmd(today) {
    return local(today || new Date());
}

/** 하루치 합계. summarize() 와 같은 모양이라 KPI 계산이 한 벌로 끝난다. */
export function dayStats(rows, day) {
    const d = String(day || '');
    if (!d) return summarize([]);
    return summarize((rows || []).filter((r) => ymd(r && r.date) === d));
}

/** 구간 합계(양 끝 포함). rangeFilter + summarize 를 한 번에. */
export function rangeStats(rows, start, end) {
    return rangeStatsOf(rows, { start, end });
}
const rangeStatsOf = (rows, range) => summarize(rangeFilter(rows, range));

/**
 * 그 주의 **월요일 ~ 기준일**. (한 주의 시작은 월요일이다 — 현장 주간회의 기준)
 * 기준일이 월요일이면 하루짜리 구간이 된다. 그게 맞다 — 아직 한 주가 시작만 한 것이다.
 */
export function weekRange(day) {
    const t = _u(day);
    if (!Number.isFinite(t)) return { start: '', end: '' };
    const dow = new Date(t).getUTCDay();     // 0=일 … 6=토
    const back = (dow + 6) % 7;              // 월요일까지 며칠 뒤로
    return { start: addDays(day, -back), end: String(day) };
}

/** 그 달의 **1일 ~ 기준일** (MTD) */
export function mtdRange(day) {
    const d = String(day || '');
    if (d.length < 10) return { start: '', end: '' };
    return { start: `${d.slice(0, 7)}-01`, end: d };
}

/**
 * 전주 / 전월의 **같은 자리** 구간. 「이번 주 5일치」를 「지난주 한 주 전체」와 비교하면
 * 늘 지고 있는 것처럼 보인다 — 그래서 자리를 맞춘다.
 *   · unit='week'  : 통째로 7일 앞으로 민다 (월~금 ↔ 지난주 월~금)
 *   · unit='month' : 전월 1일 ~ 전월 같은 일자 (전월에 그 날짜가 없으면 말일로 자른다)
 */
export function prevSameRange(range, unit) {
    const r = range || {};
    if (!r.start || !r.end) return { start: '', end: '' };
    if (unit === 'month') {
        const y = Number(r.start.slice(0, 4));
        const m = Number(r.start.slice(5, 7));
        if (!Number.isFinite(y) || !Number.isFinite(m)) return { start: '', end: '' };
        const py = m === 1 ? y - 1 : y;
        const pm = m === 1 ? 12 : m - 1;
        const last = new Date(Date.UTC(py, pm, 0)).getUTCDate();   // 전월 말일
        const dd = Math.min(Number(r.end.slice(8, 10)) || 1, last);
        return { start: `${py}-${two(pm)}-01`, end: `${py}-${two(pm)}-${two(dd)}` };
    }
    return { start: addDays(r.start, -7), end: addDays(r.end, -7) };
}

/**
 * 최근 검사 n줄. **날짜 내림차순**, 같은 날짜 안에서는 **대장에 적힌 순서 그대로**다.
 * (대장에 시각이 없다. 같은 날 줄들의 앞뒤를 지어낼 근거가 없으므로 원본 순서를 지킨다.)
 * @returns {Array<{key,date,supplier,itemCode,itemName,inQty,inspQty,ngQty,result,reportNo}>}
 */
export function recentRows(rows, n) {
    const out = (rows || [])
        .map((r, i) => ({ r, i, d: ymd(r && r.date) }))
        .filter((o) => o.d !== '')
        .sort((a, b) => (a.d !== b.d ? (a.d < b.d ? 1 : -1) : a.i - b.i))
        .map((o) => {
            const r = o.r;
            const raw = String((r.inspectionReportNo === null || r.inspectionReportNo === undefined) ? '' : r.inspectionReportNo).trim();
            return {
                key: String(r.id || `${o.d}-${o.i}`),
                date: o.d,
                supplier: String(r.supplier || '').trim() || '(미상)',
                itemCode: String(r.item_code || '').trim() || '—',
                itemName: String(r.itemName || '').trim() || '—',
                inQty: n0(r.totalQuantity),
                inspQty: n0(r.inspectionQuantity),
                ngQty: n0(r.defectQuantity),
                result: String(r.result || '').trim() || '—',
                reportNo: (raw === '' || raw === '-' || raw === '없음') ? '없음' : raw,
            };
        });
    return n ? out.slice(0, n) : out;
}

/** 기준일 하루의 불합격 목록. 모양은 recentFails() 와 같다(화면이 같은 줄 조각을 쓴다). */
export function todayFails(rows, day) {
    const d = String(day || '');
    if (!d) return [];
    return recentFails((rows || []).filter((r) => ymd(r && r.date) === d));
}

export default {
    ymd, PERIODS, periodRange, filterByPeriod, summarize, monthly, groupBy,
    bySupplier, byItemType, byItemCode, topDefectTypes, topDefectSuppliers,
    loadInspections, loadMeasurements, loadSyncLogs, clearInboundStatsCache,
    lastSyncedAt, lastSyncLogAt, isSyncOkRow, syncRowTime,
    SYNC_PATH, SYNC_TIMEOUT_MS, NO_SYNC_SERVER, syncEndpoint, syncCountOf, runSheetSync,
    QUICK_PERIODS, GROUPS, dataSpan, addDays, daySpan, quickRange, rangeFilter,
    autoGroup, bucketBy, previousRange,
    PPM_TARGET, ppm, ppmState, rateState, PPM_STATE_TEXT, fmtRate, fmtPpm,
    RECORD_CHANGE_DATE, RECORD_CHANGE_NOTE, MEASURE_SINCE_NOTE, changeIndexOf,
    activeDays, prevMonthOf, addYears, comparisonBasis, avgStats,
    rateByBucket, verdictByBucket, topVendorTrend, recentFails, parseItem,
    todayYmd, dayStats, rangeStats, weekRange, mtdRange, prevSameRange, recentRows, todayFails,
};
