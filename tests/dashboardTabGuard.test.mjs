// 087 — 부서별 메뉴 노출 실행 검사(Dashboard.jsx).
// 비품질 부서는 home/notices/resources/suggestions/ncr_inbox/ncr_ledger 6개 화면만 쓴다.
// 사이드바·본문·주소창(#해시) 직접 진입이 같은 판정을 쓰고, 관리자 메뉴는 기존 isAdmin AND 품질보증부일 때만 보인다.
// 실제 Dashboard.jsx 를 esbuild 로 묶고 하위 화면은 표식만 그리는 가짜로 바꾼다(DB·Auth 접속 없음).
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('..', import.meta.url));
const outDir = `${root}node_modules/.cache/dashboard-tab-guard`;

const runtimeShim = `
import * as real from 'react/jsx-runtime';
const grab = (type, props) => { const hook = globalThis.__grab; if (hook) hook(type, props); };
export const Fragment = real.Fragment;
export function jsx(type, props, key) { grab(type, props); return real.jsx(type, props, key); }
export function jsxs(type, props, key) { grab(type, props); return real.jsxs(type, props, key); }
`;
// activeTab 상태(getInitialTab 으로 시작)의 setter 만 기록하고, effect 는 모아 두었다가 시험이 직접 실행한다.
const reactShim = `
import * as real from 'react-real';
export * from 'react-real';
export default real;
export function useState(init) {
  const h = globalThis.__h;
  if (h && typeof init === 'function' && /getInitialTab/.test(init.name)) return [init(), v => h.tabSets.push(v)];
  return real.useState(init);
}
export function useEffect(fn) { const h = globalThis.__h; if (h) h.effects.push(fn); }
`;
const COMPONENTS = ['Chatbot', 'UserManagement', 'ProgressModal', 'NoticeBoard', 'DevNotes', 'Suggestions', 'PostApproval', 'ResourceRoom',
    'WeeklyReport', 'WeeklyStatus', 'CalendarView', 'ProcessInspectionDashboard', 'ProcessHistory', 'ProcessAnalysis', 'WorkplaceAnalysis',
    'EquipmentAnalysis', 'ModelCategoryAnalysis', 'InboundOverview', 'InboundSuppliers', 'InboundItems', 'InboundRecords',
    'NCRCreate', 'NCRInbox', 'NCRLedger'];
const stubSource = (name) => {
    if (name === 'api') return 'export const api = { fetch: async () => ({ ok: true, json: async () => [] }) };';
    if (name === 'resourceFiles') return 'export const listCurrentResources = async () => [];';
    if (name === 'resourceBoard') return 'export const canManageResources = () => false;';
    if (name === 'NCRDetail') return 'export const myTurnV101 = () => false; export const fetchNcrSettings = async () => null;';
    if (name === 'recharts') return ['XAxis', 'YAxis', 'CartesianGrid', 'Tooltip', 'ResponsiveContainer', 'PieChart', 'Pie', 'Cell', 'BarChart', 'Bar', 'Legend', 'Area', 'ComposedChart']
        .map(n => `export const ${n} = () => null;`).join('\n');
    if (name === 'xlsx') return 'export default {};';
    if (name === 'router') return 'export const useNavigate = () => () => {};';
    return `export default function Stub() { return 'STUB:${name}'; }`;
};

async function bundle() {
    mkdirSync(outDir, { recursive: true });
    const outfile = `${outDir}/dashboard.mjs`;
    await build({
        entryPoints: [`${root}src/components/Dashboard.jsx`],
        bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'silent',
        jsx: 'automatic', loader: { '.png': 'empty', '.js': 'jsx' },
        external: ['react-real', 'react-dom', 'lucide-react'],
        plugins: [{
            name: 'stubs',
            setup(b) {
                b.onResolve({ filter: /^react\/jsx-runtime$/, namespace: 'shim' }, () => ({ path: 'react/jsx-runtime', external: true }));
                b.onResolve({ filter: /^react$/ }, () => ({ path: 'react', namespace: 'shim' }));
                b.onResolve({ filter: /^react\/jsx-runtime$/ }, () => ({ path: 'jsx', namespace: 'shim' }));
                b.onResolve({ filter: /^recharts$/ }, () => ({ path: 'recharts', namespace: 'stub' }));
                b.onResolve({ filter: /^xlsx$/ }, () => ({ path: 'xlsx', namespace: 'stub' }));
                b.onResolve({ filter: /^react-router-dom$/ }, () => ({ path: 'router', namespace: 'stub' }));
                b.onResolve({ filter: /^\.\.?\// }, args => {
                    if (!args.importer.endsWith('Dashboard.jsx')) return undefined;
                    const leaf = args.path.split('/').pop();
                    if (args.path.endsWith('.png')) return undefined;
                    if (['api', 'resourceFiles', 'resourceBoard', 'NCRDetail'].includes(leaf) || COMPONENTS.includes(leaf)) return { path: leaf, namespace: 'stub' };
                    return undefined;   // ../lib/ncrRoles 등은 진짜
                });
                b.onLoad({ filter: /.*/, namespace: 'stub' }, a => ({ contents: stubSource(a.path), loader: 'js' }));
                b.onLoad({ filter: /.*/, namespace: 'shim' }, a => ({ contents: a.path === 'jsx' ? runtimeShim : reactShim, loader: 'js' }));
            }
        }]
    });
    writeFileSync(outfile, readFileSync(outfile, 'utf8').replaceAll('"react-real"', '"react"'));
    return outfile;
}

const { renderToStaticMarkup } = await import('react-dom/server');
const React = (await import('react')).default;

let Dashboard;
test.before(async () => {
    Dashboard = (await import(`${pathToFileURL(await bundle()).href}?t=${Date.now()}`)).default;
});
test.after(() => rmSync(outDir, { recursive: true, force: true }));

const QA = '품질보증부';
const USERS = {
    qaAdmin: { id: 'a1', email: 'qa.admin@example.test', name: '품질관리자', company: QA, role: 'director', status: 'Active', is_admin: true, isAdmin: true },
    qaStaff: { id: 'a2', email: 'qa.staff@example.test', name: '품질담당', company: QA, role: 'employee', status: 'Active', is_admin: false, isAdmin: false },
    prodAdmin: { id: 'a3', email: 'prod.admin@example.test', name: '생산관리자', company: '생산부', role: 'director', status: 'Active', is_admin: true, isAdmin: true },
    prodStaff: { id: 'a4', email: 'prod.staff@example.test', name: '생산담당', company: '생산부', role: 'employee', status: 'Active', is_admin: false, isAdmin: false }
};
const NON_QA_TABS = ['home', 'notices', 'resources', 'suggestions', 'ncr_inbox', 'ncr_ledger'];
const ADMIN_TABS = ['post_approval', 'members', 'settings_home'];
const QA_TABS = ['home', 'notices', 'dev_notes', 'resources', 'suggestions', 'inbound_overview', 'inbound_suppliers', 'inbound_items', 'inbound_records',
    'process_dashboard', 'process_by_process', 'process_by_workplace', 'process_by_equipment', 'process_by_model_category', 'process_history',
    'final', 'ncr_create', 'ncr_inbox', 'ncr_ledger', 'weekly_report', 'weekly_status', 'schedule'];
const CONTENT_MARK = {
    home: '등록된 공지가 없습니다.', notices: 'STUB:NoticeBoard', resources: 'STUB:ResourceRoom', suggestions: 'STUB:Suggestions',
    ncr_inbox: 'STUB:NCRInbox', ncr_ledger: 'STUB:NCRLedger', ncr_create: 'STUB:NCRCreate', dev_notes: 'STUB:DevNotes',
    inbound_overview: 'STUB:InboundOverview', inbound_suppliers: 'STUB:InboundSuppliers', inbound_items: 'STUB:InboundItems', inbound_status: 'STUB:InboundItems',
    inbound_records: 'STUB:InboundRecords', process: 'STUB:ProcessInspectionDashboard', process_dashboard: 'STUB:ProcessInspectionDashboard',
    process_by_process: 'STUB:ProcessAnalysis', process_by_workplace: 'STUB:WorkplaceAnalysis', process_by_equipment: 'STUB:EquipmentAnalysis',
    process_by_model_category: 'STUB:ModelCategoryAnalysis', process_history: 'STUB:ProcessHistory', final: '최종검사 현황',
    weekly_report: 'STUB:WeeklyReport', weekly_status: 'STUB:WeeklyStatus', schedule: 'STUB:CalendarView',
    post_approval: 'STUB:PostApproval', members: 'STUB:UserManagement', settings_home: '설정을 불러오는 중...'   // HomepageSettings 첫 화면
};
const FORBIDDEN_FOR_NON_QA = Object.keys(CONTENT_MARK).filter(t => !NON_QA_TABS.includes(t));

function installBrowser(hash) {
    const pushed = [];
    globalThis.window = {
        location: { hash },
        history: { pushState: (s, _t, url) => pushed.push(url), replaceState() {} },
        addEventListener() {}, removeEventListener() {}
    };
    try { Object.defineProperty(globalThis, 'localStorage', { value: { getItem: () => '1', setItem() {} }, configurable: true, writable: true }); } catch { /* 이미 있음 */ }
    return pushed;
}

function render(userKey, hash = '#home') {
    const pushed = installBrowser(hash);
    const h = { tabSets: [], effects: [] };
    const clicks = [];
    globalThis.__h = h;
    globalThis.__grab = (type, props) => { if (type === 'button' && props && typeof props.onClick === 'function') clicks.push(props.onClick); };
    let html;
    const user = USERS[userKey];
    try { html = renderToStaticMarkup(React.createElement(Dashboard, { user, isAdmin: user.isAdmin, members: [], onDeleteMember() {}, onEditMember() {}, onAddMember() {}, onRefresh() {} })); }
    finally { globalThis.__grab = null; globalThis.__h = null; }
    return { html, h, clicks, pushed };
}

function sidebarTabs(userKey) {
    const { clicks, h, html } = render(userKey);
    for (const onClick of clicks) { try { onClick({ preventDefault() {}, stopPropagation() {} }); } catch { /* 탭 이동과 무관한 버튼 */ } }
    return { tabs: [...new Set(h.tabSets)].sort(), html };
}

function runGuard(userKey, hash) {
    const { h, pushed } = render(userKey, hash);
    const real = { setInterval: globalThis.setInterval };
    globalThis.setInterval = () => 0;   // 60초 폴링은 시험에서 돌리지 않는다
    const cleanups = [];
    try { for (const fn of h.effects) { const c = fn(); if (typeof c === 'function') cleanups.push(c); } }
    finally { globalThis.setInterval = real.setInterval; cleanups.forEach(c => c()); }
    return { redirects: h.tabSets, pushed };
}

const sorted = a => [...a].sort();

test('사이드바: 비품질 직원·비품질 관리자는 6개 화면만 고를 수 있다', () => {
    for (const key of ['prodStaff', 'prodAdmin']) {
        const { tabs, html } = sidebarTabs(key);
        assert.deepEqual(tabs, sorted(NON_QA_TABS), key);
        for (const label of ['리포트 관리', '개발자 노트', '인수검사', '공정검사', '최종검사', '업무 관리', '주간업무보고', '주간업무현황', '일정 (Calendar)', '관리자 설정', '보고서 작성'])
            assert.equal(html.includes(label), false, `${key}: 「${label}」 숨김`);
        for (const label of ['공지사항', '자료실', '건의사항', '결재함', '부적합 대장'])
            assert.ok(html.includes(label), `${key}: 「${label}」 표시`);
    }
});

test('사이드바: 품질 직원은 종전 메뉴 전체(관리자 제외), 품질 관리자는 관리자 메뉴까지', () => {
    const staff = sidebarTabs('qaStaff');
    assert.deepEqual(staff.tabs, sorted(QA_TABS));
    assert.ok(staff.html.includes('리포트 관리'), '품질 부서에는 종전 목업 메뉴도 그대로');
    assert.equal(staff.html.includes('관리자 설정'), false);
    const admin = sidebarTabs('qaAdmin');
    assert.deepEqual(admin.tabs, sorted([...QA_TABS, ...ADMIN_TABS]));
    assert.ok(admin.html.includes('관리자 설정'));
});

test('본문: 비품질은 주소창으로 숨김 화면을 열어도 내용이 그려지지 않는다(관리자 포함)', () => {
    for (const key of ['prodStaff', 'prodAdmin']) {
        for (const tab of FORBIDDEN_FOR_NON_QA) {
            const { html } = render(key, `#${tab}`);
            assert.equal(html.includes(CONTENT_MARK[tab]), false, `${key} #${tab} 본문 차단`);
        }
        for (const tab of NON_QA_TABS) assert.ok(render(key, `#${tab}`).html.includes(CONTENT_MARK[tab]), `${key} #${tab} 본문 표시`);
    }
});

test('본문: 품질 직원은 관리자 화면만 막히고, 품질 관리자는 관리자 화면도 열린다', () => {
    for (const tab of QA_TABS) assert.ok(render('qaStaff', `#${tab}`).html.includes(CONTENT_MARK[tab]), `qaStaff #${tab}`);
    for (const tab of ADMIN_TABS) {
        assert.equal(render('qaStaff', `#${tab}`).html.includes(CONTENT_MARK[tab]), false, `qaStaff #${tab} 차단`);
        assert.ok(render('qaAdmin', `#${tab}`).html.includes(CONTENT_MARK[tab]), `qaAdmin #${tab} 표시`);
    }
});

test('홈 위젯: 비품질 홈에도 공지사항·자료실 위젯은 그대로 있다', () => {
    const { html } = render('prodStaff', '#home');
    assert.ok(html.includes('등록된 공지가 없습니다.'));
    assert.ok(html.includes('등록된 자료가 없습니다.'));
});

test('주소창: 비품질의 숨김 화면 해시는 홈으로, #ncr_create 는 기존 결재함으로 돌린다(권한 승격 없음)', () => {
    for (const key of ['prodStaff', 'prodAdmin']) {
        for (const tab of FORBIDDEN_FOR_NON_QA) {
            const { redirects, pushed } = runGuard(key, `#${tab}`);
            assert.deepEqual(redirects, [tab === 'ncr_create' ? 'ncr_inbox' : 'home'], `${key} #${tab}`);
            assert.equal(pushed.includes(`#${tab}`), false, `${key} #${tab} 를 기록에 남기지 않는다`);
        }
        for (const tab of NON_QA_TABS) {
            const { redirects, pushed } = runGuard(key, `#${tab}`);
            assert.deepEqual(redirects, [], `${key} #${tab} 허용`);
            assert.deepEqual(pushed, [`#${tab}`]);
        }
    }
});

test('주소창: 관리자 화면은 isAdmin AND 품질일 때만 — 품질 직원은 홈으로, 품질 관리자는 허용', () => {
    for (const tab of ADMIN_TABS) {
        assert.deepEqual(runGuard('qaStaff', `#${tab}`).redirects, ['home']);
        assert.deepEqual(runGuard('qaAdmin', `#${tab}`).redirects, []);
    }
    for (const tab of QA_TABS) assert.deepEqual(runGuard('qaStaff', `#${tab}`).redirects, [], `qaStaff #${tab}`);
});
