// 087 — 초기 비밀번호 변경 창 재인증·로그인 경로 실행 검사.
// PasswordChangeModal: 현재 비밀번호를 Auth 로 실제 재인증한 뒤에만 updateUser → onComplete. 실패면 둘 다 부르지 않는다.
// UserContext.login: Auth 로그인만 쓴다 — 옛 users.password 비교와 자동 signUp 은 없다.
// 실제 컴포넌트를 esbuild 로 묶고 Supabase 는 호출만 기록하는 가짜로 바꾼다(실제 로그인·비밀번호 변경 없음).
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('..', import.meta.url));
const outDir = `${root}node_modules/.cache/password-reauth`;

const runtimeShim = `
import * as real from 'react/jsx-runtime';
const grab = (type, props) => { const hook = globalThis.__grab; if (hook) hook(type, props); };
export const Fragment = real.Fragment;
export function jsx(type, props, key) { grab(type, props); return real.jsx(type, props, key); }
export function jsxs(type, props, key) { grab(type, props); return real.jsxs(type, props, key); }
`;
// 비밀번호 칸('' 로 시작하는 상태)에만 시험 값을 차례로 넣는다. 그 밖은 진짜 React.
const reactShim = `
import * as real from 'react-real';
export * from 'react-real';
export default real;
export function useState(init) {
  const q = globalThis.__pw;
  if (q && init === '' && q.length) return [q.shift(), () => {}];
  return real.useState(init);
}
`;
const stubs = {
    api: `export const supabase = new Proxy({}, { get: (_, k) => globalThis.__sb[k] });
          export const api = {}; export const USER_PUBLIC_COLUMNS = 'id';`
};

async function bundle(entry, name) {
    mkdirSync(outDir, { recursive: true });
    const outfile = `${outDir}/${name}.mjs`;
    await build({
        entryPoints: [`${root}src/${entry}`],
        bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'silent',
        jsx: 'automatic', loader: { '.js': 'jsx' },
        external: ['react-real', 'react-dom', 'lucide-react'],
        plugins: [{
            name: 'stubs',
            setup(b) {
                b.onResolve({ filter: /^react\/jsx-runtime$/, namespace: 'shim' }, () => ({ path: 'react/jsx-runtime', external: true }));
                b.onResolve({ filter: /^react$/ }, () => ({ path: 'react', namespace: 'shim' }));
                b.onResolve({ filter: /^react\/jsx-runtime$/ }, () => ({ path: 'jsx', namespace: 'shim' }));
                b.onResolve({ filter: /\/lib\/api$/ }, () => ({ path: 'api', namespace: 'stub' }));
                b.onLoad({ filter: /.*/, namespace: 'stub' }, a => ({ contents: stubs[a.path], loader: 'js' }));
                b.onLoad({ filter: /.*/, namespace: 'shim' }, a => ({ contents: a.path === 'jsx' ? runtimeShim : reactShim, loader: 'js' }));
            }
        }]
    });
    writeFileSync(outfile, readFileSync(outfile, 'utf8').replaceAll('"react-real"', '"react"'));
    return outfile;
}
const load = file => import(`${pathToFileURL(file).href}?t=${Date.now()}`);

const { renderToStaticMarkup } = await import('react-dom/server');
const React = (await import('react')).default;

let modalFile, contextFile;
test.before(async () => {
    modalFile = await bundle('components/PasswordChangeModal.jsx', 'modal');
    contextFile = await bundle('contexts/UserContext.jsx', 'context');
});
test.after(() => rmSync(outDir, { recursive: true, force: true }));

// 시험용 값(실제 계정 비밀번호 아님)
const EMAIL = 'staff@example.test';
const CURRENT = 'fixture-current-value';
const NEXT = 'Fixture-next-value!';

function fakeAuth({ getUserError = null, noEmail = false, verifyError = null, verifyThrows = false, updateError = null } = {}) {
    const calls = [];
    return {
        calls,
        auth: {
            getUser: async () => { calls.push(['getUser']); return { data: { user: noEmail ? {} : { id: 'auth-1', email: EMAIL } }, error: getUserError }; },
            getSession: async () => { calls.push(['getSession']); return { data: { session: { user: { id: 'auth-1', email: EMAIL } } }, error: null }; },
            signInWithPassword: async (arg) => {
                calls.push(['signInWithPassword', arg.email, arg.password === CURRENT ? 'CURRENT' : 'OTHER']);
                if (verifyThrows) throw new Error('network');
                return { data: verifyError ? { user: null, session: null } : { user: { id: 'auth-1', email: EMAIL }, session: {} }, error: verifyError };
            },
            updateUser: async (arg) => { calls.push(['updateUser', Object.keys(arg)]); return { data: { user: { email: EMAIL } }, error: updateError }; },
            signUp: async () => { calls.push(['signUp']); return { data: {}, error: null }; },
            signOut: async () => { calls.push(['signOut']); return { error: null }; },
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } })
        },
        from: (table) => { calls.push(['from', table]); throw new Error(`users 표 조회 금지: ${table}`); }
    };
}

async function submitModal(sb, values = [CURRENT, NEXT, NEXT]) {
    globalThis.__sb = sb;
    const alerts = [];
    globalThis.alert = m => alerts.push(String(m));
    const Modal = (await load(modalFile)).default;
    let form; const inputs = [];
    let completed = 0;
    globalThis.__pw = [...values];
    globalThis.__grab = (type, props) => {
        if (type === 'form') form = props;
        if (type === 'input' && props) inputs.push(props);
    };
    let html;
    try { html = renderToStaticMarkup(React.createElement(Modal, { onComplete: () => { completed += 1; } })); }
    finally { globalThis.__grab = null; globalThis.__pw = null; }
    await form.onSubmit({ preventDefault() {} });
    return { calls: sb.calls, completed, alerts, html, inputs };
}

test('변경 창: 현재 비밀번호 재인증 성공 뒤에만 updateUser 와 onComplete 를 부른다', async () => {
    const sb = fakeAuth();
    const { calls, completed } = await submitModal(sb);
    const names = calls.map(c => c[0]);
    const iVerify = names.indexOf('signInWithPassword');
    const iUpdate = names.indexOf('updateUser');
    assert.ok(iVerify >= 0, '현재 비밀번호로 실제 재인증한다');
    assert.deepEqual(calls[iVerify].slice(1), [EMAIL, 'CURRENT'], '세션 계정 이메일 + 입력한 현재 비밀번호');
    assert.ok(iUpdate > iVerify, '재인증 다음에 비밀번호를 바꾼다');
    assert.deepEqual(calls[iUpdate][1], ['password']);
    assert.equal(completed, 1);
});

test('변경 창: 현재 비밀번호가 틀리면 updateUser·onComplete 를 부르지 않는다', async () => {
    const { calls, completed, alerts } = await submitModal(fakeAuth({ verifyError: { message: 'Invalid login credentials' } }));
    assert.equal(calls.some(c => c[0] === 'updateUser'), false);
    assert.equal(completed, 0);
    assert.ok(alerts.length >= 1, '사용자에게 실패를 알린다');
});

test('변경 창: 재인증 요청이 예외로 끝나도 updateUser·onComplete 를 부르지 않는다', async () => {
    const { calls, completed } = await submitModal(fakeAuth({ verifyThrows: true }));
    assert.equal(calls.some(c => c[0] === 'updateUser'), false);
    assert.equal(completed, 0);
});

test('변경 창: 세션 계정을 확인하지 못하면 재인증·변경 모두 하지 않는다', async () => {
    for (const opt of [{ getUserError: { message: 'no session' } }, { noEmail: true }]) {
        const { calls, completed } = await submitModal(fakeAuth(opt));
        assert.equal(calls.some(c => c[0] === 'signInWithPassword' || c[0] === 'updateUser'), false, JSON.stringify(opt));
        assert.equal(completed, 0);
    }
});

test('변경 창: updateUser 가 실패하면 onComplete 를 부르지 않는다', async () => {
    const { calls, completed } = await submitModal(fakeAuth({ updateError: { message: 'weak password' } }));
    assert.ok(calls.some(c => c[0] === 'updateUser'));
    assert.equal(completed, 0);
});

test('변경 창: 조건 미달이면 Auth 를 아예 부르지 않는다', async () => {
    const { calls, completed } = await submitModal(fakeAuth(), ['', NEXT, NEXT]);
    assert.deepEqual(calls, []);
    assert.equal(completed, 0);
});

test('변경 창: 초기 비밀번호 숫자 힌트를 화면에 보이지 않는다', async () => {
    const { inputs, html } = await submitModal(fakeAuth());
    const current = inputs[0];
    assert.ok(current && typeof current.placeholder === 'string');
    assert.doesNotMatch(current.placeholder, /\d/, '현재 비밀번호 칸 안내에 숫자 없음');
    for (const p of inputs) assert.doesNotMatch(String(p.placeholder || ''), /\d{4,}/);
    const text = html.replace(/<[^>]*>/g, ' ');
    assert.doesNotMatch(text, /\d{6}/, '보이는 문구에 6자리 숫자 없음');
});

/* ── UserContext.login ─────────────────────────────────────── */
async function loginWith(sb, email, password) {
    globalThis.__sb = sb;
    const { UserProvider, useUser } = await load(contextFile);
    let ctx;
    const Probe = () => { ctx = useUser(); return null; };
    renderToStaticMarkup(React.createElement(UserProvider, null, React.createElement(Probe)));
    assert.equal(typeof ctx.login, 'function');
    let result, error;
    try { result = await ctx.login(email, password); } catch (e) { error = e; }
    return { result, error, calls: sb.calls };
}

test('login: Auth 실패면 옛 users.password 비교·자동 signUp 없이 실패한다', async () => {
    const sb = fakeAuth({ verifyError: { message: 'Invalid login credentials' } });
    const { error, calls } = await loginWith(sb, EMAIL, 'fixture-wrong-value');
    assert.ok(error, '로그인 실패');
    assert.match(error.message, /아이디 또는 비밀번호가 올바르지 않습니다/);
    assert.deepEqual(calls.map(c => c[0]), ['signInWithPassword'], 'Auth 로그인 1회만 — users 표 조회·signUp 없음');
});

test('login: Auth 의 다른 오류는 그대로 전달한다(대체 경로 없음)', async () => {
    const sb = fakeAuth({ verifyError: { message: 'Email not confirmed' } });
    const { error, calls } = await loginWith(sb, EMAIL, CURRENT);
    assert.equal(error?.message, 'Email not confirmed');
    assert.deepEqual(calls.map(c => c[0]), ['signInWithPassword']);
});

test('login: Auth 성공이면 그 사용자를 돌려주고, 아이디만 넣으면 회사 도메인을 붙인다', async () => {
    const sb = fakeAuth();
    const { result, error, calls } = await loginWith(sb, 'staff', CURRENT);
    assert.equal(error, undefined);
    assert.equal(result.user.email, EMAIL);
    assert.deepEqual(calls, [['signInWithPassword', 'staff@shinwoovalve.com', 'CURRENT']]);
});

test('login 원문: users.password 비교와 signUp 호출이 login 함수에 없다', () => {
    const source = readFileSync(new URL('../src/contexts/UserContext.jsx', import.meta.url), 'utf8');
    const body = source.slice(source.indexOf('const login = async'), source.indexOf('const logout = async'));
    assert.ok(body.length > 0);
    assert.doesNotMatch(body, /\.eq\(\s*['"]password['"]/);
    assert.doesNotMatch(body, /\.signUp\s*\(/, 'login 안에 signUp 호출이 없다');
    assert.doesNotMatch(body, /from\(\s*['"]users['"]/);
});
