// 프로필 저장 흐름(Header 폼 → App.handleUpdateProfile → Supabase) 실행 검사.
// 실제 Header.jsx / App.jsx / UserManagement.jsx 를 esbuild 로 묶되, 상대 경로 import(supabase 클라이언트·대시보드 등)는 가짜로 바꾼다.
// 실제 계정·DB·Auth 에는 접속하지 않는다 — supabase 는 호출 순서만 기록하는 가짜다. 비밀번호 값은 모두 시험용 가짜다.
// 088: ① 새 비밀번호 변경은 현재 비밀번호 재인증(getUser→signInWithPassword) 성공 뒤에만 프로필 DB→Auth 순서로 쓴다.
//      ② 새 비밀번호 규칙은 강제 변경 창(PasswordChangeModal)과 같다. ④ 관리자 회원 수정 비밀번호 칸은 빈 기본값·가림.
//      ⑤ 086 이후 낡은 「옛 password 열 동기화」 기대 시험은 Auth-only 계약 시험으로 바꾸고, 부분 실패 보호는 따로 남긴다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync, readFileSync } from 'node:fs';
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
// 088: __stateOverride 가 있으면 useState 호출 순번별로 값을 넣고 setter 호출을 기록한다(창 열림·가림 상태를 따로 지정).
const reactShim = `
import * as real from 'react-real';
export * from 'react-real';
export default real;
export function useState(init) {
  const o = globalThis.__stateOverride;
  if (o) { const i = o.i++; if (Object.prototype.hasOwnProperty.call(o.values, i)) return [o.values[i], v => o.sets.push([i, v])]; }
  if (globalThis.__openProfile && init === false) return [true, v => globalThis.__profileSet?.(v)];
  return real.useState(init);
}
`;
const stubs = {
    api: 'export const supabase = new Proxy({}, { get: (_, k) => globalThis.__sb[k] });',
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
// 088 시험용 가짜 값 — 실제 계정 값이 아니다. 앞뒤 공백은 「다듬지 않음」을 보려고 일부러 넣었다.
const AUTH_EMAIL = 'auth-session@example.test';   // getUser 가 돌려주는 Auth 이메일(프로필 행 이메일과 일부러 다르게)
const CUR = ' cur Pass#Q ';                        // 현재 비밀번호(가짜)
const NEW = 'NewPass!wxyz';                        // 규칙을 만족하는 새 비밀번호(가짜, 12자·특수문자)
const change = (extra = {}) => ({ name: '직원', rank: '대리', password: NEW, confirmPassword: NEW, currentPassword: CUR, ...extra });

function fakeSupabase({
    profileError = null, profileRows, authError = null, authThrows = false,
    userError = null, userEmail = AUTH_EMAIL, userThrows = false, verifyError = null, verifyThrows = false
} = {}) {
    const calls = [];
    return {
        calls,
        auth: {
            getUser: async () => {
                calls.push(['auth.getUser']);
                if (userThrows) throw new Error('getUser network');
                return { data: { user: userEmail ? { id: staff.id, email: userEmail } : null }, error: userError };
            },
            signInWithPassword: async arg => {
                calls.push(['auth.signInWithPassword', arg]);
                if (verifyThrows) throw new Error('reauth network');
                return { data: verifyError ? { user: null, session: null } : { user: { id: staff.id } }, error: verifyError };
            },
            updateUser: async arg => {
                calls.push(['auth.updateUser', arg]);
                if (authThrows) throw new Error('updateUser network');
                return { data: { user: { email: AUTH_EMAIL } }, error: authError };
            },
            getSession: async () => { calls.push(['auth.getSession']); return { data: { session: { access_token: 'fixture-session' } } }; }
        },
        from: table => ({
            update: payload => ({
                eq: (col, val) => {
                    calls.push(['update', table, payload, col, val]);
                    const result = { data: profileRows ?? [{ auth_id: staff.id }], error: profileError };
                    return { ...result, select: async () => result };
                }
            }),
            select: () => ({ order: async () => ({ data: [], error: null }) })
        })
    };
}
const order = calls => calls.map(c => (c[0] === 'update' ? `update:${Object.keys(c[2]).sort().join(',')}` : c[0]));
const authCalls = calls => calls.filter(c => String(c[0]).startsWith('auth.'));

let appFile, headerFile, usersFile;
test.before(async () => {
    appFile = await bundle('App.jsx', 'app');
    headerFile = await bundle('components/Header.jsx', 'header');
    usersFile = await bundle('components/UserManagement.jsx', 'users');
});
test.after(() => rmSync(outDir, { recursive: true, force: true }));

async function appHandlers(sb) {
    globalThis.__sb = sb;
    globalThis.__useUser = { user: staff, login() {}, logout() {}, signup() {}, migrateUser() {}, loading: false };
    const found = {};
    globalThis.__grab = (type, props) => {
        if (props && typeof props.onUpdateProfile === 'function') found.onUpdateProfile = props.onUpdateProfile;
        if (props && typeof props.onEditMember === 'function') found.onEditMember = props.onEditMember;
    };
    const App = (await load(appFile)).default;
    renderToStaticMarkup(React.createElement(App));
    globalThis.__grab = null;
    assert.equal(typeof found.onUpdateProfile, 'function', 'App 이 Header 에 onUpdateProfile 을 넘긴다');
    return found;
}
const appProfileHandler = async sb => (await appHandlers(sb)).onUpdateProfile;

function silenceAlerts() {
    const seen = [];
    globalThis.alert = msg => seen.push(String(msg));
    return seen;
}

// 실제 Header 를 「창 열림(0)=true · 비밀번호 보기(1)=false」로 그린다.
async function renderHeader(onUpdateProfile) {
    const Header = (await load(headerFile)).default;
    const o = { i: 0, values: { 0: true, 1: false }, sets: [] };
    let form;
    const inputs = [];
    globalThis.__stateOverride = o;
    globalThis.__grab = (type, props) => {
        if (type === 'form') form = props;
        if (type === 'input' && props) inputs.push(props);
    };
    let html;
    try {
        html = renderToStaticMarkup(React.createElement(Header, { isLoggedIn: true, onLogout() {}, currentUser: staff, onUpdateProfile }));
    } finally { globalThis.__grab = null; globalThis.__stateOverride = null; }
    return { form, inputs, html, sets: o.sets };
}
async function submitForm(form, entries) {
    const realFormData = globalThis.FormData;
    globalThis.FormData = class { constructor(t) { this.t = t; } get(k) { return k in this.t.__entries ? this.t.__entries[k] : null; } };
    try { await form.onSubmit({ preventDefault() {}, target: { __entries: entries } }); }
    finally { globalThis.FormData = realFormData; }
}

// 강제 변경 창의 규칙을 원문에서 그대로 읽는다(동등성 비교용).
const modalSrc = readFileSync(`${root}src/components/PasswordChangeModal.jsx`, 'utf8');
const MODAL_SPECIAL = /const hasSpecialChar = (\/.+\/)\.test\(newPassword\);/.exec(modalSrc)?.[1];
const MODAL_MIN = Number(/const isLengthValid = newPassword\.length >= (\d+);/.exec(modalSrc)?.[1]);
const toRegExp = lit => new RegExp(lit.slice(1, lit.lastIndexOf('/')), lit.slice(lit.lastIndexOf('/') + 1));
const modalAccepts = (pw, confirm) => pw.length >= MODAL_MIN && toRegExp(MODAL_SPECIAL).test(pw) && pw !== '' && pw === confirm;
const SAMPLES = [
    ['Abcdefghi!', 'Abcdefghi!'],      // 10자+특수 → 통과
    ['Abcdefgh!', 'Abcdefgh!'],        // 9자 → 거부
    ['Abcdefghij', 'Abcdefghij'],      // 특수문자 없음 → 거부
    ['Abcdefghi_', 'Abcdefghi_'],      // 밑줄은 강제 변경 창 목록 밖 → 거부
    ['Abcdefghi-', 'Abcdefghi-'],      // 하이픈도 목록 밖 → 거부
    ['Abcdefghi"', 'Abcdefghi"'],      // 큰따옴표는 목록 안 → 통과
    [' Abcdefg!1 ', ' Abcdefg!1 '],    // 앞뒤 공백 포함 11자(다듬지 않음) → 통과
    ['Abcdefghi!', 'Abcdefghi?'],      // 확인 불일치 → 거부
    ['', 'Abcdefghi!']                 // 확인 칸만 입력 → 변경 시도로 보고 거부
];

/* ── Header ─────────────────────────────────────────────────── */
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

test('Header 088①②: 현재 비밀번호·새 비밀번호 확인 칸이 있고 빈 기본값·가림·자동완성 구분, 필수(required) 아님', async () => {
    const { inputs } = await renderHeader(async () => true);
    const cur = inputs.find(p => p.name === 'currentPassword');
    const confirm = inputs.find(p => p.name === 'confirmPassword');
    const pw = inputs.find(p => p.name === 'password');
    assert.ok(cur, '현재 비밀번호 칸이 있다');
    assert.ok(confirm, '새 비밀번호 확인 칸이 있다');
    assert.equal(cur.type, 'password', '현재 비밀번호는 가린다');
    assert.equal(cur.autoComplete, 'current-password');
    assert.ok(!cur.defaultValue && !cur.value, '현재 비밀번호를 미리 채우지 않는다');
    assert.equal(confirm.type, 'password', '비밀번호 보기를 켜기 전에는 확인 칸도 가린다');
    assert.equal(confirm.autoComplete, 'new-password');
    assert.ok(!confirm.defaultValue && !confirm.value);
    for (const p of [cur, confirm, pw]) assert.ok(!p.required, `${p.name} 칸은 HTML required 가 아니다(이름·직급만 저장 허용)`);
});

test('Header 088①: 이름·직급만 저장(새 비밀번호·확인 공란)은 막지 않고 현재 비밀번호를 넘기지 않는다', async () => {
    const alerts = silenceAlerts();
    for (const currentPassword of ['', CUR]) {
        const submitted = [];
        const { form, sets } = await renderHeader(async data => { submitted.push(data); return true; });
        await submitForm(form, { name: '직원', rank: '대리', password: '', confirmPassword: '', currentPassword });
        assert.equal(submitted.length, 1, '저장을 호출한다');
        assert.equal(submitted[0].password, '');
        assert.ok(!submitted[0].currentPassword, '비밀번호를 바꾸지 않으면 현재 비밀번호 값을 넘기지 않는다');
        assert.deepEqual(sets, [[0, false]], '저장 성공이면 창을 닫는다');
    }
    assert.deepEqual(alerts, []);
});

test('Header 088②: 새 비밀번호 규칙(10자·특수문자·확인 일치)과 현재 비밀번호 입력을 저장 호출 전에 확인한다', async () => {
    const blocked = [
        { password: 'Abcdef!gh', confirmPassword: 'Abcdef!gh', currentPassword: CUR },      // 9자
        { password: 'Abcdefghij', confirmPassword: 'Abcdefghij', currentPassword: CUR },    // 특수문자 없음
        { password: NEW, confirmPassword: NEW + 'x', currentPassword: CUR },                // 확인 불일치
        { password: NEW, confirmPassword: NEW, currentPassword: '' },                       // 현재 비밀번호 없음
        { password: '', confirmPassword: NEW, currentPassword: CUR }                        // 확인 칸만
    ];
    for (const entry of blocked) {
        const alerts = silenceAlerts();
        const submitted = [];
        const { form, sets } = await renderHeader(async data => { submitted.push(data); return true; });
        await submitForm(form, { name: '직원', rank: '대리', ...entry });
        assert.equal(submitted.length, 0, '규칙 미달이면 App 저장을 부르지 않는다');
        assert.equal(alerts.length, 1, '이유를 알린다');
        assert.deepEqual(sets, [], '창을 닫지 않는다');
    }
    // 통과: 검사한 값 그대로(앞뒤 공백 포함) 넘긴다 — 현재 비밀번호도 다듬지 않는다.
    const submitted = [];
    const { form } = await renderHeader(async data => { submitted.push(data); return true; });
    await submitForm(form, { name: '직원', rank: '대리', password: ' Abcdefg!1 ', confirmPassword: ' Abcdefg!1 ', currentPassword: CUR });
    assert.equal(submitted.length, 1);
    assert.equal(submitted[0].password, ' Abcdefg!1 ');
    assert.equal(submitted[0].confirmPassword, ' Abcdefg!1 ');
    assert.equal(submitted[0].currentPassword, CUR);
});

test('Header·App 088②: 새 비밀번호 통과·거부가 강제 변경 창(PasswordChangeModal) 규칙과 같다', async () => {
    assert.ok(MODAL_SPECIAL && MODAL_MIN === 10, '강제 변경 창 규칙을 원문에서 읽었다');
    for (const file of ['src/components/Header.jsx', 'src/App.jsx']) {
        const src = readFileSync(`${root}${file}`, 'utf8');
        assert.equal(/const NEW_PW_SPECIAL = (\/.+\/);/.exec(src)?.[1], MODAL_SPECIAL, `${file} 특수문자 정규식이 강제 변경 창과 글자 그대로 같다`);
        assert.equal(Number(/const NEW_PW_MIN = (\d+);/.exec(src)?.[1]), MODAL_MIN, `${file} 최소 길이가 같다`);
    }
    silenceAlerts();
    for (const [pw, confirm] of SAMPLES) {
        const expected = modalAccepts(pw, confirm);
        const submitted = [];
        const { form } = await renderHeader(async data => { submitted.push(data); return true; });
        await submitForm(form, { name: '직원', rank: '대리', password: pw, confirmPassword: confirm, currentPassword: CUR });
        assert.equal(submitted.length === 1, expected, `Header 판정이 강제 변경 창과 같다: ${JSON.stringify([pw, confirm])}`);
        const sb = fakeSupabase();
        await (await appProfileHandler(sb))(change({ password: pw, confirmPassword: confirm }));
        assert.equal(sb.calls[0]?.[0] === 'auth.getUser', expected, `App 판정이 강제 변경 창과 같다: ${JSON.stringify([pw, confirm])}`);
        if (!expected) assert.deepEqual(sb.calls, [], '거부면 아무 호출도 없다');
    }
});

/* ── App.handleUpdateProfile ────────────────────────────────── */
test('App: 프로필 갱신 대상이 없으면 성공을 알리거나 Auth 비밀번호를 변경하지 않는다', async () => {
    const sb = fakeSupabase({ profileRows: [] });
    const alerts = silenceAlerts();
    const saved = await (await appProfileHandler(sb))(change());
    assert.equal(saved, false);
    assert.equal(sb.calls.some(c => c[0] === 'auth.updateUser'), false);
    assert.match(alerts.at(-1), /수정 실패/);
});

test('App 088⑤: 비밀번호는 Auth 에만 바꾼다 — users 에는 이름·직급 1회만 쓰고 옛 password 열 동기화는 없다(086 계약)', async () => {
    const sb = fakeSupabase();
    const alerts = silenceAlerts();
    const saved = await (await appProfileHandler(sb))(change());
    assert.equal(saved, true);
    assert.deepEqual(order(sb.calls), ['auth.getUser', 'auth.signInWithPassword', 'update:name,rank', 'auth.updateUser']);
    assert.equal(sb.calls.filter(c => c[0] === 'update').length, 1, 'users 쓰기는 프로필 1회뿐');
    assert.equal(sb.calls.some(c => c[0] === 'update' && 'password' in c[2]), false, 'users.password 열을 쓰지 않는다');
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

test('App 088①: 이름·직급만 저장은 재인증·Auth 호출 0(현재 비밀번호를 넣어도 쓰지 않는다)', async () => {
    const sb = fakeSupabase();
    silenceAlerts();
    const saved = await (await appProfileHandler(sb))({ name: '직원', rank: '대리', password: '', confirmPassword: '', currentPassword: CUR });
    assert.equal(saved, true);
    assert.deepEqual(authCalls(sb.calls), [], 'getUser·signInWithPassword·updateUser 모두 0');
    assert.deepEqual(order(sb.calls), ['update:name,rank']);
});

test('App 프로필+비밀번호 저장: 프로필 저장이 실패하면 Auth 비밀번호를 바꾸지 않는다', async () => {
    const sb = fakeSupabase({ profileError: { message: '부서·승인 상태는 시스템 관리자만 변경할 수 있습니다' } });
    const alerts = silenceAlerts();
    const save = await appProfileHandler(sb);
    const saved = await save(change({ company: '품질보증부' }));
    assert.equal(saved, false);
    assert.equal(sb.calls.some(c => c[0] === 'auth.updateUser'), false, 'Auth 만 바뀌는 일이 없어야 한다');
    assert.match(alerts.at(-1), /수정 실패/);
});

test('App 프로필+비밀번호 저장: 프로필 성공 뒤 Auth 를 바꾸고, Auth 실패 시 그 사실을 알린다', async () => {
    const ok = fakeSupabase();
    silenceAlerts();
    await (await appProfileHandler(ok))(change());
    const seq = order(ok.calls);
    assert.ok(seq.indexOf('update:name,rank') >= 0 && seq.indexOf('update:name,rank') < seq.indexOf('auth.updateUser'), '프로필 먼저, Auth 나중');

    const bad = fakeSupabase({ authError: { message: 'weak password' } });
    const alerts = silenceAlerts();
    const saved = await (await appProfileHandler(bad))(change());
    assert.equal(saved, false, '부분 성공은 성공으로 돌려주지 않는다(창 유지)');
    assert.equal(bad.calls.some(c => c[0] === 'update' && 'password' in c[2]), false, 'Auth 실패면 비밀번호 열도 건드리지 않는다');
    assert.match(alerts.at(-1), /프로필은 저장됐지만 비밀번호 변경은 실패/);
    assert.doesNotMatch(alerts.at(-1), /기존 비밀번호를 계속 사용/);
});

test('App 088①: 새 비밀번호 변경인데 현재 비밀번호가 비면 아무것도 호출·저장하지 않는다', async () => {
    const sb = fakeSupabase();
    const alerts = silenceAlerts();
    const saved = await (await appProfileHandler(sb))(change({ currentPassword: '' }));
    assert.equal(saved, false);
    assert.deepEqual(sb.calls, []);
    assert.match(alerts.at(-1), /현재 비밀번호/);
});

test('App 088①: 현재 비밀번호 재인증이 실패하면 이름·직급도 저장하지 않고 Auth 도 바꾸지 않는다', async () => {
    const sb = fakeSupabase({ verifyError: { message: 'Invalid login credentials' } });
    const alerts = silenceAlerts();
    const saved = await (await appProfileHandler(sb))(change());
    assert.equal(saved, false);
    assert.deepEqual(order(sb.calls), ['auth.getUser', 'auth.signInWithPassword'], '재인증 뒤 쓰기 0');
    assert.match(alerts.at(-1), /현재 비밀번호/);
    assert.match(alerts.at(-1), /저장하지 않았습니다/);
});

test('App 088①: 재인증 중 예외(결과 불명확)도 이름·직급·Auth 저장 0', async () => {
    const sb = fakeSupabase({ verifyThrows: true });
    const alerts = silenceAlerts();
    const saved = await (await appProfileHandler(sb))(change());
    assert.equal(saved, false);
    assert.deepEqual(order(sb.calls), ['auth.getUser', 'auth.signInWithPassword']);
    assert.match(alerts.at(-1), /저장하지 않았습니다/);
});

test('App 088①: 세션 확인 실패·이메일 없음·예외면 재인증·저장 0', async () => {
    for (const opts of [{ userError: { message: 'no session' } }, { userEmail: null }, { userThrows: true }]) {
        const sb = fakeSupabase(opts);
        const alerts = silenceAlerts();
        const saved = await (await appProfileHandler(sb))(change());
        assert.equal(saved, false);
        assert.deepEqual(order(sb.calls), ['auth.getUser'], `${JSON.stringify(opts)}: signIn·update·updateUser 0`);
        assert.match(alerts.at(-1), /저장하지 않았습니다/);
    }
});

test('App 088①: 재인증은 Auth 세션 이메일과 입력한 현재 비밀번호 그대로(다듬지 않음)로 한다', async () => {
    const sb = fakeSupabase();
    silenceAlerts();
    await (await appProfileHandler(sb))(change());
    const signIn = sb.calls.find(c => c[0] === 'auth.signInWithPassword');
    assert.ok(signIn, '재인증을 부른다');
    assert.equal(signIn[1].email, AUTH_EMAIL, '프로필 행 이메일이 아니라 Auth 세션 이메일');
    assert.equal(signIn[1].password === CUR, true, '현재 비밀번호를 trim 하지 않는다');
    assert.deepEqual(Object.keys(signIn[1]).sort(), ['email', 'password']);
});

test('App 088②: 새 비밀번호 규칙 미달·확인 불일치면(Header 를 거치지 않은 호출도) 재인증·저장 0', async () => {
    for (const extra of [
        { password: 'Abcdef!gh', confirmPassword: 'Abcdef!gh' },
        { password: 'Abcdefghij', confirmPassword: 'Abcdefghij' },
        { password: NEW, confirmPassword: NEW + 'x' },
        { password: NEW, confirmPassword: undefined }
    ]) {
        const sb = fakeSupabase();
        silenceAlerts();
        const saved = await (await appProfileHandler(sb))(change(extra));
        assert.equal(saved, false);
        assert.deepEqual(sb.calls, [], JSON.stringify(Object.keys(extra)));
    }
});

test('App 088②: 검사한 새 비밀번호 값 그대로(다듬지 않음) Auth 에 보낸다', async () => {
    const sb = fakeSupabase();
    silenceAlerts();
    const saved = await (await appProfileHandler(sb))(change({ password: ' Abcdefg!1 ', confirmPassword: ' Abcdefg!1 ' }));
    assert.equal(saved, true);
    const upd = sb.calls.find(c => c[0] === 'auth.updateUser');
    assert.deepEqual(upd[1], { password: ' Abcdefg!1 ' });
});

test('App 088①: 프로필 저장 뒤 Auth 변경이 예외로 끝나면 부분 성공·결과 불명확을 알리고 실패로 돌려준다', async () => {
    const sb = fakeSupabase({ authThrows: true });
    const alerts = silenceAlerts();
    const saved = await (await appProfileHandler(sb))(change());
    assert.equal(saved, false, '창을 닫지 않는다');
    assert.deepEqual(order(sb.calls), ['auth.getUser', 'auth.signInWithPassword', 'update:name,rank', 'auth.updateUser']);
    assert.match(alerts.at(-1), /프로필은 저장됐지만/);
    assert.match(alerts.at(-1), /비밀번호 변경 결과를 확인하지 못했습니다/);
    assert.doesNotMatch(alerts.at(-1), /^수정 실패/);
});

test('App 088①: 현재 비밀번호는 users 저장 값·Auth 변경 값·안내창·콘솔 어디에도 남지 않는다', async () => {
    const printed = [];
    const keep = { log: console.log, error: console.error, warn: console.warn, info: console.info };
    for (const k of Object.keys(keep)) console[k] = (...a) => printed.push(a.map(String).join(' '));
    const alerts = silenceAlerts();
    const written = [];
    try {
        for (const opts of [{}, { verifyError: { message: 'Invalid login credentials' } }, { profileError: { message: 'x' } }, { authError: { message: 'y' } }, { authThrows: true }]) {
            const sb = fakeSupabase(opts);
            await (await appProfileHandler(sb))(change());
            for (const c of sb.calls) if (c[0] === 'update' || c[0] === 'auth.updateUser') written.push(JSON.stringify(c));
        }
    } finally { Object.assign(console, keep); }
    assert.equal(written.some(s => s.includes(CUR)), false, 'DB·Auth 변경 값에 없음');
    assert.equal(alerts.some(s => s.includes(CUR)), false, '안내창에 없음');
    assert.equal(printed.some(s => s.includes(CUR)), false, '콘솔에 없음');
});

test('Header→App 088①: 실제 Header 제출 값으로 재인증→프로필→Auth 순서가 이어지고 성공하면 창을 닫는다', async () => {
    const sb = fakeSupabase();
    silenceAlerts();
    const handler = await appProfileHandler(sb);
    const { form, sets } = await renderHeader(handler);
    await submitForm(form, { name: '직원', rank: '과장', password: NEW, confirmPassword: NEW, currentPassword: CUR });
    assert.deepEqual(order(sb.calls), ['auth.getUser', 'auth.signInWithPassword', 'update:name,rank', 'auth.updateUser']);
    assert.deepEqual(sets, [[0, false]]);

    const bad = fakeSupabase({ verifyError: { message: 'Invalid login credentials' } });
    const h2 = await appProfileHandler(bad);
    const second = await renderHeader(h2);
    await submitForm(second.form, { name: '직원', rank: '과장', password: NEW, confirmPassword: NEW, currentPassword: 'wrong-current' });
    assert.equal(bad.calls.some(c => c[0] === 'update' || c[0] === 'auth.updateUser'), false);
    assert.deepEqual(second.sets, [], '재인증 실패면 창을 닫지 않는다');
});

/* ── 관리자 회원 수정(UserManagement → App.handleEditUser) ─────── */
const legacyMember = { id: 7, auth_id: 'auth-7', email: 'member@example.test', name: '회원', company: '생산부', rank: '사원', role: 'employee', status: 'Active', is_admin: false, password: 'legacy-plain-fixture' };

async function renderUserManagement(onEditMember) {
    const UserManagement = (await load(usersFile)).default;
    // useState 순번: 0 드롭다운 · 1 수정창 · 2 추가창 · 3 수정 대상 · 4 비밀번호 보기
    const o = { i: 0, values: { 1: true, 2: false, 3: legacyMember, 4: false }, sets: [] };
    let form;
    const inputs = [];
    globalThis.__stateOverride = o;
    globalThis.__grab = (type, props) => {
        if (type === 'form' && props) form = props;
        if (type === 'input' && props) inputs.push(props);
    };
    let html;
    try {
        html = renderToStaticMarkup(React.createElement(UserManagement, {
            members: [], onDeleteMember() {}, onEditMember, onAddMember() {}, onRefresh() {}
        }));
    } finally { globalThis.__grab = null; globalThis.__stateOverride = null; }
    return { form, inputs, html };
}

test('UserManagement 088④: 회원 수정 비밀번호 칸은 빈 기본값·가림·new-password 이고 옛 비밀번호·예시 숫자를 보여 주지 않는다', async () => {
    const { inputs, html } = await renderUserManagement(() => {});
    const pws = inputs.filter(p => p.name === 'password');
    assert.equal(pws.length, 1, '수정 창의 비밀번호 칸 하나');
    const pw = pws[0];
    assert.equal(!pw.defaultValue && !pw.value, true, '옛 password 열 값을 기본값으로 넣지 않는다');
    assert.equal(pw.type, 'password', '입력값을 가린다');
    assert.equal(pw.autoComplete, 'new-password', '브라우저 저장 비밀번호 자동 채움 대신 새 비밀번호로 표시');
    const placeholder = String(pw.placeholder || '');
    assert.equal(/\d{6}/.test(placeholder), false, '예시 숫자 비밀번호를 보여 주지 않는다');
    assert.equal(/예\s*:/.test(placeholder), false, '예시 문구를 두지 않는다');
    assert.equal(html.includes(legacyMember.password), false, '화면 어디에도 옛 비밀번호 값이 없다');
});

test('UserManagement→App 088④: 비밀번호 칸을 비우면 재설정(관리자 API·세션) 없이 회원 정보만 고치고, 값이 있으면 기존 재설정 경로 그대로', async () => {
    const edits = [];
    const { form } = await renderUserManagement(data => edits.push(data));
    const entries = { name: '회원', company: '생산부', rank: '대리', role: 'employee', email: legacyMember.email, password: '', status: 'Active', is_admin: null };
    await submitForm(form, entries);
    assert.equal(edits.length, 1);
    assert.equal(edits[0].password, '', '빈칸 그대로 넘긴다(옛 값으로 채우지 않음)');

    const sb = fakeSupabase();
    const fetched = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (url, init) => { fetched.push([url, JSON.parse(init.body)]); return { ok: true, json: async () => ({ success: true }) }; };
    const alerts = silenceAlerts();
    try {
        const { onEditMember } = await appHandlers(sb);
        await onEditMember(edits[0]);
        assert.deepEqual(fetched, [], '관리자 비밀번호 재설정 API 를 부르지 않는다');
        assert.deepEqual(authCalls(sb.calls), [], '세션·Auth 호출 없음');
        const updates = sb.calls.filter(c => c[0] === 'update');
        assert.equal(updates.length, 1);
        assert.equal('password' in updates[0][2], false, 'users 갱신 값에 password 가 없다');
        assert.match(alerts.at(-1), /성공적으로 수정/);

        await onEditMember({ ...edits[0], password: 'TempPass!x' });
        assert.equal(fetched.length, 1, '값이 있으면 기존 관리자 재설정 경로를 그대로 쓴다');
        assert.equal(fetched[0][0], '/api/admin-update-member');
        assert.equal(fetched[0][1].password, 'TempPass!x');
    } finally { globalThis.fetch = realFetch; }
});
