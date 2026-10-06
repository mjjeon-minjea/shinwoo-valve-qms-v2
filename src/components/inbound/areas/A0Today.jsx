/* ─────────────────────────────────────────────────────────────────────────────
   areas/A0Today.jsx — 「대시보드」 영역 0 · 오늘 현황   (플랜 042 / P9 r9)

   r7 → r8 에서 바뀐 것
     A. **신호등이 두 칸이 됐다.** 🟢 불합격 0건 **그리고** PPM ≤ 100 / 🔴 그 밖 전부.
        주황(주의)을 없앴다 — 1초에 "손 대야 하나"만 묻는 화면에 세 칸은 한 칸 많다.
        불량률이 나오는 자리는 전부 **% 와 PPM 을 함께** 적는다(fmtRate).
     B. 비교가 셋이 됐다 — 어제(칩) · 이번 주 일평균 · **전월 일평균**(새로 붙임).
        일평균의 분모는 **검사가 있던 날 수**다(달력 일수가 아니다).
     D. 각주에서 개발 용어를 걷어냈다 ('대장에 …' → '검사 기록이 …').
     E. 화면 제목은 어느 영역에서나 「인수검사 — 대시보드」다(InboundOverview 에서 고쳤다).

   r8 → r9 (차장 피드백 09-02)
     · **이 영역에도 스크롤 막대가 없다.** 「누계」는 글자·여백 눈금을 줄여 12줄을
       그대로 넣었고(styles/inbound.css), 「최근 검사」는 데스크톱에서 **7줄**만
       그린다(TV 는 흐르는 티커라 예전대로 10줄이다). 줄을 지운 게 아니라
       화면이 몇 줄을 보여 줄지 정한 것이고, 카드 부제에 그 줄 수를 적어 둔다.

   P7 r7 에서 고친 것 — **큰 숫자가 「vs 어제」 칩을 덮던 버그**.
   r6 은 TV 눈금을 1080px 짜리 화면 하나만 보고 px 로 못 박았다. 실제로 이 화면이
   뜨는 창은 1920×911(크롬 UI 를 뺀 높이)이 흔하고 TV 자체가 1366×768 인 곳도 있다.
   숫자만 108px 로 남아 제 칸(50~82px)을 넘겼고, flex 자식은 밖으로 삐져나오므로
   아래 칩과 각주를 덮었다. 고친 자리는 이 파일 두 곳(타일 뼈대·빈 상태 체크 크기)과
   styles/inbound.css 다. 숫자를 세는 규칙은 한 줄도 건드리지 않았다.

   앞의 네 영역(종합현황·추이·부적합 현황·공정능력)은 **분석**이다. 지난 기간을 놓고
   왜 그랬는지 따지는 화면이다. 이 영역만 **운영**이다 — 벽걸이 TV 앞을 지나가는
   사람이 오늘 무슨 일이 있었는지 알고 가야 한다. 그래서 규칙이 다르다.

     1초  : 색.    타일 테두리 신호등 — 초록(불합격 0건 · PPM ≤ 100) / 빨강(그 밖)
     3초  : 큰 숫자. 오늘 건수·수량·불합격·부적합 넷.
     10초 : 목록.  오늘 불합격 · 최근 검사 티커.

   ── 이 자료로 무엇을 못 하는지 (화면에도 적어 둔다) ──────────────────────────
     · 대장의 date 에는 **시각이 없다**. 그래서 '오늘'은 `date === 기준일` 인 줄이지
       '지금 몇 시간 안'이 아니다. 「방금 들어온 건」 같은 칸을 만들 수 없다.
     · 동기화는 **수동**이다(구글시트 → /api/sync-sheets 버튼). 자동으로 도는 게 없다.
       그래서 「살아있음」을 초록 점으로만 칠하지 않고, 마지막 동기화 시각을 적고
       60분이 넘었거나 알 수 없으면 주황 「갱신 확인 필요」를 붙인다. 그게 정직하다.
     · **목표치가 없다.** 달성률·잔여 건수 같은 칸을 지어내지 않는다.
     · 입고 예정·검사 대기 자료가 없다. 「대기 N건」을 만들지 않는다.

   ── P15 r15 (차장 확정 09-09) — TV 의 기준일 ────────────────────────────────
     오늘 검사가 0건이면 기준일이 **가장 최근 검사일**로 자동으로 옮겨진다
     (규칙은 lib/inboundStats.js 의 autoAsOf, 판단은 InboundOverview 가 한다).
     옮겨졌으면 이 화면의 기준일 칸에 호박색으로 「09-08 기준 · 오늘 자료 없음」이
     붙는다(note 값). TV 시작 팝업에서 날짜를 못 박았으면 옮기지 않고 딱지도 없다.
     데스크톱의 날짜칸은 예전 그대로다 — 사람이 고르고, 저장하지 않는다.

   숫자는 하나도 여기서 세지 않는다 — 전부 lib/inboundStats.js 가 낸 값이다.
   불량률 = 부적합 수량 ÷ 입고 수량 (차장 확정 09-01). 그래서 입고 수량도 같이 적는다.
   ───────────────────────────────────────────────────────────────────────────── */
import React from 'react';
import { CheckCircle2, CalendarDays } from 'lucide-react';
import {
    Card, SectionTitle, DeltaChip, StatusBadge, CountUp, Empty,
    fmt, fx, useInboundTheme, useReducedMotion,
} from '../ui';
import { PPM_TARGET, ppm, rateState, fmtRate } from '../../../lib/inboundStats';

/* ── 신호등 ────────────────────────────────────────────────────────────────
   P8 r8 (차장 확정 09-02) — **두 칸뿐이다. 가운데(주황)를 없앴다.**
     🟢 정상  : 불합격 0건  **그리고**  PPM ≤ 100
     🔴 이상  : 그 밖 전부
   왜 주황을 뺐나 : 벽걸이 TV 앞을 지나가는 사람이 1초에 판단할 것은
   "손 대야 하나 아닌가" 하나다. 세 칸이면 주황을 보고 또 생각해야 한다.
   불합격이 한 건이라도 있으면 이미 사람이 봐야 하는 날이다.
   ※ 관리선은 lib/inboundStats.js 의 PPM_TARGET 한 곳이 정한다. */
export function todayTone(D, target) {
    const T = target === undefined || target === null ? PPM_TARGET : target;
    const p = ppm(D.ngQty, D.inQty);
    const over = p !== null && p > T;
    return (D.ngCount === 0 && !over) ? 'ok' : 'bad';
}
const TONE_TEXT = { ok: '목표 이내', bad: '목표 초과' };

/* ── 큰 숫자 타일 ─────────────────────────────────────────────────────────── */
const BigTile = ({ label, value, unit, dec, tone, lamp, delta, note, delay }) => (
    <Card delay={delay} className={`ib-a0tile ${lamp ? `ib-lamp-${lamp}` : ''}`}>
        <div className="ib-a0lbl">{label}</div>
        {/* 숫자 칸이 남은 높이를 먹고 그 안에서 가운데 선다 — 라벨 바로 밑에 붙여 두면
            타일이 클수록 숫자와 각주 사이가 허전하게 벌어진다.
            P7 r7 : 이 칸은 CSS 에서 container 로 잡혀 있다. 숫자 크기가 이 칸 높이를
            절대 못 넘는다(넘겨서 아래 칩을 덮은 게 r6 의 버그다). */}
        <div className="ib-a0numwrap">
            <div className="ib-a0num tabular-nums" style={{ color: tone || 'var(--ib-ink)' }}>
                <CountUp value={value} dec={dec} />{unit && <small>{unit}</small>}
            </div>
        </div>
        {/* 칩·각주는 flex:none 이다 — 숫자가 아무리 커도 이 둘의 자리를 뺏지 못한다 */}
        <div className="ib-a0delta">{delta}</div>
        <div className="ib-a0sub">{note}</div>
    </Card>
);

/**
 * 「… 일평균 대비」 한 줄. 평균이 0이면 비교하지 않는다(0 대비 증가율은 거짓말이다).
 * 일평균의 분모 '일수' 는 **검사가 1건이라도 있던 날 수**다 — 달력 일수로 나누면
 * 주말·휴무가 분모를 부풀려 오늘이 늘 좋아 보인다.
 */
const AvgLine = ({ name, cur, sum, days, unit, dec }) => {
    const d = days > 0 ? days : 0;
    const avg = d > 0 ? sum / d : null;
    if (avg === null || avg === 0) {
        return <div className="ib-a0avg">{name} 일평균 <span style={{ opacity: .8 }}>— 비교 자료 없음</span></div>;
    }
    const diff = (cur - avg) / avg * 100;
    const flat = Math.abs(diff) < 0.5;
    return (
        <div className="ib-a0avg">
            {name} 일평균 <b className="tabular-nums" style={{ color: 'var(--ib-ink2)' }}>{fx(avg, dec === undefined ? 1 : dec)}</b>{unit} 대비{' '}
            <b className="tabular-nums" style={{ color: 'var(--ib-ink2)' }}>
                {flat ? '보합' : `${diff >= 0 ? '▲' : '▼'} ${Math.abs(diff).toFixed(1)}%`}
            </b>
        </div>
    );
};

/** 각주 두 줄 — 이번 주 일평균 · 전월 일평균 (P8 r8: 전월이 세 번째 비교다). */
const AvgNotes = ({ cur, W, wkDays, M, pmDays, unit, dec }) => (
    <>
        <AvgLine name="이번 주" cur={cur} sum={W} days={wkDays} unit={unit} dec={dec} />
        <AvgLine name="전월" cur={cur} sum={M} days={pmDays} unit={unit} dec={dec} />
    </>
);

/* ── 누계 카드 한 줄 ──────────────────────────────────────────────────────── */
const RollRow = ({ k, v, chip }) => (
    <div className="ib-a0row">
        <span className="k">{k}</span>
        <span className="v tabular-nums">{v}</span>
        <span className="flex-none">{chip}</span>
    </div>
);

const RollBlock = ({ title, sub, label, S, P }) => (
    <div className="ib-a0blk">
        <div className="flex flex-wrap items-baseline gap-x-2" style={{ marginBottom: 2 }}>
            <b style={{ fontSize: 'var(--ib-lbl)', fontWeight: 800, color: 'var(--ib-ink)' }}>{title}</b>
            <span style={{ fontSize: 'calc(var(--ib-lbl)*.9)', color: 'var(--ib-ink4)', fontWeight: 600 }}>{sub}</span>
        </div>
        <RollRow k="검사" v={`${fmt(S.count)}건`} chip={<DeltaChip cur={S.count} prev={P.count} label={label} />} />
        <RollRow k="검사수량" v={`${fmt(S.inspQty)} EA`} chip={<DeltaChip cur={S.inspQty} prev={P.inspQty} label={label} />} />
        <RollRow k="불합격" v={`${fmt(S.ngCount)}건`} chip={<DeltaChip cur={S.ngCount} prev={P.ngCount} goodDown label={label} />} />
        {/* r8 : 불량률은 % 와 PPM 을 함께. 목표(100 PPM)와 같은 자로 적어야 대조가 된다. */}
        <RollRow k="불량률" v={fmtRate(S.ngQty, S.inQty)} chip={<DeltaChip cur={S.defectRate} prev={P.defectRate} goodDown label={label} />} />
        {/* 불량률의 분모(입고 수량)를 적어 둔다. TV 는 자리가 없어 감춘다 — 4 m 밖에서
            읽을 줄이 아니고, 같은 값이 「종합현황」 영역에 크게 있다. */}
        <div className="ib-a0foot" style={{ padding: '4px 0 0', fontSize: 'calc(var(--ib-lbl)*.9)', color: 'var(--ib-ink4)' }}>
            입고 <span className="tabular-nums">{fmt(S.inQty)}</span> EA · 부적합 <span className="tabular-nums">{fmt(S.ngQty)}</span> EA
        </div>
    </div>
);

/* ── 최근 검사 한 줄 ──────────────────────────────────────────────────────── */
const TickRow = ({ r, bad }) => (
    <div className="ib-tkrow">
        <span className="d tabular-nums">{r.date.slice(5)}</span>
        <span className="s" title={`${r.supplier} · ${r.itemName}`}>{r.supplier} · {r.itemName}</span>
        <span className="r" style={{ color: bad ? 'var(--ib-bad)' : 'var(--ib-ok)' }}>{r.result}</span>
    </div>
);

/* ═══════════════════════════════════════════════════════════════════════════ */
const A0Today = ({ tv, T, asOf, onAsOf, sync, span, note }) => {
    const C = useInboundTheme();
    const rm = useReducedMotion();
    const tone = todayTone(T.D);
    const dayState = rateState(T.D.ngQty, T.D.inQty);

    /* 마지막 동기화 — 수동 버튼이라 '오래됐다'가 곧 '틀렸다'는 뜻일 수 있다. */
    const syncMs = sync ? Date.parse(sync) : NaN;
    const syncOk = Number.isFinite(syncMs);
    const ageMin = syncOk ? Math.floor((Date.now() - syncMs) / 60000) : null;
    const stale = !syncOk || ageMin >= 60;
    const hhmm = syncOk
        ? `${String(new Date(syncMs).getHours()).padStart(2, '0')}:${String(new Date(syncMs).getMinutes()).padStart(2, '0')}`
        : null;

    const noData = T.D.count === 0;
    const behind = span && span.max && span.max < asOf;

    /* 티커는 TV 에서만 흐른다. 흐르게 하려면 같은 줄 묶음이 **두 벌** 있어야 이음매가 없다. */
    const roll = tv && !rm && T.recent.length > 0;
    const rows = (tag) => T.recent.map((r) => <TickRow key={`${tag}-${r.key}`} r={r} bad={r.result === '불합격'} />);

    return (
        <div className="ib-a0wrap">
            {/* ── 기준일 · 마지막 동기화 · 상태 ── */}
            <div className="ib-a0bar ib-fade" style={{ animationDelay: '.03s' }}>
                <span className="inline-flex items-center gap-1.5" style={{ fontWeight: 700, color: 'var(--ib-ink2)' }}>
                    <CalendarDays className="w-3.5 h-3.5" style={{ width: '1em', height: '1em' }} />
                    기준일
                </span>
                {onAsOf
                    ? (
                        <input type="date" value={asOf} max={T.today} onChange={(e) => onAsOf(e.target.value)}
                            aria-label="기준일" className="tabular-nums" />
                    )
                    : <b className="tabular-nums" style={{ color: 'var(--ib-ink)', fontWeight: 800 }}>{asOf}</b>}

                {/* P15 r15 — 기준일을 **자동으로 옮겼을 때만** 뜬다(「09-08 기준 · 오늘 자료 없음」).
                    벽걸이 TV 는 사람이 날짜를 못 고치므로 오늘 검사가 0건이면 최근 검사일로
                    옮긴다. 옮겼다는 말이 없으면 어제 숫자를 오늘 숫자로 읽는다 — 그게 더 위험하다. */}
                {note && <StatusBadge tone="warn">{note}</StatusBadge>}

                <StatusBadge tone={tone}>{TONE_TEXT[tone]} · 불합격 {fmt(T.D.ngCount)}건</StatusBadge>

                <span className="tabular-nums">
                    {syncOk ? `마지막 동기화 ${hhmm}` : '동기화 시각 없음'}
                </span>
                {stale && <StatusBadge tone="warn">갱신 확인 필요</StatusBadge>}
                {behind && (
                    <span style={{ color: 'var(--ib-ink4)' }} className="tabular-nums">
                        기준일 자료 없음 · 최신 자료 {span.max}
                    </span>
                )}
                <span className="flex-1" />
                {!tv && (
                    <span style={{ color: 'var(--ib-ink4)', fontWeight: 600 }}>
                        시각 없는 날짜 자료 · 동기화는 수동이다
                    </span>
                )}
            </div>

            <div className="ib-area-grid ib-g0">
                {/* ── 1층 : 큰 숫자 넷 ── */}
                <BigTile delay={0.06} lamp={tone} label="오늘 검사 건수" value={T.D.count} unit="건"
                    delta={<DeltaChip cur={T.D.count} prev={T.Y.count} label="vs 어제" />}
                    note={<AvgNotes cur={T.D.count} W={T.W.count} wkDays={T.wkDays} M={T.PM.count} pmDays={T.pmDays} unit="건" />} />

                <BigTile delay={0.09} lamp={tone} label="오늘 검사 수량" value={T.D.inspQty} unit="EA"
                    delta={<DeltaChip cur={T.D.inspQty} prev={T.Y.inspQty} label="vs 어제" />}
                    note={<>
                        <div className="ib-a0avg">입고 <b className="tabular-nums" style={{ color: 'var(--ib-ink2)' }}>{fmt(T.D.inQty)}</b> EA</div>
                        <AvgNotes cur={T.D.inspQty} W={T.W.inspQty} wkDays={T.wkDays} M={T.PM.inspQty} pmDays={T.pmDays} unit="EA" dec={0} />
                    </>} />

                <BigTile delay={0.12} lamp={tone} label="오늘 불합격 건수" value={T.D.ngCount} unit="건"
                    tone={T.D.ngCount ? C.bad : undefined}
                    delta={<DeltaChip cur={T.D.ngCount} prev={T.Y.ngCount} goodDown label="vs 어제" />}
                    note={<AvgNotes cur={T.D.ngCount} W={T.W.ngCount} wkDays={T.wkDays} M={T.PM.ngCount} pmDays={T.pmDays} unit="건" />} />

                <BigTile delay={0.15} lamp={tone} label="오늘 부적합 수량" value={T.D.ngQty} unit="EA"
                    tone={T.D.ngQty ? C.bad : undefined}
                    delta={<DeltaChip cur={T.D.ngQty} prev={T.Y.ngQty} goodDown label="vs 어제" />}
                    note={<>
                        <div className="ib-a0avg">불량률 <b className="tabular-nums"
                            style={{ color: dayState === 'over' ? 'var(--ib-bad)' : 'var(--ib-ok)' }}>{fmtRate(T.D.ngQty, T.D.inQty)}</b></div>
                        <AvgNotes cur={T.D.ngQty} W={T.W.ngQty} wkDays={T.wkDays} M={T.PM.ngQty} pmDays={T.pmDays} unit="EA" dec={0} />
                    </>} />

                {/* ── 2층 ① 누계 ── */}
                <Card className="ib-a0roll" delay={0.18}>
                    <SectionTitle title="누계" subtitle="기준일까지 쌓인 값" />
                    <div className="ib-cardbody ib-scroll">
                        <RollBlock title="이번 주" label="전주" S={T.W} P={T.Wp}
                            sub={`${T.wk.start.slice(5)} ~ ${T.wk.end.slice(5)} · 전주 같은 기간 대비`} />
                        <RollBlock title="이번 달" label="전월" S={T.M} P={T.Mp}
                            sub={`${T.mo.start.slice(5)} ~ ${T.mo.end.slice(5)} · 전월 같은 기간 대비`} />
                    </div>
                </Card>

                {/* ── 2층 ② 오늘 불합격 ── */}
                <Card className="ib-a0fails" delay={0.21}>
                    <SectionTitle title="오늘 불합격" subtitle={`기준일 ${asOf} · 판정 불합격`}
                        right={<StatusBadge tone={T.fails.length ? 'bad' : 'ok'}>{fmt(T.fails.length)}건</StatusBadge>} />
                    <div className="ib-cardbody">
                        {T.fails.length === 0 ? (
                            <div className="ib-a0zero">
                                {/* P7 r7 : 이 체크도 화면 높이를 따라간다. 768px 짜리 TV 에서 92px 는 너무 크다. */}
                                <CheckCircle2
                                    style={tv
                                        ? { width: 'clamp(44px, 8.5vh, 92px)', height: 'clamp(44px, 8.5vh, 92px)', flex: 'none' }
                                        : { width: 52, height: 52, flex: 'none' }}
                                    strokeWidth={1.6} aria-hidden="true" />
                                <b style={{ fontSize: tv ? 'var(--ib-ttl)' : 'var(--ib-ttl)', fontWeight: 800 }}>오늘 불합격 0건</b>
                                {noData && (
                                    <span style={{ fontSize: 'var(--ib-lbl)', color: 'var(--ib-ink4)', fontWeight: 600 }}>
                                        기준일에 등록된 검사 자료가 없다{span && span.max ? ` · 최신 자료 ${span.max}` : ''}
                                    </span>
                                )}
                            </div>
                        ) : (
                            <div className="ib-scroll">
                                <table className="ib-table" style={{ fontSize: 'var(--ib-lbl)' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ textAlign: 'left', padding: '5px 8px 5px 0' }}>업체</th>
                                            <th style={{ textAlign: 'left', padding: '5px 8px 5px 0' }}>품번</th>
                                            <th style={{ textAlign: 'left', padding: '5px 8px 5px 0' }}>품명</th>
                                            <th style={{ textAlign: 'right', padding: '5px 8px 5px 0' }}>부적합수량</th>
                                            <th style={{ textAlign: 'left', padding: '5px 0' }}>보고서번호</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {T.fails.map((f) => (
                                            <tr key={f.key}>
                                                <td style={{ padding: '6px 8px 6px 0', color: 'var(--ib-ink)', fontWeight: 700 }}>{f.supplier}</td>
                                                <td className="tabular-nums" style={{ padding: '6px 8px 6px 0', color: 'var(--ib-ink2)' }}>{f.itemCode}</td>
                                                <td style={{ padding: '6px 8px 6px 0', color: 'var(--ib-ink2)' }}>{f.itemName}</td>
                                                <td className="tabular-nums" style={{ padding: '6px 8px 6px 0', textAlign: 'right', fontWeight: 800, color: 'var(--ib-bad)' }}>{fmt(f.ngQty)}</td>
                                                <td className="tabular-nums" style={{ padding: '6px 0', color: f.reportNo === '없음' ? 'var(--ib-ink4)' : 'var(--ib-ink2)' }}>{f.reportNo}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </Card>

                {/* ── 2층 ③ 최근 검사 티커 ── */}
                <Card className="ib-a0tick" delay={0.24}>
                    <SectionTitle title="최근 검사"
                        subtitle={tv ? `최근 ${fmt(T.recent.length)}건 · 천천히 흐른다` : `최근 ${fmt(T.recent.length)}건 · 최신순`} />
                    <div className="ib-cardbody">
                        {T.recent.length === 0 ? <Empty t="검사 기록이 없다" /> : (
                            <div className="ib-tk">
                                <div className={`ib-tk-track ${roll ? 'run' : ''}`}>
                                    <div className="ib-tk-set ib-tk-orig">{rows('a')}</div>
                                    {roll && <div className="ib-tk-set" aria-hidden="true">{rows('b')}</div>}
                                </div>
                            </div>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default A0Today;
