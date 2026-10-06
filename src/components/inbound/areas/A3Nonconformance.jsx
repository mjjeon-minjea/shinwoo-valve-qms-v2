/* ─────────────────────────────────────────────────────────────────────────────
   areas/A3Nonconformance.jsx — 「대시보드」 영역 3 · 부적합 현황   (플랜 042 / P9 r9)

   승인 구성안 r0 의 .g3 격자 — 2×2.
     · 협력업체 Top 5   (P4 r4 그대로)
     · 품목유형 구성    (P4 r4 그대로)
     · 부적합 유형 Top 5 ← 「품목·부적합」 탭의 topDefectTypes() 를 **그대로 다시 쓴다**
                          (그 탭은 한 글자도 고치지 않았다. 계산 함수가 lib 에 있어서 복제가 아니다)
     · 최근 불합격 목록  ← 신규. 기간 안의 result==='불합격' 을 최신순으로. 카드 안에서 구른다.

   r8 → r9 (차장 피드백 09-02)
     1. 「최근 불합격 목록」의 칸을 바꿨다 —
          품번·보고서번호  ✕      (현업이 이 화면에서 찾는 값이 아니다)
          모델명·사이즈    ○      품명 한 줄에서 뽑는다(lib/inboundStats.js parseItem)
        남은 칸은 일자 · 업체 · 부적합수량. 다섯 칸이면 TV 에서도 안 잘린다.
        원래 품명은 모델명 칸의 title 툴팁으로 통째로 남는다 — 뽑기가 틀려도 원본이 보인다.
     2. **카드 안에서 구르지 않는다.** 7줄만 그리고 남은 건 「외 N건」으로 적는다.
        벽걸이 TV 는 아무도 굴려 주지 않고, 데스크톱에서도 카드 속 스크롤 막대는
        "여기 뭔가 더 있다"는 신호만 주고 끝난다.
     3. 랭킹 막대(협력업체 Top 5 · 부적합 유형 Top 5)의 막대가 두 배로 두꺼워졌다 —
        값은 components/inbound/ui.jsx 와 styles/inbound.css 가 정한다(여기는 그대로다).

   공식 용어는 「부적합」이다. '불량유형' 같은 옛 표현을 화면에 쓰지 않는다.
   ───────────────────────────────────────────────────────────────────────────── */
import React from 'react';
import { Card, SectionTitle, RankBar, StackStrip, LegendRow, Empty, fmt, pctText, useInboundTheme } from '../ui';
import { PPM_TARGET, ppm, fmtRate, fmtPpm } from '../../../lib/inboundStats';

/* 최근 불합격 목록에 그리는 줄 수. 카드가 구르지 않으므로 **화면이 정한다**.
   남은 건 아래 「외 N건」 한 줄이 말한다. */
const SHOW = 7;

const A3Nonconformance = ({ tv, TOP5, TY, DEFTYPE, FAILS, go }) => {
    const C = useInboundTheme();
    const shown = (FAILS || []).slice(0, SHOW);
    const rest = Math.max(0, (FAILS || []).length - shown.length);
    const typeColors = [C.pri, C.ok2, C.warn2, C.pri3, '#a78bfa', '#94a3b8'];
    /* P8 r8 : 색 기준도 관리선 하나다 — 100 PPM 이내 초록 / 넘으면 빨강. 가운데는 없다. */
    const rateTone = (o) => {
        const p = ppm(o.ngQty, o.inQty);
        return p === null ? C.ink4 : (p > PPM_TARGET ? C.bad : C.ok);
    };
    /* % 는 크게, PPM 은 그 밑에 작게. 같은 분수를 두 자리로 적는다. */
    const RatePair = ({ o }) => (
        <span className="tabular-nums" style={{ color: rateTone(o), display: 'inline-block', textAlign: 'right', lineHeight: 1.2 }}>
            {pctText(o.defectRate)}
            <small style={{ display: 'block', fontSize: '.8em', fontWeight: 700, opacity: .85 }}>{fmtPpm(o.ngQty, o.inQty)}</small>
        </span>
    );

    /* P9 r9 : 인라인 style 은 CSS 클래스로 못 이긴다 — 그래서 TV/데스크톱 줄 여백을
       여기서 나눈다. TV 는 글자가 두 배라 여백까지 두 배면 7줄이 카드를 넘는다. */
    const th = {
        textAlign: 'left', fontWeight: 700, color: 'var(--ib-ink3)', whiteSpace: 'nowrap',
        padding: tv ? '1px 8px 3px 0' : '3px 8px 4px 0',
    };
    const td = { padding: tv ? '1px 8px 1px 0' : '4px 8px 4px 0', verticalAlign: 'top', color: 'var(--ib-ink2)' };

    return (
        <div className="ib-area-grid ib-g3">
            <Card delay={0.06}>
                <SectionTitle title="협력업체 Top 5" subtitle={`검사 건수 순 · 우측은 불량률(% · PPM) · 목표 ${fmt(PPM_TARGET)} PPM`} />
                <div className="ib-cardbody ib-scroll">
                    {TOP5.length === 0 ? <Empty t="이 기간에 입고가 없다" /> : (
                        <RankBar rows={TOP5} valueKey="count" valueUnit="건"
                            nameWidth={tv ? 300 : 170} onPick={tv ? undefined : go}
                            rightOf={(r) => <RatePair o={r} />} />
                    )}
                </div>
            </Card>

            <Card delay={0.09}>
                <SectionTitle title="품목유형 구성" subtitle="검사 건수 · 입고 수량" />
                <div className="ib-cardbody ib-scroll">
                    <StackStrip rows={TY} valueKey="count" colors={typeColors} height={tv ? 30 : 22} />
                    {/* P9 r9 : 보조값을 **한 줄**로 합쳤다. 두 줄이면 유형이 6종일 때
                        1366×768 짜리 TV 에서 아래 두 줄이 카드 밖으로 잘려 나갔다.
                        fmtRate 가 「0.31% · 3,073 PPM」을 한 줄로 준다 — 같은 값이다. */}
                    <ul className="list-none m-0 p-0" style={{ marginTop: 10, fontSize: 'var(--ib-lbl)' }}>
                        {TY.map((o, i) => (
                            <LegendRow key={o.key} color={typeColors[i % typeColors.length]} name={o.name}
                                value={`${fmt(o.count)}건`} tone={rateTone(o)}
                                extra={<span className="tabular-nums whitespace-nowrap">
                                    {fmt(o.inQty)} EA <b style={{ color: rateTone(o) }}>{fmtRate(o.ngQty, o.inQty)}</b>
                                </span>} />
                        ))}
                    </ul>
                </div>
            </Card>

            <Card delay={0.12}>
                <SectionTitle title="부적합 유형 Top 5" subtitle="건수 순 · 우측은 부적합 수량" />
                <div className="ib-cardbody ib-scroll">
                    {DEFTYPE.length === 0 ? <Empty t="이 기간에 기록된 부적합 유형이 없다" /> : (
                        <RankBar rows={DEFTYPE} valueKey="count" valueUnit="건"
                            nameWidth={tv ? 300 : 170}
                            rightOf={(r) => <span className="tabular-nums" style={{ color: C.bad }}>{fmt(r.ngQty)} EA</span>} />
                    )}
                </div>
            </Card>

            <Card delay={0.15}>
                <SectionTitle title="최근 불합격 목록"
                    subtitle={`이 기간 ${fmt(FAILS.length)}건 · 최신순 ${SHOW}줄`} />
                {/* 칸은 다섯이다 — 일자 · 업체 · 모델명 · 사이즈 · 부적합수량.
                    모델명·사이즈는 품명 한 줄에서 뽑은 값이고, 원래 품명은 title 툴팁에 남는다. */}
                <div className="ib-cardbody ib-scroll ib-faillist">
                    {FAILS.length === 0 ? <Empty t="이 기간에는 불합격이 없다" /> : (
                        <>
                            <table className="ib-table" style={{ fontSize: tv ? 'calc(var(--ib-lbl)*.72)' : 'calc(var(--ib-lbl)*.96)', lineHeight: 1.35 }}>
                                <thead>
                                    <tr>
                                        <th style={th}>일자</th>
                                        <th style={th}>업체</th>
                                        <th style={th}>모델명</th>
                                        <th style={th}>사이즈</th>
                                        <th style={{ ...th, textAlign: 'right' }}>부적합수량</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {shown.map((r) => (
                                        <tr key={r.key}>
                                            <td style={td} className="tabular-nums whitespace-nowrap">{r.date}</td>
                                            <td style={{ ...td, color: 'var(--ib-ink)', fontWeight: 700, maxWidth: tv ? 260 : 170 }}>
                                                <span className="block truncate" title={r.supplier}>{r.supplier}</span>
                                            </td>
                                            <td style={{ ...td, color: 'var(--ib-ink)', fontWeight: 700, maxWidth: tv ? 230 : 150 }}>
                                                <span className="block truncate" title={r.itemName}>{r.model}</span>
                                            </td>
                                            <td style={{ ...td, whiteSpace: 'nowrap' }} className="tabular-nums" title={r.itemName}>{r.size}</td>
                                            <td style={{ ...td, textAlign: 'right', color: C.bad, fontWeight: 800 }} className="tabular-nums">{fmt(r.ngQty)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {/* 목록이 잘렸다는 사실을 감추지 않는다 — 감추면 "이게 전부"로 읽힌다 */}
                            {rest > 0 && <div className="ib-listfoot">외 {fmt(rest)}건</div>}
                        </>
                    )}
                </div>
            </Card>
        </div>
    );
};

export default A3Nonconformance;
