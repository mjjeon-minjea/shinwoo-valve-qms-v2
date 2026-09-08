/* ─────────────────────────────────────────────────────────────────────────────
   areas/A2Trend.jsx — 「대시보드」 영역 2 · 추이   (플랜 042 / P9 r9)

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
} from 'recharts';
import { Card, SectionTitle, Empty, TooltipBox, fmt, fx, pctText, useInboundTheme } from '../ui';
import { PPM_TARGET, fmtRate } from '../../../lib/inboundStats';

/** 묶음 단위별 X축 글자 — 일별 07-14 · 월별 26-07 · 년별 2026 */
export const bucketLabel = (key, group) => (group === 'year' ? key : group === 'month' ? key.slice(2) : key.slice(5));

const axisTick = (tv, C) => ({ fontSize: tv ? 16 : 11, fill: C.ink4 });

/* Recharts 3.x 의 ResponsiveContainer 는 첫 렌더에 컨테이너 크기를 -1 로 잡고
   "width(-1) and height(-1) …" 경고를 콘솔에 뱉는다. 크기를 flex 로 주는 칸에서는
   피할 수 없으므로 라이브러리가 마련해 둔 initialDimension 으로 첫 값을 1px 로 준다.
   바로 다음 프레임에 ResizeObserver 가 진짜 크기로 덮는다(그림은 그대로다). */
const INIT_DIM = { width: 1, height: 1 };

/* ── 메인 : 기간 추이 (막대 = 입고 수량 · 선 = 부적합 수량) ─────────────────── */
const TrendChart = ({ data, tv }) => {
    const C = useInboundTheme();
    if (!data.length) return <Empty t="이 기간에는 그릴 구간이 없다" />;
    const worst = data.reduce((a, b) => (b.ngQty > a.ngQty ? b : a), data[0]);
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
            <ComposedChart data={data} margin={{ top: 24, right: 8, left: 0, bottom: 0 }}>
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
                        label={{
                            value: `최다 부적합 · ${worst.key} · ${fmt(worst.ngQty)} EA`,
                            position: 'top', fill: C.bad, fontSize: tv ? 18 : 11, fontWeight: 700,
                        }} />
                )}
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
            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
            </LineChart>
        </ResponsiveContainer>
    );
};

/* ── 판정 추이 ── 도넛 대신 구간별 합격/불합격 누적 막대 ─────────────────────── */
const VerdictChart = ({ data, tv }) => {
    const C = useInboundTheme();
    if (!data.length) return <Empty t="판정 자료가 없다" />;
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
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={C.grid} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={12} tick={axisTick(tv, C)} />
                <YAxis tickLine={false} axisLine={false} width={tv ? 56 : 40}
                    tick={axisTick(tv, C)} tickFormatter={(v) => fmt(v)} />
                <Tooltip content={<Tip />} cursor={{ fill: C.grid }} />
                <Legend verticalAlign="top" height={tv ? 30 : 20}
                    wrapperStyle={{ fontSize: tv ? 16 : 10.5, color: C.ink3 }} />
                <Bar dataKey="pass" name="합격" stackId="v" fill={C.pri2} maxBarSize={tv ? 90 : 34} isAnimationActive={false} />
                <Bar dataKey="ng" name="불합격" stackId="v" fill={C.bad2} radius={[4, 4, 0, 0]}
                    maxBarSize={tv ? 90 : 34} isAnimationActive={false} />
            </BarChart>
        </ResponsiveContainer>
    );
};

/* ── 협력업체 Top3 불량률 추이 ─────────────────────────────────────────────── */
const VendorTrendChart = ({ vendors, data, tv }) => {
    const C = useInboundTheme();
    if (!vendors.length || !data.length) return <Empty t="이 기간에 입고가 없다" />;
    const colors = [C.pri2, C.warn2, C.ok2];
    const Tip = ({ active, payload, label }) => {
        if (!active || !payload || !payload.length) return null;
        return <TooltipBox title={label} rows={payload.map((p, i) => ({
            color: colors[i % colors.length], name: p.name, value: pctText(p.value),
        }))} />;
    };
    return (
        <ResponsiveContainer width="100%" height="100%" initialDimension={INIT_DIM}>
            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
