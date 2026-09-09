/* ─────────────────────────────────────────────────────────────────────────────
   InboundOverview.jsx — 인수검사 「대시보드」   (플랜 042 / P13 r13)

   r12 → r13 에서 바뀐 것 (차장 승인 09-03)
     ⓐ **TV 현황판 시작 팝오버가 「계획」으로 넓어졌다.** 간격 칸 하나였던 것이
        다섯 줄이 됐다 — 줄 하나가 화면 하나고, 줄마다 [체크]와 [초]가 따로 있다.
        · 켠 화면이 2개 이상 → 켠 것만 **차례대로** 돈다. 화면마다 제 초를 지킨다.
        · 켠 화면이 딱 1개  → **고정 화면**이다. 돌지 않는다. 화살표도 없앤다.
        · 0개               → 「시작」이 잠긴다.
        저장은 localStorage `inbound_tv_plan` 하나다. 예전 열쇠 `inbound_tv_interval`
        은 **읽기만** 한다 — 계획이 없으면 그 값을 다섯 줄에 옮겨 첫 계획을 만든다.
        지우지 않는다(r12 로 되돌린 앱이 그 값을 도로 써야 한다).
        조각과 저장 규칙은 components/inbound/ui.jsx 의 useTvPlan/TvStartDialog 다.
     ⓑ **Space = 일시정지/재개.** 순환할 때만 먹는다. 멈춘 동안 머리줄에
        「⏸ 일시정지」가 뜨고 진행선이 그대로 선다. 입력칸에 커서가 있으면 무시한다.
        ※ 60초 자동 재조회(r11)는 **멈춰도 · 고정이어도 그대로 돈다** — 멈춘 건 화면을
          넘기는 일이지 자료를 받는 일이 아니다. 벽에 걸린 채 하루를 넘겨도 숫자는 산다.
     ⓒ **순환 시계를 눈금 세기에서 벽시계로 바꿨다** (차장 실사용 결함 09-03).
        첫 판은 0.25초마다 도는 타이머가 **뛴 횟수**로 남은 시간을 셌다
        (tick += 250 / 총시간). 그런데 브라우저의 setInterval 은 약속을 못 지킨다 —
        · 주 흐름이 막히면(진짜 앱의 Dashboard.jsx 는 결재함·문의 폴링으로 수시로 막힌다)
          밀린 호출을 **하나로 합쳐** 한 번만 부른다. 그만큼 시간이 통째로 사라진다.
        · 크롬은 뒤에 가려진 탭·창의 타이머를 1초로 묶는다. 벽걸이 TV 를 다른 창으로
          덮어 두면 0.25초 눈금이 1초에 한 번이 되어 **네 배로 느려진다**.
        차장 실측 : 5·3·4초로 맞춘 화면이 17.8 → 10.9초씩 머물렀다(약 3.6배).
        그래서 이제 **Date.now() 로 잰다.** 타이머는 "이제 얼마나 지났나" 물어보는
        일꾼일 뿐이고, 시간의 근거는 시계다. 타이머가 몇 번 뛰든, 걷혔다 다시 걸리든,
        묶였다 풀리든 흐른 시간은 시계에 그대로 남는다.
        더해서 **재렌더에 아예 흔들리지 않게** 계획·차례·지금 영역·멈춤을 ref 로 들고,
        타이머 effect 의 의존 목록에는 원시값(tv · 계획 지문 · 순환 여부)만 남겼다.
        60초 재조회도 같은 이유로 load 를 ref 로 들어 의존 목록을 [tv] 하나로 줄였다.
        손으로 옮길 때(← → · ‹ ›)만 시계를 0으로 되돌린다.

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
     · inbound_tv_plan    : **P13 r13** TV 시작 계획
                            {"areas":[{"key":"today","on":true,"sec":10}, … 5줄]}
     · inbound_tv_interval: 예전(r12까지) 자동 순환 간격(초, 3~600).
                            r13 은 **읽기만** 한다 — 계획이 없을 때 다섯 줄에 옮긴다.
                            지우지도 덮어쓰지도 않는다(되돌리기 대비).
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
    AreaBar, TvArrow, Dots, ProgressLine, TvStartDialog,
    useTvPlan, tvPlanKeys, tvSecOf,
    fmt, useStickyFlag, useStickyString,
} from './inbound/ui';
import A0Today from './inbound/areas/A0Today';
import A1Summary from './inbound/areas/A1Summary';
import A2Trend, { bucketLabel } from './inbound/areas/A2Trend';
import A3Nonconformance from './inbound/areas/A3Nonconformance';
import A4Capability from './inbound/areas/A4Capability';

const TV_KEY = 'inbound_tv_mode';
const TV_PLAN_KEY = 'inbound_tv_plan';       /* P13 r13 — 화면별 켬/초 계획 */
const TV_IV_KEY = 'inbound_tv_interval';     /* r12 까지의 간격 한 개. **읽기 전용**이다 */
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
const AREA_LABEL = (k) => (AREAS.find((a) => a.key === k) || {}).label || '';

/* 훅에 넘길 값은 **모듈 상수**여야 한다. 그때그때 만든 객체를 넘기면 신원이 매번 바뀌어
   useCallback 의 의존 목록이 매 렌더 갈리고, 저장 함수가 쓸데없이 새로 만들어진다. */
const TV_PLAN_OPT = { min: TV_IV_MIN, max: TV_IV_MAX, def: TV_IV_DEFAULT, legacyKey: TV_IV_KEY };

/* ── 본체 ─────────────────────────────────────────────────────────────────── */
const InboundOverview = ({ setActiveTab }) => {
    const [st, setSt] = useState({ loading: true, err: null, rows: [] });
    const [sync, setSync] = useState(null);           // 마지막 동기화 시각 (없으면 null)
    const [tv, setTv] = useStickyFlag(TV_KEY, false);
    const [plan, setPlan] = useTvPlan(TV_PLAN_KEY, AREA_KEYS, TV_PLAN_OPT);   /* P13 r13 */
    const [area, setArea] = useStickyString(AREA_KEY, 'today', AREA_KEYS);
    const [ask, setAsk] = useState(false);            // TV 시작 팝오버
    const [paused, setPaused] = useState(false);      // Space 일시정지 (P13 r13)
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
       데스크톱에서는 아예 걸리지 않는다(tv 가 false 면 즉시 되돌아간다).
       r13 : load 를 ref 로 들어 의존 목록을 **[tv] 하나**로 줄였다. load 는 지금도
       useCallback([]) 이라 신원이 안 바뀌지만, 앞으로 누가 그 안에서 state 를 읽어
       의존이 붙으면 부모가 다시 그릴 때마다 1분 시계가 0으로 되돌아간다 —
       그러면 TV 는 **영원히 재조회를 못 한다**(60초가 차기 전에 매번 새로 걸리므로).
       구조로 막아 둔다. */
    const loadRef = useRef(load);
    loadRef.current = load;
    useEffect(() => {
        if (!tv) return undefined;
        const id = window.setInterval(() => { loadRef.current(true, { silent: true }); }, tvRefreshMs());
        return () => window.clearInterval(id);
    }, [tv]);

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

    /* ── P13 r13 : TV 가 도는 차례는 **켠 화면들**이다 ─────────────────────────
       데스크톱은 예전 그대로 다섯 영역을 다 쓴다(계획은 TV 만의 것이다).
       ring 이 비는 일은 없다 — 팝오버가 0개로는 시작을 안 시킨다. 그래도 예전 저장값이
       망가져 들어올 수 있으니 빈 배열이면 다섯 영역으로 되돌린다(화면이 멎지 않게). */
    const selKeys = useMemo(() => {
        const k = tvPlanKeys(plan);
        return k.length ? k : AREA_KEYS;
    }, [plan]);
    const ring = tv ? selKeys : AREA_KEYS;
    const fixedTv = tv && selKeys.length === 1;         /* 고정 화면 — 돌지 않는다 */
    const rotating = tv && selKeys.length >= 2;

    /* ── 재렌더에 흔들리지 않는 손잡이들 (P13 r13) ────────────────────────────
       아래 타이머는 이 ref 들만 본다. 그래서 부모(Dashboard.jsx)가 몇 번을 다시
       그리든 타이머는 다시 걸리지 않고, 걸리더라도 잃는 것이 없다.
       planRef·ringRef 는 지금 state 에서 곧바로 나오는 값이라 그리는 김에 맞춘다.
       areaRef 는 **goArea 만** 바꾼다 — 그리는 도중에 되돌리면 한 박자 어긋난다. */
    const planRef = useRef(plan);
    planRef.current = plan;
    const ringRef = useRef(ring);
    ringRef.current = ring;
    const areaRef = useRef(area);
    const pausedRef = useRef(false);
    /* clock.start = 지금 화면이 뜬 시각(멈춘 만큼 뒤로 민다) · clock.pausedAt = 멈춘 시각 */
    const clockRef = useRef({ start: 0, pausedAt: 0 });
    useEffect(() => { areaRef.current = area; }, [area]);

    /* 계획의 '지문'. 문자열이라 값이 같으면 신원도 같다 — effect 가 헛돌지 않는다. */
    const planSig = useMemo(() => JSON.stringify(plan), [plan]);

    /* ── 영역 이동 (클릭 · 화살표 키 · TV 자동 순환이 전부 이 함수를 쓴다) ──
       손으로 옮기면 **그 화면의 시간이 처음부터** 다시 간다. */
    const goArea = useCallback((next) => {
        areaRef.current = next;
        setArea(next);
        const c = clockRef.current;
        c.start = Date.now();
        c.pausedAt = pausedRef.current ? Date.now() : 0;
        setTick(0);
    }, [setArea]);
    const step = useCallback((d) => {
        const r = ringRef.current;
        if (!r.length) return;
        const i = r.indexOf(areaRef.current);
        /* 지금 영역이 차례에 없으면(계획이 바뀐 직후) 맨 앞으로 간다 */
        goArea(i < 0 ? r[0] : r[(i + d + r.length) % r.length]);
    }, [goArea]);

    /* 멈춤/재개 — 멈춘 만큼 시계를 뒤로 민다. 그래야 재개했을 때 남은 시간이 그대로다. */
    const togglePause = useCallback(() => {
        const c = clockRef.current;
        const next = !pausedRef.current;
        if (next) c.pausedAt = Date.now();
        else if (c.pausedAt) { c.start += Date.now() - c.pausedAt; c.pausedAt = 0; }
        pausedRef.current = next;
        setPaused(next);
    }, []);

    /* 계획에서 빠진 화면에 서 있으면 첫 화면으로 옮긴다 — 고른 적 없는 화면이
       현황판에 떠 있으면 안 된다(TV 를 켠 채 계획만 바뀐 경우). */
    useEffect(() => {
        if (!tv) return;
        if (selKeys.indexOf(area) < 0) goArea(selKeys[0]);
    }, [tv, selKeys, area, goArea]);

    /* 현황판을 켜고 끌 때마다 시계를 지금으로 맞춘다. 나가면 일시정지도 푼다 —
       다음에 켰을 때 멈춘 채로 뜨면 고장으로 읽힌다. */
    useEffect(() => {
        clockRef.current = { start: Date.now(), pausedAt: 0 };
        setTick(0);
        if (!tv) { pausedRef.current = false; setPaused(false); }
    }, [tv]);

    /* 키보드 — 입력칸에 커서가 있으면 무시한다(날짜칸에서 날짜를 옮기는 중일 수 있다).
       팝오버가 떠 있으면 그쪽이 먼저 먹는다.
         ← →   영역 이동. **TV 에서는 켠 화면들 사이에서만** 돈다.
                고정 화면(1개)일 때는 갈 곳이 없으므로 아무 일도 하지 않는다.
         Space 일시정지/재개. 순환할 때만이다 — 고정 화면에는 멈출 것이 없다.
         Esc   TV 현황판을 끈다. */
    useEffect(() => {
        const onKey = (e) => {
            if (ask) return;
            const t = e.target;
            const tag = t && t.tagName ? String(t.tagName).toLowerCase() : '';
            if (tag === 'input' || tag === 'select' || tag === 'textarea' || (t && t.isContentEditable)) return;
            if (e.key === 'ArrowLeft') { if (fixedTv) return; e.preventDefault(); step(-1); }
            else if (e.key === 'ArrowRight') { if (fixedTv) return; e.preventDefault(); step(1); }
            else if ((e.key === ' ' || e.key === 'Spacebar' || e.code === 'Space') && rotating) {
                e.preventDefault();
                togglePause();
            } else if (e.key === 'Escape' && tv) { e.preventDefault(); setTv(false); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [ask, step, tv, setTv, fixedTv, rotating, togglePause]);

    /* ── TV 자동 순환 (P13 r13) ───────────────────────────────────────────────
       데스크톱에서는 절대 돌지 않는다. 고정 화면에서도 안 돈다.

       0.25초마다 도는 타이머는 **시간을 세지 않는다.** 시계(Date.now)를 보고
       「지금 화면이 뜬 지 얼마나 됐나」를 물을 뿐이다. 그래서
         · 타이머가 걷혔다 다시 걸려도  → 잃는 시간이 없다
         · 브라우저가 밀린 호출을 합쳐도 → 잃는 시간이 없다
         · 가려진 탭이라 1초로 묶여도    → 넘어가는 시각이 최대 0.75초 늦을 뿐,
                                            5초가 18초가 되는 일은 없다
       (r13 첫 판은 tick += 250/총시간 으로 **뛴 횟수**를 셌다. 그게 결함이었다.)

       의존 목록에는 원시값만 둔다 — 부모가 다시 그린다고 이 effect 가 다시 돌지 않는다.
       멈춤은 의존에 넣지 않고 ref 로 본다: 멈췄다고 타이머를 걷을 이유가 없다. */
    useEffect(() => {
        if (!rotating) return undefined;
        const id = window.setInterval(() => {
            if (pausedRef.current) return;            /* 멈춘 동안 진행선은 그 자리에 선다 */
            const c = clockRef.current;
            if (!c.start) c.start = Date.now();
            const r = ringRef.current;
            const total = Math.max(TV_IV_MIN, tvSecOf(planRef.current, areaRef.current)) * 1000;
            const p = (Date.now() - c.start) / total;
            if (p >= 1) {
                const i = r.indexOf(areaRef.current);
                const next = r.length ? r[(i < 0 ? 0 : (i + 1) % r.length)] : areaRef.current;
                /* 다음 화면의 시작을 **원래 넘어갔어야 할 시각**에 건다(지금이 아니라).
                   주 흐름이 막혀 0.5초 늦게 알아챘더라도 그 늦음이 다음 화면으로
                   따라 붙지 않는다 — 열 바퀴를 돌아도 밀리지 않는다.
                   다만 한 칸을 통째로 넘길 만큼 오래 막혔으면(창을 오래 덮어 둔 경우)
                   지난 칸들을 몰아서 넘기지 않고 지금부터 다시 센다. */
                const ideal = c.start + total;
                c.start = (Date.now() - ideal > total) ? Date.now() : ideal;
                c.pausedAt = 0;
                areaRef.current = next;
                setArea(next);
                setTick(0);
            } else {
                setTick(p);
            }
        }, 250);
        return () => window.clearInterval(id);
    }, [tv, rotating, planSig, setArea]);

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
                        {/* P13 r13 : 멈춘 것은 **화면 넘김**뿐이라고 한 눈에 말한다.
                            자료는 그동안에도 1분마다 들어온다(바로 왼쪽 「화면 갱신」 시각이 는다). */}
                        {tv && paused && <span className="ib-tvpause" data-ib="tvpause">⏸ 일시정지</span>}
                        {/* 진행 점은 **켠 화면 수만큼**이다. 안 고른 화면 자리까지 찍히면
                            "왜 저기는 안 가지" 하고 고장으로 읽힌다. */}
                        {tv && <Dots n={selKeys.length} active={selKeys.indexOf(area)} />}
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

                {/* P13 r13 : TV 에서는 **고른 화면만** 세그먼트 바에 세운다.
                    안 고른 화면은 눌러도 갈 수 없어야 한다 — 목록에 두면 눌러 보게 된다. */}
                <AreaBar items={tv ? AREAS.filter((a) => selKeys.indexOf(a.key) >= 0) : AREAS}
                    value={area} onPick={goArea}
                    right={<span style={{ fontSize: 'calc(var(--ib-lbl)*.95)', color: 'var(--ib-ink4)' }}>
                        {tv
                            ? (fixedTv
                                ? `고정 · ${AREA_LABEL(area)} · Esc 나가기`
                                : `자동 순환 · ${selKeys.length}개 화면 · ← → 로 이동 · Space 일시정지 · Esc 나가기`)
                            : '← → 키로 영역 이동'}
                    </span>} />

                {/* 고정 화면에는 남은 시간이 없다 — 진행선을 그리면 영원히 안 차는 선이 된다 */}
                {rotating && <ProgressLine p={tick} />}

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

            {/* 고정 화면에서는 화살표를 없앤다 — 눌러도 갈 곳이 없는 단추는 고장으로 읽힌다 */}
            {rotating && <><TvArrow side="l" onClick={() => step(-1)} /><TvArrow side="r" onClick={() => step(1)} /></>}

            {askSync && <ConfirmSync onOk={doSync} onCancel={() => setAskSync(false)} />}
            {toast && <Toast tone={toast.tone} text={toast.text} onClose={() => setToast(null)} />}

            {ask && (
                <TvStartDialog areas={AREAS} plan={plan} min={TV_IV_MIN} max={TV_IV_MAX} def={TV_IV_DEFAULT}
                    onCancel={() => setAsk(false)}
                    onStart={(next) => {
                        setPlan(next);
                        setAsk(false);
                        setTick(0);
                        pausedRef.current = false;
                        setPaused(false);
                        clockRef.current = { start: Date.now(), pausedAt: 0 };
                        /* 현황판은 **고른 것 중 맨 앞**에서 시작한다. 「오늘 현황」을 껐다면
                           그 다음 화면이다 — 고르지 않은 화면이 첫 장이 되면 안 된다. */
                        const first = (next.filter((a) => a.on)[0] || next[0]).key;
                        goArea(first);
                        setTv(true);
                    }} />
            )}
        </ScreenFrame>
    );
};

export default InboundOverview;
