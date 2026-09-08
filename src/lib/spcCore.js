// spcCore.js — 인수검사 SPC 계산 코어 (JavaScript 이식본)
// ─────────────────────────────────────────────────────────────────────────────
// 원본: docs/project/인수검사/04_SPC/spc_core.py  +  /tmp/spc_build_D.py
// 「재구현 금지」: 이 파일은 파이썬의 **번역본**이다. 정답은 파이썬 출력이며,
// 계산식·반올림·정렬·구간 규칙을 임의로 "개선"하지 않는다.
// 각 주석의 [D:NN] 은 spc_build_D.py 줄번호, [C:NN] 은 spc_core.py 줄번호.
//
// 입력: rows = spc_core.load() 결과와 동일 구조의 배열 (QMS 에서는 DB 행에서 생성)
//   { ri, part, name, point, T, usl, lsl, xs:[..], vendor, judg }
// 출력: buildD(rows) → spc_build_D.build() 와 완전히 동일한 D 객체
// 의존성 0 (ESM).
// ─────────────────────────────────────────────────────────────────────────────

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ 0. 파이썬 수치 의미론 재현 계층                                            ║
// ╚═══════════════════════════════════════════════════════════════════════════╝
// 실측 결론 (P2 대조 과정):
//  (a) Math.round 는 파이썬 round() 와 다르다. 파이썬 round(x, n) 은 double 의
//      **정확한 2진값**을 10진 n자리로 round-half-to-EVEN(은행가 반올림) 하고,
//      Math.round 는 half-up(+∞ 방향)이다. 20260821 스냅샷에서는 실측 결과
//      tie 가 0건이라 Math.round 로도 같은 값이 나왔지만, round(oos/N*1e6)
//      처럼 nd=0 이고 분모가 2의 거듭제곱(N=32,64,128…)이면 정확한 .5 가
//      실제로 발생하여 값이 갈린다. 데이터 의존적 우연에 기대지 않도록
//      pyRound() 를 항상 쓴다. (nd=1,2 는 x.05/x.005 가 2진수로 표현
//      불가라 이론상 tie 없음 — 동일 헬퍼로 일괄 처리.)
//      ex) pyRound(0.5)=0, pyRound(1.5)=2, pyRound(2.5)=2  vs Math.round=1,2,3
//  (b) statistics.mean / statistics.stdev 는 float 누산이 아니라 **Fraction
//      정확 누산** 후 마지막에 한 번만 반올림한다. 순진한 sum/n 은 마지막
//      1ulp 가 어긋나 round(...,1) 경계에서 값이 갈릴 수 있으므로 BigInt
//      유리수로 그대로 옮긴다. (CPython Lib/statistics.py _sum/_ss/stdev)
//      실측: 순진한 sum/n 은 24개 업체 중 mean 5건·stdev 11건에서 1ulp
//      어긋났다(최종 반올림 결과는 이번 스냅샷 한정으로 우연히 동일).

/** double → 정확한 유리수 [n, d] (d>0, 2의 거듭제곱). float.as_integer_ratio() */
function exactRatio(x) {
  if (x === 0) return [0n, 1n];
  const dv = new DataView(new ArrayBuffer(8));
  dv.setFloat64(0, x);
  const hi = dv.getUint32(0), lo = dv.getUint32(4);
  const neg = (hi >>> 31) === 1;
  const be = (hi >>> 20) & 0x7ff;
  let mant = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo);
  let e;
  if (be === 0) { e = -1074; } else { mant |= (1n << 52n); e = be - 1075; }
  let n = mant, d = 1n;
  if (e >= 0) n <<= BigInt(e); else d = 1n << BigInt(-e);
  while (d > 1n && (n & 1n) === 0n) { n >>= 1n; d >>= 1n; }   // 기약화
  return [neg ? -n : n, d];
}

const _abs = (a) => (a < 0n ? -a : a);
function _gcd(a, b) { a = _abs(a); b = _abs(b); while (b) { const t = a % b; a = b; b = t; } return a; }
function _fnorm(n, d) {
  if (d < 0n) { n = -n; d = -d; }
  if (n === 0n) return [0n, 1n];
  const g = _gcd(n, d);
  return [n / g, d / g];
}
function _fadd(a, b) { return _fnorm(a[0] * b[1] + b[0] * a[1], a[1] * b[1]); }
function _fsub(a, b) { return _fnorm(a[0] * b[1] - b[0] * a[1], a[1] * b[1]); }
function _fmul(a, b) { return _fnorm(a[0] * b[0], a[1] * b[1]); }
function _fdivInt(a, k) { return _fnorm(a[0], a[1] * k); }
const _bl = (x) => (x < 0n ? -x : x).toString(2).length;

/** 정확 유리수 n/d → 가장 가까운 double (half-even). Fraction→float 과 동일 */
function fracToFloat(n, d) {
  if (n === 0n) return 0;
  let sign = 1;
  if (n < 0n) { sign = -1; n = -n; }
  let k = 53 - (_bl(n) - _bl(d));
  const build = (kk) => (kk >= 0 ? [n << BigInt(kk), d] : [n, d << BigInt(-kk)]);
  let [num, den] = build(k);
  let q = num / den;
  while (_bl(q) > 53) { k -= 1; [num, den] = build(k); q = num / den; }
  while (_bl(q) < 53) { k += 1; [num, den] = build(k); q = num / den; }
  const r = num - q * den;
  const twice = 2n * r;
  if (twice > den || (twice === den && (q & 1n) === 1n)) q += 1n;
  if (_bl(q) > 53) { q >>= 1n; k -= 1; }
  return sign * Number(q) * Math.pow(2, -k);
}

function _isqrt(n) {                       // math.isqrt (BigInt)
  if (n < 0n) throw new Error('isqrt<0');
  if (n < 2n) return n;
  let x = 1n << BigInt(Math.ceil(_bl(n) / 2));
  for (;;) { const y = (x + n / x) >> 1n; if (y >= x) break; x = y; }
  return x;
}
function _isqrtRto(n, m) {                 // statistics._integer_sqrt_of_frac_rto
  const a = _isqrt(n / m);
  return a | ((a * a * m !== n) ? 1n : 0n);
}
/** statistics._float_sqrt_of_frac: n/m 의 제곱근을 정확히 반올림 (_sqrt_bit_width=109) */
function floatSqrtOfFrac(n, m) {
  const q = Math.floor((_bl(n) - _bl(m) - 109) / 2);
  if (q >= 0) return fracToFloat(_isqrtRto(n, m << BigInt(2 * q)) << BigInt(q), 1n);
  return fracToFloat(_isqrtRto(n << BigInt(-2 * q), m), 1n << BigInt(-q));
}

/** 파이썬 round(x, nd) 의 10진 문자열 (정확값 기준 half-to-even) */
function pyFixedStr(x, nd) {
  const [n0, d] = exactRatio(x);
  const neg = n0 < 0n;
  let n = neg ? -n0 : n0;
  const P = 10n ** BigInt(nd);
  const num = n * P;
  let q = num / d;
  const r = num - q * d;
  const twice = 2n * r;
  if (twice > d || (twice === d && (q & 1n) === 1n)) q += 1n;
  let s = q.toString();
  if (nd > 0) {
    if (s.length <= nd) s = '0'.repeat(nd - s.length + 1) + s;
    s = s.slice(0, s.length - nd) + '.' + s.slice(s.length - nd);
  }
  return (neg ? '-' : '') + s;
}
/** 파이썬 round(x, nd) — Math.round 로 대체 불가 (위 (a) 참조) */
export function pyRound(x, nd = 0) {
  if (!Number.isFinite(x)) return x;
  return Number(pyFixedStr(x, nd));
}

/** 파이썬 float // float (CPython float_divmod 알고리즘) 후 정수화 */
function pyFloorDivF(a, b) {
  let mod = a % b;                       // JS % == C fmod
  let div = (a - mod) / b;
  if (mod !== 0) { if ((b < 0) !== (mod < 0)) { div -= 1.0; } }
  if (div !== 0) { let fd = Math.floor(div); if (div - fd > 0.5) fd += 1.0; return fd; }
  return 0;
}

/** statistics._sum: 정확 유리수 합 + 개수 */
function _pySumFrac(values) {
  const byD = new Map();                 // dStr -> {d, n}
  let count = 0;
  for (const v of values) {
    const [n, d] = exactRatio(v);
    count += 1;
    const k = d.toString();
    const e = byD.get(k);
    if (e) e.n += n; else byD.set(k, { d, n });
  }
  let tot = [0n, 1n];
  for (const { d, n } of byD.values()) tot = _fadd(tot, _fnorm(n, d));
  return [tot, count];
}

/** statistics.mean */
export function pyMean(values) {
  const [tot, n] = _pySumFrac(values);
  if (n < 1) throw new Error('mean requires at least one data point');
  return fracToFloat(...(_fdivInt(tot, BigInt(n))));
}

/** statistics.stdev (xbar 미지정) — _ss 의 (count*sxx - sx*sx)/count 를 그대로 */
export function pyStdev(values) {
  const byD = new Map();
  let count = 0;
  for (const v of values) {
    const [n, d] = exactRatio(v);
    count += 1;
    const k = d.toString();
    let e = byD.get(k);
    if (!e) { e = { d, n: 0n, nn: 0n }; byD.set(k, e); }
    e.n += n; e.nn += n * n;
  }
  if (count < 2) throw new Error('stdev requires at least two data points');
  let sx = [0n, 1n], sxx = [0n, 1n];
  for (const { d, n, nn } of byD.values()) {
    sx = _fadd(sx, _fnorm(n, d));
    sxx = _fadd(sxx, _fnorm(nn, d * d));
  }
  const C = BigInt(count);
  const ssd = _fdivInt(_fsub(_fmul([C, 1n], sxx), _fmul(sx, sx)), C);
  const mss = _fdivInt(ssd, BigInt(count - 1));
  return floatSqrtOfFrac(mss[0], mss[1]);
}

/** 파이썬 "%g" (유효숫자 6, 후행 0 제거) */
function fmtG(v) {
  if (v === 0) return (Object.is(v, -0) ? '-0' : '0');
  const es = v.toExponential(5);
  const ei = es.indexOf('e');
  const exp = parseInt(es.slice(ei + 1), 10);
  if (exp < -4 || exp >= 6) {
    let mant = es.slice(0, ei);
    if (mant.indexOf('.') >= 0) mant = mant.replace(/0+$/, '').replace(/\.$/, '');
    const a = Math.abs(exp).toString().padStart(2, '0');
    return mant + 'e' + (exp < 0 ? '-' : '+') + a;
  }
  let s = pyFixedStr(v, Math.max(0, 5 - exp));
  if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s;
}

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ 1. 상수 / 기본 함수                                                        ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

// [D:11-14] 관리도 상수 (표준값)
const D2 = { 2: 1.128, 3: 1.693, 4: 2.059, 5: 2.326 };
const A2 = { 2: 1.880, 3: 1.023, 4: 0.729, 5: 0.577 };
const D3 = { 2: 0.0, 3: 0.0, 4: 0.0, 5: 0.0 };
const D4 = { 2: 3.267, 3: 2.574, 4: 2.282, 5: 2.114 };

// [D:16-22] / [C:60-66] 회사 공식 5등급 (SSOT: [신우밸브]cpk 기준.pdf)
export const GRADES = [
  [1.67, '특급', '공정능력 매우 충분 — 관리 간소화·코스트 절감 검토'],
  [1.33, '1등급', '공정능력 충분 — 이상적, 유지'],
  [1.00, '2등급', '근사 — 공정 관리를 야무지게, 필요 시 조처'],
  [0.67, '3등급', '부족 — 부적합 발생, 전수선별·공정 개선 필요'],
  [null, '4등급', '대단히 부족 — 긴급 대책·원인 추구·규격 재검토'],
];

// [D:24] 히스토그램 하한 고정 -140%, 구간폭 20%
const HIST_B0 = -140, HIST_W = 20;

/** [D:27-30] / [C:68-71] 등급 판정 → [등급명, 조치문] */
export function grade(cpk) {
  for (const [th, name, action] of GRADES) {
    if (th === null || cpk >= th) return [name, action];
  }
}

/** [D:40-46] / [C:74-80] 차장 방식 %정규화: 기준=0, 상한=+100, 하한=-100 */
export function normPct(x, T, usl, lsl) {
  const up = usl - T, lo = T - lsl;
  const d = x - T;
  if (d >= 0) return up > 0 ? (d / up * 100) : (d === 0 ? 0.0 : Infinity);
  return lo > 0 ? (d / lo * 100) : -Infinity;
}

/** [D:49-50] "%g~%g" % (round(lsl,6), round(usl,6)) */
function fmtSpec(lsl, usl) {
  return fmtG(pyRound(lsl, 6)) + '~' + fmtG(pyRound(usl, 6));
}

/** [D:53-56] RI-260714-09 → 07/14 */
function riDate(ri) {
  const m = /^RI-(\d{2})(\d{2})(\d{2})-/.exec(String(ri));
  return m ? m[2] + '/' + m[3] : '';
}

/** [C:40-58] combo_stats — 같은 (품번, 포인트, 기준치수) 로트들 → SPC 지표
 *  (D 빌더에서는 쓰이지 않지만 spc_core.py 이식 완결성을 위해 포함) */
export function comboStats(rows) {
  const allX = rows.flatMap(r => r.xs);
  const n = allX.length;
  const { usl, lsl, T } = rows[0];
  const xbar = pyMean(allX);
  const subs = rows.filter(r => r.xs.length >= 2).map(r => r.xs);
  const out = { n, lots: rows.length, xbar, usl, lsl, T };
  if (subs.length >= 2) {                                   // [C:48]
    const rbar = pyMean(subs.map(s => Math.max(...s) - Math.min(...s)));
    const d2bar = pyMean(subs.map(s => D2[s.length]));
    const sw = rbar / d2bar;
    out.rbar = rbar; out.sigma_w = sw;
    out.cp = sw ? (usl - lsl) / (6 * sw) : null;
    out.cpk = sw ? Math.min(usl - xbar, xbar - lsl) / (3 * sw) : null;
  }
  if (n >= 2) {                                             // [C:55]
    const so = pyStdev(allX);
    out.sigma_o = so;
    out.ppk = so ? Math.min(usl - xbar, xbar - lsl) / (3 * so) : null;
  }
  return out;
}

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ 2. 히스토그램 / mt 블록                                                    ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

/** [D:90-100] _hist — 하한은 -140 과 floor(min/20)*20 중 작은 쪽,
 *  상한은 +140 과 ceil(max/20)*20 중 큰 쪽. 구간 인덱스는 float //(floor)로. */
function _hist(vals) {
  const lo = Math.min(HIST_B0, Math.floor(Math.min(...vals) / HIST_W) * HIST_W);   // [D:92]
  const hi = Math.max(-HIST_B0, Math.ceil(Math.max(...vals) / HIST_W) * HIST_W);   // [D:93]
  const nb = Math.floor((hi - lo) / HIST_W);                                       // [D:94] int //
  const bins = new Array(nb).fill(0);
  for (const p of vals) {                                                          // [D:96-99]
    let i = pyFloorDivF(p - lo, HIST_W);
    i = i < 0 ? 0 : (i >= nb ? nb - 1 : i);
    bins[i] += 1;
  }
  return { b0: lo, w: HIST_W, bins };
}

/** [D:103-144] _mt — mt 블록 (키 순서 = 원본과 동일). raw 에 반올림 전 값을 담는다.
 *  ※ 부분군(len(xs)>=2 로트)이 2개 미만이면 관리도(xbb/rbar/UCL/LCL/sw/cp/cpk) 자체를 생략.
 *  ※ sw 가 0/None 이면 cp·cpk 생략 (파이썬 `if sw:` 의 truthiness 그대로).
 *  ※ cl 은 소수1자리, mt 는 소수2자리 — 같은 값이라도 반올림 자릿수가 다르다. */
function _mt(pcts, subs, oos, lotmeans, raw) {
  const mt = {};
  if (raw === undefined || raw === null) raw = {};
  const N = pcts.length;
  if (subs.length >= 2) {                                                    // [D:109]
    // [D:110] 전체평균 xbb 는 "로트 평균들의 평균" (lotmeans 는 단측 로트도 포함)
    const xbb = (lotmeans && lotmeans.length)
      ? pyMean(lotmeans)
      : pyMean(subs.map(s => pyMean(s)));
    const rs = subs.map(s => Math.max(...s) - Math.min(...s));               // [D:111]
    const rbar = pyMean(rs);                                                 // [D:112]
    const d2b = pyMean(subs.map(s => D2[s.length]));                         // [D:113]
    const a2b = pyMean(subs.map(s => A2[s.length]));                         // [D:114]
    const d3b = pyMean(subs.map(s => D3[s.length]));                         // [D:115]
    const d4b = pyMean(subs.map(s => D4[s.length]));                         // [D:116]
    const sw = d2b ? rbar / d2b : null;                                      // [D:117]
    raw.xbb = xbb; raw.rbar = rbar; raw.sw = sw;                             // [D:118-119]
    raw.x_ucl = xbb + a2b * rbar; raw.x_lcl = xbb - a2b * rbar;
    mt.xbb = pyRound(xbb, 2);                                                // [D:120]
    mt.rbar = pyRound(rbar, 2);                                              // [D:121]
    mt.x_ucl = pyRound(xbb + a2b * rbar, 2);                                 // [D:122]
    mt.x_lcl = pyRound(xbb - a2b * rbar, 2);                                 // [D:123]
    mt.r_ucl = pyRound(d4b * rbar, 2);                                       // [D:124]
    mt.r_lcl = pyRound(d3b * rbar, 2);                                       // [D:125]
    mt.sw = sw ? pyRound(sw, 2) : null;                                      // [D:126]
    if (sw) {                                                                // [D:127]
      mt.cp = pyRound(200 / (6 * sw), 2);                                    // [D:128]
      // [D:129-131] ※ Cpk 중심은 xbb 가 아니라 전체평균 mu (원본 D 와 일치 확인)
      const _mu = pyMean(pcts);
      mt.cpk = pyRound(Math.min(100 - _mu, _mu + 100) / (3 * sw), 2);
    }
  }
  const mu = pyMean(pcts);                                                   // [D:132]
  const so = N >= 2 ? pyStdev(pcts) : null;                                  // [D:133]
  raw.mu = mu;                                                               // [D:134]
  raw.so = so;                                                               // [D:135]
  raw.ppk = so ? (Math.min(100 - mu, mu + 100) / (3 * so)) : null;           // [D:136]
  mt.so = (so !== null && so !== undefined) ? pyRound(so, 2) : null;         // [D:137]
  mt.pp = so ? pyRound(200 / (6 * so), 2) : null;                            // [D:138]
  mt.ppk = so ? pyRound(Math.min(100 - mu, mu + 100) / (3 * so), 2) : null;  // [D:139]
  mt.mu = pyRound(mu, 2);                                                    // [D:140]
  mt.N = N;                                                                  // [D:141]
  mt.ppm_obs = N ? pyRound(oos / N * 1e6) : 0;                               // [D:142] ★ round(x) — 은행가 반올림
  mt.hist = _hist(pcts);                                                     // [D:143]
  return mt;
}

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ 3. buildD — spc_build_D.build() 이식                                       ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

/** [D:147-225] build(xlsx) 의 rows 이후 전부. rows 는 spc_core.load() 와 동일 구조. */
export function buildD(rows) {
  // ── 로트(행) 단위 가공 [D:150-165]
  // ※ [D:151-153] 한쪽 공차폭이 0이라 %정규화가 ±무한대가 되는 행은 D에서 제외한다.
  const lots = [];
  for (const r of rows) {
    const raw = r.xs.map(x => normPct(x, r.T, r.usl, r.lsl));                // [D:155]
    if (!raw.every(p => -1e308 < p && p < 1e308)) continue;                  // [D:156-157]
    const pct = raw.map(p => pyRound(p, 1));                                 // [D:158]
    lots.push({
      vendor: r.vendor, raw, pct,
      rec: {
        ri: r.ri, date: riDate(r.ri), part: r.part,
        point: r.point,
        name: Array.from(r.name).slice(0, 40).join(''),                      // [D:162] name[:40]
        spec: fmtSpec(r.lsl, r.usl),
        pct,
        mean: pyRound(pyMean(pct), 1),                                       // [D:164]
        oos: pct.filter(p => Math.abs(p) > 100).length,                      // [D:165]
      },
    });
  }

  // [D:167] RI번호 오름차순(안정 정렬) — 문자열 코드포인트 비교, Array.sort 는 안정 정렬
  lots.sort((a, b) => (a.rec.ri < b.rec.ri ? -1 : a.rec.ri > b.rec.ri ? 1 : 0));

  // ── overall [D:169-189]
  const allRaw = lots.flatMap(L => L.raw);                                   // [D:170]
  const allPct = lots.flatMap(L => L.pct);                                   // [D:171]
  const nAll = allPct.length;
  const muAll = pyMean(allPct);
  const soAll = pyStdev(allPct);
  const oosAll = allRaw.filter(p => Math.abs(p) > 100).length;               // [D:175] ※ raw(반올림 전) 기준
  const vendorsOrder = [];
  const byv = new Map();
  for (const L of lots) {                                                    // [D:178-182]
    if (!byv.has(L.vendor)) { byv.set(L.vendor, []); vendorsOrder.push(L.vendor); }
    byv.get(L.vendor).push(L);
  }
  const overall = {
    n: nAll,
    vendors: byv.size,
    mu: pyRound(muAll, 1),
    oos: oosAll,
    oospct: pyRound(oosAll / nAll * 100, 1),
    idx: pyRound(Math.min(100 - muAll, muAll + 100) / (3 * soAll), 2),
  };

  // ── vendors [D:191-223]
  const vlist = [];
  for (const vname of vendorsOrder) {
    const Ls = byv.get(vname);
    const pcts = Ls.flatMap(L => L.pct);                                     // [D:195]
    const subs = Ls.filter(L => L.pct.length >= 2).map(L => L.pct);          // [D:196]
    const oos = Ls.reduce((a, L) => a + L.rec.oos, 0);                       // [D:197]
    const lm = Ls.map(L => L.rec.mean);                                      // [D:198] 모든 로트의 평균
    const rw = {};
    const mt = _mt(pcts, subs, oos, lm, rw);                                 // [D:200]
    const idx = mt.ppk;                                                      // [D:201]
    const [g, act] = grade(rw.ppk !== null && rw.ppk !== undefined ? rw.ppk : 0); // [D:202] 반올림 전 ppk 로 등급
    // [D:203-207] cl 은 소수1자리 (mt 는 2자리) — 같은 원천값, 다른 반올림
    const cl = subs.length >= 2
      ? { xbb: pyRound(rw.xbb, 1), rbar: pyRound(rw.rbar, 1), ucl: pyRound(rw.x_ucl, 1), lcl: pyRound(rw.x_lcl, 1) }
      : null;
    // [D:208-209] rseq 는 부분군이 2개 이상일 때만, 그 중 n>=2 로트만
    const rseq = subs.length >= 2
      ? Ls.filter(L => L.pct.length >= 2).map(L => ({
          ri: L.rec.ri,
          r: pyRound(Math.max(...L.pct) - Math.min(...L.pct), 1),
          n: L.pct.length,
        }))
      : [];
    vlist.push({
      vendor: vname,
      n: pcts.length,
      lots: Ls.map(L => L.rec),
      mean: pyRound(pyMean(pcts), 1),                                        // [D:214]
      sigma: pcts.length >= 2 ? pyRound(pyStdev(pcts), 1) : null,            // [D:215]
      oos, idx, grade: g, action: act, cl, rseq, mt,
    });
  }
  vlist.sort((a, b) => (-a.n) - (-b.n));                                     // [D:224] n 내림차순(안정)
  return { overall, vendors: vlist };
}

export default { normPct, comboStats, grade, buildD, pyRound, pyMean, pyStdev, GRADES };
