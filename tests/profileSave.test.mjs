// 프로필 저장 흐름(Header 폼 → App.handleUpdateProfile → Supabase) 실행 검사.
// 실제 Header.jsx / App.jsx 를 esbuild 로 묶되, 상대 경로 import(supabase 클라이언트·대시보드 등)는 가짜로 바꾼다.
// 실제 계정·DB·Auth 에는 접속하지 않는다 — supabase 는 호출 순서만 기록하는 가짜다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('..', import.meta.url));
const outDir = `${root}node_modules/.cache/profile-save-test`;

// 렌더 중 만들어진 React 요소의 props 를 type 별로 가로챈다.
const runtimeShim = `
import * as real from 'react/jsx-runtime';
const grab = (type, props) => { const hook = globalThis.__grab; if (hook) hook(type, props); };
export const Fragment = real.Fragment;
export function jsx(type, props, key) { grab(type, props); return real.jsx(type, props, key); }
export function jsxs(type, props, key) { grab(type, props); return real.jsxs(type, props, key); }
`;
// 프로필 창을 연 상태로 그리기 위해 Header 의 초기값 false 상태를 true 로 연다(그 밖 동작은 진짜 React).
const reactShim = `
import * as real from 'react-real';
export * from 'react-real';
export default real;
export function useState(init) {
  if (globalThis.__openProfile && init === false) return [true, v => globalThis.__profileSet?.(v)];
  return real.useState(init);
}
`;
const stubs = {
    api: 'export const USER_PUBLIC_COLUMNS = "id,email,name"; export const supabase = new Proxy({}, { get: (_, k) => globalThis.__sb[k] });',
    user: 'export const UserProvider = ({ children }) => children; export const useUser = () => globalThis.__useUser;',
    router: `export const Routes = ({ children }) => children; export const Route = () => null;
             export const Navigate = () => null; export const Link = ({ children }) => children;
             export const useNavigate = () => () => {};`,
    blank: 'export default function Stub() { return null; }'
};

async function bundle(entry, name) {
    mkdirSync(outDir, { recursive: true });
    const outfile = `${outDir}/${name}.mjs`;
    await build({
        entryPoints: [`${root}src/${entry}`],
        bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'silent',
        jsx: 'automatic', loader: { '.png': 'empty' },
        external: ['react-real', 'react-dom', 'lucide-react'],
        plugins: [{
            name: 'stubs',
            setup(b) {
                b.onResolve({ filter: /^react\/jsx-runtime$/, namespace: 'shim' }, () => ({ path: 'react/jsx-runtime', external: true }));
                b.onResolve({ filter: /^react$/ }, () => ({ path: 'react', namespace: 'shim' }));
                b.onResolve({ filter: /^react\/jsx-runtime$/ }, () => ({ path: 'jsx', namespace: 'shim' }));
                b.onResolve({ filter: /^react-router-dom$/ }, () => ({ path: 'router', namespace: 'stub' }));
                b.onResolve({ filter: /^\.\.?\// }, args => {
                    if (args.path.endsWith('.png')) return undefined;
                    if (args.path.endsWith('/lib/api')) return { path: 'api', namespace: 'stub' };
                    if (args.path.endsWith('/contexts/UserContext')) return { path: 'user', namespace: 'stub' };
                    if (args.path.endsWith('/components/Header')) return undefined; // 진짜 Header
                    if (args.importer.endsWith('App.jsx')) return { path: 'blank', namespace: 'stub' };
                    return undefined;
                });
                b.onLoad({ filter: /.*/, namespace: 'stub' }, a => ({ contents: stubs[a.path], loader: 'js' }));
                b.onLoad({ filter: /.*/, namespace: 'shim' }, a => ({ contents: a.path === 'jsx' ? runtimeShim : reactShim, loader: 'js' }));
            }
        }]
    });
    return outfile;
}

// react-real 은 진짜 react 로 이어 준다.
async function load(file) {
    const { readFileSync, writeFileSync } = await import('node:fs');
    writeFileSync(file, readFileSync(file, 'utf8').replaceAll('"react-real"', '"react"'));
    return import(`${pathToFileURL(file).href}?t=${Date.now()}`);
}

const { renderToStaticMarkup } = await import('react-dom/server');
const React = (await import('react')).default;

const staff = { id: 'auth-1', email: 'staff@example.test', name: '직원', company: '생산부', rank: '사원', status: 'Active', isAdmin: false, password: 'legacy-plain' };

function fakeSupabase({ profileError = null, authError = null, legacyError = null } = {}) {
    const calls = [];
    return {
        calls,
        auth: {
            updateUser: async arg => { calls.push(['auth.updateUser', Object.keys(arg)]); return { data: { user: { email: staff.email } }, error: authError }; }
        },
        from: table => ({
            update: payload => ({
                eq: (col, val) => {
                    calls.push(['update', table, payload, col, val]);
                    const onlyPassword = Object.keys(payload).length === 1 && 'password' in payload;
                    const result = { data: [{ auth_id: staff.id }], error: onlyPassword ? legacyError : profileError };
                    return { ...result, select: async () => result };
                }
            }),
            select: () => ({ order: async () => ({ data: [], error: null }) })
        })
    };
}

let appFile, headerFile;
test.before(async () => {
    appFile = await bundle('App.jsx', 'app');
    headerFile = await bundle('components/Header.jsx', 'header');
});
test.after(() => rmSync(outDir, { recursive: true, force: true }));

async function appProfileHandler(sb) {
    globalThis.__sb = sb;
    globalThis.__useUser = { user: staff, login() {}, logout() {}, signup() {}, migrateUser() {}, loading: false };
    let handler;
    globalThis.__grab = (type, props) => { if (props && typeof props.onUpdateProfile === 'function') handler = props.onUpdateProfile; };
    const App = (await load(appFile)).default;
    renderToStaticMarkup(React.createElement(App));
    globalThis.__grab = null;
    assert.equal(typeof handler, 'function', 'App 이 Header 에 onUpdateProfile 을 넘긴다');
    return handler;
}

function silenceAlerts() {
    const seen = [];
    globalThis.alert = msg => seen.push(String(msg));
    return seen;
}

test('Header 프로필 창: 부서명은 표시만 하고 제출 값에 회사명·기존 비밀번호를 싣지 않는다', async () => {
    const Header = (await load(headerFile)).default;
    let form;
    const inputs = [];
    globalThis.__openProfile = true;
    globalThis.__grab = (type, props) => {
        if (type === 'form') form = props;
        if (type === 'input' && props) inputs.push(props);
    };
    let submitted;
    const html = renderToStaticMarkup(React.createElement(Header, {
        isLoggedIn: true, onLogout() {}, currentUser: staff, onUpdateProfile: data => { submitted = data; }
    }));
    globalThis.__grab = null;
    globalThis.__openProfile = false;

    assert.match(html, /부서명/);
    assert.match(html, /생산부/, '현재 부서명은 보인다');
    const companyInput = inputs.find(p => p.defaultValue === '생산부' || p.value === '생산부');
    assert.ok(companyInput, '부서명 칸이 있다');
    assert.ok(companyInput.readOnly || companyInput.disabled, '부서명 칸은 고칠 수 없다');
    assert.equal(companyInput.name, undefined, '부서명 칸은 폼 제출 값이 아니다');
    const pw = inputs.find(p => p.name === 'password');
    assert.ok(!pw.defaultValue, '기존 비밀번호를 미리 채우지 않는다(빈칸 = 변경 없음)');

    // 사용자가 회사명을 위조해 넣어도(개발자도구) 제출 값에는 없다.
    const entries = { name: '직원', company: '품질보증부', rank: '대리', password: '' };
    const realFormData = globalThis.FormData;
    globalThis.FormData = class { constructor(t) { this.t = t; } get(k) { return k in this.t.__entries ? this.t.__entries[k] : null; } };
    try {
        form.onSubmit({ preventDefault() {}, target: { __entries: entries } });
    } finally { globalThis.FormData = realFormData; }
    assert.ok(submitted, '저장을 호출한다');
    assert.equal('company' in submitted, false, '제출 값에 company 가 없다');
    assert.equal(submitted.rank, '대리');
});

test('Header: 프로필 저장 실패면 창을 닫지 않는다', async () => {
    const Header = (await load(headerFile)).default;
    let form;
    const closed = [];
    globalThis.__openProfile = true;
    globalThis.__profileSet = value => closed.push(value);
    globalThis.__grab = (type, props) => { if (type === 'form') form = props; };
    renderToStaticMarkup(React.createElement(Header, {
        isLoggedIn: true, onLogout() {}, currentUser: staff, onUpdateProfile: async () => false
    }));
    globalThis.__grab = null;
    globalThis.__openProfile = false;
    const original = globalThis.FormData;
    globalThis.FormData = class { get(key) { return { name: staff.name, rank: staff.rank, password: '' }[key]; } };
    try { await form.onSubmit({ preventDefault() {}, target: {} }); }
    finally { globalThis.FormData = original; globalThis.__profileSet = null; }
    assert.deepEqual(closed, []);
});

test('App: 프로필 갱신 대상이 없으면 성공을 알리거나 Auth 비밀번호를 변경하지 않는다', async () => {
    const sb = fakeSupabase();
    const original = sb.from;
    sb.from = table => ({ ...original(table), update: () => ({ eq: () => ({ select: async () => ({ data: [], error: null }) }) }) });
    const alerts = silenceAlerts();
    const saved = await (await appProfileHandler(sb))({ name: staff.name, rank: staff.rank, password: 'NewPass!234' });
    assert.equal(saved, false);
    assert.equal(sb.calls.some(c => c[0] === 'auth.updateUser'), false);
    assert.match(alerts.at(-1), /수정 실패/);
});

test('App: Auth 성공은 사본 열 동기화를 하지 않고 성공한다', async () => {
    const sb = fakeSupabase({ legacyError: { message: '동기화 실패' } });
    const alerts = silenceAlerts();
    const saved = await (await appProfileHandler(sb))({ name: staff.name, rank: staff.rank, password: 'NewPass!234' });
    assert.equal(saved, true);
    assert.equal(sb.calls.filter(c => c[0] === 'update').length, 1);
    assert.match(alerts.at(-1), /^프로필 및 비밀번호가 수정되었습니다/);
});

test('App 프로필 저장: users 갱신 값에 company·status·password 가 없다(비밀번호 미변경)', async () => {
    const sb = fakeSupabase();
    const alerts = silenceAlerts();
    const save = await appProfileHandler(sb);
    await save({ name: '직원', company: '품질보증부', status: 'Active', rank: '대리', password: '' });
    const updates = sb.calls.filter(c => c[0] === 'update');
    assert.equal(updates.length, 1);
    assert.deepEqual(Object.keys(updates[0][2]).sort(), ['name', 'rank']);
    assert.equal(sb.calls.some(c => c[0] === 'auth.updateUser'), false);
    assert.match(alerts.at(-1), /프로필이 수정/);
});

test('App 프로필+비밀번호 저장: 프로필 저장이 실패하면 Auth 비밀번호를 바꾸지 않는다', async () => {
    const sb = fakeSupabase({ profileError: { message: '부서·승인 상태는 시스템 관리자만 변경할 수 있습니다' } });
    const alerts = silenceAlerts();
    const save = await appProfileHandler(sb);
    await save({ name: '직원', company: '품질보증부', rank: '대리', password: 'NewPass!234' });
    assert.equal(sb.calls.some(c => c[0] === 'auth.updateUser'), false, 'Auth 만 바뀌는 일이 없어야 한다');
    assert.match(alerts.at(-1), /수정 실패/);
});

test('App 프로필+비밀번호 저장: 프로필 성공 뒤 Auth 를 바꾸고, Auth 실패 시 그 사실을 알린다', async () => {
    const ok = fakeSupabase();
    silenceAlerts();
    await (await appProfileHandler(ok))({ name: '직원', rank: '대리', password: 'NewPass!234' });
    const order = ok.calls.map(c => c[0] === 'update' ? `update:${Object.keys(c[2]).sort().join(',')}` : c[0]);
    assert.deepEqual(order.slice(0, 2), ['update:name,rank', 'auth.updateUser'], '프로필 먼저, Auth 나중');

    const bad = fakeSupabase({ authError: { message: 'weak password' } });
    const alerts = silenceAlerts();
    await (await appProfileHandler(bad))({ name: '직원', rank: '대리', password: 'x' });
    assert.equal(bad.calls.some(c => c[0] === 'update' && 'password' in c[2]), false, 'Auth 실패면 비밀번호 열도 건드리지 않는다');
    assert.match(alerts.at(-1), /비밀번호.*(실패|변경되지)/);
    assert.doesNotMatch(alerts.at(-1), /기존 비밀번호를 계속 사용/);
});
