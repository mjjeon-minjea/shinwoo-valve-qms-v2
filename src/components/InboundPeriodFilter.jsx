/* ─────────────────────────────────────────────────────────────────────────────
   InboundPeriodFilter.jsx — 인수검사 기간 필터 (A안, 한 줄)   (플랜 042 / P9 r9)

   배치안 r0 「A안 — 한 줄」 확정본이다. 다만 **연/월 셀렉트는 넣지 않았다**(차장 확정).
   빠른기간 칩이 그 일을 이미 하고, 셀렉트 2개는 한 줄을 넘기게 만든다.

     [빠른기간] 전체·올해·이번달·최근30일·최근7일   [직접] 시작일 ~ 종료일   ⟶   [묶음] 일별|월별|년별

   동작 규칙 (배치안 r0 표 그대로)
     · 칩을 누르면 시작~종료가 채워진다. **칩은 상태가 아니다** — 진짜 상태는 {start,end} 하나뿐이다.
     · 날짜를 직접 고치면 칩 강조가 풀린다(‘직접 지정’). 기간 값은 여전히 {start,end} 하나다.
     · 묶음은 추이 차트 X축만 바꾼다. KPI·도넛·Top5·품목유형·SPC 는 기간 합계를 그대로 쓴다.
     · 자동 묶음 — 기간 ≤62일 일별 / ≤24개월 월별 / 그 이상 년별.
       손으로 한 번 고르면 그 선택이 이긴다(manual). 칩이나 날짜를 바꾸면 다시 자동으로 돌아간다.
     · TV 현황판 모드에서는 이 바를 아예 그리지 않는다(부르는 쪽이 렌더를 건너뛴다).

   ── P9 r9 에서 붙은 것 ──────────────────────────────────────────────────────
     1. **showGroup={false}** — 「묶음」 덩어리를 통째로 감춘다. 묶음은 추이 차트의
        X축만 바꾸는 값이라, 추이 차트가 없는 화면(협력업체·품목·부적합 관리)에서는
        눌러도 아무 일이 일어나지 않는다. 아무 일도 안 하는 조작부는 그리지 않는다.
     2. **useSharedPeriod()** — 기간을 화면 셋이 함께 쓴다(차장 확정 09-02).
        예전엔 「대시보드」만 기간을 갖고 그것도 화면 상태(state)라 탭을 옮기면 사라졌다.
        이제 값 하나가 localStorage `inbound_period` 에 살고, 대시보드·협력업체·
        품목·부적합 관리가 **같은 값을 읽고 쓴다**. 한 화면에서 「최근 30일」을 누르면
        다른 화면도 최근 30일이다.
        · TV 현황판은 예전대로 「올해 · 월별」 고정이다 — 저장값을 읽지도 쓰지도 않는다
          (부르는 쪽이 eff 로 갈아 끼운다).
        · 같은 탭 안의 다른 화면에는 모듈 안 구독자 목록으로 알린다. 다른 **창**에는
          브라우저의 storage 이벤트가 알린다.
        · localStorage 를 못 쓰는 환경(사설 모드·차단)에서도 화면은 그대로 돈다 —
          저장만 안 될 뿐 그 화면 안에서는 정상 동작한다.

   상태는 부모가 들고 있다(제어 컴포넌트). 이 파일은 그리고 알리는 일만 한다.
   ───────────────────────────────────────────────────────────────────────────── */
import React, { useCallback, useEffect, useState } from 'react';
import { QUICK_PERIODS, GROUPS, quickRange, autoGroup, daySpan } from '../lib/inboundStats';
import { Chip, Segmented } from './inbound/ui';

/* ═════════════════════════════════════════════════════════════════════════════
   공유 기간 — localStorage 키 하나 (화면 셋이 같은 값을 본다)
   ═════════════════════════════════════════════════════════════════════════════ */
export const PERIOD_KEY = 'inbound_period';

const GROUP_KEYS = GROUPS.map((g) => g.key);
const DEFAULT_PERIOD = { range: { start: '', end: '' }, quick: 'all', group: 'day', manualGroup: false };

/** 저장값 → 화면이 쓰는 모양. 모르는 값이 들어 있으면 기본값으로 되돌린다. */
function normalize(o) {
    if (!o || typeof o !== 'object') return null;
    const r = o.range || {};
    const g = GROUP_KEYS.indexOf(o.group) >= 0 ? o.group : 'day';
    const q = o.quick === null || o.quick === undefined ? null : String(o.quick);
    return {
        range: { start: String(r.start || ''), end: String(r.end || '') },
        quick: q,
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
 * 화면 셋이 함께 쓰는 기간 상태.
 * @param {{min:string,max:string}} span  대장에서 자료가 있는 전 구간(dataSpan 결과)
 * @returns {[{range,quick,group,manualGroup}, (next)=>void]}
 */
export function useSharedPeriod(span) {
    const [flt, setFlt] = useState(() => readPeriod() || DEFAULT_PERIOD);

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
        const v = normalize(next) || DEFAULT_PERIOD;
        setFlt(v);
        writePeriod(v);
    }, []);

    /* 자료 구간이 들어오면 한 번 채운다.
       · 저장된 기간이 아예 없으면 '전체'로 맞춘다.
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
        set({ range: { start: min, end: max }, quick: 'all', group: autoGroup(min, max), manualGroup: false });
    }, [min, max, flt.range.start, flt.range.end, flt.quick, set]);

    return [flt, set];
}

/**
 * @param {{start:string,end:string}} range      현재 기간 (유일한 진짜 상태)
 * @param {string|null} quick                    강조할 칩 key ('직접 지정'이면 null)
 * @param {string} group                         'day' | 'month' | 'year'
 * @param {boolean} manualGroup                  묶음을 손으로 골랐는가
 * @param {{min:string,max:string}} span         자료가 있는 전 구간 (date input 의 min/max)
 * @param {boolean} showGroup                    「묶음」을 그리는가 (기본 true)
 * @param {React.ReactNode} right                묶음 자리에 대신 놓을 것 (선택)
 * @param {(next:{range,quick,group,manualGroup})=>void} onChange
 */
const InboundPeriodFilter = ({ range, quick, group, manualGroup, span, onChange, today, showGroup, right, style }) => {
    const s = span || { min: '', max: '' };
    const withGroup = showGroup === undefined ? true : !!showGroup;

    const emit = (next) => { if (typeof onChange === 'function') onChange(next); };

    /* 칩 — 날짜를 채우고 칩을 강조한다. 묶음은 자동으로 되돌린다. */
    const pickQuick = (key) => {
        const r = quickRange(key, { min: s.min, max: s.max, today });
        emit({ range: r, quick: key, group: autoGroup(r.start, r.end), manualGroup: false });
    };

    /* 날짜 직접 수정 — 칩 강조를 풀고, 묶음은 자동으로 되돌린다. */
    const setDate = (which, val) => {
        const r = { ...range, [which]: val };
        if (r.start && r.end && r.start > r.end) {
            /* 뒤집힌 기간은 만들지 않는다. 방금 고친 쪽에 맞춰 반대쪽을 끌어온다. */
            if (which === 'start') r.end = val; else r.start = val;
        }
        emit({ range: r, quick: null, group: autoGroup(r.start, r.end), manualGroup: false });
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
                {QUICK_PERIODS.map((q) => (
                    <Chip key={q.key} on={quick === q.key} onClick={() => pickQuick(q.key)} aria-pressed={quick === q.key}>
                        {q.label}
                    </Chip>
                ))}
            </div>

            <span style={{ ...lbl, marginLeft: 4 }}>직접</span>
            <input type="date" aria-label="시작일" style={dateStyle}
                min={s.min || undefined} max={s.max || undefined}
                value={range.start || ''} onChange={(e) => setDate('start', e.target.value)} />
            <span style={{ color: 'var(--ib-ink4)' }}>~</span>
            <input type="date" aria-label="종료일" style={dateStyle}
                min={s.min || undefined} max={s.max || undefined}
                value={range.end || ''} onChange={(e) => setDate('end', e.target.value)} />

            <span className="flex-1" />

            {/* 이 셋은 한 덩어리다 — 줄바꿈이 나도 '묶음' 라벨이 컨트롤과 떨어지지 않게 묶어 둔다.
                P9 r9 : 추이 차트가 없는 화면은 showGroup={false} 로 통째로 감춘다. */}
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
        </div>
    );
};

export default InboundPeriodFilter;
