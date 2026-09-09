/* ─────────────────────────────────────────────────────────────────────────────
   areas/A2Trend.jsx — 「대시보드」 영역 2 · 추이   (플랜 042 / P14 r14)

   r13 → r14 (차장 승인 09-04)
     · 네 그래프 모두 **2026-07-14 자리에 세로 점선 한 줄**을 긋는다.
       09-04 에 옛 기록(1/2~7/13)을 대장에 병합했다. 그 앞은 옛 시트(판정·수량만),
       그 뒤는 정본 시트(측정값 있음)라 **같은 방식으로 적힌 기록이 아니다**.
       선이 없으면 7월 앞뒤를 같은 자로 읽게 된다. 숫자는 한 글자도 안 바뀐다.
       그을 자리·날짜는 lib/inboundStats.js 의 changeIndexOf / RECORD_CHANGE_DATE 다.
       딱지 「기록 방식 변경 7/14」는 **그림칸 아래 여백 띠**에 앉는다 — 아래
       ChangeLabel 주석을 보라(막대·선·눈금 글자 어느 것과도 겹칠 수 없는 자리다).

   r12 → r13 (차장 승인 09-03)
     · 「기간 추이」의 **「최다 부적합 · YYYY-MM · N EA」 딱지가 막대 꼭대기와 겹치던 것**을
       고쳤다. 딱지를 그림칸 위 여백 띠로 올린다 — 아래 WorstLabel 주석을 보라.
       숫자·색·점 위치는 한 글자도 안 바뀐다. 옮긴 것은 글귀 자리뿐이다.

   승인 구성안 r0 의 .g2 격자 —  위 1줄(메인 차트, 폭 100%) + 아래 3칸.
     · 위      : 기간 추이 (막대=입고 수량 · 선=부적합 수량)
     · 아래 좌 : 불량률 추이   (선, 구간별 **PPM**)  ← r8 : 목표선 100 PPM 을 함께 긋는다.
     · 아래 중 : 판정 추이     (합격/불합격 누적막대) ← 도넛을 대신한다(종합현황 링과 겹쳐서)
     · 아래 우 : 협력업체 Top3 불량률 추이 (선 3개)  ← 상위 3사 = 이 기간 검사 건수 순.

   r7 → r8
     A. 「불량률 추이」의 축을 % → **PPM** 으로 바꿨다. 관리선(100 PPM)과 같은 자로 재야
        기준선이 뜻을 갖는다. 「관리선 미설정」 문구는 사라졌다.

   r8 → r9 (차장 피드백 09-02)
     · **모든 선은 꺾은선이다 (type="linear").** monotone 은 점 사이를 3차 곡선으로
       잇는다. 점이 셋뿐인 월별 구간에서는 그 곡선이 "있지도 않은 중간값"을 그려
       자료보다 부드러워 보인다 — 차장 표현으로 「가짜 같다」. 값과 값 사이에 우리가
       아는 것은 아무것도 없으므로 **직선으로 잇는다**. 이 규칙은 기간 추이 선 ·
       불량률 추이 · 협력업체 Top3 · 스파크라인까지 화면 전체에 같다
       (스파크라인은 원래부터 L 명령만 쓰는 꺾은선이다).

   네 차트 모두 **같은 묶음(일/월/년)** 을 쓴다. 묶음은 기간 필터가 정한다.
   차트 높이는 고정값이 아니라 칸을 채운다(ResponsiveContainer height="100%").
   ───────────────────────────────────────────────────────────────────────────── */
import React from 'react';
import {
    ResponsiveContainer, ComposedChart, BarChart, LineChart, Bar, Line, XAxis, YAxis,
    CartesianGrid, Tooltip, ReferenceDot, ReferenceLine, Legend,
    usePlotArea, useChartWidth, useChartHeight,
} from 'recharts';
import { Card, SectionTitle, Empty, TooltipBox, fmt, fx, pctText, useInboundTheme } from '../ui';
import { PPM_TARGET, fmtRate, RECORD_CHANGE_NOTE, changeIndexOf } from '../../../lib/inboundStats';

/** 묶음 단위별 X축 글자 — 일별 07-14 · 월별 26-07 · 년별 2026 */
export const bucketLabel = (key, group) => (group === 'year' ? key : group === 'month' ? key.slice(2) : key.slice(5));

const axisTick = (tv, C) => ({ fontSize: tv ? 16 : 11, fill: C.ink4 });

/* Recharts 3.x 의 ResponsiveContainer 는 첫 렌더에 컨테이너 크기를 -1 로 잡고
   "width(-1) and height(-1) …" 경고를 콘솔에 뱉는다. 크기를 flex 로 주는 칸에서는
   피할 수 없으므로 라이브러리가 마련해 둔 initialDimension 으로 첫 값을 1px 로 준다.
   바로 다음 프레임에 ResizeObserver 가 진짜 크기로 덮는다(그림은 그대로다). */
const INIT_DIM = { width: 1, height: 1 };

/* ── 「최다 부적합」 딱지 (P13 r13, 차장 승인 09-03) ──────────────────────────
   r12 까지 이 글귀는 ReferenceDot 의 position:'top' 라벨이었다 — 점 바로 위 몇 px 이다.
   최다 부적합 구간이 **키 큰 막대**와 같은 칸이면(그런 달이 흔하다 — 많이 들어온 달에
   많이 걸린다) 글자가 막대 꼭대기에 박혀 읽히지 않았다. 일별·월별 둘 다, TV·데스크톱
   둘 다 그랬다. 점을 옆으로 옮길 수는 없다 — 점이 곧 그 구간이다. 글자를 옆으로 밀어도
   글자폭이 막대보다 훨씬 넓어 옆 막대에 다시 걸린다.

   그래서 **글귀만** 그림칸(plot area) **위 여백 띠**로 올렸다. 막대·선·격자는 전부
   그림칸 안에서만 그려지므로 그 띠에는 아무것도 닿지 못한다 — 화면 크기(1080·911·768)와
   묶음(일별·월별)에 상관없이 겹칠 수가 없다. 여백은 위 margin.top 이 잡아 준다.
   가로 자리는 점을 따라가고, 양끝에서는 글자가 그림 밖으로 나가지 않게 안으로 물린다.
   점과 글자 사이에는 옅은 점선 한 줄을 내려 어느 점 이야기인지 잇는다. */
const glyphW = (s, size) => {
    let u = 0;
    for (const ch of String(s)) {
        const c = ch.codePointAt(0);
        u += c > 0x2e7f ? 1 : (ch === ' ' ? 0.3 : 0.56);   /* 한글 한 자 ≈ 1em · 숫자/기호 ≈ .56em */
    }
    return u * size;
};

const WorstLabel = ({ viewBox, text, size, color, r }) => {
    const plot = usePlotArea();
    const chartW = useChartWidth();
    if (!viewBox || !plot || !plot.width) return null;
    const cx = (viewBox.x || 0) + (viewBox.width || 0) / 2;
    const cy = (viewBox.y || 0) + (viewBox.height || 0) / 2;
    const W = chartW || (plot.x + plot.width);
    const w = glyphW(text, size);
    const pad = 3;
    /* 가로 : 될 수 있으면 **그림칸 안**에 머문다(그래야 y축 눈금 글자 위로 안 넘어간다).
       그림칸보다 넓으면 그림 전체 폭으로, 그것보다도 넓으면 왼쪽에 붙인다. */
    const inPlot = w + pad * 2 <= plot.width;
    let x, anchor;
    if (w + pad * 2 >= W) { x = pad; anchor = 'start'; }
    else {
        const lo = (inPlot ? plot.x : 0) + pad + w / 2;
        const hi = (inPlot ? plot.x + plot.width : W) - pad - w / 2;
        x = Math.min(hi, Math.max(lo, cx));
        anchor = 'middle';
    }
    /* 세로 : 글자 상자가 여백 띠 **안**에 통째로 들어가게 밑선을 잡는다.
       위로는 그림 밖(0)으로, 아래로는 그림칸(맨 위 눈금 글자 포함) 안으로 넘지 않는다. */
    const y = Math.max(size * 0.82 + 1, plot.y - Math.max(6, size * 0.62) - size * 0.22);
    const lineTop = y + size * 0.3;
    const lineBot = cy - (r || 0) - 2;
    return (
        <>
            {lineBot > lineTop + 4 && (
                <line x1={cx} y1={lineTop} x2={cx} y2={lineBot} stroke={color} strokeWidth="1"
                    strokeDasharray="3 4" opacity=".3" />
            )}
            <text className="recharts-label ib-worstlabel" data-ib="worst-label"
                x={x} y={y} textAnchor={anchor} fill={color} fontSize={size} fontWeight={700}>{text}</text>
        </>
    );
};

/* ── 「기록 방식 변경 7/14」 세로 점선 (P14 r14, 차장 승인 09-04) ────────────
   09-04 에 옛 기록(1/2~7/13)이 대장에 들어왔다. 7/13 까지는 옛 시트(판정·수량만),
   7/14 부터는 정본 시트(측정값 있음)다. 같은 표에 있지만 같은 방식으로 적힌 기록이
   아니므로 그 자리를 그림에 밝힌다 — **숫자는 하나도 바꾸지 않는다.**

   선은 recharts 의 ReferenceLine 이다. position="start" 를 주면 그 구간의 **왼쪽
   경계**에 선다(막대 한가운데를 가르지 않는다). 일별이면 7/14 칸 앞, 월별이면
   7월 칸 앞이다. 년별 묶음에서는 긋지 않는다 — 한 해 **안**에서 갈리므로 해와 해
   사이에 그을 자리가 없다(changeIndexOf 가 -1 을 준다).

   딱지는 **그림칸 아래 여백 띠**에 앉힌다. 막대·선·격자는 그림칸 안에서만,
   X축 눈금 글자는 그림칸과 아래 여백 **사이**에서만 그려지므로 그 띠에는 아무것도
   닿지 못한다 — 화면 크기·묶음과 상관없이 구조적으로 겹칠 수가 없다.
   (위 여백 띠는 「최다 부적합」 딱지(r13)가 이미 쓰고 있다. 둘을 한 띠에 넣으면
    최다 부적합 구간이 7월 근처일 때 서로 겹친다. 그래서 아래로 내렸다.)
   띠 높이만큼 그림칸이 낮아진다 — 선을 안 그을 때는 여백도 0 이다. */
const CHG_BAND = (tv) => (tv ? 26 : 17);

const ChangeLabel = ({ viewBox, text, size, color }) => {
    const W = useChartWidth();
    const H = useChartHeight();
    if (!viewBox || !W || !H) return null;
    const cx = (viewBox.x || 0) + (viewBox.width || 0) / 2;   /* 세로선의 x (width 는 0 이다) */
    const w = glyphW(text, size);
    const pad = 3;
    let x = pad, anchor = 'start';
    if (w + pad * 2 < W) {
        x = Math.min(W - pad - w / 2, Math.max(pad + w / 2, cx));
        anchor = 'middle';
    }
    /* 글자 상자가 아래 여백 띠 **안**에 통째로 들어가게 밑선을 잡는다.
       띠 높이 = 글자 크기 + 6 이므로 위아래로 숨통이 남는다. */
    return (
        <text className="recharts-label ib-changelabel" data-ib="change-label"
            x={x} y={H - 1 - size * 0.22} textAnchor={anchor} fill={color} fontSize={size} fontWeight={700}>{text}</text>
    );
};

/** 구간 목록 → 선을 그을 자리의 **X축 글자**. 그을 곳이 없으면 '' (선을 안 그린다).
    ※ 내보내지 않는다 — 이 파일 안에서만 쓰고, 내보내면 fast-refresh 경고가 는다. */
const changeMarkOf = (rows) => {
    const list = rows || [];
    const i = changeIndexOf(list.map((r) => r && r.key));
    return i < 0 ? '' : (list[i].label || '');
};

/** 세로 점선 한 줄. **차트의 직계 자식으로** 불러야 한다(recharts 가 자식으로 읽는다).
    yAxisId — **반드시 그 차트에 있는 Y축 id 여야 한다.** ReferenceLine 의 기본값은 0 인데,
    「기간 추이」처럼 Y축을 둘(`"l"` · `"r"`) 쓰는 차트에는 0번 축이 없다. 그러면 recharts 가
    축을 못 찾아 **아무것도 안 그리고 조용히 null 을 돌려준다** — 오류도 경고도 없다.
    첫 판(r14)이 여기서 걸려 네 그래프 중 「기간 추이」에만 선이 안 떴다(차장 실화면 09-04).
    Y축이 하나뿐인 차트는 id 가 기본 0 이라 넘기지 않아도 된다. */
const changeLine = (mark, tv, C, yAxisId) => (mark ? (
    <ReferenceLine x={mark} yAxisId={yAxisId === undefined ? 0 : yAxisId} position="start" stroke={C.ink3}
        strokeWidth={tv ? 2 : 1.3} strokeDasharray={tv ? '7 6' : '5 4'}
        label={<ChangeLabel text={RECORD_CHANGE_NOTE} size={tv ? 16 : 10.5} color={C.ink2} />} />
) : null);

/* ── 메인 : 기간 추이 (막대 = 입고 수량 · 선 = 부적합 수량) ─────────────────── */
const TrendChart = ({ data, tv }) => {
    const C = useInboundTheme();
    if (!data.length) return <Empty t="이 기간에는 그릴 구간이 없다" />;
    const worst = data.reduce((a, b) => (b.ngQty > a.ngQty ? b : a), data[0]);
    const chg = changeMarkOf(data);
    const Tip = ({ active, payload }) => {
        if (!active || !payload || !payload.length) return null;
        const d = payload[0].payload;
        return (
            <TooltipBox title={d.key} rows={[
                { color: C.pri2, name: '입고 수량', value: `${fmt(d.inQty)} EA` },
                { color: C.bad2, name: '부적합 수량', value: `${fmt(d.ngQty)} EA` },
                { color: C.ink4, name: '검사 건수', value: `${fmt(d.count)}건` },
                { color: C.ink4, name: '불량률', value: fmtRate(d.ngQty, d.inQty) },
            ]} />
        );
    };
    return (
        <ResponsiveContainer width="100%" height="100%" initialDimension={INIT_DIM}>
            {/* 위 여백은 「최다 부적합」 딱지가 앉을 띠다 (P13 r13) — 글자 높이 + 숨통.
                막대는 이 띠에 못 들어오므로 딱지가 막대 꼭대기와 겹칠 수 없다. */}
            <ComposedChart data={data} margin={{ top: tv ? 42 : 30, right: 8, left: 0, bottom: chg ? CHG_BAND(tv) : 0 }}>
                <defs>
                    <linearGradient id="ibTrendBar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={C.pri2} stopOpacity={0.95} />
                        <stop offset="100%" stopColor={C.pri2} stopOpacity={0.18} />
                    </linearGradient>
                    <linearGradient id="ibTrendLine" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={C.warn2} />
                        <stop offset="100%" stopColor={C.bad2} />
                    </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={C.grid} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={12} tick={axisTick(tv, C)} />
                <YAxis yAxisId="l" tickLine={false} axisLine={false} width={tv ? 74 : 56}
                    tick={axisTick(tv, C)} tickFormatter={(v) => fmt(v)} />
                <YAxis yAxisId="r" orientation="right" tickLine={false} axisLine={false} width={tv ? 58 : 42}
                    tick={{ fontSize: tv ? 16 : 11, fill: C.bad }} tickFormatter={(v) => fmt(v)} />
                <Tooltip content={<Tip />} cursor={{ fill: C.grid }} />
                <Bar yAxisId="l" dataKey="inQty" name="입고 수량" fill="url(#ibTrendBar)"
                    radius={[5, 5, 0, 0]} maxBarSize={tv ? 110 : 40} isAnimationActive={false} />
                <Line yAxisId="r" type="linear" dataKey="ngQty" name="부적합 수량" stroke="url(#ibTrendLine)"
                    strokeWidth={tv ? 4 : 2.4} isAnimationActive={false}
                    dot={(p) => (p.payload && p.payload.ngQty > 0
                        ? <circle key={`d${p.index}`} cx={p.cx} cy={p.cy} r={tv ? 6 : 3.2} fill={C.bad2} stroke={C.card} strokeWidth={1.5} />
                        : <g key={`d${p.index}`} />)} />
                {worst.ngQty > 0 && (
                    <ReferenceDot yAxisId="r" x={worst.label} y={worst.ngQty} r={tv ? 9 : 6}
                        fill="none" stroke={C.bad2} strokeWidth={1.6}
                        label={<WorstLabel
                            text={`최다 부적합 · ${worst.key} · ${fmt(worst.ngQty)} EA`}
                            size={tv ? 18 : 11} color={C.bad} r={tv ? 9 : 6} />} />
                )}
                {/* 이 차트만 Y축이 둘이다 — 왼쪽(입고 수량) 축에 건다. 세로선이라 어느 축에
                    걸든 그림은 같지만, 없는 축(기본값 0)을 주면 선 자체가 안 그려진다. */}
                {changeLine(chg, tv, C, 'l')}
            </ComposedChart>
        </ResponsiveContainer>
    );
};

/* ── 불량률 추이 ─────────────────────────────────────────────────────────────
   P8 r8 : **축을 PPM 으로 바꿨다.** 목표 관리선이 100 PPM 으로 정해졌기 때문이다 —
   기준선과 값을 같은 자로 재야 대조가 된다. 0.63% 같은 값을 % 축에 그리면
   0.01%(=100 PPM) 짜리 기준선이 축에 파묻혀 안 보인다.
   숫자 자체는 그대로다(같은 분수의 자릿수만 다르다). 툴팁은 % 와 PPM 을 함께 준다. */
const RateChart = ({ data, tv }) => {
    const C = useInboundTheme();
    if (!data.length) return <Empty t="그릴 구간이 없다" />;
    const chg = changeMarkOf(data);
    const Tip = ({ active, payload }) => {
        if (!active || !payload || !payload.length) return null;
        const d = payload[0].payload;
        const over = d.ppm !== null && d.ppm !== undefined && d.ppm > PPM_TARGET;
        return <TooltipBox title={d.key} rows={[
            { color: over ? C.bad2 : C.ok2, name: '불량률', value: fmtRate(d.ngQty, d.inQty) },
            { color: C.ink4, name: '목표', value: `${fmt(PPM_TARGET)} PPM · ${over ? '초과' : '이내'}` },
            { color: C.ink4, name: '부적합 / 입고', value: `${fmt(d.ngQty)} / ${fmt(d.inQty)} EA` },
        ]} />;
    };
    return (
        <ResponsiveContainer width="100%" height="100%" initialDimension={INIT_DIM}>
            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: chg ? CHG_BAND(tv) : 0 }}>
                <CartesianGrid vertical={false} stroke={C.grid} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={12} tick={axisTick(tv, C)} />
                <YAxis tickLine={false} axisLine={false} width={tv ? 74 : 52}
                    tick={axisTick(tv, C)} tickFormatter={(v) => fmt(Math.round(v))} />
                <Tooltip content={<Tip />} cursor={{ stroke: C.grid }} />
                {/* 목표선. 라벨은 **선을 따라간다**(선 바로 위, 그림 안쪽 오른끝).
                    지금 자료에서는 이 선이 축 바닥에 거의 붙는다 — 그게 사실이다
                    (일별 최댓값이 십만 PPM 대다). 라벨을 차트 꼭대기에 고정해 두면
                    "목표가 저 위"로 잘못 읽히므로 그렇게 하지 않았다.
                    position:'right' 는 그림 밖으로 나가 잘린다(여백이 8px 뿐이다). */}
                <ReferenceLine y={PPM_TARGET} stroke={C.ok2} strokeDasharray="5 4" strokeWidth={tv ? 2.6 : 1.8}
                    label={{
                        value: `목표 ${fmt(PPM_TARGET)} PPM`, position: 'insideTopRight', dy: tv ? -20 : -11,
                        fill: C.ok, fontSize: tv ? 16 : 10.5, fontWeight: 800,
                    }} />
                <Line type="linear" dataKey="ppm" name="PPM" stroke={C.bad2} strokeWidth={tv ? 4 : 2.4}
                    connectNulls={false} isAnimationActive={false}
                    dot={{ r: tv ? 5 : 2.6, fill: C.bad2, strokeWidth: 0 }} />
                {changeLine(chg, tv, C)}
            </LineChart>
        </ResponsiveContainer>
    );
};

/* ── 판정 추이 ── 도넛 대신 구간별 합격/불합격 누적 막대 ───────────────────────
   r12 : 범례 차례를 **쌓인 차례와 같게** 맞춘다. 막대는 아래가 합격(파랑) ·
   위가 불합격(빨강)인데, 범례는 「불합격 · 합격」으로 거꾸로 떴다.
   recharts 3 의 Legend 는 기본값이 itemSorter='value' 라 글자를 가나다로 세운다
   ('불'<'합' → 불합격이 앞). payload 를 넘겨도 무시된다(범례 목록은 차트가 만든다).
   그래서 **차례를 정하는 함수**를 준다 — 아래에서 위로 = 합격, 불합격. */
const VERDICT_ORDER = ['합격', '불합격'];
const verdictSorter = (e) => {
    const i = VERDICT_ORDER.indexOf(e && e.value);
    return i < 0 ? VERDICT_ORDER.length : i;
};

const VerdictChart = ({ data, tv }) => {
    const C = useInboundTheme();
    if (!data.length) return <Empty t="판정 자료가 없다" />;
    const chg = changeMarkOf(data);
    const Tip = ({ active, payload }) => {
        if (!active || !payload || !payload.length) return null;
        const d = payload[0].payload;
        return <TooltipBox title={d.key} rows={[
            { color: C.pri2, name: '합격', value: `${fmt(d.pass)}건` },
            { color: C.bad2, name: '불합격', value: `${fmt(d.ng)}건` },
            { color: C.ink4, name: '합계', value: `${fmt(d.count)}건` },
        ]} />;
    };
    return (
        <ResponsiveContainer width="100%" height="100%" initialDimension={INIT_DIM}>
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: chg ? CHG_BAND(tv) : 0 }}>
                <CartesianGrid vertical={false} stroke={C.grid} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={12} tick={axisTick(tv, C)} />
                <YAxis tickLine={false} axisLine={false} width={tv ? 56 : 40}
                    tick={axisTick(tv, C)} tickFormatter={(v) => fmt(v)} />
                <Tooltip content={<Tip />} cursor={{ fill: C.grid }} />
                <Legend verticalAlign="top" height={tv ? 30 : 20} itemSorter={verdictSorter}
                    wrapperStyle={{ fontSize: tv ? 16 : 10.5, color: C.ink3 }} />
                <Bar dataKey="pass" name="합격" stackId="v" fill={C.pri2} maxBarSize={tv ? 90 : 34} isAnimationActive={false} />
                <Bar dataKey="ng" name="불합격" stackId="v" fill={C.bad2} radius={[4, 4, 0, 0]}
                    maxBarSize={tv ? 90 : 34} isAnimationActive={false} />
                {changeLine(chg, tv, C)}
            </BarChart>
        </ResponsiveContainer>
    );
};

/* ── 협력업체 Top3 불량률 추이 ─────────────────────────────────────────────── */
const VendorTrendChart = ({ vendors, data, tv }) => {
    const C = useInboundTheme();
    if (!vendors.length || !data.length) return <Empty t="이 기간에 입고가 없다" />;
    const chg = changeMarkOf(data);
    const colors = [C.pri2, C.warn2, C.ok2];
    const Tip = ({ active, payload, label }) => {
        if (!active || !payload || !payload.length) return null;
        return <TooltipBox title={label} rows={payload.map((p, i) => ({
            color: colors[i % colors.length], name: p.name, value: pctText(p.value),
        }))} />;
    };
    return (
        <ResponsiveContainer width="100%" height="100%" initialDimension={INIT_DIM}>
            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: chg ? CHG_BAND(tv) : 0 }}>
                <CartesianGrid vertical={false} stroke={C.grid} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={12} tick={axisTick(tv, C)} />
                <YAxis tickLine={false} axisLine={false} width={tv ? 60 : 42}
                    tick={axisTick(tv, C)} tickFormatter={(v) => fx(v, 2)} />
                <Tooltip content={<Tip />} cursor={{ stroke: C.grid }} />
                <Legend verticalAlign="top" height={tv ? 30 : 20}
                    wrapperStyle={{ fontSize: tv ? 15 : 10, color: C.ink3 }} />
                {vendors.map((v, i) => (
                    <Line key={v} type="linear" dataKey={v} name={v} stroke={colors[i % colors.length]}
                        strokeWidth={tv ? 3.4 : 2.2} connectNulls={false} isAnimationActive={false}
                        dot={{ r: tv ? 4.5 : 2.4, fill: colors[i % colors.length], strokeWidth: 0 }} />
                ))}
                {changeLine(chg, tv, C)}
            </LineChart>
        </ResponsiveContainer>
    );
};

const A2Trend = ({ tv, B, RATE, VERDICT, VT }) => {
    const limitNote = `구간별 PPM · 점선 = 목표 ${fmt(PPM_TARGET)} PPM`;
    return (
        <div className="ib-area-grid ib-g2">
            <Card style={{ gridColumn: 'span 3' }} delay={0.06}>
                <SectionTitle title="기간 추이" subtitle="막대 = 입고 수량(EA) · 선 = 부적합 수량(EA)" />
                <div className="ib-cardbody"><TrendChart data={B} tv={tv} /></div>
            </Card>

            <Card delay={0.10}>
                <SectionTitle title="불량률 추이" subtitle={limitNote} />
                <div className="ib-cardbody"><RateChart data={RATE} tv={tv} /></div>
            </Card>

            <Card delay={0.13}>
                <SectionTitle title="판정 추이" subtitle="구간별 합격 · 불합격 건수" />
                <div className="ib-cardbody"><VerdictChart data={VERDICT} tv={tv} /></div>
            </Card>

            <Card delay={0.16}>
                <SectionTitle title="협력업체 Top 3 불량률" subtitle="이 기간 검사 건수 상위 3사" />
                <div className="ib-cardbody"><VendorTrendChart vendors={VT.vendors} data={VT.data} tv={tv} /></div>
            </Card>
        </div>
    );
};

export default A2Trend;
