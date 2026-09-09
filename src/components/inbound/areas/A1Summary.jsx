/* ─────────────────────────────────────────────────────────────────────────────
   areas/A1Summary.jsx — 「대시보드」 영역 1 · 종합현황   (플랜 042 / P8 r8)

   승인 구성안 r0 의 .g1 격자 그대로다 — 4fr 3fr 3fr 3fr × 2줄.
     · 1열(2줄 통칸) = 불량률 히어로
     · 남은 6칸      = KPI 6타일 (검사 건수 · 입고 · 검사 · 불합격 · 부적합 · 합격률)

   r7 → r8 에서 바뀐 것
     A. **관리선이 정해졌다 — 100 PPM.** 「관리선 미설정」 회색 문구를 전부 걷어냈다.
        상태는 둘뿐이다: 🟢 목표 이내(≤100) / 🔴 목표 초과(>100). 가운데(주의)는 없다.
        불량률이 나오는 자리마다 **% 와 PPM 을 함께** 적는다(fmtRate — lib 한 군데).
     B. 증감 칩의 비교 기준이 바뀌었다. 「기간 후반 vs 전반」(같은 자료를 반으로 갈라
        스스로와 견주던 값)을 버리고, 묶음이 기준을 정한다 —
        일별·월별 = **전월 일평균** / 년별 = **전년 동기**. 칩에 그 이름을 적는다.
     C. 스파크라인이 **묶음(일별/월별/년별)을 따른다**. r7 까지는 묶음을 무엇으로 바꾸든
        늘 일별이라 「묶음」 막대가 이 영역에서 아무 일도 안 하는 것처럼 보였다.
        시작/끝날과 최고점(날짜·값)을 그림 밑에 적는다.
     D. 각주에서 개발 용어를 걷어냈다 ('대장 행 수 기준' → '검사 기록 건수',
        '대장 defectQuantity 합계' → '부적합 수량 합계').
     G. 히어로의 빈자리에 **월별 PPM 미니 막대**(최근 6개월까지)를 넣었다. 목표선과
        같은 자로 최근 몇 달을 나란히 세운다.

   숫자는 하나도 여기서 세지 않는다. 전부 lib/inboundStats.js 의 값이다.
   ───────────────────────────────────────────────────────────────────────────── */
import React from 'react';
import {
    Card, SectionTitle, KpiTile, DeltaChip, Sparkline, MiniPpmBars, Ring, StatusBadge, CountUp,
    fmt, fx, useInboundTheme, groupLabel,
} from '../ui';
import { PPM_TARGET, PPM_STATE_TEXT, rateState, fmtRate, fmtPpm } from '../../../lib/inboundStats';

const A1Summary = ({ tv, S, B, MPPM, P, Cc, basis, group }) => {
    const C = useInboundTheme();
    const state = rateState(S.ngQty, S.inQty);            // 'ok' | 'over' | 'none'
    const tone = state === 'over' ? 'bad' : state === 'ok' ? 'ok' : 'mute';
    const keys = B.map((x) => x.key);
    const gl = groupLabel(group);

    return (
        <div className="ib-area-grid ib-g1">
            {/* 히어로 — 불량률(% · PPM) (1열 2줄 통칸) */}
            <Card style={{ gridRow: 'span 2' }} delay={0.06}>
                <SectionTitle title="불량률" subtitle="부적합 수량 ÷ 입고 수량 · 목표 100 PPM" />
                <div className="ib-cardbody ib-scroll" style={{ justifyContent: 'space-between' }}>
                    <div className="flex flex-wrap items-center gap-4 flex-none">
                        {/* r12: 지름을 CSS 눈금(--ib-heroring)에 맡긴다. 데스크톱 112 · 1080p TV 190
                            은 그대로고, 낮은 TV 화면에서만 같이 준다(inbound.css 한 곳이 정한다). */}
                        <Ring pct={S.passRate || 0} color={C.ok2} size="var(--ib-heroring)"
                            label={`${fx(S.passRate, 1)}%`} sub="합격률(건수)" />
                        <div className="flex-1" style={{ minWidth: 120 }}>
                            <div className="tabular-nums" style={{
                                fontSize: 'var(--ib-hero)', fontWeight: 800, letterSpacing: '-.045em', lineHeight: 1,
                                backgroundImage: state === 'ok'
                                    ? `linear-gradient(150deg, ${C.ok}, ${C.ok2})`
                                    : `linear-gradient(150deg, ${C.bad}, ${C.bad2})`,
                                WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
                            }}>
                                <CountUp value={S.defectRate || 0} dec={2} /><span style={{ fontSize: '.34em' }}>%</span>
                            </div>
                            {/* 같은 분수를 PPM 으로 한 번 더. 0.63% 는 소수점 뒤에서 판이 갈려
                                눈으로 못 읽는다 — 목표(100 PPM)와 같은 자로 적어야 대조가 된다. */}
                            <div className="tabular-nums" style={{
                                marginTop: 2, fontSize: 'calc(var(--ib-hero) * .30)', fontWeight: 800,
                                letterSpacing: '-.02em', lineHeight: 1.1,
                                color: state === 'ok' ? C.ok : C.bad,
                            }}>
                                {fmtPpm(S.ngQty, S.inQty)}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5" style={{ marginTop: 8 }}>
                                <DeltaChip cur={Cc.defectRate} prev={P.defectRate} goodDown label={basis.rateLabel} />
                            </div>
                            <div style={{ marginTop: 7, fontSize: 'calc(var(--ib-lbl)*.98)', color: 'var(--ib-ink3)', lineHeight: 1.45 }}>
                                부적합 <b className="tabular-nums" style={{ color: 'var(--ib-ink)' }}>{fmt(S.ngQty)}</b> EA ÷
                                입고 <b className="tabular-nums" style={{ color: 'var(--ib-ink)' }}>{fmt(S.inQty)}</b> EA
                            </div>
                        </div>
                    </div>

                    {/* G — 히어로 빈자리 : 월별 PPM 미니 막대 + 목표선 */}
                    <div className="flex flex-col" style={{ marginTop: 10, flex: 1, minHeight: 'var(--ib-heroppm)' }}>
                        <div style={{ fontSize: 'calc(var(--ib-lbl)*.95)', fontWeight: 700, color: 'var(--ib-ink3)' }}>
                            월별 PPM <span style={{ color: 'var(--ib-ink4)', fontWeight: 600 }}>최근 {MPPM.length}개월 · 점선 = 목표</span>
                        </div>
                        <MiniPpmBars rows={MPPM} target={PPM_TARGET} />
                    </div>

                    {/* C — 기간 내 추이. 묶음을 따라간다. */}
                    <div className="flex flex-col flex-none" style={{ marginTop: 10, height: 'var(--ib-herospark)' }}>
                        <div style={{ fontSize: 'calc(var(--ib-lbl)*.95)', fontWeight: 700, color: 'var(--ib-ink3)' }}>
                            기간 내 추이 <span style={{ color: 'var(--ib-ink4)', fontWeight: 600 }}>부적합 수량({gl})</span>
                        </div>
                        <div style={{ flex: 1, minHeight: 40 }}>{/* P10b: 히어로 추이는 높이 고정(늘리지 않음), 남는 자리는 월별 PPM 막대가 가진다 */}
                            <Sparkline values={B.map((x) => x.ngQty)} keys={keys} unit="EA" marks
                                color={C.bad2} height="100%" />
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 flex-none" style={{ marginTop: 10 }}>
                        <StatusBadge tone={tone}>{PPM_STATE_TEXT[state]} · {fmtRate(S.ngQty, S.inQty)}</StatusBadge>
                        <StatusBadge tone={S.ngCount ? 'bad' : 'ok'}>불합격 {fmt(S.ngCount)}건</StatusBadge>
                    </div>
                </div>
            </Card>

            <KpiTile delay={0.10} label="검사 건수" value={S.count} unit="건"
                spark={B.map((x) => x.count)} sparkKeys={keys} sparkUnit="건" sparkGroup={group} sparkColor={C.pri2}
                delta={<DeltaChip cur={Cc.count} prev={P.count} label={basis.label} />}
                footnote={`성적서 발급 ${fmt(S.reportCount)}건 · 검사 기록 1건 = 입고 1건`} />
            <KpiTile delay={0.13} label="입고 수량" value={S.inQty} unit="EA"
                spark={B.map((x) => x.inQty)} sparkKeys={keys} sparkUnit="EA" sparkGroup={group} sparkColor={C.pri2}
                delta={<DeltaChip cur={Cc.inQty} prev={P.inQty} label={basis.label} />}
                footnote="전 품목 합계 (불량률·PPM 의 분모)" />
            <KpiTile delay={0.16} label="검사 수량" value={S.inspQty} unit="EA"
                spark={B.map((x) => x.inspQty)} sparkKeys={keys} sparkUnit="EA" sparkGroup={group} sparkColor={C.pri2}
                delta={<DeltaChip cur={Cc.inspQty} prev={P.inspQty} label={basis.label} />}
                footnote={`검사율 ${S.inQty > 0 ? fx(S.inspQty / S.inQty * 100, 2) : '—'}% (표본검사 수량 ÷ 입고 수량)`} />
            <KpiTile delay={0.19} label="불합격 건수" value={S.ngCount} unit="건" tone={C.bad}
                spark={B.map((x) => x.ngCount)} sparkKeys={keys} sparkUnit="건" sparkGroup={group} sparkColor={C.bad2}
                delta={<DeltaChip cur={Cc.ngCount} prev={P.ngCount} goodDown label={basis.label} />}
                footnote={`합격률 ${fx(S.passRate, 2)}% (건수 기준)`} />
            <KpiTile delay={0.22} label="부적합 수량" value={S.ngQty} unit="EA" tone={C.bad}
                spark={B.map((x) => x.ngQty)} sparkKeys={keys} sparkUnit="EA" sparkGroup={group} sparkColor={C.bad2}
                delta={<DeltaChip cur={Cc.ngQty} prev={P.ngQty} goodDown label={basis.label} />}
                footnote={`부적합 수량 합계 · 불량률 ${fmtRate(S.ngQty, S.inQty)}`} />
            <KpiTile delay={0.25} label="합격률" value={S.passRate} unit="%" dec={2} tone={C.ok}
                spark={B.map((x) => x.passCount)} sparkKeys={keys} sparkUnit="건" sparkGroup={group} sparkColor={C.ok2}
                delta={<DeltaChip cur={Cc.passCount} prev={P.passCount} goodDown={false} label={basis.label} />}
                footnote={`합격 ${fmt(S.passCount)}건 / ${fmt(S.count)}건`} />
        </div>
    );
};

export default A1Summary;
