/* ─────────────────────────────────────────────────────────────────────────────
   components/inbound/ui.jsx — 인수검사 화면 공용 조각   (플랜 042 / P4 r4)

   승인된 디자인 시안([260901]인수검사_한눈에_디자인시안_r1.html)의 표면·색·모션을
   React 조각으로 옮긴 것이다. 화면 넷이 **같은 조각**을 쓴다 —
   화면마다 카드 테두리가 다르거나 같은 뜻의 색이 다르게 칠해지는 일을 막는다.

   색은 두 갈래뿐이다.
     · 계통색(브랜드) = sky        → 막대·선·게이지 등 '값' 자체
     · 의미색                      → 정상 emerald / 주의 amber / 이상 rose (ISA-101)
   값은 전부 styles/inbound.css 의 CSS 변수(--ib-*)에서 온다. TV 현황판(다크)은
   그 변수만 덮어쓰므로 이 파일의 조각들은 라이트/다크에서 그대로 재사용된다.

   ※ 새 npm 의존성은 하나도 늘리지 않았다. 스파크라인·게이지·랭킹막대는 인라인 SVG 다.
   ───────────────────────────────────────────────────────────────────────────── */
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

/* ── 숫자 표기 ── 값이 없으면 0 이 아니라 '—' 다. 0 으로 적으면 "없음"으로 잘못 읽힌다. */
export const fmt = (v) => (v === null || v === undefined || Number.isNaN(v) ? '—' : Number(v).toLocaleString('ko-KR'));
export const fx = (v, d) => (v === null || v === undefined || Number.isNaN(v) ? '—' : Number(v).toFixed(d === undefined ? 1 : d));
export const pctText = (v, d) => (v === null || v === undefined ? '—' : `${fx(v, d === undefined ? 2 : d)}%`);

/* ── 등급 5색 (시안 팔레트) ──────────────────────────────────────────────────
   특급 emerald-700 → 4등급 rose. lib/inboundSpc.js 의 GRADE_COLOR(구 v3 팔레트)는
   그대로 두었다 — 다른 화면이 아직 그 값을 쓸 수 있어서다. 인수검사 4화면은 이쪽을 쓴다. */
export const GRADE_ORDER5 = ['특급', '1등급', '2등급', '3등급', '4등급'];
export const GRADE_UI = {
    '특급': { bar: '#047857', text: '#065f46', bg: 'rgba(4,120,87,.13)' },
    '1등급': { bar: '#10b981', text: '#047857', bg: 'rgba(16,185,129,.14)' },
    '2등급': { bar: '#0ea5e9', text: '#0369a1', bg: 'rgba(14,165,233,.14)' },
    '3등급': { bar: '#f59e0b', text: '#b45309', bg: 'rgba(245,158,11,.16)' },
    '4등급': { bar: '#f43f5e', text: '#be123c', bg: 'rgba(244,63,94,.13)' },
};
export const gradeColor = (g) => GRADE_UI[g] || GRADE_UI['4등급'];

/* ── 색 팔레트 (JS 값) ──────────────────────────────────────────────────────
   왜 CSS 변수를 그대로 안 쓰나: SVG 의 **표시 속성**(fill="…" · stroke="…")과
   Recharts 에 넘기는 색은 CSS 값이 아니라 속성값이라 var(--x) 가 풀리지 않는다.
   그래서 styles/inbound.css 와 **같은 값**을 여기 JS 로도 둔다. HTML 쪽(style=)은
   var(--ib-*) 를 그대로 쓴다 — 그쪽은 진짜 CSS 라 잘 풀린다.
   ※ 두 곳의 값이 어긋나면 라이트/다크가 서로 다른 색이 된다. 고칠 땐 둘 다 고쳐라. */
export const PALETTE = {
    light: {
        bg: '#eef2f9', ink: '#0f172a', ink2: '#475569', ink3: '#64748b', ink4: '#94a3b8',
        card: 'rgba(255,255,255,.75)', pri: '#0369a1', pri2: '#0ea5e9', pri3: '#7dd3fc',
        ok: '#047857', ok2: '#10b981', warn: '#b45309', warn2: '#f59e0b', bad: '#be123c', bad2: '#f43f5e',
        grid: 'rgba(15,23,42,.09)', track: 'rgba(15,23,42,.09)',
    },
    dark: {
        bg: '#020617', ink: '#eaf2fb', ink2: '#b6c6da', ink3: '#94a3b8', ink4: '#64748b',
        card: '#0a1120', pri: '#38bdf8', pri2: '#38bdf8', pri3: '#0ea5e9',
        ok: '#34d399', ok2: '#34d399', warn: '#fbbf24', warn2: '#fbbf24', bad: '#fb7185', bad2: '#fb7185',
        grid: 'rgba(148,163,184,.16)', track: 'rgba(148,163,184,.18)',
    },
};
const ThemeCtx = React.createContext(PALETTE.light);
/** 지금 화면(라이트/TV다크)의 색 묶음. SVG·Recharts 에 넘길 값은 전부 여기서 꺼낸다. */
export const useInboundTheme = () => React.useContext(ThemeCtx);

/** 의미색 3단 — 화면 어디서나 같은 뜻이다 */
export const TONE = {
    ok: { fg: 'var(--ib-ok)', dot: 'var(--ib-ok2)', bg: 'rgba(16,185,129,.14)' },
    warn: { fg: 'var(--ib-warn)', dot: 'var(--ib-warn2)', bg: 'rgba(245,158,11,.16)' },
    bad: { fg: 'var(--ib-bad)', dot: 'var(--ib-bad2)', bg: 'rgba(244,63,94,.13)' },
    mute: { fg: 'var(--ib-ink3)', dot: 'var(--ib-ink4)', bg: 'var(--ib-chip)' },
};

/* ── 모션 ─────────────────────────────────────────────────────────────────── */
export function useReducedMotion() {
    const [rm, setRm] = useState(() => {
        try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
        catch (e) { return false; }
    });
    useEffect(() => {
        let m;
        try { m = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)'); } catch (e) { m = null; }
        if (!m) return undefined;
        const h = () => setRm(m.matches);
        if (m.addEventListener) m.addEventListener('change', h); else m.addListener(h);
        return () => { if (m.removeEventListener) m.removeEventListener('change', h); else m.removeListener(h); };
    }, []);
    return rm;
}

/**
 * 숫자 카운트업. prefers-reduced-motion 이면 애니메이션 없이 목표값을 그대로 준다.
 * (읽는 값이 흔들리는 걸 싫어하는 사람이 있다. OS 설정을 존중한다.)
 */
export function useCountUp(to, opt) {
    const dur = (opt && opt.duration) || 900;
    const rm = useReducedMotion();
    const target = Number.isFinite(Number(to)) ? Number(to) : 0;
    const [v, setV] = useState(rm ? target : 0);
    const st = useRef({ raf: 0, last: 0 });
    useEffect(() => {
        if (rm) { st.current.last = target; setV(target); return undefined; }
        const from = st.current.last;
        const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        const step = (t) => {
            const p = Math.min(1, (t - t0) / dur);
            const e = 1 - Math.pow(1 - p, 3);
            const val = from + (target - from) * e;
            st.current.last = val;
            setV(val);
            if (p < 1) st.current.raf = requestAnimationFrame(step);
            else { st.current.last = target; setV(target); }
        };
        st.current.raf = requestAnimationFrame(step);
        return () => cancelAnimationFrame(st.current.raf);
    }, [target, rm, dur]);
    return v;
}

/** 카운트업 숫자. dec 를 주면 소수 자리, 없으면 천단위 콤마 정수 */
export const CountUp = ({ value, dec }) => {
    const v = useCountUp(value);
    if (value === null || value === undefined) return <>—</>;
    return <>{dec ? v.toFixed(dec) : Math.round(v).toLocaleString('ko-KR')}</>;
};

/* ── 표면 ─────────────────────────────────────────────────────────────────── */

/** 페이지 배경 오로라 3겹. 화면 뿌리(.inbound-screen) 안에 딱 한 번 놓는다. */
export const AuroraBg = () => <div className="ib-aurora" aria-hidden="true" />;

export const Card = ({ className = '', style, delay, children, ...rest }) => (
    <section
        className={`ib-card ib-fade ${className}`}
        style={{ padding: 'var(--ib-pad)', animationDelay: delay ? `${delay}s` : undefined, ...style }}
        {...rest}
    >
        {children}
    </section>
);

/** 카드 제목 + 부제(왜 이 숫자인지 한 줄). 부제가 없는 카드는 만들지 않는다. */
export const SectionTitle = ({ title, subtitle, right }) => (
    <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 min-w-0">
            <b style={{ color: 'var(--ib-ink)', fontSize: 'var(--ib-ttl)', fontWeight: 800, letterSpacing: '-.01em' }}>{title}</b>
            {subtitle && (
                <span style={{ color: 'var(--ib-ink4)', fontSize: 'calc(var(--ib-lbl) * .95)', fontWeight: 600 }}>{subtitle}</span>
            )}
        </div>
        {right}
    </div>
);

/** 상태 배지 — 글로우는 배지에만 허용한다(경고가 튀어야 하니까) */
export const StatusBadge = ({ tone = 'mute', children }) => {
    const t = TONE[tone] || TONE.mute;
    return (
        <span className="inline-flex items-center gap-1.5 rounded-full whitespace-nowrap"
            style={{ padding: '4px 11px', fontSize: 'calc(var(--ib-lbl)*.95)', fontWeight: 800, background: t.bg, color: t.fg }}>
            <i className="rounded-full" style={{ width: 7, height: 7, background: t.dot, boxShadow: `0 0 8px ${t.dot}` }} />
            {children}
        </span>
    );
};

/**
 * 증감 칩. goodDown=true 면 "내려가는 게 좋은 지표"다(불량률·부적합).
 * 값이 없거나 이전이 0이면 색을 칠하지 않는다 — 무한대 증가율은 거짓말이다.
 */
export const DeltaChip = ({ cur, prev, goodDown, label }) => {
    const ok = cur !== null && cur !== undefined && prev !== null && prev !== undefined && prev !== 0;
    if (!ok) {
        /* P8 r8 : 기준 구간에 자료가 없을 때의 문구를 한 군데로 모았다.
           예전엔 「전월 —」 처럼 적어 "전월이 0이었다"로 읽혔다. 없는 건 없다고 적는다. */
        return (
            <span className="inline-flex items-center gap-1 rounded-full whitespace-nowrap"
                style={{ padding: '3px 9px', fontSize: 'calc(var(--ib-lbl)*.95)', fontWeight: 700, background: 'var(--ib-chip)', color: 'var(--ib-ink3)' }}>
                — 비교 자료 없음
            </span>
        );
    }
    const d = (cur - prev) / Math.abs(prev) * 100;
    const up = d >= 0;
    const flat = Math.abs(d) < 0.5;
    const good = goodDown === null || goodDown === undefined ? null : (goodDown ? !up : up);
    const t = flat || good === null ? TONE.mute : (good ? TONE.ok : TONE.bad);
    return (
        <span className="inline-flex items-center gap-1 rounded-full whitespace-nowrap"
            style={{ padding: '3px 9px', fontSize: 'calc(var(--ib-lbl)*.95)', fontWeight: 800, background: t.bg, color: t.fg }}>
            {up ? '▲' : '▼'} {Math.abs(d).toFixed(1)}%
            <span style={{ fontWeight: 600, opacity: .75 }}>{label || 'vs 이전'}</span>
        </span>
    );
};

/* ── 구간 키 → 짧은 글자 ────────────────────────────────────────────────────
   '2026-08-27' → '8/27' · '2026-08' → '8월' · '2026' → '2026'
   스파크라인 밑 자리는 좁다. 연도까지 적으면 세 칸이 서로 붙는다. */
export const sparkKeyLabel = (k) => {
    const s = String(k === null || k === undefined ? '' : k);
    if (s.length >= 10) return `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}`;
    if (s.length >= 7) return `${Number(s.slice(5, 7))}월`;
    return s;
};

/** 묶음 → 사람이 읽는 이름. 스파크라인 감싸개 라벨이 이 값으로 바뀐다(P8 r8). */
export const GROUP_LABEL = { day: '일별', month: '월별', year: '년별' };
export const groupLabel = (g) => GROUP_LABEL[g] || '일별';

/* ── 스파크라인 ── 축·눈금 없이 형태만. 면적은 40%→0 그러데이션.
   P8 r8 에서 붙인 것 (marks=true 일 때만)
     · 아래 한 줄에 **시작일 · 최고점(값) · 종료일**. 축을 그리지 않고도
       "언제부터 언제까지의 그림인가"와 "제일 높았던 게 언제 얼마인가"가 읽힌다.
     · 최고점에는 고리 표시와 바닥까지 내리는 점선을 그린다.
   marks 를 안 주면 예전 모양 그대로다(다른 화면이 쓰고 있다). */
/* P10 (09-02): 늘려 그리지 않는다. 감싸는 칸의 실제 픽셀 크기를 재서(ResizeObserver)
   그 크기 그대로 viewBox 를 잡는다 — 고리·점이 타원이 되지 않고, 선 굵기도 진짜 2px 다. */
export const Sparkline = ({ values, keys, unit, color, height = 38, marks }) => {
    const uid = useId().replace(/[:]/g, '');
    const C = useInboundTheme();
    color = color || C.pri2;
    const boxRef = useRef(null);
    const [box, setBox] = useState({ w: 260, h: 54 });
    useEffect(() => {
        const el = boxRef.current;
        if (!el || typeof ResizeObserver === 'undefined') return undefined;
        /* SVG 요소는 contentRect 가 0 으로 오는 브라우저가 있어 getBoundingClientRect 로 잰다 */
        const measure = () => {
            const r = el.getBoundingClientRect();
            if (r.width > 10 && r.height > 10) {
                const w = Math.round(r.width), h = Math.round(r.height);
                setBox((b) => (b.w === w && b.h === h ? b : { w, h }));
            }
        };
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        window.addEventListener('resize', measure);
        return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
    }, []);
    const vals = (values || []).map((v) => (Number.isFinite(Number(v)) ? Number(v) : 0));
    if (vals.length < 2) return <div style={{ height }} />;
    const W = box.w, H = box.h, p = 5, n = vals.length;
    const mx = Math.max(...vals, 1);
    const X = (i) => p + i * (W - 2 * p) / (n - 1);
    const Y = (v) => H - p - (v / mx) * (H - 2 * p);
    let d = `M${X(0)} ${Y(vals[0])}`;
    for (let i = 1; i < n; i++) d += `L${X(i)} ${Y(vals[i])}`;

    let iMax = 0;
    for (let i = 1; i < n; i++) if (vals[i] > vals[iMax]) iMax = i;
    const K = keys || [];
    const showMarks = !!marks && K.length === n;

    const svg = (
        <svg ref={boxRef} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet"
            style={{ display: 'block', width: '100%', height: showMarks ? '100%' : height }} aria-hidden="true">
            <defs>
                <linearGradient id={`sp${uid}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity=".4" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            <path d={`${d}L${X(n - 1)} ${H} L${X(0)} ${H}Z`} fill={`url(#sp${uid})`} />
            <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            {showMarks && vals[iMax] > 0 && (
                <>
                    <line x1={X(iMax)} y1={Y(vals[iMax])} x2={X(iMax)} y2={H - p} stroke={color}
                        strokeWidth="1" strokeDasharray="3 3" opacity=".55" vectorEffect="non-scaling-stroke" />
                    <circle cx={X(iMax)} cy={Y(vals[iMax])} r="4.4" fill="none" stroke={color}
                        strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
                </>
            )}
            <circle cx={X(n - 1)} cy={Y(vals[n - 1])} r="2.6" fill={color} />
        </svg>
    );
    if (!showMarks) return svg;

    return (
        <div className="ib-spark" style={{ height }}>
            <div className="ib-spark-svg">{svg}</div>
            <div className="ib-sparkfoot">
                <span className="tabular-nums">{sparkKeyLabel(K[0])}</span>
                <b className="tabular-nums" style={{ color }}>
                    {sparkKeyLabel(K[iMax])} · {fmt(vals[iMax])}{unit ? ` ${unit}` : ''}
                </b>
                <span className="tabular-nums">{sparkKeyLabel(K[n - 1])}</span>
            </div>
        </div>
    );
};

/* ── 월별 PPM 미니 막대 (P8 r8, 히어로 카드 전용) ────────────────────────────
   목표선(100 PPM)과 같은 자로 최근 몇 달을 나란히 세운다. 축은 **선형**이다 —
   로그로 그리면 12,608 과 100 이 비슷해 보여 "거의 다 왔다"로 읽힌다.
   그래서 목표선은 실제로 바닥에 거의 붙는다. 그게 지금의 사실이다.
   (선이 축과 완전히 겹쳐 사라지지 않게 바닥에서 2px 만 띄운다 — 그리기 때문이지
    값을 옮긴 게 아니다.) */
export const MiniPpmBars = ({ rows, target = 100, height }) => {
    const C = useInboundTheme();
    const list = (rows || []).filter((r) => r && r.ppm !== null && r.ppm !== undefined);
    if (!list.length) return <Empty t="월별로 그릴 자료가 없다" />;
    const mx = Math.max(target, ...list.map((r) => r.ppm)) * 1.18;
    const pctOf = (v) => Math.max(0, Math.min(100, (v / mx) * 100));
    return (
        <div className="ib-ppmbars">
            <div className="ib-ppmvals">
                {list.map((r) => (
                    <span key={r.key} className="tabular-nums"
                        style={{ color: r.ppm > target ? C.bad : C.ok }}>{fmt(Math.round(r.ppm))}</span>
                ))}
            </div>
            <div className="ib-ppmplot">
                {list.map((r) => (
                    <i key={r.key} title={`${r.key} · ${Math.round(r.ppm).toLocaleString('ko-KR')} PPM`}
                        style={{
                            height: `${pctOf(r.ppm)}%`,
                            background: r.ppm > target
                                ? `linear-gradient(180deg, ${C.bad2}, ${C.bad})`
                                : `linear-gradient(180deg, ${C.ok2}, ${C.ok})`,
                        }} />
                ))}
                <span className="ib-ppmtarget" style={{ bottom: `max(2px, ${pctOf(target)}%)`, borderColor: C.ok2 }}>
                    <em style={{ color: C.ok }}>목표 {fmt(target)} PPM</em>
                </span>
            </div>
            <div className="ib-ppmkeys">
                {list.map((r) => <span key={r.key} className="tabular-nums">{sparkKeyLabel(r.key)}</span>)}
            </div>
        </div>
    );
};

/* ── KPI 타일 ── 라벨 · 큰 숫자 · 증감 칩 · 스파크라인 · 각주 5단 고정
   스파크라인 칸에 ib-kpispark 를 붙여 둔다 — 「대시보드」 격자 안(.ib-area-grid)에서는
   그 칸이 남은 높이를 먹어 타일 아래가 비지 않는다. 다른 화면에서는 예전 높이 그대로다. */
export const KpiTile = ({
    label, value, unit, dec, tone, spark, sparkKeys, sparkUnit, sparkGroup, sparkColor,
    delta, footnote, delay,
}) => (
    <Card delay={delay}>
        <div style={{ fontSize: 'var(--ib-lbl)', fontWeight: 700, color: 'var(--ib-ink3)' }}>{label}</div>
        <div className="tabular-nums"
            style={{ marginTop: 8, fontSize: 'var(--ib-kpi)', fontWeight: 800, letterSpacing: '-.035em', lineHeight: 1.05, color: tone || 'var(--ib-ink)' }}>
            <CountUp value={value} dec={dec} />
            {unit && <small style={{ fontSize: '.42em', fontWeight: 700, color: 'var(--ib-ink3)', marginLeft: 4 }}>{unit}</small>}
        </div>
        {delta && <div style={{ marginTop: 7 }}>{delta}</div>}
        {spark && (
            <>
                {/* P8 r8 : 감싸개 라벨이 묶음을 따라 바뀐다. 「묶음」 막대를 눌렀는데
                    스파크라인이 그대로면 그 막대가 아무 일도 안 하는 것처럼 보인다. */}
                {sparkGroup && (
                    <div className="ib-sparkcap">
                        <span>추이</span><b>({groupLabel(sparkGroup)})</b>
                    </div>
                )}
                <div className="ib-kpispark" style={{ marginTop: sparkGroup ? 2 : 6 }}>
                    <Sparkline values={spark} keys={sparkKeys} unit={sparkUnit} marks={!!sparkKeys}
                        color={sparkColor || 'var(--ib-pri2)'} height="100%" />
                </div>
            </>
        )}
        {footnote && <div style={{ marginTop: 8, fontSize: 'calc(var(--ib-lbl)*.98)', color: 'var(--ib-ink3)', lineHeight: 1.45 }}>{footnote}</div>}
    </Card>
);

/* ── 링 게이지 (합격률 등 0~100%) ────────────────────────────────────────── */
export const Ring = ({ pct, color, size = 150, label, sub }) => {
    const uid = useId().replace(/[:]/g, '');
    const C = useInboundTheme();
    color = color || C.ok2;
    const rm = useReducedMotion();
    const c = 75, R = 60, sw = 13, dash = 2 * Math.PI * R;
    const p = Math.max(0, Math.min(1, (pct || 0) / 100));
    const [off, setOff] = useState(rm ? dash * (1 - p) : dash);
    useEffect(() => {
        if (rm) { setOff(dash * (1 - p)); return undefined; }
        const t = setTimeout(() => setOff(dash * (1 - p)), 30);
        return () => clearTimeout(t);
    }, [p, rm, dash]);
    return (
        <svg viewBox="0 0 150 150" style={{ width: size, flex: 'none', display: 'block' }} role="img" aria-label={`${label} ${sub}`}>
            <defs>
                <linearGradient id={`rg${uid}`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={color} />
                    <stop offset="100%" stopColor={C.pri2} />
                </linearGradient>
            </defs>
            <circle cx={c} cy={c} r={R} fill="none" stroke={C.track} strokeWidth={sw} />
            <circle cx={c} cy={c} r={R} fill="none" stroke={`url(#rg${uid})`} strokeWidth={sw} strokeLinecap="round"
                transform={`rotate(-90 ${c} ${c})`} strokeDasharray={dash} strokeDashoffset={off}
                style={{ transition: rm ? 'none' : 'stroke-dashoffset 1.1s cubic-bezier(.22,1,.36,1)' }} />
            <text x={c} y={c - 2} textAnchor="middle" fontSize="15" fontWeight="800" fill={C.ink} className="tabular-nums">{label}</text>
            <text x={c} y={c + 17} textAnchor="middle" fontSize="10.5" fontWeight="600" fill={C.ink4}>{sub}</text>
        </svg>
    );
};

/* ── 방사형 게이지 (Ppk) ── 등급 경계 4개를 트랙에 새겨 값과 기준을 대조시킨다 */
export const GaugeRing = ({ value, domain = 1.8, bounds = [0.67, 1.00, 1.33, 1.67], grade, size }) => {
    const uid = useId().replace(/[:]/g, '');
    const C = useInboundTheme();
    const S = 230, c = 115, R = 88, sw = 17;
    const A0 = Math.PI * 0.78, A1 = Math.PI * 2.22;
    const P = (a, rr) => `${(c + rr * Math.cos(a)).toFixed(2)} ${(c + rr * Math.sin(a)).toFixed(2)}`;
    const arc = (a0, a1, rr) => `M${P(a0, rr)} A${rr} ${rr} 0 ${(a1 - a0) > Math.PI ? 1 : 0} 1 ${P(a1, rr)}`;
    const v = Number.isFinite(Number(value)) ? Number(value) : 0;
    const p = Math.max(0, Math.min(1, v / domain));
    const va = A0 + (A1 - A0) * p;
    const gc = gradeColor(grade);
    return (
        <svg viewBox={`0 0 ${S} ${S * 0.82}`} style={{ width: '100%', maxWidth: size || 230, display: 'block' }} role="img" aria-label={`Ppk ${v.toFixed(2)} ${grade || ''}`}>
            <defs>
                <linearGradient id={`gg${uid}`} x1="0" y1="1" x2="1" y2="0">
                    <stop offset="0%" stopColor={C.bad2} />
                    <stop offset="55%" stopColor={C.warn2} />
                    <stop offset="100%" stopColor={C.ok2} />
                </linearGradient>
            </defs>
            <path d={arc(A0, A1, R)} fill="none" stroke={C.track} strokeWidth={sw} strokeLinecap="round" />
            {p > 0 && <path d={arc(A0, va, R)} fill="none" stroke={`url(#gg${uid})`} strokeWidth={sw} strokeLinecap="round" />}
            {bounds.map((b) => {
                const a = A0 + (A1 - A0) * (b / domain);
                return (
                    <line key={b} x1={c + (R - sw / 2 - 1) * Math.cos(a)} y1={c + (R - sw / 2 - 1) * Math.sin(a)}
                        x2={c + (R + sw / 2 + 1) * Math.cos(a)} y2={c + (R + sw / 2 + 1) * Math.sin(a)}
                        stroke={C.bg} strokeWidth="2.4" />
                );
            })}
            <text x={c} y={c + 8} textAnchor="middle" fontSize="46" fontWeight="800" fill={C.ink} className="tabular-nums">{v.toFixed(2)}</text>
            <text x={c} y={c + 30} textAnchor="middle" fontSize="13" fontWeight="700" fill={gc.bar}>{(grade || '') + ' · Ppk'}</text>
            <text x={c + R * Math.cos(A0) - 4} y={c + R * Math.sin(A0) + 20} textAnchor="middle" fontSize="11" fill={C.ink4}>0</text>
            <text x={c + R * Math.cos(A1) + 4} y={c + R * Math.sin(A1) + 20} textAnchor="middle" fontSize="11" fill={C.ink4}>{domain.toFixed(1)}</text>
        </svg>
    );
};

/* ── 5등급 누적 스트립 + 범례 ─────────────────────────────────────────────── */
export const GradeStrip = ({ counts, total, unit = '', tv, height }) => {
    const tot = total || GRADE_ORDER5.reduce((a, g) => a + (counts[g] || 0), 0) || 1;
    const th = tv ? 0.20 : 0.10;
    return (
        <div>
            <div className="flex overflow-hidden rounded-lg gap-0.5"
                style={{ height: height || (tv ? 34 : 24), background: 'var(--ib-track)' }}>
                {GRADE_ORDER5.filter((g) => counts[g] > 0).map((g) => (
                    <i key={g} title={`${g} ${counts[g]}${unit}`} className="flex items-center justify-center overflow-hidden whitespace-nowrap not-italic"
                        style={{ flex: counts[g], background: gradeColor(g).bar, color: '#fff', fontSize: 'calc(var(--ib-lbl)*.92)', fontWeight: 800 }}>
                        {counts[g] / tot >= th ? `${g} ${counts[g]}` : ''}
                    </i>
                ))}
            </div>
            <div className="flex flex-wrap gap-x-3.5 gap-y-1" style={{ marginTop: 8, fontSize: 'calc(var(--ib-lbl)*.95)', color: 'var(--ib-ink3)' }}>
                {GRADE_ORDER5.map((g) => (
                    <span key={g} className="inline-flex items-center gap-1.5" style={{ opacity: counts[g] ? 1 : .5 }}>
                        <i className="rounded-sm flex-none" style={{ width: 9, height: 9, background: gradeColor(g).bar }} />
                        {g} <b style={{ color: 'var(--ib-ink)' }}>{counts[g] || 0}</b>{unit}
                    </span>
                ))}
            </div>
        </div>
    );
};

/** 등급 알약 */
export const GradeChip = ({ g }) => {
    if (!g) return <span style={{ color: 'var(--ib-ink4)' }}>—</span>;
    const c = gradeColor(g);
    return (
        <span className="inline-flex items-center gap-1 rounded-full whitespace-nowrap"
            style={{ padding: '3px 9px', fontSize: 'calc(var(--ib-lbl)*.92)', fontWeight: 800, background: c.bg, color: c.text }}>
            <i className="rounded-sm" style={{ width: 6, height: 6, background: c.bar }} />{g}
        </span>
    );
};

/* ── 랭킹 막대 ── 이름이 긴 협력업체는 세로 막대보다 가로 막대가 빨리 읽힌다
   P9 r9 (차장 피드백 09-02) — **막대 높이를 두 배로.** r8 까지 14px 이라 막대 안에
   앉은 「164건」이 위아래로 잘려 나갔다. 이제 높이는 CSS 변수 --ib-rankbar 가 정하고
   데스크톱 28px · TV 는 화면 높이를 따라가는 clamp 다(styles/inbound.css).
   글자는 막대 안에서 세로 가운데 정렬이고 막대보다 커질 수 없다 —
   `font-size: min(계산값, 막대높이×0.62)` 로 한 번 더 잠가 둔다. */
const MEDAL = ['#c8a227', '#94a3b8', '#a97142'];
export const RankBar = ({ rows, valueKey = 'count', valueUnit = '건', rightOf, onPick, nameWidth = 190 }) => {
    const rm = useReducedMotion();
    const [on, setOn] = useState(rm);
    useEffect(() => { const t = setTimeout(() => setOn(true), 40); return () => clearTimeout(t); }, []);
    const mx = Math.max(...(rows || []).map((r) => Number(r[valueKey]) || 0), 1);
    return (
        /* ib-rank : 「대시보드」 격자 안에서는 줄들이 카드 높이를 고르게 나눠 갖는다 */
        <div className="ib-rank">
            {(rows || []).map((r, i) => {
                const w = (Number(r[valueKey]) || 0) / mx * 100;
                const right = rightOf ? rightOf(r) : null;
                const Tag = onPick ? 'button' : 'div';
                return (
                    <Tag key={r.key || r.name || i} type={onPick ? 'button' : undefined}
                        onClick={onPick ? () => onPick(r) : undefined}
                        className={`ib-rankrow w-full flex items-center gap-3 text-left ${onPick ? 'cursor-pointer' : ''}`}>
                        <span className="flex items-center justify-center rounded-full flex-none"
                            style={{
                                width: 24, height: 24, fontSize: 'calc(var(--ib-lbl)*.95)', fontWeight: 800,
                                background: i < 3 ? MEDAL[i] : 'var(--ib-track)', color: i < 3 ? '#fff' : 'var(--ib-ink3)',
                            }}>{i + 1}</span>
                        <span className="min-w-0 flex-none truncate" style={{ width: nameWidth, fontSize: 'var(--ib-lbl)', fontWeight: 700, color: 'var(--ib-ink)' }} title={r.name}>{r.name}</span>
                        <span className="ib-rankbar relative flex-1 min-w-0 rounded-full overflow-hidden">
                            <i className="absolute inset-y-0 left-0 rounded-full block"
                                style={{
                                    width: `${on ? w.toFixed(2) : 0}%`,
                                    background: 'linear-gradient(90deg, var(--ib-pri), rgba(14,165,233,.55))',
                                    transition: rm ? 'none' : `width .85s cubic-bezier(.22,1,.36,1) ${i * 0.06}s`,
                                }} />
                            <span className="ib-rankval absolute inset-y-0 left-3 flex items-center tabular-nums">
                                {fmt(r[valueKey])}{valueUnit}
                            </span>
                        </span>
                        {right && <span className="flex-none text-right tabular-nums" style={{ minWidth: 90, fontSize: 'var(--ib-lbl)', fontWeight: 800 }}>{right}</span>}
                    </Tag>
                );
            })}
        </div>
    );
};

/* ── 누적 띠(품목유형 구성) ───────────────────────────────────────────────── */
export const SERIES_COLORS = ['var(--ib-pri)', 'var(--ib-ok2)', 'var(--ib-warn2)', 'var(--ib-pri3)', '#a78bfa', '#94a3b8'];
export const StackStrip = ({ rows, valueKey = 'count', colors = SERIES_COLORS, height = 24 }) => {
    const tot = (rows || []).reduce((a, r) => a + (Number(r[valueKey]) || 0), 0) || 1;
    return (
        <div className="flex w-full overflow-hidden rounded-lg gap-0.5" style={{ height, background: 'var(--ib-track)' }}>
            {(rows || []).map((r, i) => (
                <i key={r.key || r.name || i} title={`${r.name} ${fmt(r[valueKey])}`} className="block not-italic"
                    style={{ flex: Math.max(Number(r[valueKey]) || 0, 0.0001), background: colors[i % colors.length] }} />
            ))}
        </div>
    );
};

/** 범례 한 줄 (이름 / 값 / 보조값) */
export const LegendRow = ({ color, name, value, extra, tone }) => (
    <li className="flex items-center gap-2.5" style={{ padding: '5px 0', borderBottom: '1px solid var(--ib-grid)' }}>
        <i className="rounded-sm flex-none" style={{ width: 10, height: 10, background: color }} />
        <span className="flex-1 min-w-0 truncate" style={{ color: 'var(--ib-ink2)', fontWeight: 600 }}>{name}</span>
        <span className="tabular-nums" style={{ fontWeight: 800, color: 'var(--ib-ink)' }}>{value}</span>
        {extra !== undefined && extra !== null && (
            /* P9 r9 : 보조값이 「51,418 EA 0.31% · 3,073 PPM」처럼 한 줄로 길어졌다.
               78px 로는 줄이 접혀 카드가 두 배로 높아진다 — 자리를 미리 잡아 둔다. */
            <span className="tabular-nums text-right flex-none" style={{ minWidth: 150, color: tone || 'var(--ib-ink4)' }}>{extra}</span>
        )}
    </li>
);

/* ── 작은 컨트롤 ──────────────────────────────────────────────────────────── */
export const Chip = ({ on, children, ...rest }) => (
    <button type="button"
        className="rounded-full transition-colors"
        style={{
            padding: '6px 13px', fontSize: 'var(--ib-lbl)', fontWeight: 600,
            border: on ? '1px solid transparent' : '1px solid rgba(15,23,42,.12)',
            background: on ? 'linear-gradient(135deg, var(--ib-pri), var(--ib-pri2))' : 'rgba(255,255,255,.6)',
            color: on ? '#fff' : 'var(--ib-ink2)',
            boxShadow: on ? '0 3px 10px rgba(2,132,199,.32)' : 'none',
        }}
        {...rest}>{children}</button>
);

export const Segmented = ({ items, value, onChange, ariaLabel }) => (
    <div role="group" aria-label={ariaLabel} className="inline-flex overflow-hidden"
        style={{ borderRadius: 11, border: '1px solid rgba(15,23,42,.12)', background: 'rgba(255,255,255,.6)' }}>
        {items.map((it, i) => {
            const on = it.key === value;
            return (
                <button key={it.key} type="button" onClick={() => onChange(it.key)}
                    aria-pressed={on}
                    style={{
                        padding: '6px 14px', fontSize: 'var(--ib-lbl)', fontWeight: 600,
                        borderLeft: i === 0 ? '0' : '1px solid rgba(15,23,42,.09)',
                        background: on ? 'var(--ib-ink)' : 'transparent',
                        color: on ? '#fff' : 'var(--ib-ink2)',
                    }}>{it.label}</button>
            );
        })}
    </div>
);

export const GhostButton = ({ children, ...rest }) => (
    <button type="button"
        className="inline-flex items-center gap-1.5 rounded-full transition-colors"
        style={{
            padding: '7px 14px', fontSize: 'var(--ib-lbl)', fontWeight: 700, color: 'var(--ib-ink)',
            background: 'var(--ib-card)', border: '1px solid var(--ib-cardline)',
            boxShadow: 'var(--ib-shadow), 0 0 0 1px var(--ib-ring)',
            WebkitBackdropFilter: 'blur(12px)', backdropFilter: 'blur(12px)',
        }}
        {...rest}>{children}</button>
);

/* ═════════════════════════════════════════════════════════════════════════════
   P15 r15 — 공용 쪽넘김 (차장 확정 09-09)

   r14 까지 쪽넘김은 InboundItems.jsx 안에만 있었고 한 쪽이 **20줄**이었다. 표 넷이
   한 화면에 서게 되면서(품목 검색 · 측정치 검색 · 부적합 검색 · 협력업체 현황)
   20줄짜리 표는 화면 하나를 통째로 먹는다. 그래서 **한 쪽 10줄**로 줄이고, 조각을
   여기로 올려 네 표가 **같은 것**을 쓰게 했다 — 표마다 쪽넘김이 다르게 생기면
   같은 화면으로 안 읽힌다.

     [ 3,331건 중 1–10 ]                       ‹  1 2 3 … 34  ›

   · 쪽 번호는 **저장하지 않는다.** 다시 열면 늘 1쪽이다 — 어제 보던 17쪽이 오늘
     떠 있으면 그게 어디인지 아무도 모른다. (기간·정렬·검색은 저장한다. 그건 뜻이 있다.)
   · 검색어나 정렬이 바뀌면 1쪽으로 되돌린다(usePaged). 3쪽을 보다 검색하면 결과가
     두 쪽뿐일 수 있고, 그때 빈 화면이 뜨면 「찾은 게 없다」로 잘못 읽힌다.
   ═════════════════════════════════════════════════════════════════════════════ */

/** 한 쪽에 담는 줄 수. 네 표가 전부 이 값을 쓴다. */
export const PAGE_ROWS = 10;

/** 번호를 다 그리면 30쪽짜리 표에서 줄이 두 줄이 된다. 앞뒤 2쪽과 처음·끝만 그린다. */
export const pageList = (cur, last) => {
    const out = [];
    for (let i = 1; i <= last; i += 1) {
        if (i === 1 || i === last || Math.abs(i - cur) <= 2) out.push(i);
        else if (out[out.length - 1] !== '…') out.push('…');
    }
    return out;
};

/**
 * 쪽넘김 한 줄. 표 아래(카드 안)에 붙인다.
 * @param {number} page 지금 쪽 (1부터) · @param {number} last 마지막 쪽
 * @param {(p:number)=>void} onGo · @param {number} from,to,total 「N건 중 a–b」
 */
export const Pager = ({ page, last, onGo, from, to, total, unit = '건' }) => {
    const line = { padding: '10px var(--ib-pad)', borderTop: '1px solid var(--ib-grid)' };
    const cnt = { fontSize: 'calc(var(--ib-lbl)*.95)', color: 'var(--ib-ink4)' };
    if (last <= 1) {
        return (
            <div style={line}>
                <span className="tabular-nums" style={cnt}>{fmt(total)}{unit} 전부</span>
            </div>
        );
    }
    const btn = (on) => ({
        minWidth: 30, padding: '5px 9px', borderRadius: 8, fontSize: 'var(--ib-lbl)', fontWeight: on ? 800 : 600,
        background: on ? 'var(--ib-ink)' : 'var(--ib-chip)', color: on ? '#fff' : 'var(--ib-ink2)',
    });
    return (
        <div className="flex flex-wrap items-center gap-2" style={line}>
            <span className="tabular-nums" style={cnt}>
                {fmt(total)}{unit} 중 {fmt(from)}–{fmt(to)}
            </span>
            <span className="flex-1" />
            <button type="button" onClick={() => onGo(page - 1)} disabled={page <= 1} aria-label="이전 쪽"
                style={{ ...btn(false), opacity: page <= 1 ? .45 : 1 }}>‹</button>
            {pageList(page, last).map((p, i) => (
                p === '…'
                    ? <span key={`d${i}`} style={{ color: 'var(--ib-ink4)', padding: '0 2px' }}>…</span>
                    : <button key={p} type="button" onClick={() => onGo(p)} aria-current={p === page ? 'page' : undefined}
                        className="tabular-nums" style={btn(p === page)}>{p}</button>
            ))}
            <button type="button" onClick={() => onGo(page + 1)} disabled={page >= last} aria-label="다음 쪽"
                style={{ ...btn(false), opacity: page >= last ? .45 : 1 }}>›</button>
        </div>
    );
};

/**
 * 검색어 + 쪽넘김 한 벌. 검색어(q)나 목록(list)이 바뀌면 1쪽으로 되돌린다.
 * 검색이 없는 표는 q·matches 를 안 넘기면 된다(정렬만으로도 1쪽으로 돌아간다).
 * @param {Array} list 원본 줄들 · @param {string} q 검색어 · @param {(x,s)=>boolean} matches
 */
export function usePaged(list, q, matches) {
    const [page, setPage] = useState(1);
    const src = list || [];
    const hits = useMemo(() => {
        const s = String(q || '').trim().toLowerCase();
        if (s === '' || typeof matches !== 'function') return src;
        return src.filter((x) => matches(x, s));
    }, [src, q]);   // eslint-disable-line react-hooks/exhaustive-deps
    const last = Math.max(1, Math.ceil(hits.length / PAGE_ROWS));
    const cur = Math.min(page, last);
    useEffect(() => { setPage(1); }, [q, list]);
    const from = hits.length === 0 ? 0 : (cur - 1) * PAGE_ROWS + 1;
    const to = Math.min(cur * PAGE_ROWS, hits.length);
    return {
        hits, page: cur, last, from, to,
        rows: hits.slice((cur - 1) * PAGE_ROWS, cur * PAGE_ROWS),
        go: (p) => setPage(Math.max(1, Math.min(last, p))),
    };
}

/* ── 화면 뼈대 ────────────────────────────────────────────────────────────── */

/**
 * 화면 뿌리. tv=true 면 .inbound-tv 가 붙어 화면 전체를 덮는 다크 현황판이 된다.
 * fill=true (P5 r5, 「대시보드」 전용) 면 높이를 화면 한 장으로 고정한다 —
 * styles/inbound.css 의 .ib-fill 참고. 나머지 3화면은 fill 을 주지 않으므로 예전 그대로다.
 */
export const ScreenFrame = ({ tv, fill, children, className = '' }) => (
    <ThemeCtx.Provider value={tv ? PALETTE.dark : PALETTE.light}>
        <div className={`inbound-screen ${tv ? 'inbound-tv' : ''} ${fill ? 'ib-fill' : ''} ${className}`}>
            <AuroraBg />
            <div className={`relative ${fill ? 'ib-fillbody' : ''}`}
                style={{ zIndex: 1, padding: tv ? (fill ? '16px 26px 20px' : '30px 34px 34px') : '0' }}>{children}</div>
        </div>
    </ThemeCtx.Provider>
);

/**
 * 화면 머리 — 눈썹줄(살아있음 점) · 제목 · 한 줄 설명 · 오른쪽 버튼들
 * compact (P5 r5, 「대시보드」 전용) 는 위아래 여백과 제목 크기를 줄인다 —
 * 한 화면에 영역 본문까지 넣어야 하므로 머리가 세로를 덜 먹어야 한다.
 */
export const ScreenHeader = ({ eyebrow, title, meta, right, live, compact }) => (
    <div className="ib-fade flex flex-wrap items-start justify-between gap-4 flex-none"
        style={{ marginBottom: compact ? 9 : 18, animationDelay: '.02s' }}>
        <div className="flex-1 min-w-0" style={{ minWidth: 300 }}>
            <div className="flex items-center gap-2"
                style={{ fontSize: 'calc(var(--ib-lbl)*.95)', fontWeight: 700, letterSpacing: '.08em', color: 'var(--ib-pri)' }}>
                {live && <span className="ib-dot" />}{eyebrow}
            </div>
            <h1 style={{
                margin: compact ? '3px 0 0' : '6px 0 0',
                fontSize: `calc(var(--ib-kpi) * ${compact ? 0.66 : 0.78})`,
                fontWeight: 800, letterSpacing: '-.03em', lineHeight: 1.1, color: 'var(--ib-ink)',
            }}>{title}</h1>
            {meta && (
                <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1"
                    style={{ marginTop: compact ? 4 : 7, fontSize: 'calc(var(--ib-lbl)*.95)', color: 'var(--ib-ink3)' }}>{meta}</div>
            )}
        </div>
        {right && <div className="flex items-center gap-2 flex-none">{right}</div>}
    </div>
);

/** 불러오는 중 / 실패 — 화면 넷이 같은 모양을 쓴다 */
export const Loading = ({ t }) => (
    <div style={{ padding: '48px 8px', color: 'var(--ib-ink4)', fontSize: 'var(--ib-ttl)' }}>{t}</div>
);
export const ErrorCard = ({ msg, onRetry }) => (
    <Card>
        <div className="flex items-center gap-2" style={{ fontWeight: 800, color: 'var(--ib-ink)', marginBottom: 8 }}>
            <span style={{ color: 'var(--ib-bad)' }}>⚠</span>불러오지 못했다
        </div>
        <p style={{ fontSize: 'var(--ib-lbl)', color: 'var(--ib-ink3)' }}>{msg}</p>
        {onRetry && (
            <button type="button" onClick={onRetry} className="mt-4 rounded-lg"
                style={{ padding: '7px 14px', background: 'var(--ib-ink)', color: '#fff', fontSize: 'var(--ib-lbl)', fontWeight: 700 }}>
                다시 시도
            </button>
        )}
    </Card>
);
export const Empty = ({ t }) => (
    <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 'var(--ib-lbl)', color: 'var(--ib-ink4)' }}>{t}</div>
);

/* ── Recharts 툴팁 공통 껍데기 ────────────────────────────────────────────── */
export const TooltipBox = ({ title, rows }) => (
    <div className="rounded-xl" style={{
        background: 'var(--ib-card)', border: '1px solid var(--ib-cardline)', boxShadow: 'var(--ib-shadow)',
        padding: '9px 12px', fontSize: 'var(--ib-lbl)', color: 'var(--ib-ink2)',
        WebkitBackdropFilter: 'blur(12px)', backdropFilter: 'blur(12px)',
    }}>
        <div style={{ fontWeight: 800, color: 'var(--ib-ink)', marginBottom: 4 }}>{title}</div>
        {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
                <i className="rounded-sm" style={{ width: 8, height: 8, background: r.color }} />
                <span className="flex-1">{r.name}</span>
                <b className="tabular-nums" style={{ color: 'var(--ib-ink)' }}>{r.value}</b>
            </div>
        ))}
    </div>
);

/** localStorage 를 안전하게 쓰는 훅 — 사설 모드·차단 설정에서 던지므로 전부 감싼다 */
export function useStickyFlag(key, initial) {
    const [v, setV] = useState(() => {
        try {
            const raw = window.localStorage.getItem(key);
            return raw === null ? initial : raw === '1';
        } catch (e) { return initial; }
    });
    const set = useCallback((next) => {
        setV(next);
        try { window.localStorage.setItem(key, next ? '1' : '0'); } catch (e) { /* 저장 못 해도 화면은 돌아간다 */ }
    }, [key]);
    return [v, set];
}

/** localStorage 에 숫자 하나를 남기는 훅 (자동 순환 간격 등). 못 써도 화면은 돈다. */
export function useStickyNumber(key, initial, min, max) {
    const clamp = useCallback((n) => {
        const x = Number(n);
        if (!Number.isFinite(x)) return initial;
        return Math.min(max === undefined ? Infinity : max, Math.max(min === undefined ? -Infinity : min, Math.round(x)));
    }, [initial, min, max]);
    const [v, setV] = useState(() => {
        try {
            const raw = window.localStorage.getItem(key);
            return raw === null ? initial : clamp(raw);
        } catch (e) { return initial; }
    });
    const set = useCallback((next) => {
        const c = clamp(next);
        setV(c);
        try { window.localStorage.setItem(key, String(c)); } catch (e) { /* 저장 못 해도 화면은 돌아간다 */ }
    }, [key, clamp]);
    return [v, set];
}

/** localStorage 에 문자열 하나(선택된 영역 등). Dashboard.jsx 의 해시 라우팅을 건드리지 않으려고 쓴다. */
export function useStickyString(key, initial, allowed) {
    const [v, setV] = useState(() => {
        try {
            const raw = window.localStorage.getItem(key);
            if (raw === null) return initial;
            return (!allowed || allowed.indexOf(raw) >= 0) ? raw : initial;
        } catch (e) { return initial; }
    });
    const set = useCallback((next) => {
        setV(next);
        try { window.localStorage.setItem(key, String(next)); } catch (e) { /* 무시 */ }
    }, [key]);
    return [v, set];
}

/* ═════════════════════════════════════════════════════════════════════════════
   P5 r5 — 「대시보드」 영역 조작부  (P6 r6 에서 영역이 4 → 5개가 됐다.
   조각들은 개수를 상수로 갖고 있지 않다 — 화면이 넘겨주는 배열/숫자만 쓴다.)
   ═════════════════════════════════════════════════════════════════════════════ */

/**
 * 영역 세그먼트 바. tablist 로 읽히게 role 을 준다 —
 * 화살표 키 처리는 화면(InboundOverview)이 한 군데서 맡는다(TV 순환과 같은 함수라서다).
 */
export const AreaBar = ({ items, value, onPick, right, ariaLabel, idPrefix = 'ib' }) => (
    <div className="ib-areabar ib-fade" role="tablist" aria-label={ariaLabel || '대시보드 영역'} style={{ animationDelay: '.03s' }}>
        {items.map((it) => (
            <button key={it.key} type="button" role="tab" id={`${idPrefix}-tab-${it.key}`}
                aria-selected={it.key === value} aria-controls={`${idPrefix}-panel-${it.key}`}
                tabIndex={it.key === value ? 0 : -1}
                onClick={() => onPick(it.key)}>{it.label}</button>
        ))}
        <span className="flex-1" />
        {right}
    </div>
);

/** TV 현황판 좌/우 화살표 (반투명, 늘 보인다) */
export const TvArrow = ({ side, onClick }) => (
    <button type="button" className={`ib-tvarrow ${side}`} onClick={onClick}
        aria-label={side === 'l' ? '이전 영역' : '다음 영역'}>{side === 'l' ? '‹' : '›'}</button>
);

/** 진행 점 — 영역 수만큼 (P6 r6 부터 5개) */
export const Dots = ({ n, active, onPick }) => (
    <span className="ib-dots" role="presentation">
        {Array.from({ length: n }, (_, i) => (
            onPick
                ? <button key={i} type="button" onClick={() => onPick(i)} aria-label={`${i + 1}번째 영역`}
                    style={{ padding: 0, border: 0, background: 'transparent', lineHeight: 0 }}>
                    <i className={i === active ? 'on' : ''} />
                </button>
                : <i key={i} className={i === active ? 'on' : ''} />
        ))}
    </span>
);

/** 남은 시간 진행선 (0~1). prefers-reduced-motion 이면 전환을 끈다. */
export const ProgressLine = ({ p }) => {
    const rm = useReducedMotion();
    return (
        <div className="ib-progress" aria-hidden="true">
            <i style={{ width: `${Math.max(0, Math.min(1, p || 0)) * 100}%`, transition: rm ? 'none' : 'width .25s linear' }} />
        </div>
    );
};

/* ═════════════════════════════════════════════════════════════════════════════
   P13 r13 — TV 현황판 「시작 계획」 (차장 승인 09-03)

   r12 까지는 간격 칸이 **하나**였다. 다섯 영역을 다 돌되 전부 같은 초였다.
   현장에서 나온 말은 둘이다 —
     · 「공정능력은 하루에 한 번 보면 되는데 10초씩 잡아먹는다」 → **화면을 고르고 싶다**
     · 「오늘 현황은 좀 더 오래 띄워 달라」                      → **화면마다 초가 다르다**
   그래서 값이 숫자 하나에서 **계획**으로 바뀌었다.

     계획 = [{ key, on, sec } × 5]   — 차례는 영역 차례 그대로다(오늘 현황이 맨 앞).

   규칙은 셋뿐이다.
     · 켠 화면이 2개 이상 → 켠 것만 **차례대로** 돈다. 화면마다 제 초를 지킨다.
     · 켠 화면이 딱 1개   → **고정 화면**이다. 돌지 않으니 초 칸은 회색으로 잠근다.
     · 0개                 → 「시작」이 잠긴다. 아무것도 안 뜨는 현황판은 현황판이 아니다.

   저장은 localStorage `inbound_tv_plan` 한 열쇠다. 예전 열쇠 `inbound_tv_interval` 은
   **읽기만** 한다 — 계획이 없을 때 그 값을 다섯 줄에 그대로 옮겨 첫 화면을 만든다.
   지우지 않는다: r12 로 되돌린 앱이 그 값을 도로 써야 하기 때문이다.
   ═════════════════════════════════════════════════════════════════════════════ */

export const TV_SEC_MIN = 3;
export const TV_SEC_MAX = 600;
export const TV_SEC_DEFAULT = 10;

/**
 * 저장값을 화면이 쓸 모양으로 손질한다.
 *   · 모르는 key 는 버린다(예전 판·손댄 값이 들어와도 화면이 깨지지 않는다).
 *   · 빠진 영역은 「켬 · 기본 초」로 채운다 — 영역이 늘어난 판으로 올라가도 그대로 돈다.
 *   · 초는 언제나 min~max 안의 정수다.
 * 돌려주는 배열의 차례는 **언제나 areaKeys 차례**다. TV 순환 차례가 곧 이 차례다.
 */
export function normalizeTvPlan(raw, areaKeys, opt) {
    const min = (opt && opt.min) || TV_SEC_MIN;
    const max = (opt && opt.max) || TV_SEC_MAX;
    const def = (opt && opt.def) || TV_SEC_DEFAULT;
    const clampSec = (n) => {
        const x = Math.round(Number(n));
        if (!Number.isFinite(x)) return def;
        return Math.min(max, Math.max(min, x));
    };
    const by = {};
    if (raw && Array.isArray(raw.areas)) {
        raw.areas.forEach((a) => { if (a && typeof a.key === 'string' && !(a.key in by)) by[a.key] = a; });
    }
    return (areaKeys || []).map((k) => {
        const a = by[k];
        return { key: k, on: a ? a.on !== false : true, sec: a ? clampSec(a.sec) : def };
    });
}

/**
 * P15 r15 — 계획에 붙은 **기준일**. 'YYYY-MM-DD' 이거나 '' (비면 자동 규칙)이다.
 * 자동 규칙은 lib/inboundStats.js 의 autoAsOf() 다 — 오늘 검사가 0건이면
 * 가장 최근 검사일로 옮기고, 옮겼다는 사실을 화면에 적는다.
 */
export function tvPlanAsOf(raw) {
    const v = raw && raw.asOf;
    const s = String(v === null || v === undefined ? '' : v).trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

/** 켠 화면들의 key 배열 (차례 그대로) */
export const tvPlanKeys = (plan) => (plan || []).filter((a) => a && a.on).map((a) => a.key);
/** 한 바퀴 초 — 켠 화면들의 초 합계 */
export const tvPlanLoop = (plan) => (plan || []).reduce((a, b) => a + (b && b.on ? Number(b.sec) || 0 : 0), 0);
/** 지금 화면이 머무를 초. 계획에 없으면 기본값이다. */
export const tvSecOf = (plan, key) => {
    const a = (plan || []).find((x) => x && x.key === key);
    return a && Number.isFinite(Number(a.sec)) ? Number(a.sec) : TV_SEC_DEFAULT;
};

/**
 * TV 계획을 localStorage 에 남기는 훅.
 * opt.legacyKey 를 주면 계획이 없을 때 그 열쇠(옛 간격 한 개)를 다섯 줄에 옮긴다 —
 * **옛 열쇠는 읽기만 하고 건드리지 않는다.**
 */
export function useTvPlan(key, areaKeys, opt) {
    const keySig = (areaKeys || []).join('|');
    const legacyKey = opt && opt.legacyKey;
    const min = (opt && opt.min) || TV_SEC_MIN;
    const max = (opt && opt.max) || TV_SEC_MAX;
    const def = (opt && opt.def) || TV_SEC_DEFAULT;
    const [v, setV] = useState(() => {
        let raw = null;
        try {
            const s = window.localStorage.getItem(key);
            if (s) raw = JSON.parse(s);
        } catch (e) { raw = null; }
        if (!raw && legacyKey) {
            let iv = null;
            try { iv = window.localStorage.getItem(legacyKey); } catch (e) { iv = null; }
            if (iv !== null && iv !== '' && Number.isFinite(Number(iv))) {
                raw = { areas: (areaKeys || []).map((k) => ({ key: k, on: true, sec: Number(iv) })) };
            }
        }
        return { areas: normalizeTvPlan(raw, areaKeys, { min, max, def }), asOf: tvPlanAsOf(raw) };
    });
    /* P15 r15 : set(계획, 기준일). 기준일을 안 넘기면 '' 다(= 자동 규칙). */
    const set = useCallback((next, nextAsOf) => {
        const p = normalizeTvPlan({ areas: next }, keySig ? keySig.split('|') : [], { min, max, def });
        const a = tvPlanAsOf({ asOf: nextAsOf });
        setV({ areas: p, asOf: a });
        try { window.localStorage.setItem(key, JSON.stringify({ areas: p, asOf: a })); } catch (e) { /* 저장 못 해도 화면은 돈다 */ }
    }, [key, keySig, min, max, def]);
    /* 셋째 칸(기준일)은 r15 에서 늘었다 — [plan, set] 만 받던 예전 호출도 그대로 돈다. */
    return [v.areas, set, v.asOf];
}

/**
 * TV 현황판 시작 팝오버. 「TV 현황판」을 누르면 먼저 이게 뜬다 —
 * 켜 놓고 나서 계획을 못 바꾸면 사다리를 놓고 TV 앞으로 가야 하기 때문이다.
 * 줄 하나가 화면 하나다: [체크] [이름] [초] 초.
 */
export const TvStartDialog = ({ areas, plan, asOf, autoAsOfDay, min = TV_SEC_MIN, max = TV_SEC_MAX, def = TV_SEC_DEFAULT, onStart, onCancel }) => {
    const list = areas || [];
    const build = useCallback((p) => list.map((a) => {
        const r = (p || []).find((x) => x && x.key === a.key);
        return { key: a.key, label: a.label, on: r ? r.on !== false : true, sec: String(r ? r.sec : def) };
    }), [list, def]);
    const [rows, setRows] = useState(() => build(plan));
    /* P15 r15 — 「오늘 현황」의 기준일. 비우면 자동 규칙이다(오늘 0건이면 최근 검사일). */
    const [day, setDay] = useState(() => String(asOf || ''));
    const ref = useRef(null);
    useEffect(() => { if (ref.current) ref.current.focus(); }, []);

    const secOk = (s) => {
        const n = Number(s);
        return Number.isFinite(n) && Math.round(n) >= min && Math.round(n) <= max && String(s).trim() !== '';
    };
    const on = rows.filter((r) => r.on);
    const nOn = on.length;
    const fixed = nOn === 1;
    /* 고정 화면은 돌지 않으니 그 줄의 초는 따지지 않는다 — 잠긴 칸이 「시작」을 막으면 이상하다. */
    const badRows = fixed ? [] : on.filter((r) => !secOk(r.sec));
    const canStart = nOn >= 1 && badRows.length === 0;
    const loop = on.reduce((a, r) => a + (secOk(r.sec) ? Math.round(Number(r.sec)) : 0), 0);

    const setRow = (k, patch) => setRows((rs) => rs.map((r) => (r.key === k ? { ...r, ...patch } : r)));
    const allOn = () => setRows((rs) => rs.map((r) => ({ ...r, on: true })));
    const reset = () => { setRows((rs) => rs.map((r) => ({ ...r, on: true, sec: String(def) }))); setDay(''); };

    const submit = (e) => {
        if (e) e.preventDefault();
        if (!canStart) return;
        onStart(rows.map((r) => ({
            key: r.key,
            on: !!r.on,
            sec: secOk(r.sec) ? Math.round(Number(r.sec)) : def,
        })), day);
    };

    const foot = nOn === 0
        ? '최소 1개 선택'
        : (fixed ? `고정 · ${on[0].label}` : `선택 ${nOn}개 · 한 바퀴 ${loop}초`);

    return (
        <div className="ib-modalwrap" role="presentation"
            onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
            <form className="ib-modal ib-modal-tv" role="dialog" aria-modal="true" aria-label="TV 현황판 시작"
                onSubmit={submit}
                onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onCancel(); } }}>
                <b style={{ fontSize: 15, fontWeight: 800, display: 'block' }}>TV 현황판 시작</b>
                <p style={{ marginTop: 6, fontSize: 11.5, lineHeight: 1.55, color: '#64748b' }}>
                    띄울 화면을 고르고 머무를 시간을 정한다. 하나만 고르면 그 화면만 계속 띄운다.
                </p>

                <div className="ib-tvplan" data-ib="tvplan">
                    {rows.map((r, i) => {
                        const off = !r.on;
                        const lock = off || fixed;                 /* 고정 화면이면 초 칸도 잠근다 */
                        const bad = !off && !fixed && !secOk(r.sec);
                        return (
                            <div key={r.key} className={`ib-tvrow${off ? ' off' : ''}`} data-ib-row={r.key}>
                                <input id={`ib-tvon-${r.key}`} ref={i === 0 ? ref : null} type="checkbox"
                                    checked={!!r.on} aria-label={`${r.label} 사용`}
                                    onChange={(e) => setRow(r.key, { on: e.target.checked })} />
                                <label className="ib-tvname" htmlFor={`ib-tvon-${r.key}`}>{r.label}</label>
                                <input type="number" inputMode="numeric" min={min} max={max} step="1"
                                    className={`ib-tvsec tabular-nums${bad ? ' bad' : ''}`}
                                    aria-label={`${r.label} 표시 시간(초)`} disabled={lock}
                                    value={r.sec} onChange={(e) => setRow(r.key, { sec: e.target.value })} />
                                <span className="ib-tvunit">초</span>
                            </div>
                        );
                    })}
                </div>

                {/* P15 r15 — 기준일. 벽걸이 TV 는 사다리를 놓지 않으면 못 고치므로 여기서 정한다.
                    비워 두면 자동이다 : 오늘 검사가 0건이면 **가장 최근 검사일**로 옮기고,
                    옮겼다는 사실을 화면에 적는다(「09-08 기준 · 오늘 자료 없음」). */}
                <div className="flex flex-wrap items-center gap-2" style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(15,23,42,.10)' }}>
                    <label htmlFor="ib-tvasof" style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>기준일</label>
                    <input id="ib-tvasof" type="date" className="tabular-nums" value={day}
                        onChange={(e) => setDay(e.target.value)} aria-label="오늘 현황 기준일"
                        style={{ padding: '5px 8px', borderRadius: 8, border: '1px solid rgba(15,23,42,.16)', fontSize: 12, fontFamily: 'inherit', color: '#0f172a' }} />
                    <button type="button" className="ib-tvmini" onClick={() => setDay('')} disabled={!day}
                        style={day ? undefined : { opacity: .45 }}>비우기</button>
                    <span style={{ fontSize: 11.5, color: '#64748b', lineHeight: 1.45 }}>
                        {day
                            ? '이 날짜로 고정된다'
                            : `자동 — 오늘 검사가 0건이면 최근 검사일${autoAsOfDay ? ` (지금은 ${autoAsOfDay})` : ''}`}
                    </span>
                </div>

                <div className="ib-tvfoot">
                    <span className={`ib-tvsum tabular-nums${canStart ? '' : ' warn'}`} data-ib="tvsum">{foot}</span>
                    <button type="button" className="ib-tvmini" onClick={allOn}>전체 선택</button>
                    <button type="button" className="ib-tvmini" onClick={reset}>기본값</button>
                </div>
                {badRows.length > 0 && (
                    <div style={{ marginTop: 8, fontSize: 11.5, color: '#be123c' }}>
                        {`${min} ~ ${max} 사이의 초 단위 값이어야 한다.`}
                    </div>
                )}

                <div className="flex items-center justify-end gap-2" style={{ marginTop: 14 }}>
                    <button type="button" onClick={onCancel} className="rounded-lg"
                        style={{ padding: '8px 14px', fontSize: 12.5, fontWeight: 700, color: '#475569', background: 'rgba(15,23,42,.06)' }}>취소</button>
                    <button type="submit" disabled={!canStart} className="rounded-lg"
                        style={{ padding: '8px 16px', fontSize: 12.5, fontWeight: 800, color: '#fff', background: canStart ? '#0f172a' : '#94a3b8' }}>시작</button>
                </div>
            </form>
        </div>
    );
};

/** 예전 이름. 다른 화면이 아직 부를 수 있어 남겨 둔다(속은 같은 조각이다). */
export const IntervalDialog = TvStartDialog;

export default {
    fmt, fx, pctText, GRADE_UI, GRADE_ORDER5, gradeColor, TONE, PALETTE, useInboundTheme,
    AuroraBg, Card, SectionTitle, StatusBadge, DeltaChip, Sparkline, KpiTile,
    sparkKeyLabel, GROUP_LABEL, groupLabel, MiniPpmBars,
    Ring, GaugeRing, GradeStrip, GradeChip, RankBar, StackStrip, LegendRow,
    Chip, Segmented, GhostButton, ScreenFrame, ScreenHeader, Loading, ErrorCard, Empty,
    TooltipBox, CountUp, useCountUp, useReducedMotion, useStickyFlag,
    useStickyNumber, useStickyString, AreaBar, TvArrow, Dots, ProgressLine, IntervalDialog,
    TvStartDialog, useTvPlan, normalizeTvPlan, tvPlanKeys, tvPlanLoop, tvSecOf, tvPlanAsOf,
    PAGE_ROWS, pageList, Pager, usePaged,
    TV_SEC_MIN, TV_SEC_MAX, TV_SEC_DEFAULT,
};
