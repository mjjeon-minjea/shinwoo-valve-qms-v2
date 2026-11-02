// 087 — NCR OBT 시험계정(이메일 test_ 접두) 구분 실행 검사.
// 실직원이 처리하면 회람 담당·처리방안 마련자 후보·회람 부서·알림 수신자에서 test_ 계정을 뺀다.
// test_ 계정이 처리하면 종전 후보 전체를 그대로 쓴다. 차례(myTurn)·권한·역할 판정은 바꾸지 않는다.
// 실제 NCRCreate.jsx / NCRDetail.jsx / api/ncr-notify.js 를 esbuild 로 묶고 Supabase·메일은 가짜로 바꾼다.
// 실제 계정·DB·Auth·SMTP 에는 접속하지 않는다.
// 088 ③ — 이메일이 test_ 가 아닌 AI 시험계정은 승인된 정확한 auth_id 로만 같은 판정에 넣는다(이름·is_admin·부서로 추정하지 않음).
//         화면 actor.id 는 Auth UUID, 후보 행 id 는 public UUID 이므로 id 끼리 비교하지 않고 auth_id 열만 본다.
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

/* 088 ③ AI 시험계정 — auth_id 는 AI-IDENTITY-BINDING-READONLY.json 의 값(비밀값 아님). 이메일·이름은 시험용 가짜다. */
const AI_AUTH_ID = '7c56892c-f8fd-42a1-91e1-546cf2e3bde2';
const AI_ROWS = [
    { id: 'pub-qa', auth_id: 'auth-qa', email: 'qa.staff@example.test', name: '품질담당', company: '품질보증부', role: 'employee', rank: '대리', status: 'Active', is_admin: false },
    { id: AI_AUTH_ID, auth_id: AI_AUTH_ID, email: 'ai.member@example.test', name: 'AI담당', company: '품질보증부', role: 'employee', rank: '사원', status: 'Active', is_admin: true },
    { id: 'pub-twin', auth_id: 'auth-twin', email: 'twin.member@example.test', name: 'AI담당', company: '품질보증부', role: 'employee', rank: '사원', status: 'Active', is_admin: false },
    { id: 'pub-admin', auth_id: 'auth-admin', email: 'qa.admin@example.test', name: '품질관리자', company: '품질보증부', role: 'employee', rank: '과장', status: 'Active', is_admin: true },
    { id: 'pub-test', auth_id: 'auth-test-qa', email: 'test_qa_staff@example.test', name: '시험품질', company: '품질보증부', role: 'employee', rank: '사원', status: 'Active', is_admin: false },
    { id: 'pub-prod', auth_id: 'auth-prod', email: 'prod.staff@example.test', name: '생산담당', company: '생산부', role: 'employee', rank: '사원', status: 'Active', is_admin: false }
];
// 화면 actor 모양 — UserContext 가 public 행 열(auth_id 포함)을 펼치고 id 만 Auth UUID 로 덮는다.
const REAL_FRONT_ACTOR = { ...AI_ROWS[0], id: 'auth-qa', isAdmin: false };
const AI_FRONT_ACTOR = { ...AI_ROWS[1], id: AI_AUTH_ID, isAdmin: true };
const authIds = rows => rows.map(u => u.auth_id);

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

test('088 공통 판정: 승인된 AI auth_id 는 이메일이 test_ 가 아니어도 시험계정이다(auth_id 열만 본다)', () => {
    assert.deepEqual([...roles.NCR_OBT_TEST_AUTH_IDS], [AI_AUTH_ID], '공통 상수는 승인된 auth_id 하나');
    assert.equal(isNcrTestAccount(AI_ROWS[1]), true, '후보 행(public id + auth_id)');
    assert.equal(isNcrTestAccount({ id: 'pub-other', auth_id: AI_AUTH_ID, email: 'ai.member@example.test' }), true, 'public id 가 달라도 auth_id 로 판정');
    assert.equal(isNcrTestAccount(AI_FRONT_ACTOR), true, '화면 actor(id=Auth UUID, auth_id 열 포함)');
    assert.equal(isNcrTestAccount({ auth_id: AI_AUTH_ID.toUpperCase(), email: 'x@example.test' }), true, 'UUID 대소문자 무관');
    assert.equal(isNcrTestAccount({ id: AI_AUTH_ID, auth_id: 'auth-other', email: 'x@example.test' }), false, 'id 값이 같아도 auth_id 가 다르면 다른 계정(id 끼리 비교 금지)');
    assert.equal(isNcrTestAccount({ id: AI_AUTH_ID, email: 'x@example.test' }), false, 'id 만으로는 판정하지 않는다');
    assert.equal(isNcrTestAccount(AI_ROWS[2]), false, '동명이인(같은 이름·부서·직급)은 실직원');
    assert.equal(isNcrTestAccount(AI_ROWS[3]), false, '일반 시스템 관리자(is_admin)는 실직원');
    assert.equal(isNcrTestAccount({ auth_id: '' }), false);
    assert.equal(isNcrTestAccount(AI_ROWS[4]), true, 'test_ 이메일 판정은 그대로');
});

test('088 공통 판정: 실직원 actor 는 AI 를 후보에서 빼고, AI actor 는 후보 전체(test_ 포함)를 그대로 쓴다', () => {
    assert.deepEqual(authIds(filterNcrCandidates(REAL_FRONT_ACTOR, AI_ROWS)), ['auth-qa', 'auth-twin', 'auth-admin', 'auth-prod']);
    assert.deepEqual(filterNcrCandidates(AI_FRONT_ACTOR, AI_ROWS), AI_ROWS, 'AI actor 는 시험 actor 처럼 전체·같은 순서');
    assert.deepEqual(filterNcrCandidates(TEST_ACTOR, AI_ROWS), AI_ROWS, 'test_ actor 도 전체');
});

test('088: AI 계정의 역할·차례 판정(myTurnV101)·관리자 표식은 그대로다(후보·알림 구분 전용)', () => {
    const review = { status: '종합검토', flow_ver: 'v10.1', reviews: {} };
    assert.equal(myTurnV101(AI_ROWS[1], review, {}), true, 'AI 품질 담당도 자기 차례는 그대로');
    assert.equal(myTurnV101(AI_ROWS[2], review, {}), true);
    assert.equal(roles.roleOf(AI_ROWS[1]).isQaStaff, true);
    assert.equal(AI_ROWS[1].is_admin, true, '판정이 계정 값을 바꾸지 않는다');
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
async function createCandidates(actor, rows = ROWS) {
    globalThis.__api = fakeApi(rows);
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
const REPORT_087 = { id: 'r-087', ncr_no: 'NCR 26-901', status: '회람중', flow_ver: 'v10.1', reviews: { '생산부': { state: 'wait' } }, supplier: '협력사', item_name: '품목', author_name: '작성자' };
function serverFixture({ actorEmail, actorAuthId = 'auth-actor', users = ROWS, report = REPORT_087 }) {
    const sent = [];
    const reads = [];   // 088: 서버가 읽은 users SELECT 열 기록(쓰기 없음)
    const AUTH = { 'token-actor': { id: actorAuthId } };
    const tables = {
        users,
        me: [{ status: 'Active', email: actorEmail, auth_id: actorAuthId }],
        ncr_reports: [report],
        ncr_settings: []
    };
    // 실제 SELECT 처럼 요청한 열만 돌려준다(요청하지 않은 auth_id 는 서버가 볼 수 없다).
    const project = (rows, selected) => {
        if (selected === '*') return rows;
        const cols = selected.split(',').map(s => s.trim());
        return rows.map(r => Object.fromEntries(cols.map(c => [c, r[c]])));
    };
    const builder = (table) => {
        const filters = [];
        let selected = '*';
        const rowsNow = () => {
            if (table === 'users') reads.push({ selected, filters: filters.map(([c]) => c) });
            if (table === 'users' && filters.some(([c]) => c === 'auth_id')) {
                const [, v] = filters.find(([c]) => c === 'auth_id');
                return v === actorAuthId ? project(tables.me, selected) : [];
            }
            let rows = tables[table] || [];
            for (const [c, v] of filters) rows = rows.filter(r => r[c] === v);
            if (table === 'users') rows = project(rows, selected);
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
    return { sent, reads };
}

async function notifyAs(actorEmail, bodyExtra = {}, fixture = {}) {
    const keep = { ...process.env };
    Object.assign(process.env, {
        VITE_SUPABASE_URL: 'https://fixture.invalid', VITE_SUPABASE_ANON_KEY: 'fixture-anon', SUPABASE_SERVICE_ROLE_KEY: 'fixture-service',
        SMTP_USER: 'fixture-smtp', SMTP_PASS: 'fixture-smtp-pass', NCR_MAIL_TO: 'operator@example.test'
    });
    delete process.env.NCR_MAIL_LIVE; delete process.env.QMS_BASE_URL;
    try {
        const { sent, reads } = serverFixture({ actorEmail, ...fixture });
        const handler = (await load(notifyFile)).default;
        let status = 0, body = null;
        const res = { status(c) { status = c; return this; }, json(b) { body = b; return this; } };
        const report = fixture.report || REPORT_087;
        await handler({
            method: 'POST', headers: { authorization: 'Bearer token-actor' },
            body: { ncr_id: report.id, prev: fixture.prev || { status: '발행승인 대기', reviews: {} }, ...bodyExtra }
        }, res);
        return { status, body, sent, reads };
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

/* ── 088 ③ AI 시험계정(auth_id) — 실제 화면·서버 알림 ──────────── */
test('NCRCreate 088 실직원 actor: 처리방안 마련자 후보에서 AI 를 빼되 동명이인·일반 관리자는 남긴다', async () => {
    const { staffAll, options } = await createCandidates(REAL_FRONT_ACTOR, AI_ROWS);
    assert.deepEqual(authIds(staffAll), ['auth-qa', 'auth-twin', 'auth-admin', 'auth-prod'], 'AI·test_ 제외');
    const values = options.map(o => String(o.value));
    assert.equal(values.filter(v => v === 'AI담당').length, 1, '같은 이름 선택지는 동명이인 1개만 남는다');
    assert.ok(values.includes('품질관리자'), '일반 시스템 관리자는 후보에 남는다');
    assert.equal(values.includes('시험품질'), false);
});

test('NCRCreate 088 AI actor(화면 id=Auth UUID): 시험 actor 처럼 후보 전체 유지', async () => {
    const { staffAll, options } = await createCandidates(AI_FRONT_ACTOR, AI_ROWS);
    assert.deepEqual(staffAll, AI_ROWS);
    const values = options.map(o => String(o.value));
    assert.equal(values.filter(v => v === 'AI담당').length, 2, 'AI·동명이인 둘 다 보인다');
    assert.ok(values.includes('시험품질'));
});

const REPORT_088 = { id: 'r-088', ncr_no: 'NCR 26-902', status: '종합검토', flow_ver: 'v10.1', reviews: { '생산부': { state: 'done' } }, supplier: '협력사', item_name: '품목', author_name: '작성자' };
const PREV_088 = { status: '회람중', reviews: { '생산부': { state: 'staffDone' } } };

test('ncr-notify 088 실직원 actor: 종합검토 새 차례 알림에서 AI·test_ 를 빼고 동명이인·일반 관리자에게는 보낸다', async () => {
    const { status, body, sent } = await notifyAs('qa.head@example.test', {}, { users: AI_ROWS, report: REPORT_088, prev: PREV_088 });
    assert.equal(status, 200);
    assert.deepEqual(body.sent.map(s => s.to).sort(), ['qa.admin@example.test', 'qa.staff@example.test', 'twin.member@example.test']);
    assert.equal(sent.some(m => m.text.includes('ai.member@example.test')), false, '시험 모드 본문 원래 수신자에도 AI 없음');
    assert.deepEqual([...new Set(sent.map(m => m.to))], ['operator@example.test'], '시험 모드 — 운영자 주소로만');
});

test('ncr-notify 088 AI actor(토큰→auth_id 로 찾은 me): 시험 actor 처럼 종전 수신자 전체 유지(자기 자신 제외 규칙은 그대로)', async () => {
    const { status, body } = await notifyAs('ai.member@example.test', {}, { actorAuthId: AI_AUTH_ID, users: AI_ROWS, report: REPORT_088, prev: PREV_088 });
    assert.equal(status, 200);
    assert.deepEqual(body.sent.map(s => s.to).sort(), ['qa.admin@example.test', 'qa.staff@example.test', 'test_qa_staff@example.test', 'twin.member@example.test']);
});

test('ncr-notify 088: 서버는 actor(me)·후보 SELECT 양쪽에 auth_id 를 읽고, 본문 값으로 AI 판정을 바꿀 수 없다', async () => {
    const { reads, body } = await notifyAs('qa.head@example.test', { auth_id: AI_AUTH_ID, actor_auth_id: AI_AUTH_ID }, { users: AI_ROWS, report: REPORT_088, prev: PREV_088 });
    const meRead = reads.find(r => r.filters.includes('auth_id'));
    const listRead = reads.find(r => r.filters.includes('status'));
    assert.ok(meRead && listRead, 'me 조회와 후보 조회가 있다');
    assert.ok(meRead.selected.split(',').map(s => s.trim()).includes('auth_id'), 'me SELECT 에 auth_id');
    assert.ok(listRead.selected.split(',').map(s => s.trim()).includes('auth_id'), '후보 SELECT 에 auth_id');
    assert.equal(body.sent.some(s => s.to === 'test_qa_staff@example.test'), false, '본문에 AI auth_id 를 넣어도 실직원 actor 그대로');
});
