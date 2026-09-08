/* ─────────────────────────────────────────────────────────────────────────────
   areas/A4Capability.jsx — 「대시보드」 영역 4 · 공정능력(Cpk)   (플랜 042 / P9 r9)

   r8 → r9 : **줄 여백만** 줄였다(계산·구성은 그대로다). 대시보드에서 스크롤 막대를
   없앴으므로 「요주의 하위 5개사」 다섯 줄이 1366×768 짜리 TV 에서도 카드 안에
   전부 들어와야 한다 — r8 값(5px · 0.82em)으로는 다섯째 줄이 잘려 나갔다.

   승인 구성안 r0 의 .g4 격자 — 1fr 2fr 1fr × 2줄.
     · 1열(2줄 통칸) = 전체 판정지수 Ppk 게이지 (크게)
     · 2열 위        = 품번별 Cpk 등급 분포 (237 품번 — 파생값)
     · 3열 위        = 요주의 하위 5개사      (P4 r4 의 3개사 → 5개사)
     · 2열 아래      = 협력업체 등급 분포 (24개사)
     · 3열 아래      = 우수 상위 3개사        ← 신규(칭찬용 · 협력업체 평가 근거)

   **기간 필터와 무관한 전체 스냅샷**이다. 측정값기록서는 날짜 축이 대장과 다르다.
   그래서 이 영역에서는 기간 필터 바를 아예 그리지 않고 안내줄로 바꾼다(화면 쪽에서 한다).

   「우수 상위 3개사」의 자격 — 표본이 적으면 Ppk 는 쉽게 커진다. 그래서 **n ≥ 30** 을 먼저 본다.
   30 이상인 업체가 3곳이 안 되면 남은 업체 중 좋은 순으로 채우되 그 줄에 「표본 적음」을 적는다.
   자격을 숨기고 순위만 보이면 칭찬이 거짓말이 된다.
   ───────────────────────────────────────────────────────────────────────────── */
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import {
    Card, SectionTitle, GaugeRing, GradeStrip, GradeChip, GhostButton, Loading, Empty,
    fmt, fx, gradeColor, useInboundTheme,
} from '../ui';
import { loadInboundSpc, gradeOf, partGrades, gradeCounts } from '../../../lib/inboundSpc';

const MIN_N = 30;

/** 업체 한 줄 (지수 · 이름 · n/규격외 · 등급 알약)
    TV 는 글자가 두 배라 줄바꿈이 나면 5줄이 카드를 넘긴다 — 이름·보조줄 모두 한 줄로 자른다. */
const VendorRow = ({ v, onPick, note, tv }) => (
    <button type="button" onClick={onPick} className="w-full flex items-center gap-2.5 text-left"
        style={{ padding: tv ? '1px 0' : '7px 0', borderBottom: '1px solid var(--ib-grid)', cursor: onPick ? 'pointer' : 'default' }}>
        <span className="tabular-nums text-right flex-none"
            style={{
                width: '2.8em', fontSize: tv ? 'calc(var(--ib-num)*.70)' : 'var(--ib-num)',
                fontWeight: 800, letterSpacing: '-.03em', color: gradeColor(v.grade).bar,
            }}>
            {v.idx !== null && v.idx !== undefined ? v.idx.toFixed(2) : '—'}
        </span>
        <span className="min-w-0 flex-1">
            <b className="block truncate" style={{ fontSize: tv ? 'calc(var(--ib-lbl)*.86)' : 'var(--ib-lbl)', fontWeight: 700, color: 'var(--ib-ink)' }}>{v.vendor}</b>
            <span className="block truncate tabular-nums" style={{ fontSize: tv ? 'calc(var(--ib-lbl)*.7)' : 'calc(var(--ib-lbl)*.9)', color: 'var(--ib-ink4)' }}>
                n={v.n} · 규격외 {v.oos}건{note ? ` · ${note}` : ''}
            </span>
        </span>
        <GradeChip g={v.grade} />
    </button>
);

const A4Capability = ({ tv, go, onInfo }) => {
    const C = useInboundTheme();
    const [st, setSt] = useState({ loading: true, err: null, D: null, rows: null });

    const load = async (force) => {
        setSt({ loading: true, err: null, D: null, rows: null });
        try {
            const { D, rows } = await loadInboundSpc({ force });
            setSt({ loading: false, err: null, D, rows });
        } catch (e) {
            console.error('[대시보드/공정능력]', e);
            setSt({ loading: false, err: e.message || String(e), D: null, rows: null });
        }
    };
    useEffect(() => { load(false); }, []);

    const parts = useMemo(() => (st.rows ? partGrades(st.rows) : []), [st.rows]);

    /* 안내줄(기간 필터 자리)에 쓸 문구를 화면에 올려 보낸다 */
    useEffect(() => {
        if (typeof onInfo !== 'function') return;
        if (st.loading) onInfo('측정값 SPC 계산 중…');
        else if (st.err) onInfo('측정값을 불러오지 못했다');
        else if (st.D) {
            const O = st.D.overall;
            onInfo(`측정값기록서 ${fmt(O.n)}개 측정치 · 기간 필터와 무관한 전체 스냅샷 · 등급 = 회사 공식 5등급`);
        }
    }, [st.loading, st.err, st.D]);   // eslint-disable-line react-hooks/exhaustive-deps

    if (st.loading) {
        return <div className="ib-area-grid" style={{ gridTemplateColumns: '1fr', gridTemplateRows: '1fr' }}>
            <Card><Loading t="측정값 SPC 계산 중…" /></Card>
        </div>;
    }
    if (st.err) {
        return <div className="ib-area-grid" style={{ gridTemplateColumns: '1fr', gridTemplateRows: '1fr' }}>
            <Card>
                <SectionTitle title="공정능력(Cpk)" subtitle="측정값기록서 기준 · 인수검사 기록 통계와 별개 항목" />
                <div className="ib-cardbody items-center gap-2"
                    style={{ flexDirection: 'row', fontSize: 'var(--ib-lbl)', color: 'var(--ib-ink3)' }}>
                    <span style={{ color: C.bad }}>⚠</span>{st.err}
                    <button type="button" onClick={() => load(true)} className="rounded-lg"
                        style={{ padding: '5px 11px', background: 'var(--ib-ink)', color: '#fff', fontWeight: 700 }}>다시 시도</button>
                </div>
            </Card>
        </div>;
    }

    const O = st.D.overall;
    const V = st.D.vendors;
    const g = gradeOf(O.idx);
    const vendCnt = gradeCounts(V);
    const partCnt = gradeCounts(parts);

    const scored = V.filter((v) => v.idx !== null && v.idx !== undefined);
    const worst = scored.slice().sort((a, b) => a.idx - b.idx).slice(0, 5);
    const bestPool = scored.slice().sort((a, b) => b.idx - a.idx);
    const qualified = bestPool.filter((v) => v.n >= MIN_N);
    const best = qualified.length >= 3
        ? qualified.slice(0, 3)
        : qualified.concat(bestPool.filter((v) => v.n < MIN_N)).slice(0, 3);

    return (
        <div className="ib-area-grid ib-g4">
            <Card style={{ gridRow: 'span 2' }} delay={0.06}>
                <SectionTitle title="전체 판정지수 Ppk" subtitle="측정값기록서 전체" />
                <div className="ib-cardbody items-center justify-center">
                    <GaugeRing value={O.idx} grade={g} size={tv ? 400 : 260} />
                    <div style={{ marginTop: 10, fontSize: 'calc(var(--ib-lbl)*.98)', color: 'var(--ib-ink3)', lineHeight: 1.5, textAlign: 'center' }}>
                        측정값 <b className="tabular-nums" style={{ color: 'var(--ib-ink)' }}>{fmt(O.n)}</b>개 · 업체 {O.vendors}곳<br />
                        규격외 <b className="tabular-nums" style={{ color: C.bad }}>{fmt(O.oos)}</b>건 ({fx(O.oospct, 1)}%)
                    </div>
                    {!tv && (
                        <div style={{ marginTop: 12 }}>
                            <GhostButton onClick={go}>협력업체 <ArrowRight className="w-3.5 h-3.5" /></GhostButton>
                        </div>
                    )}
                </div>
            </Card>

            <Card delay={0.09}>
                <SectionTitle title="품번별 Cpk 등급 분포"
                    subtitle={`${fmt(parts.length)} 품번 · 업체별과 같은 규칙을 품번 단위로 다시 적용한 파생값`} />
                <div className="ib-cardbody ib-scroll justify-center">
                    <GradeStrip counts={partCnt} total={parts.length} unit="" tv={tv} height={tv ? 56 : 40} />
                    <div style={{ marginTop: 10, fontSize: 'calc(var(--ib-lbl)*.95)', color: 'var(--ib-ink4)', lineHeight: 1.5 }}>
                        등급 = 회사 공식 5등급(특급 ≥1.67 · 1등급 ≥1.33 · 2등급 ≥1.00 · 3등급 ≥0.67 · 미만 4등급), 지수는 Ppk.
                    </div>
                </div>
            </Card>

            <Card delay={0.12}>
                <SectionTitle title="요주의 — 하위 5개사" subtitle="Ppk 낮은 순" />
                <div className="ib-cardbody ib-scroll">
                    {worst.length === 0 ? <Empty t="계산할 업체가 없다" /> : worst.map((v) => (
                        <VendorRow key={v.vendor} v={v} tv={tv} onPick={tv ? undefined : go}
                            note={v.n < MIN_N ? '표본 적음' : ''} />
                    ))}
                </div>
            </Card>

            <Card delay={0.15}>
                <SectionTitle title="협력업체 등급 분포" subtitle={`${V.length} 개사`} />
                <div className="ib-cardbody ib-scroll justify-center">
                    <GradeStrip counts={vendCnt} total={V.length} unit="" tv={tv} height={tv ? 56 : 40} />
                </div>
            </Card>

            <Card delay={0.18}>
                <SectionTitle title="우수 — 상위 3개사" subtitle={`Ppk 높은 순 · 측정치 ${MIN_N}개 이상`} />
                <div className="ib-cardbody ib-scroll">
                    {best.length === 0 ? <Empty t="계산할 업체가 없다" /> : best.map((v) => (
                        <VendorRow key={v.vendor} v={v} tv={tv} onPick={tv ? undefined : go}
                            note={v.n < MIN_N ? `표본 적음 (n<${MIN_N})` : ''} />
                    ))}
                    {qualified.length < 3 && (
                        <div style={{ marginTop: 8, fontSize: 'calc(var(--ib-lbl)*.92)', color: 'var(--ib-ink4)', lineHeight: 1.45 }}>
                            측정치 {MIN_N}개 이상인 업체가 {qualified.length}곳뿐이라 나머지는 표본이 적은 업체로 채웠다.
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
};

export default A4Capability;
