/* ─────────────────────────────────────────────────────────────────────────────
   InboundOverview.jsx — 인수검사 「대시보드」   (플랜 042 / P11 r11)

   r10 → r11 에서 바뀐 것 (차장 승인 09-03)
     ① **TV 현황판이 켜져 있는 동안 60초마다 DB 를 다시 읽는다.** 간격은 아래
        TV_REFRESH_MS 한 곳이 정한다(60000). 영역 순환 타이머와 **다른 타이머**다 —
        섞으면 순환 간격을 바꿀 때 재조회 주기까지 따라 바뀐다.
        · 조용히 받는다. 「불러오는 중…」을 다시 띄우지 않는다 — 벽걸이 TV 가 1분마다
          껌뻑이면 사람들이 화면이 죽었다고 생각한다. 보고 있던 영역·순환도 그대로다.
        · **실패하면 예전 자료를 그대로 둔다.** 지우고 '자료 없음'을 띄우면, 잠깐 끊긴
          네트워크가 "오늘 검사 0건"으로 읽힌다. 대신 머리줄에 호박색으로
          「재조회 실패 hh:mm」을 적어 화면의 숫자가 언제 것인지 밝힌다.
        · 데스크톱은 자동으로 다시 읽지 않는다. 예전대로 「새로고침」 버튼이다.
     ② **「지금 동기화」 버튼**(데스크톱 전용, 「새로고침」 옆). 구글시트 → DB 를
        사람이 직접 돌린다. 주소 규칙은 구화면(InboundHistory.jsx)이 쓰던 것을 그대로
        옮겼다 — lib/inboundStats.js 의 syncEndpoint() 를 보라.
        누르면 먼저 물어본다(두 번 눌러 두 번 도는 사고를 막는다) → 「동기화 중…」
        (버튼 잠금, 최대 90초) → 「동기화 완료 · N건」 뒤 자료를 다시 읽는다.
        **개발웹에는 동기화 백엔드가 없다.** 그래서 여기서는 실패가 정상이고,
        「이 환경에는 동기화 서버가 없다 (스테이징에서 동작)」로 뜬다. 화면은 살아 있다.
     ③ **마지막 동기화 시각을 sync_logs 에서 읽는다.** 그 표가 없거나 비면 예전처럼
        측정값 행의 synced_at 으로 되돌아가고, 그것도 없으면 「동기화 시각 없음」이다.
        60분이 넘으면 「갱신 확인 필요」 — 규칙은 r6 그대로다.

   r8 → r9 에서 바뀐 것 (차장 피드백 09-02)
     1. **기간을 화면 셋이 함께 쓴다.** 예전엔 기간이 이 화면의 state 라 탭을 옮기면
        사라졌다. 이제 useSharedPeriod() 가 localStorage `inbound_period` 하나를 읽고
        쓴다 — 여기서 「최근 30일」을 누르면 협력업체·품목·부적합 관리도 최근 30일이다.
        TV 현황판은 예전대로 「올해 · 월별」 고정이다(저장값을 건드리지 않는다).
     2. 대시보드 어디에도 **스크롤 막대가 없다**(데스크톱·TV). 목록은 줄 수를 정해
        놓고 남는 건 「외 N건」으로 적는다 — 「최근 검사」는 데스크톱에서 7줄이다.
     3. 모든 꺾은선이 type="linear" 다(A2Trend). 랭킹 막대는 두 배로 두꺼워졌다.
     4. 「최근 불합격 목록」의 칸이 모델명·사이즈로 바뀌었다(A3Nonconformance).

   r7 → r8 에서 바뀐 것 (차장 확정 09-02)
     A. 관리선이 **100 PPM** 으로 정해졌다. 값은 lib/inboundStats.js 의 PPM_TARGET
        한 곳에만 있고, 다섯 영역이 전부 그 상수를 본다. 「관리선 미설정」 문구는 사라졌다.
     B. 증감 칩의 비교 기준을 묶음이 정한다 —
          일별·월별 → **전월(직전 달) 일평균** / 년별 → **전년 동기**.
        기준 이름을 칩에 적는다(「▲ 12.3% vs 전월 일평균」). 기준 구간에 자료가 없으면
        「— 비교 자료 없음」이다. 예전의 「기간 후반 vs 전반」은 같은 자료를 반으로 갈라
        스스로와 견주던 값이라 버렸다.
     C. 스파크라인이 **묶음을 따라간다**(일별/월별/년별). 그래서 「묶음」 막대가 종합현황
        에서도 눈에 보이는 일을 한다. 시작/끝날과 최고점을 그림 밑에 적는다.
     D. 화면 글자에서 개발 용어를 걷어냈다 ('대장 행 수' → '검사 기록 건수' 등).
     E. 머리글은 어느 영역에서나 「인수검사 — 대시보드」다.
     G. 히어로 카드의 빈자리에 월별 PPM 미니 막대(최근 6개월까지 · 목표선 100 PPM).

   r5 → r6 에서 바뀐 것
     1. **영역 0 「오늘 현황」이 맨 앞에 생겼다.** 영역이 5개가 됐고, TV 현황판도
        여기서부터 돈다.  오늘 현황 · 종합현황 · 추이 · 부적합 현황 · 공정능력(Cpk)
        왜 : 벽걸이 TV 는 '분석 화면'이 아니라 '운영 화면'으로 열려야 한다. 지나가는
        사람이 오늘 무슨 일이 있었는지 1초(색) · 3초(큰 숫자) · 10초(목록)에 읽는다.
     2. 영역 0 은 기간 필터를 쓰지 않는다. 대신 **기준일** 하나로 돈다.
        · 데스크톱 : 기준일을 날짜칸으로 바꿔 지난 날을 되짚어 볼 수 있다.
          이 값은 **localStorage 에 넣지 않는다** — 다음에 열 때 지난 날짜가 남아
          "오늘 0건"으로 잘못 읽히면 위험하다. 새로 열면 언제나 오늘이다.
        · TV 현황판 : 언제나 오늘이다(사다리를 놓고 날짜를 고칠 수는 없다).
     3. 마지막 동기화 시각을 읽으려고 측정값기록서를 **곁다리로** 한 번 더 부른다.
        실패해도 대시보드는 그대로 돈다(그 값이 없으면 「동기화 시각 없음」이다).
        로더가 모듈 캐시라 공정능력 영역과 요청을 나눠 쓴다 — 표당 1회다.

   r5 에서 그대로인 것
     · 탭 id(`inbound_overview`)와 URL 해시. 즐겨찾기가 깨지면 안 된다.
     · 영역 1~4 의 내용과 격자. 이 판은 그 넷을 손대지 않았다.
     · 숫자 정의는 전부 lib/inboundStats.js 다. 여기서 다시 세지 않는다.
       불량률 = 부적합 수량 ÷ 입고 수량 (차장 확정 09-01).

   ── 상태를 어디에 두나 ────────────────────────────────────────────────────────
   Dashboard.jsx 는 `activeTab` 을 URL 해시(`#inbound_overview`)에 넣고 pushState 로 민다.
   영역까지 해시에 넣으면 그 라우팅과 싸운다. 그래서 **선택한 영역은 localStorage** 다.
     · inbound_dash_area  : 'today' | 'summary' | 'trend' | 'nc' | 'cpk'
                            ← 모르는 값이 들어 있으면(예전 판·손댄 값) 'today' 로 되돌린다.
     · inbound_tv_mode    : TV 현황판 켜짐 ('1'/'0')
     · inbound_tv_interval: 자동 순환 간격(초, 3~600)
     · inbound_period     : **화면 셋이 함께 쓰는 기간** (P9 r9 — InboundPeriodFilter 의
                            useSharedPeriod() 가 읽고 쓴다. 여기서만 쓰는 값이 아니다)
   기준일(asOf)은 여기 없다 — 위 2번의 이유로 화면 상태로만 산다.
   ───────────────────────────────────────────────────────────────────────────── */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, MonitorPlay, LayoutDashboard, LogOut, Database } from 'lucide-react';
import '../styles/inbound.css';
import InboundPeriodFilter, { useSharedPeriod } from './InboundPeriodFilter';
import {
    loadInspections, loadMeasurements, loadSyncLogs, lastSyncedAt, runSheetSync,
    summarize, bucketBy, rangeFilter, dataSpan, quickRange,
    comparisonBasis, avgStats, activeDays, prevMonthOf,
    bySupplier, byItemType, topDefectTypes,
    rateByBucket, verdictByBucket, topVendorTrend, recentFails,
    todayYmd, dayStats, rangeStats, weekRange, mtdRange, prevSameRange,
    recentRows, todayFails, addDays,
} from '../lib/inboundStats';
import {
    ScreenFrame, ScreenHeader, Card, Empty, GhostButton, Loading, ErrorCard,
    AreaBar, TvArrow, Dots, ProgressLine, IntervalDialog,
    fmt, useStickyFlag, useStickyNumber, useStickyString,
} from './inbound/ui';
import A0Today from './inbound/areas/A0Today';
import A1Summary from './inbound/areas/A1Summary';
import A2Trend, { bucketLabel } from './inbound/areas/A2Trend';
import A3Nonconformance from './inbound/areas/A3Nonconformance';
import A4Capability from './inbound/areas/A4Capability';

const TV_KEY = 'inbound_tv_mode';
const TV_IV_KEY = 'inbound_tv_interval';
const AREA_KEY = 'inbound_dash_area';

const TV_IV_DEFAULT = 10;
const TV_IV_MIN = 3;
const TV_IV_MAX = 600;

/* ── TV 현황판 자동 재조회 간격 (P11 r11) ────────────────────────────────────
   **이 한 줄이 유일한 출처다.** 60초 = 60000ms. 60분 크론(스테이징)보다 훨씬 촘촘하니
   더 줄일 이유가 없고, 더 늘리면 TV 앞의 숫자가 사람 기억보다 늦어진다. */
const TV_REFRESH_MS = 60000;

/* 자동 검증용 뒷문. **개발 빌드에서만 열린다** — 운영 빌드에서는 import.meta.env.DEV 가
   false 로 박혀 이 if 가 통째로 사라진다. 60초를 실제로 기다리지 않고 재조회를 확인하려고
   플레이라이트가 window.__IB_TV_REFRESH_MS 에 짧은 값을 넣는다. */
const tvRefreshMs = () => {
    if (import.meta.env && import.meta.env.DEV && typeof window !== 'undefined') {
        const v = Number(window.__IB_TV_REFRESH_MS);
        if (Number.isFinite(v) && v >= 500) return v;
    }
    return TV_REFRESH_MS;
};

const TOAST_MS = 6000;

const two = (n) => String(n).padStart(2, '0');
const hhmm = (t) => { const d = new Date(t); return `${two(d.getHours())}:${two(d.getMinutes())}`; };
const hhmmss = (t) => `${hhmm(t)}:${two(new Date(t).getSeconds())}`;

/* ── 확인 팝오버 ── 「지금 동기화」는 되돌릴 수 없는 일이라 한 번 묻는다.
   IntervalDialog 와 같은 껍데기(.ib-modalwrap/.ib-modal)를 쓴다 — CSS 는 손대지 않았다. */
const ConfirmSync = ({ onOk, onCancel }) => {
    const ref = useRef(null);
    useEffect(() => { if (ref.current) ref.current.focus(); }, []);
    return (
        <div className="ib-modalwrap" role="presentation"
            onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
            <div className="ib-modal" role="dialog" aria-modal="true" aria-label="지금 동기화"
                onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onCancel(); } }}>
                <b style={{ fontSize: 15, fontWeight: 800, display: 'block' }}>지금 동기화</b>
                <p style={{ marginTop: 10, fontSize: 12.5, lineHeight: 1.6, color: '#475569' }}>
                    구글시트에서 다시 불러옵니다. 진행할까요?
                </p>
                <div className="flex items-center justify-end gap-2" style={{ marginTop: 16 }}>
                    <button type="button" onClick={onCancel} className="rounded-lg"
                        style={{ padding: '8px 14px', fontSize: 12.5, fontWeight: 700, color: '#475569', background: 'rgba(15,23,42,.06)' }}>취소</button>
                    <button type="button" ref={ref} onClick={onOk} className="rounded-lg"
                        style={{ padding: '8px 16px', fontSize: 12.5, fontWeight: 800, color: '#fff', background: '#0f172a' }}>진행</button>
                </div>
            </div>
        </div>
    );
};

/* ── 알림 쪽지 ── 오른쪽 아래에 잠깐 떴다 사라진다. 화면 짜임(격자)에 끼지 않으므로
   무스크롤 규칙과 무관하다(position:fixed). 실패 문구는 사람이 읽을 한 문장이다. */
const Toast = ({ tone, text, onClose }) => {
    const bad = tone === 'bad';
    return (
        <div role="status" aria-live="polite"
            style={{
                position: 'fixed', right: 22, bottom: 22, zIndex: 90, maxWidth: 460,
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '12px 14px', borderRadius: 12,
                background: bad ? '#7f1d1d' : '#0f172a', color: '#fff',
                fontSize: 13, fontWeight: 700, lineHeight: 1.5,
                boxShadow: '0 12px 34px rgba(2,6,23,.34)',
            }}>
            <span aria-hidden="true" style={{ opacity: .85 }}>{bad ? '⚠' : '✓'}</span>
            <span style={{ flex: 1 }}>{text}</span>
            <button type="button" onClick={onClose} aria-label="알림 닫기"
                style={{ color: 'rgba(255,255,255,.7)', fontWeight: 800, padding: '0 2px' }}>✕</button>
        </div>
    );
};

/* 순서가 곧 TV 순환 순서다. 「오늘 현황」이 0번이라야 현황판이 운영 화면으로 열린다. */
const AREAS = [
    { key: 'today', label: '오늘 현황' },
    { key: 'summary', label: '종합현황' },
    { key: 'trend', label: '추이' },
    { key: 'nc', label: '부적합 현황' },
    { key: 'cpk', label: '공정능력(Cpk)' },
];
const AREA_KEYS = AREAS.map((a) => a.key);

/* ── 본체 ─────────────────────────────────────────────────────────────────── */
const InboundOverview = ({ setActiveTab }) => {
    const [st, setSt] = useState({ loading: true, err: null, rows: [] });
    const [sync, setSync] = useState(null);           // 마지막 동기화 시각 (없으면 null)
    const [tv, setTv] = useStickyFlag(TV_KEY, false);
    const [interval_, setInterval_] = useStickyNumber(TV_IV_KEY, TV_IV_DEFAULT, TV_IV_MIN, TV_IV_MAX);
    const [area, setArea] = useStickyString(AREA_KEY, 'today', AREA_KEYS);
    const [ask, setAsk] = useState(false);            // 자동 순환 간격 팝오버
    const [tick, setTick] = useState(0);              // TV 진행선 (0~1)
    const [cpkInfo, setCpkInfo] = useState('');       // 영역 4 안내줄
    const [asOf, setAsOf] = useState(() => todayYmd());   // 영역 0 기준일 (저장하지 않는다)
    const [seenAt, setSeenAt] = useState(null);       // 화면에 앉은 자료를 받은 시각 (P11 r11)
    const [reErr, setReErr] = useState(null);         // 조용한 재조회가 실패한 시각 (P11 r11)
    const [syncing, setSyncing] = useState(false);    // 「지금 동기화」 도는 중
    const [askSync, setAskSync] = useState(false);    // 「지금 동기화」 확인 팝오버
    const [toast, setToast] = useState(null);         // { tone:'ok'|'bad', text }
    const rootRef = useRef(null);

    /**
     * 자료를 읽는다.
     *   load(force)                  — 사람이 시킨 조회. 「불러오는 중…」이 뜨고, 실패는 화면에 뜬다.
     *   load(true, { silent: true }) — TV 의 1분 자동 재조회. 아무것도 껌뻑이지 않고,
     *                                  실패하면 **예전 자료를 그대로 둔 채** 머리줄에만 적는다.
     */
    const load = useCallback(async (force, opt) => {
        const silent = !!(opt && opt.silent);
        if (!silent) setSt((s) => ({ ...s, loading: true, err: null }));
        let got = false;
        try {
            const rows = await loadInspections({ force });
            setSt({ loading: false, err: null, rows });
            got = true;
        } catch (e) {
            if (silent) {
                /* 조용한 재조회의 실패는 **경고**다. 오류로 찍으면 TV 를 며칠 켜 두었을 때
                   콘솔이 붉게 뒤덮여 진짜 오류가 묻힌다. 화면에는 호박색 한 줄로 남는다. */
                console.warn('[InboundOverview] 자동 재조회 실패 — 이전 자료를 유지한다', e);
                setReErr(Date.now());                  /* 화면의 자료는 손대지 않는다 */
            } else {
                console.error('[InboundOverview]', e);
                setSt({ loading: false, err: e.message || String(e), rows: [] });
            }
        }
        /* 곁다리 — 마지막 동기화 시각. 실패해도 대시보드는 살아 있어야 하므로 삼킨다.
           P11 r11 : sync_logs 가 1순위, 측정값의 synced_at 이 2순위다(lastSyncedAt 참고).
           sync_logs 표가 아예 없는 환경에서는 api 가 던지므로 따로 감싼다. */
        let logs = null;
        try { logs = await loadSyncLogs({ force }); } catch (e) { logs = null; }
        try {
            const ms = await loadMeasurements({ force });
            setSync(lastSyncedAt(ms, logs));
        } catch (e) {
            if (logs) setSync(lastSyncedAt(null, logs));
            else if (!silent) setSync(null);
        }
        if (got) { setSeenAt(Date.now()); setReErr(null); }
        return got;
    }, []);
    useEffect(() => { load(false); }, [load]);

    /* ── ① TV 자동 재조회 ── 순환 타이머와 **따로** 돈다.
       데스크톱에서는 아예 걸리지 않는다(tv 가 false 면 즉시 되돌아간다). */
    useEffect(() => {
        if (!tv) return undefined;
        const id = window.setInterval(() => { load(true, { silent: true }); }, tvRefreshMs());
        return () => window.clearInterval(id);
    }, [tv, load]);

    /* ── ② 「지금 동기화」 ── 확인을 받은 뒤에만 여기로 온다. */
    const doSync = useCallback(async () => {
        setAskSync(false);
        if (syncing) return;
        setSyncing(true);
        setToast(null);
        try {
            const r = await runSheetSync();
            setToast({ tone: 'ok', text: r.count === null ? '동기화 완료' : `동기화 완료 · ${fmt(r.count)}건` });
            await load(true);       /* 캐시를 버리고 다시 받는다 — 안 그러면 화면이 옛날 값이다 */
        } catch (e) {
            setToast({ tone: 'bad', text: e.message || String(e) });
        } finally {
            setSyncing(false);
        }
    }, [syncing, load]);

    /* 쪽지는 스스로 사라진다. 남겨 두면 다음에 뭘 눌렀을 때 옛 결과를 읽게 된다. */
    useEffect(() => {
        if (!toast) return undefined;
        const id = window.setTimeout(() => setToast(null), TOAST_MS);
        return () => window.clearTimeout(id);
    }, [toast]);

    const span = useMemo(() => dataSpan(st.rows), [st.rows]);

    /* P9 r9 — 기간은 화면 셋이 함께 쓰는 값이다(localStorage `inbound_period`).
       '전체'로 한 번 맞추는 일과 저장·구독은 훅이 맡는다. 여기서는 읽고 넘길 뿐이다. */
    const [flt, setFlt] = useSharedPeriod(span);

    /* TV 현황판은 「올해 · 월별」 고정이다 — 상태를 건드리지 않고 값만 갈아 끼운다. */
    const eff = useMemo(() => (tv
        ? { range: quickRange('year', { min: span.min, max: span.max }), group: 'month' }
        : { range: flt.range, group: flt.group }), [tv, flt.range, flt.group, span.min, span.max]);

    /* ── 영역 이동 (클릭 · 화살표 키 · TV 자동 순환이 전부 이 함수를 쓴다) ── */
    const goArea = useCallback((next) => {
        setArea(next);
        setTick(0);
    }, [setArea]);
    const step = useCallback((d) => {
        const i = AREA_KEYS.indexOf(area);
        goArea(AREA_KEYS[(i + d + AREA_KEYS.length) % AREA_KEYS.length]);
    }, [area, goArea]);

    /* 키보드 ← → — 입력칸에 커서가 있으면 무시한다(날짜칸에서 날짜를 옮기는 중일 수 있다).
       Esc 는 TV 현황판을 끈다. 팝오버가 떠 있으면 그쪽이 먼저 먹는다. */
    useEffect(() => {
        const onKey = (e) => {
            if (ask) return;
            const t = e.target;
            const tag = t && t.tagName ? String(t.tagName).toLowerCase() : '';
            if (tag === 'input' || tag === 'select' || tag === 'textarea' || (t && t.isContentEditable)) return;
            if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
            else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
            else if (e.key === 'Escape' && tv) { e.preventDefault(); setTv(false); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [ask, step, tv, setTv]);

    /* TV 자동 순환 — 데스크톱에서는 절대 돌지 않는다.
       진행선을 위해 0.25초마다 tick 을 올리고, 1 이 되면 다음 영역으로 넘어간다.
       (setTimeout 하나로 넘기면 진행선이 멈춰 보여 "죽었나" 싶어진다) */
    useEffect(() => {
        if (!tv) { setTick(0); return undefined; }
        const stepMs = 250;
        const total = Math.max(TV_IV_MIN, interval_) * 1000;
        const id = window.setInterval(() => {
            setTick((p) => {
                const n = p + stepMs / total;
                if (n >= 1) { step(1); return 0; }
                return n;
            });
        }, stepMs);
        return () => window.clearInterval(id);
    }, [tv, interval_, step]);

    /* ── 파생값 (영역이 바뀌어도 다시 세지 않게 여기서 한 번만) ── */
    const F = useMemo(() => rangeFilter(st.rows, eff.range), [st.rows, eff.range]);
    const S = useMemo(() => summarize(F), [F]);
    const B = useMemo(() => bucketBy(F, eff.group).map((b) => ({ ...b, label: bucketLabel(b.key, eff.group) })), [F, eff.group]);
    /* G — 히어로의 월별 PPM 미니 막대. 선택 기간 안에서 **가장 최근 6개월까지**.
       3개월밖에 없으면 3개만 그린다(빈 달을 지어내지 않는다). */
    const MPPM = useMemo(() => bucketBy(F, 'month').slice(-6), [F]);
    /* B — 「vs 이전」 비교 기준. 묶음이 정한다(일별·월별 = 전월 일평균 / 년별 = 전년 동기).
       기준 구간은 선택 기간 **밖**이므로 F 가 아니라 st.rows(원본)를 넘긴다. */
    const basis = useMemo(() => comparisonBasis(st.rows, eff.range, eff.group), [st.rows, eff.range, eff.group]);
    const Cc = useMemo(() => avgStats(basis.cur, basis.curDays), [basis]);
    const P = useMemo(() => avgStats(basis.prev, basis.prevDays), [basis]);
    const RATE = useMemo(() => rateByBucket(F, eff.group).map((b) => ({ ...b, label: bucketLabel(b.key, eff.group) })), [F, eff.group]);
    const VERDICT = useMemo(() => verdictByBucket(F, eff.group).map((b) => ({ ...b, label: bucketLabel(b.key, eff.group) })), [F, eff.group]);
    const VT = useMemo(() => {
        const t = topVendorTrend(F, eff.group, 3);
        return { vendors: t.vendors, data: t.data.map((d) => ({ ...d, label: bucketLabel(d.key, eff.group) })) };
    }, [F, eff.group]);
    const TOP5 = useMemo(() => bySupplier(F).sort((a, b) => b.count - a.count).slice(0, 5), [F]);
    const TY = useMemo(() => byItemType(F).sort((a, b) => b.count - a.count), [F]);
    const DEFTYPE = useMemo(() => topDefectTypes(F, 5), [F]);
    const FAILS = useMemo(() => recentFails(F), [F]);

    /* ── 영역 0 「오늘 현황」 파생값 ──────────────────────────────────────────
       기간 필터를 타지 않는다. **기준일 하나**로 오늘/어제/이번 주/이번 달을 낸다.
       TV 현황판은 사람이 못 만지므로 언제나 오늘이다. */
    const asOfEff = tv ? todayYmd() : asOf;
    const T = useMemo(() => {
        const d = asOfEff;
        const wk = weekRange(d);
        const wkp = prevSameRange(wk, 'week');
        const mo = mtdRange(d);
        const mop = prevSameRange(mo, 'month');
        const pm = prevMonthOf(d);                 /* B : 직전 달 **전체** (일평균의 기준) */
        return {
            day: d,
            today: todayYmd(),
            yday: addDays(d, -1),
            D: dayStats(st.rows, d),
            Y: dayStats(st.rows, addDays(d, -1)),
            wk, wkp, mo, mop,
            W: rangeStats(st.rows, wk.start, wk.end),
            Wp: rangeStats(st.rows, wkp.start, wkp.end),
            M: rangeStats(st.rows, mo.start, mo.end),
            Mp: rangeStats(st.rows, mop.start, mop.end),
            /* 일평균의 분모는 **검사가 1건이라도 있던 날 수**다. 달력 일수로 나누면
               주말·휴무가 분모를 부풀려 오늘이 늘 좋아 보인다. */
            wkDays: activeDays(rangeFilter(st.rows, wk)),
            pm,
            PM: rangeStats(st.rows, pm.start, pm.end),
            pmDays: activeDays(rangeFilter(st.rows, pm)),
            fails: todayFails(st.rows, d),
            /* P9 r9 : 데스크톱은 7줄이다(카드가 구르지 않는다). TV 는 흐르는 티커라
               10줄이어야 이음매가 안 보인다 — 두 벌을 이어 붙여 돌리기 때문이다. */
            recent: recentRows(st.rows, tv ? 10 : 7),
        };
    }, [st.rows, asOfEff, tv]);

    const go = () => { if (typeof setActiveTab === 'function') setActiveTab('inbound_suppliers'); };

    if (st.loading) return <ScreenFrame tv={false}><Loading t="인수검사 대장을 불러오는 중…" /></ScreenFrame>;
    if (st.err) return <ScreenFrame tv={false}><ErrorCard msg={st.err} onRetry={() => load(true)} /></ScreenFrame>;

    const isToday = area === 'today';
    const isCpk = area === 'cpk';
    const areaBody = () => {
        if (isToday) {
            return (
                <A0Today tv={tv} T={T} asOf={asOfEff} sync={sync} span={span}
                    onAsOf={tv ? null : setAsOf} />
            );
        }
        if (isCpk) return <A4Capability tv={tv} go={go} onInfo={setCpkInfo} />;
        if (F.length === 0) {
            return (
                <div className="ib-area-grid" style={{ gridTemplateColumns: '1fr', gridTemplateRows: '1fr' }}>
                    <Card>
                        <Empty t={`선택한 기간(${eff.range.start} ~ ${eff.range.end})에 입고 자료가 없다. '전체'로 보면 ${fmt(st.rows.length)}건이 있다.`} />
                    </Card>
                </div>
            );
        }
        if (area === 'trend') return <A2Trend tv={tv} B={B} RATE={RATE} VERDICT={VERDICT} VT={VT} />;
        if (area === 'nc') return <A3Nonconformance tv={tv} TOP5={TOP5} TY={TY} DEFTYPE={DEFTYPE} FAILS={FAILS} go={go} />;
        return <A1Summary tv={tv} S={S} B={B} MPPM={MPPM} P={P} Cc={Cc} basis={basis} group={eff.group} />;
    };

    return (
        <ScreenFrame tv={tv} fill>
            <div ref={rootRef} className="flex flex-col" style={{ flex: 1, minHeight: 0 }}>
                <ScreenHeader
                    live compact
                    /* P11 r11 : 살아있음 점 옆에 **자료를 받은 시각**을 적는다. 점만 뛰면
                       "웹은 살아 있다"까지만 말한다 — TV 앞에서 알고 싶은 건 화면의
                       숫자가 언제 것이냐다. 재조회가 실패했으면 그 시각을 호박색으로 덧붙인다. */
                    eyebrow={<>
                        <span>신우밸브 · 품질경영시스템</span>
                        {tv && seenAt && (
                            <span className="tabular-nums" style={{ color: 'var(--ib-ink4)', letterSpacing: '.02em' }}>
                                화면 갱신 {hhmmss(seenAt)}
                            </span>
                        )}
                        {tv && reErr && (
                            <span className="tabular-nums" style={{ color: 'var(--ib-warn2)', letterSpacing: '.02em' }}>
                                재조회 실패 {hhmm(reErr)}
                            </span>
                        )}
                    </>}
                    /* E (차장 확정 09-02) : 제목은 어느 영역에서나 **한 문장**이다.
                       영역 이름은 바로 아래 세그먼트 바가 이미 말한다. 머리글까지 같이
                       바뀌면 TV 가 넘어갈 때마다 화면이 통째로 갈린 것처럼 보인다. */
                    title="인수검사 — 대시보드"
                    meta={<>
                        <span>{isToday ? '기준일 하루 · 기간 필터 무관' : (isCpk ? '기간 무관 전체 스냅샷' : (tv ? '올해 · 월별 (현황판 고정)' : (flt.quick ? '빠른기간' : '직접 지정')))}</span>
                        {!isToday && !isCpk && <span className="tabular-nums">{eff.range.start || '—'} ~ {eff.range.end || '—'}</span>}
                        <span>불량률 = 부적합 수량 ÷ 입고 수량 · 목표 100 PPM</span>
                        {!tv && <span className="tabular-nums">검사 기록 {fmt(st.rows.length)}건 · 자료 {span.min || '—'} ~ {span.max || '—'}</span>}
                        {tv && <Dots n={AREAS.length} active={AREA_KEYS.indexOf(area)} />}
                    </>}
                    right={<>
                        {!tv && <GhostButton onClick={() => load(true)}><RefreshCw className="w-3.5 h-3.5" />새로고침</GhostButton>}
                        {/* P11 r11 : 구글시트 → DB 를 사람이 직접 돌린다. TV 에는 없다(사다리를
                            놓고 누를 버튼이 아니고, 잘못 눌리면 두 번 돈다). */}
                        {!tv && (
                            <span style={{ opacity: syncing ? .6 : 1 }}>
                                <GhostButton onClick={() => setAskSync(true)} disabled={syncing} aria-busy={syncing}>
                                    <Database className="w-3.5 h-3.5" />{syncing ? '동기화 중…' : '지금 동기화'}
                                </GhostButton>
                            </span>
                        )}
                        {tv
                            ? <GhostButton onClick={() => setTv(false)} aria-pressed><LogOut className="w-3.5 h-3.5" />나가기</GhostButton>
                            : <GhostButton onClick={() => setAsk(true)} aria-pressed={false}><MonitorPlay className="w-3.5 h-3.5" />TV 현황판</GhostButton>}
                    </>}
                />

                <AreaBar items={AREAS} value={area} onPick={goArea}
                    right={<span style={{ fontSize: 'calc(var(--ib-lbl)*.95)', color: 'var(--ib-ink4)' }}>
                        {tv ? `자동 순환 ${interval_}초 · ← → 로 이동 · Esc 나가기` : '← → 키로 영역 이동'}
                    </span>} />

                {tv && <ProgressLine p={tick} />}

                {/* 영역 0 은 자기 머리줄(기준일·동기화)을 스스로 그린다 — 여기서는 아무것도 얹지 않는다. */}
                {!tv && !isToday && (isCpk
                    ? (
                        <div className="ib-fade" style={{
                            marginBottom: 10, padding: '9px 14px', borderRadius: 12, animationDelay: '.06s',
                            background: 'var(--ib-card)', border: '1px solid var(--ib-cardline)',
                            boxShadow: 'var(--ib-shadow), 0 0 0 1px var(--ib-ring)',
                            fontSize: 'var(--ib-lbl)', color: 'var(--ib-ink3)', fontWeight: 600,
                        }}>
                            {cpkInfo || '측정값기록서 기준 · 기간 필터와 무관한 전체 스냅샷'}
                        </div>
                    )
                    : (
                        /* 기간 필터는 P4 r4 파일 그대로 쓴다(바이트 무변경). 그 파일이 marginBottom 을
                           인라인으로 18px 잡고 있어 여기서만 감싸개로 8px 되돌린다. */
                        <div style={{ marginBottom: -8 }}>
                            <InboundPeriodFilter
                                range={flt.range} quick={flt.quick} group={flt.group} manualGroup={flt.manualGroup}
                                span={span} onChange={setFlt}
                            />
                        </div>
                    ))}

                <div className="ib-area" role="tabpanel" id={`ib-panel-${area}`} aria-labelledby={`ib-tab-${area}`}>
                    {areaBody()}
                </div>
            </div>

            {tv && <><TvArrow side="l" onClick={() => step(-1)} /><TvArrow side="r" onClick={() => step(1)} /></>}

            {askSync && <ConfirmSync onOk={doSync} onCancel={() => setAskSync(false)} />}
            {toast && <Toast tone={toast.tone} text={toast.text} onClose={() => setToast(null)} />}

            {ask && (
                <IntervalDialog value={interval_} min={TV_IV_MIN} max={TV_IV_MAX} areas={AREAS.length}
                    onCancel={() => setAsk(false)}
                    onStart={(v) => {
                        setInterval_(v);
                        setAsk(false);
                        setTick(0);
                        goArea('today');   /* 현황판은 언제나 「오늘 현황」에서 시작한다 */
                        setTv(true);
                    }} />
            )}
        </ScreenFrame>
    );
};

export default InboundOverview;
