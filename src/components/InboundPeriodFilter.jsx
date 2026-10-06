/* ─────────────────────────────────────────────────────────────────────────────
   InboundPeriodFilter.jsx — 인수검사 기간 필터   (플랜 042 / P15 r15)

   r9 → r15 (차장 확정 09-09) — **칩이 바뀌었다.**

     예전 :  [전체] [올해] [이번달] [최근 30일] [최근 7일]   [직접] 시작 ~ 종료
     지금 :  [전체] [연도] [월] [직접 기간]                    선택 「2026년 8월」

   왜 —  「최근 30일」·「최근 7일」은 **오늘로부터** 세는 값이라 어제 본 화면과 오늘 본
   화면의 숫자가 다르다. 회의에서 「지난주에 본 그 숫자」를 다시 못 찾는다. 「이번달」도
   달이 바뀌면 말없이 다른 달이 된다. 현업이 실제로 말하는 단위는 **연도와 달**이다 —
   「8월 실적」·「올해 전체」. 그래서 칩을 그 둘로 바꾸고, 고른 것을 화면에 글자로
   적는다(「2026년 8월」). 무엇을 보고 있는지가 화면에 남아야 한다.

   ── 동작 ────────────────────────────────────────────────────────────────────
     · [전체]      자료가 있는 전 구간.
     · [연도]      누르면 **자료가 있는 연도** 칩이 아래에 펼쳐진다(예 2025·2026).
                   자료가 한 줄도 없는 해는 칩을 만들지 않는다.
     · [월]        누르면 연도 칩 + 1~12월 칩이 펼쳐진다.
                   그 해에 자료가 없는 달은 **흐리게 잠근다**(누를 수 없다).
     · [직접 기간] 누르면 시작일~종료일 두 칸이 펼쳐진다. 날짜를 고치면 선택은
                   「직접 지정」이 된다.
     · 진짜 상태는 예전과 똑같이 **{start,end} 한 쌍뿐**이다. 칩은 그 쌍을 채우는
       버튼이고, quick 은 「무엇을 눌러서 채운 값인가」를 적어 두는 이름표다.
     · 묶음(일별/월별/년별) 자동 규칙은 **한 줄도 안 고쳤다**(autoGroup) —
       월 선택 → 일별 · 연도 → 월별 · 전체 → 길이에 따라 월별/년별.
       손으로 고르면 그 선택이 이긴다. 칩이나 날짜를 바꾸면 다시 자동으로 돌아간다.
     · TV 현황판 모드에서는 이 바를 아예 그리지 않는다(부르는 쪽이 렌더를 건너뛴다).

   ── 저장 (localStorage `inbound_period`) ────────────────────────────────────
     화면 넷(대시보드·협력업체·품목·부적합)이 **같은 값**을 읽고 쓴다. 열쇠 이름과
     생김새는 r9 그대로다. quick 값만 늘었다 —
       'all' · 'y:2026' · 'm:2026-08' · null(직접 지정)
     **옛 값은 읽을 때 옮긴다**(normalize) —
       'year'(올해) → 'y:그 범위의 해' · 'month'(이번달) → 'm:그 범위의 달'
       'd30' · 'd7' · 모르는 값 → null(직접 지정)
     날짜 두 개는 손대지 않으므로 옮겨진 뒤에도 **화면의 숫자는 어제와 같다**.
     기본값은 **올해**다(예전엔 '전체'였다 — 차장 확정 09-09).

   상태는 부모가 들고 있다(제어 컴포넌트). 이 파일은 그리고 알리는 일만 한다.
   ───────────────────────────────────────────────────────────────────────────── */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    GROUPS, quickRange, autoGroup, daySpan,
    PERIOD_MODES, yearQuick, monthQuick, periodMode, periodYear, periodLabel,
    yearRange, monthRange, dataYears, dataMonths,
} from '../lib/inboundStats';
import { Chip, Segmented } from './inbound/ui';

/* ═════════════════════════════════════════════════════════════════════════════
   공유 기간 — localStorage 열쇠 하나 (화면 넷이 같은 값을 본다)
   ═════════════════════════════════════════════════════════════════════════════ */
export const PERIOD_KEY = 'inbound_period';

const GROUP_KEYS = GROUPS.map((g) => g.key);

/** 그 해 전체를 고른 상태 한 벌 */
const yearPeriod = (y) => {
    const r = yearRange(y);
    return { range: r, quick: yearQuick(y), group: autoGroup(r.start, r.end), manualGroup: false };
};

/** 기본값 = **올해**. 자료가 올해 앞에서 끝났으면 자료가 있는 마지막 해다
    (없는 해를 기본으로 띄우면 첫 화면이 「자료 없음」이 된다). */
function defaultPeriod(span) {
    const now = new Date().getFullYear();
    const max = (span && span.max) || '';
    const y = (max && Number(max.slice(0, 4)) < now) ? Number(max.slice(0, 4)) : now;
    return yearPeriod(y);
}

/** 옛 quick 값을 새 값으로 옮긴다. 날짜({start,end})는 건드리지 않는다. */
function migrateQuick(q, r) {
    if (q === null || q === undefined) return null;
    const s = String(q);
    if (s === 'all') return 'all';
    const m = periodMode(s);
    if (m === 'year' || m === 'month') return s;      /* 이미 새 값이다 */
    const st = String((r && r.start) || '');
    if (s === 'year') {
        return yearQuick(st.length >= 4 ? Number(st.slice(0, 4)) : new Date().getFullYear());
    }
    if (s === 'month' && st.length >= 7) {
        return monthQuick(Number(st.slice(0, 4)), Number(st.slice(5, 7)));
    }
    /* 'd30' · 'd7' · 모르는 값 — 날짜는 살아 있으므로 「직접 지정」으로 둔다 */
    return null;
}

/** 저장값 → 화면이 쓰는 모양. 모르는 값이 들어 있으면 기본값으로 되돌린다. */
function normalize(o) {
    if (!o || typeof o !== 'object') return null;
    const r = o.range || {};
    const range = { start: String(r.start || ''), end: String(r.end || '') };
    const g = GROUP_KEYS.indexOf(o.group) >= 0 ? o.group : 'day';
    return {
        range,
        quick: migrateQuick(o.quick, range),
        group: g,
        manualGroup: !!o.manualGroup,
    };
}

function readPeriod() {
    try {
        const raw = window.localStorage.getItem(PERIOD_KEY);
        return raw === null ? null : normalize(JSON.parse(raw));
    } catch (e) {
        return null;   /* 사설 모드·차단·깨진 값 — 없는 것으로 친다 */
    }
}

/* 같은 탭 안에서 열려 있는 다른 화면들. Set 하나면 충분하다(화면이 넷뿐이다). */
const subs = new Set();

function writePeriod(v) {
    try { window.localStorage.setItem(PERIOD_KEY, JSON.stringify(v)); } catch (e) { /* 저장 못 해도 화면은 돈다 */ }
    subs.forEach((fn) => { try { fn(v); } catch (e) { /* 한 구독자가 터져도 나머지는 받는다 */ } });
}

/**
 * 화면 넷이 함께 쓰는 기간 상태.
 * @param {{min:string,max:string}} span  대장에서 자료가 있는 전 구간(dataSpan 결과)
 * @returns {[{range,quick,group,manualGroup}, (next)=>void]}
 */
export function useSharedPeriod(span) {
    const [flt, setFlt] = useState(() => readPeriod() || defaultPeriod(span));

    /* 다른 화면(같은 탭) · 다른 창(storage 이벤트)에서 바뀌면 따라간다 */
    useEffect(() => {
        const mine = (v) => setFlt(v);
        subs.add(mine);
        const onStorage = (e) => {
            if (e && e.key !== null && e.key !== PERIOD_KEY) return;
            const v = readPeriod();
            if (v) setFlt(v);
        };
        window.addEventListener('storage', onStorage);
        return () => { subs.delete(mine); window.removeEventListener('storage', onStorage); };
    }, []);

    const set = useCallback((next) => {
        /* 깨진 값이 들어오면 기본값(올해)으로 되돌린다 — span 을 안 보므로 신원이 안 바뀐다 */
        const v = normalize(next) || defaultPeriod(null);
        setFlt(v);
        writePeriod(v);
    }, []);

    /* 자료 구간이 들어오면 한 번 채운다.
       · 저장된 기간이 아예 없으면 **올해**로 맞춘다(r15 — 예전엔 '전체'였다).
       · 저장된 값이 '전체'인데 자료가 늘어 구간이 달라졌으면 다시 맞춘다
         ('전체'는 늘 **자료가 있는 전 구간**이어야 한다).
       그 밖에는 사람이 고른 값이 이긴다 — 화면을 옮겨도 기간이 되돌아가지 않는다. */
    const min = (span && span.min) || '';
    const max = (span && span.max) || '';
    useEffect(() => {
        if (!min) return;
        const empty = !(flt.range.start && flt.range.end);
        const staleAll = flt.quick === 'all' && (flt.range.start !== min || flt.range.end !== max);
        if (!empty && !staleAll) return;
        if (staleAll) set({ range: { start: min, end: max }, quick: 'all', group: autoGroup(min, max), manualGroup: false });
        else set(defaultPeriod({ min, max }));
    }, [min, max, flt.range.start, flt.range.end, flt.quick, set]);

    return [flt, set];
}

/**
 * @param {{start:string,end:string}} range      현재 기간 (유일한 진짜 상태)
 * @param {string|null} quick                    'all' | 'y:YYYY' | 'm:YYYY-MM' | null
 * @param {string} group                         'day' | 'month' | 'year'
 * @param {boolean} manualGroup                  묶음을 손으로 골랐는가
 * @param {{min:string,max:string}} span         자료가 있는 전 구간 (date input 의 min/max)
 * @param {Array} rows                           대장 원본 — 연도·월 칩을 여기서 뽑는다
 * @param {boolean} showGroup                    「묶음」을 그리는가 (기본 true)
 * @param {React.ReactNode} right                묶음 자리에 대신 놓을 것 (선택)
 * @param {(next:{range,quick,group,manualGroup})=>void} onChange
 */
const InboundPeriodFilter = ({ range, quick, group, manualGroup, span, rows, onChange, today, showGroup, right, style }) => {
    const s = span || { min: '', max: '' };
    const withGroup = showGroup === undefined ? true : !!showGroup;
    const mode = periodMode(quick);

    /* 아래에 펼쳐 놓을 줄. **처음에는 닫혀 있다.**
       열어 둔 채로 뜨면 이 바가 두 줄이 되고, 「대시보드」는 화면 한 장에 딱 맞춰 놓은
       격자라(ib-fill) 한 줄이 늘면 아래가 잘리거나 스크롤이 생긴다. 지금 고른 것은
       칩 색이 아니라 오른쪽 「선택 2026년 8월」 글자가 말해 준다 — 열어 둘 이유가 없다. */
    const [open, setOpen] = useState(null);

    /* 자료가 있는 연도. rows 를 안 넘긴 화면은 자료 구간(min~max)의 해로 대신한다. */
    const years = useMemo(() => {
        const got = dataYears(rows);
        if (got.length) return got;
        const a = s.min ? Number(s.min.slice(0, 4)) : null;
        const b = s.max ? Number(s.max.slice(0, 4)) : a;
        if (!Number.isFinite(a)) return [];
        const out = [];
        for (let y = a; y <= b; y += 1) out.push(y);
        return out;
    }, [rows, s.min, s.max]);

    /* 「월」 줄이 보고 있는 해. 고른 값 → 자료의 마지막 해 → 올해 차례로 잡는다. */
    const [panelYear, setPanelYear] = useState(() => (
        periodYear(quick) || (s.max ? Number(s.max.slice(0, 4)) : new Date().getFullYear())
    ));
    useEffect(() => {
        const y = periodYear(quick);
        if (y) setPanelYear(y);
    }, [quick]);
    const shownYear = years.indexOf(panelYear) >= 0 ? panelYear : (years[years.length - 1] || panelYear);
    const monthsWith = useMemo(() => dataMonths(rows, shownYear), [rows, shownYear]);

    const emit = (next) => { if (typeof onChange === 'function') onChange(next); };
    const put = (r, q) => emit({ range: r, quick: q, group: autoGroup(r.start, r.end), manualGroup: false });

    const pickAll = () => { setOpen(null); put(quickRange('all', { min: s.min, max: s.max, today }), 'all'); };
    const pickYear = (y) => put(yearRange(y), yearQuick(y));
    const pickMonth = (y, m) => put(monthRange(y, m), monthQuick(y, m));

    /* 날짜 직접 수정 — 칩 강조를 풀고(「직접 지정」), 묶음은 자동으로 되돌린다. */
    const setDate = (which, val) => {
        const r = { ...range, [which]: val };
        if (r.start && r.end && r.start > r.end) {
            /* 뒤집힌 기간은 만들지 않는다. 방금 고친 쪽에 맞춰 반대쪽을 끌어온다. */
            if (which === 'start') r.end = val; else r.start = val;
        }
        put(r, null);
    };

    /* 묶음 — 손으로 고른 것이므로 자동 추천을 덮는다(manual). */
    const setGroup = (g) => emit({ range, quick, group: g, manualGroup: true });

    const days = daySpan(range.start, range.end);
    const auto = autoGroup(range.start, range.end);
    const autoLabel = (GROUPS.find((g) => g.key === auto) || {}).label;

    const dateStyle = {
        padding: '6px 10px', borderRadius: 10, border: '1px solid rgba(15,23,42,.14)',
        background: 'rgba(255,255,255,.7)', fontSize: 'var(--ib-lbl)', color: 'var(--ib-ink2)',
        fontFamily: 'inherit',
    };
    const lbl = { fontSize: 'var(--ib-lbl)', fontWeight: 700, color: 'var(--ib-ink3)', whiteSpace: 'nowrap' };
    const rowStyle = {
        width: '100%', marginTop: 2, paddingTop: 10, borderTop: '1px solid var(--ib-grid)',
    };

    /* 칩 하나를 누르면 그 줄이 펼쳐진다. [전체]만 곧바로 값을 바꾼다 —
       나머지 셋은 **고를 것이 더 있으므로** 누른 순간에는 아무 값도 안 바꾼다.
       (누르자마자 기간이 확 바뀌면 아래 줄에서 고르기도 전에 화면이 갈린다.) */
    const clickMode = (key) => {
        if (key === 'all') { pickAll(); return; }
        setOpen((o) => (o === key ? null : key));
    };

    return (
        <div className="ib-fade flex flex-wrap items-center gap-x-3.5 gap-y-2.5"
            style={{
                marginBottom: 18, padding: '12px 16px', borderRadius: 16, animationDelay: '.06s',
                background: 'var(--ib-card)', border: '1px solid var(--ib-cardline)',
                boxShadow: 'var(--ib-shadow), 0 0 0 1px var(--ib-ring)',
                WebkitBackdropFilter: 'blur(14px)', backdropFilter: 'blur(14px)',
                ...style,
            }}>
            <span style={lbl}>빠른기간</span>
            <div className="flex flex-wrap gap-1.5">
                {PERIOD_MODES.map((q) => (
                    <Chip key={q.key} on={mode === q.key || open === q.key} onClick={() => clickMode(q.key)}
                        aria-pressed={mode === q.key} aria-expanded={q.key === 'all' ? undefined : open === q.key}>
                        {q.label}
                    </Chip>
                ))}
            </div>

            {/* 무엇을 보고 있는지 글자로 적는다 — 칩 색만으로는 「2026년 8월」이 안 읽힌다 */}
            <span className="inline-flex items-baseline gap-1.5 flex-none">
                <span style={lbl}>선택</span>
                <b className="tabular-nums" style={{ fontSize: 'var(--ib-lbl)', fontWeight: 800, color: 'var(--ib-ink)' }}>
                    {periodLabel(quick)}
                </b>
                <span className="tabular-nums" style={{ fontSize: 'calc(var(--ib-lbl)*.92)', color: 'var(--ib-ink4)' }}>
                    {range.start || '—'} ~ {range.end || '—'}
                </span>
            </span>

            <span className="flex-1" />

            {/* 이 셋은 한 덩어리다 — 줄바꿈이 나도 '묶음' 라벨이 컨트롤과 떨어지지 않게 묶어 둔다.
                추이 차트가 없는 화면은 showGroup={false} 로 통째로 감춘다. */}
            <span className="inline-flex items-center gap-2.5 flex-none">
                <span className="tabular-nums" style={{ fontSize: 'calc(var(--ib-lbl)*.95)', color: 'var(--ib-ink4)' }}
                    title={withGroup && manualGroup && auto !== group ? `자동 추천은 ${autoLabel} 이다 (지금은 손으로 고른 값이 이긴다)` : undefined}>
                    {days > 0 ? `${days.toLocaleString('ko-KR')}일` : '기간 미지정'}
                    {withGroup && manualGroup && auto !== group ? ` · 추천 ${autoLabel}` : ''}
                </span>
                {withGroup && <span style={lbl}>묶음</span>}
                {withGroup && <Segmented items={GROUPS} value={group} onChange={setGroup} ariaLabel="묶음 단위" />}
                {right}
            </span>

            {/* ── 펼침 줄 ① 연도 ── */}
            {open === 'year' && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2" style={rowStyle}>
                    <span style={lbl}>연도</span>
                    {years.length === 0
                        ? <span style={{ fontSize: 'var(--ib-lbl)', color: 'var(--ib-ink4)' }}>자료가 있는 연도가 없다</span>
                        : years.map((y) => (
                            <Chip key={y} on={quick === yearQuick(y)} onClick={() => pickYear(y)}
                                aria-pressed={quick === yearQuick(y)}>{y}년</Chip>
                        ))}
                </div>
            )}

            {/* ── 펼침 줄 ② 월 ── 연도를 먼저 고르고 달을 고른다 */}
            {open === 'month' && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2" style={rowStyle}>
                    <span style={lbl}>연도</span>
                    {years.map((y) => (
                        <Chip key={y} on={shownYear === y} onClick={() => setPanelYear(y)}
                            aria-pressed={shownYear === y}>{y}년</Chip>
                    ))}
                    <span style={{ ...lbl, marginLeft: 6 }}>월</span>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                        const has = monthsWith.indexOf(m) >= 0;
                        const on = quick === monthQuick(shownYear, m);
                        /* 자료가 없는 달은 **흐리게 잠근다**. 지우지 않는 이유는 1~12월이
                           늘 같은 자리에 있어야 눈이 달을 세지 않고 짚기 때문이다. */
                        return (
                            <span key={m} style={{ opacity: has ? 1 : 0.38 }}
                                title={has ? undefined : `${shownYear}년 ${m}월 자료 없음`}>
                                <Chip on={on} disabled={!has} onClick={() => has && pickMonth(shownYear, m)}
                                    aria-pressed={on} aria-disabled={!has}>{m}월</Chip>
                            </span>
                        );
                    })}
                    {monthsWith.length === 0 && (
                        <span style={{ fontSize: 'calc(var(--ib-lbl)*.95)', color: 'var(--ib-ink4)' }}>
                            {shownYear}년에는 검사 기록이 없다
                        </span>
                    )}
                </div>
            )}

            {/* ── 펼침 줄 ③ 직접 기간 ── */}
            {open === 'custom' && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2" style={rowStyle}>
                    <span style={lbl}>직접</span>
                    <input type="date" aria-label="시작일" style={dateStyle}
                        min={s.min || undefined} max={s.max || undefined}
                        value={range.start || ''} onChange={(e) => setDate('start', e.target.value)} />
                    <span style={{ color: 'var(--ib-ink4)' }}>~</span>
                    <input type="date" aria-label="종료일" style={dateStyle}
                        min={s.min || undefined} max={s.max || undefined}
                        value={range.end || ''} onChange={(e) => setDate('end', e.target.value)} />
                    <span style={{ fontSize: 'calc(var(--ib-lbl)*.95)', color: 'var(--ib-ink4)' }}>
                        자료 구간 {s.min || '—'} ~ {s.max || '—'}
                    </span>
                </div>
            )}
        </div>
    );
};

export default InboundPeriodFilter;
