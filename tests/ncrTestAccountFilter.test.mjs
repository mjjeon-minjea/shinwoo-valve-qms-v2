// 087 — NCR OBT 시험계정(이메일 test_ 접두) 구분 실행 검사.
// 실직원이 처리하면 회람 담당·처리방안 마련자 후보·회람 부서·알림 수신자에서 test_ 계정을 뺀다.
// test_ 계정이 처리하면 종전 후보 전체를 그대로 쓴다. 차례(myTurn)·권한·역할 판정은 바꾸지 않는다.
// 실제 NCRCreate.jsx / NCRDetail.jsx / api/ncr-notify.js 를 esbuild 로 묶고 Supabase·메일은 가짜로 바꾼다.
// 실제 계정·DB·Auth·SMTP 에는 접속하지 않는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import * as roles from '../src/lib/ncrRoles.js';

const { myTurnV101 } = roles;
const isNcrTestAccount = (...a) => roles.isNcrTestAccount(...a);
const filterNcrCandidates = (...a) => roles.filterNcrCandidates(...a);

const root = fileURLToPath(new URL('..', import.meta.url));
const outDir = `${root}node_modules/.cache/ncr-test-account-filter`;

const ROWS = [
    { id: 1, email: 'qa.staff@example.test', name: '품질담당', company: '품질보증부', role: 'employee', rank: '대리', status: 'Active' },
    { id: 2, email: 'test_qa_staff@example.test', name: '시험품질', company: '품질보증부', role: 'employee', rank: '사원', status: 'Active' },
    { id: 3, email: 'prod.staff@example.test', name: '생산담당', company: '생산부', role: 'employee', rank: '사원', status: 'Active' },
    { id: 4, email: 'test_prod_staff@example.test', name: '시험생산', company: '생산부', role: 'employee', rank: '사원', status: 'Active' },
    { id: 5, email: 'test_lab@example.test', name: '시험전용', company: '시험부서', role: 'employee', rank: '사원', status: 'Active' },
    { id: 6, email: 'prod.head@example.test', name: '생산부장', company: '생산부', role: 'director', rank: '부장', status: 'Active' }
];
const TEST_EMAILS = ROWS.filter(u => u.email.startsWith('test_')).map(u => u.email);
const REAL_ACTOR = { id: 'auth-real', email: 'qa.writer@example.test', name: '작성자', company: '품질보증부', role: 'employee', status: 'Active' };
const TEST_ACTOR = { id: 'auth-test', email: 'test_qa_writer@example.test', name: '시험작성자', company: '품질보증부', role: 'employee', status: 'Active' };

/* ── 공통 판정 ─────────────────────────────────────────────── */
test('087 공통 판정: 이메일 test_ 접두만 시험계정이다', () => {
    assert.equal(isNcrTestAccount({ email: 'test_prod_staff@example.test' }), true);
    assert.equal(isNcrTestAccount({ email: 'TEST_upper@example.test' }), true, '이메일 대소문자는 구분하지 않는다');
    assert.equal(isNcrTestAccount({ email: 'prod.staff@example.test' }), false);
    assert.equal(isNcrTestAccount({ email: 'mytest_x@example.test' }), false, '접두가 아니면 시험계정이 아니다');
    assert.equal(isNcrTestAccount({ email: 'test@example.test' }), false, 'test_ 접두만');
    assert.equal(isNcrTestAccount(null), false);
    assert.equal(isNcrTestAccount({ name: 'test_이름만' }), false, '이름이 아니라 이메일로만 판정한다');
});

test('087 공통 판정: 실직원 actor는 test_ 후보를 빼고, test_ actor는 원래 목록을 그대로 쓴다', () => {
    const real = filterNcrCandidates(REAL_ACTOR, ROWS);
    assert.deepEqual(real.map(u => u.id), [1, 3, 6]);
    const tester = filterNcrCandidates(TEST_ACTOR, ROWS);
    assert.deepEqual(tester, ROWS, 'test_ actor는 원래 후보 전체(같은 순서)');
    assert.deepEqual(filterNcrCandidates(REAL_ACTOR, null), []);
});

test('087: 차례 판정(myTurnV101)은 test_ 여부와 무관하게 그대로다', () => {
    const r = { status: '회람중', flow_ver: 'v10.1', reviews: { '생산부': { state: 'wait' } } };
    assert.equal(myTurnV101(ROWS[3], r, {}), true, 'test_ 생산 담당도 자기 차례는 그대로');
    assert.equal(myTurnV101(ROWS[2], r, {}), true);
    const issue = { status: '발행승인 대기', flow_ver: 'v10.1', reviews: {} };
    assert.equal(myTurnV101({ ...ROWS[1], role: 'director' }, issue, {}), true, 'test_ 품질 director 권한도 그대로');
});

/* ── 실제 화면 컴포넌트·서버 함수를 묶는 도구 ─────────────────── */
const runtimeShim = `
import * as real from 'react/jsx-runtime';
const grab = (type, props) => { const hook = globalThis.__grab; if (hook) hook(type, props); };
export const Fragment = real.Fragment;
export function jsx(type, props, key) { grab(type, props); return real.jsx(type, props, key); }
export function jsxs(type, props, key) { grab(type, props); return real.jsxs(type, props, key); }
`;
// 훅 상태를 기록·주입한다(한 번 그리는 정적 렌더 전용). __h 가 없으면 진짜 React 그대로.
const reactShim = `
import * as real from 'react-real';
export * from 'react-real';
export default real;
export function useState(init) {
  const h = globalThis.__h;
  if (!h) return real.useState(init);
  const idx = h.idx++;
  if (h.inject && Object.prototype.hasOwnProperty.call(h.inject, idx)) return [h.inject[idx], v => h.sets.push([idx, v])];
  return [typeof init === 'function' ? init() : init, v => h.sets.push([idx, v])];
}
export function useEffect(fn) { const h = globalThis.__h; if (h) h.effects.push(fn); }
`;
const stubs = {
    api: `export const api = new Proxy({}, { get: (_, k) => globalThis.__api[k] });
          export const supabase = new Proxy({}, { get: (_, k) => globalThis.__sb[k] });`,
    notify: 'export const notifyNcrTurn = (...a) => { (globalThis.__notified ||= []).push(a); };',
    print: 'export default function NCRPrint() { return null; } export const fmtDT = v => String(v || "");',
    supabaseJs: 'export const createClient = (...a) => globalThis.__createClient(...a);',
    nodemailer: 'export default { createTransport: (...a) => globalThis.__createTransport(...a) };'
};

async function bundle(entry, name) {
    mkdirSync(outDir, { recursive: true });
    const outfile = `${outDir}/${name}.mjs`;
    await build({
        entryPoints: [`${root}${entry}`],
        bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'silent',
        jsx: 'automatic', loader: { '.png': 'empty', '.js': 'jsx' },
        external: ['react-real', 'react-dom', 'lucide-react'],
        plugins: [{
            name: 'stubs',
            setup(b) {
                b.onResolve({ filter: /^react\/jsx-runtime$/, namespace: 'shim' }, () => ({ path: 'react/jsx-runtime', external: true }));
                b.onResolve({ filter: /^react$/ }, () => ({ path: 'react', namespace: 'shim' }));
                b.onResolve({ filter: /^react\/jsx-runtime$/ }, () => ({ path: 'jsx', namespace: 'shim' }));
                b.onResolve({ filter: /^@supabase\/supabase-js$/ }, () => ({ path: 'supabaseJs', namespace: 'stub' }));
                b.onResolve({ filter: /^nodemailer$/ }, () => ({ path: 'nodemailer', namespace: 'stub' }));
                b.onResolve({ filter: /^\.\.?\// }, args => {
                    if (/\/api$|^\.\/api$/.test(args.path)) return { path: 'api', namespace: 'stub' };
                    if (/ncrNotify$/.test(args.path)) return { path: 'notify', namespace: 'stub' };
                    if (/\/NCRPrint$/.test(args.path)) return { path: 'print', namespace: 'stub' };
                    return undefined;
                });
                b.onLoad({ filter: /.*/, namespace: 'stub' }, a => ({ contents: stubs[a.path], loader: 'js' }));
                b.onLoad({ filter: /.*/, namespace: 'shim' }, a => ({ contents: a.path === 'jsx' ? runtimeShim : reactShim, loader: 'js' }));
            }
        }]
    });
    writeFileSync(outfile, readFileSync(outfile, 'utf8').replaceAll('"react-real"', '"react"'));
    return outfile;
}
const load = file => import(`${pathToFileURL(file).href}?t=${Date.now()}`);
const flush = async () => { for (let i = 0; i < 10; i += 1) await new Promise(r => setTimeout(r, 0)); };

// 무엇을 불러도 빈 결과로 끝나는 Supabase 클라이언트 가짜(쓰기·네트워크 없음)
const chain = () => {
    const done = { data: [], error: null };
    const p = new Proxy(function () {}, {
        get: (_, k) => (k === 'then' ? (res, rej) => Promise.resolve(done).then(res, rej) : p),
        apply: () => p
    });
    return p;
};
const fakeApi = rows => ({
    fetch: async path => ({ ok: true, json: async () => (String(path).startsWith('/users') ? rows : []) }),
    rpc: async () => null
});

const { renderToStaticMarkup } = await import('react-dom/server');
const React = (await import('react')).default;

let createFile, detailFile, notifyFile;
test.before(async () => {
    createFile = await bundle('src/components/NCRCreate.jsx', 'create');
    detailFile = await bundle('src/components/NCRDetail.jsx', 'detail');
    notifyFile = await bundle('api/ncr-notify.js', 'notify');
});
test.after(() => rmSync(outDir, { recursive: true, force: true }));

function renderOnce(Component, props, inject) {
    const h = { idx: 0, sets: [], effects: [], inject };
    globalThis.__h = h;
    const options = [];
    globalThis.__grab = (type, p) => { if (type === 'option' && p) options.push(p); };
    let html;
    try { html = renderToStaticMarkup(React.createElement(Component, props)); }
    finally { globalThis.__grab = null; globalThis.__h = null; }
    return { h, html, options };
}

async function runEffectsMatching(h, needle) {
    globalThis.__h = h;   // 효과 안에서 부르는 setter 기록용
    try {
        const picked = h.effects.filter(fn => String(fn).includes(needle));
        assert.ok(picked.length >= 1, `"${needle}" 를 읽는 실제 effect 가 있다`);
        for (const fn of picked) fn();
        await flush();
    } finally { globalThis.__h = null; }
}

/* ── NCRCreate: 회람 담당·처리방안 마련자·회람 부서 후보 ───────── */
async function createCandidates(actor) {
    globalThis.__api = fakeApi(ROWS);
    globalThis.__sb = chain();
    const NCRCreate = (await load(createFile)).default;
    const first = renderOnce(NCRCreate, { user: actor });
    await runEffectsMatching(first.h, '/users');
    const k = first.h.sets.findIndex(([, v]) => Array.isArray(v) && v.length && v.every(x => x && typeof x === 'object' && 'email' in x));
    assert.ok(k >= 0, '/users 응답으로 staffAll 이 채워진다');
    const [staffIdx, staffAll] = first.h.sets[k];
    const [deptIdx, depts] = first.h.sets[k + 1];
    // 같은 훅 자리에 그 값을 넣고 다시 그려 실제 select 선택지를 본다
    const second = renderOnce(NCRCreate, { user: actor }, { [staffIdx]: staffAll, [deptIdx]: depts });
    return { staffAll, depts, html: second.html, options: second.options };
}

test('NCRCreate 실직원 actor: 회람 담당·처리방안 마련자·회람 부서 후보에서 test_ 계정을 뺀다', async () => {
    const { staffAll, depts, html, options } = await createCandidates(REAL_ACTOR);
    assert.deepEqual(staffAll.map(u => u.email), ['qa.staff@example.test', 'prod.staff@example.test', 'prod.head@example.test']);
    assert.deepEqual(depts, ['생산부', '품질보증부'], 'test_ 계정만 있는 부서는 회람 부서 후보가 아니다');
    const values = options.map(o => String(o.value));
    for (const e of TEST_EMAILS) assert.equal(values.includes(e), false, `회람 담당 선택지에 ${e} 없음`);
    assert.ok(values.includes('prod.staff@example.test'), '실직원 회람 담당은 그대로 보인다');
    assert.equal(values.includes('시험품질'), false, '처리방안 마련자 선택지에 test_ 품질 계정 없음');
    assert.ok(values.includes('품질담당'), '실직원 처리방안 마련자는 그대로');
    assert.doesNotMatch(html, /시험부서/);
});

test('NCRCreate test_ actor: 종전 후보 전체를 그대로 쓴다', async () => {
    const { staffAll, depts, options } = await createCandidates(TEST_ACTOR);
    assert.deepEqual(staffAll, ROWS);
    assert.deepEqual(depts, ['생산부', '시험부서', '품질보증부']);
    const values = options.map(o => String(o.value));
    assert.ok(values.includes('test_prod_staff@example.test'));
    assert.ok(values.includes('prod.staff@example.test'));
    assert.ok(values.includes('시험품질'));
});

/* ── NCRDetail: 재회람·특채판단 때 쓰는 부서 목록 ─────────────── */
async function detailDepts(actor) {
    globalThis.__api = fakeApi(ROWS);
    globalThis.__sb = chain();
    const NCRDetail = (await load(detailFile)).default;
    const report = { id: 'r-087', ncr_no: 'NCR 26-901', status: '회람중', flow_ver: 'v10.1', reviews: { '생산부': { state: 'wait' } }, author_email: 'qa.writer@example.test' };
    const first = renderOnce(NCRDetail, { report, user: actor, onClose() {}, onChanged() {} });
    await runEffectsMatching(first.h, '/users');
    const hit = first.h.sets.find(([, v]) => Array.isArray(v) && v.length && v.every(x => typeof x === 'string'));
    assert.ok(hit, '/users 응답으로 부서 목록이 채워진다');
    return hit[1];
}

test('NCRDetail 실직원 actor: test_ 계정만 있는 부서는 회람 부서 목록에 넣지 않는다', async () => {
    assert.deepEqual(await detailDepts(REAL_ACTOR), ['생산부']);
});

test('NCRDetail test_ actor: 종전 부서 목록 그대로', async () => {
    assert.deepEqual(await detailDepts(TEST_ACTOR), ['생산부', '시험부서']);
});

/* ── 서버 알림: 토큰→auth_id 로 찾은 me.email 이 actor ─────────── */
function serverFixture({ actorEmail }) {
    const sent = [];
    const AUTH = { 'token-actor': { id: 'auth-actor' } };
    const report = { id: 'r-087', ncr_no: 'NCR 26-901', status: '회람중', flow_ver: 'v10.1', reviews: { '생산부': { state: 'wait' } }, supplier: '협력사', item_name: '품목', author_name: '작성자' };
    const tables = {
        users: ROWS,
        me: [{ status: 'Active', email: actorEmail }],
        ncr_reports: [report],
        ncr_settings: []
    };
    const builder = (table) => {
        const filters = [];
        let selected = '*';
        const rowsNow = () => {
            if (table === 'users' && filters.some(([c]) => c === 'auth_id')) {
                const [, v] = filters.find(([c]) => c === 'auth_id');
                return v === 'auth-actor' ? tables.me : [];
            }
            let rows = tables[table] || [];
            for (const [c, v] of filters) rows = rows.filter(r => r[c] === v);
            if (table === 'users' && selected !== '*') {
                const cols = selected.split(',').map(s => s.trim());
                rows = rows.map(r => Object.fromEntries(cols.map(c => [c, r[c]])));
            }
            return rows;
        };
        const q = {
            select: cols => { selected = cols; return q; },
            eq: (c, v) => { filters.push([c, v]); return q; },
            single: async () => { const r = rowsNow(); return r.length === 1 ? { data: r[0], error: null } : { data: null, error: { message: 'not single' } }; },
            then: (res, rej) => Promise.resolve({ data: rowsNow(), error: null }).then(res, rej),
            insert() { throw new Error('쓰기 금지'); }, update() { throw new Error('쓰기 금지'); }, delete() { throw new Error('쓰기 금지'); }
        };
        return q;
    };
    globalThis.__createClient = () => ({
        auth: { getUser: async token => (AUTH[token] ? { data: { user: AUTH[token] }, error: null } : { data: { user: null }, error: { message: 'bad token' } }) },
        from: builder
    });
    globalThis.__createTransport = () => ({
        sendMail: async info => { sent.push(info); return { messageId: `fixture-${sent.length}`, response: 'fixture' }; }
    });
    return { sent };
}

async function notifyAs(actorEmail, bodyExtra = {}) {
    const keep = { ...process.env };
    Object.assign(process.env, {
        VITE_SUPABASE_URL: 'https://fixture.invalid', VITE_SUPABASE_ANON_KEY: 'fixture-anon', SUPABASE_SERVICE_ROLE_KEY: 'fixture-service',
        SMTP_USER: 'fixture-smtp', SMTP_PASS: 'fixture-smtp-pass', NCR_MAIL_TO: 'operator@example.test'
    });
    delete process.env.NCR_MAIL_LIVE; delete process.env.QMS_BASE_URL;
    try {
        const { sent } = serverFixture({ actorEmail });
        const handler = (await load(notifyFile)).default;
        let status = 0, body = null;
        const res = { status(c) { status = c; return this; }, json(b) { body = b; return this; } };
        await handler({
            method: 'POST', headers: { authorization: 'Bearer token-actor' },
            body: { ncr_id: 'r-087', prev: { status: '발행승인 대기', reviews: {} }, ...bodyExtra }
        }, res);
        return { status, body, sent };
    } finally {
        for (const k of Object.keys(process.env)) if (!(k in keep)) delete process.env[k];
        Object.assign(process.env, keep);
    }
}

test('ncr-notify 실직원 actor: 새 차례 알림 수신자에서 test_ 계정을 뺀다(시험 모드 주소로만 발송)', async () => {
    const { status, body, sent } = await notifyAs('qa.head@example.test');
    assert.equal(status, 200);
    assert.deepEqual(body.sent.map(s => s.to), ['prod.staff@example.test']);
    assert.deepEqual(sent.map(m => m.to), ['operator@example.test'], '시험 모드 — 운영자 주소로만');
    assert.equal(sent.some(m => TEST_EMAILS.some(e => m.text.includes(e))), false, '본문 원래 수신자에도 test_ 없음');
});

test('ncr-notify test_ actor: 종전 수신자 전체 유지', async () => {
    const { status, body } = await notifyAs('test_qa_head@example.test');
    assert.equal(status, 200);
    assert.deepEqual(body.sent.map(s => s.to).sort(), ['prod.staff@example.test', 'test_prod_staff@example.test']);
});

test('ncr-notify: actor는 요청 본문이 아니라 토큰으로 찾은 계정 이메일이다', async () => {
    const { body } = await notifyAs('qa.head@example.test', { actor_email: 'test_spoof@example.test', email: 'test_spoof@example.test' });
    assert.deepEqual(body.sent.map(s => s.to), ['prod.staff@example.test'], '본문의 test_ 표기로 필터를 끌 수 없다');
});

test('ncr-notify newTurnUsers 자체는 그대로(필터는 호출 직전에만)', async () => {
    const { newTurnUsers } = await load(notifyFile);
    const r = { status: '회람중', flow_ver: 'v10.1', reviews: { '생산부': { state: 'wait' } } };
    const out = newTurnUsers(ROWS, r, { status: '발행승인 대기', reviews: {} }, {}, 'nobody@example.test');
    assert.deepEqual(out.map(u => u.email).sort(), ['prod.staff@example.test', 'test_prod_staff@example.test']);
});
