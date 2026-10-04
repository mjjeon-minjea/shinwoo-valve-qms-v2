import test from 'node:test';
import assert from 'node:assert/strict';

import { buildResourceStoragePath, createResourceFiles, restoreResource } from '../src/lib/resourceFiles.js';
import {
    COMMON_MODULE, FIRST_NOTE, NEW_OPTION, activeTabOf, adminRows, adminSummary, buildDraft, categoryOptions, categoryTabs, docId, draftProblem,
    fileExt, filterResources, freshLabel, keyForLabel, moduleOptions, newDocKey, revisionStatus, startCategory
} from '../src/lib/resourceBoard.js';

const SHA = 'a'.repeat(64);
const file = { name: '새파일.pdf', size: 4, type: 'application/pdf' };

function row(overrides = {}) {
    return {
        id: 'a', module: 'qms-docs', module_label: '전사 문서', category: 'procedure', category_label: '절차서',
        doc_key: 'qp-sample-01', revision: 2, title: '검사 절차서', description: '', source_ref: 'NCR-7',
        revision_note: '문구 수정', original_name: '검사절차.pdf', file_size: 4, registered_by_name: '관리자',
        created_at: '2026-10-01T00:00:00.000Z', is_current: true, is_deleted: false,
        ...overrides
    };
}
const manual = row({
    id: 'b', category: 'manual', category_label: '매뉴얼', doc_key: 'qm-01', revision: 1, title: '품질매뉴얼',
    source_ref: null, original_name: '매뉴얼.hwpx', created_at: '2026-09-01T00:00:00.000Z'
});
const rows = [row(), manual];
const context = () => ({ categories: categoryOptions(rows), modules: moduleOptions(rows), takenDocKeys: rows.map(item => item.doc_key) });

// 화면이 만든 draft 를 실제 발행 경로(resourceFiles 의 publish)에 넣어 서버 함수 호출까지 가는지 본다.
function publisher() {
    const state = { failRpc: false, uploads: 0, calls: [] };
    const files = createResourceFiles({
        apiClient: {
            async rpc(name, args) {
                state.calls.push(args);
                if (state.failRpc) throw new Error('RPC unavailable');
                return { id: args.p_id };
            }
        },
        supabaseClient: { storage: { from: () => ({ async upload() { state.uploads += 1; return { error: null }; } }) } },
        createId: () => 'id-1',
        hashFile: async () => SHA
    });
    return { files, state };
}

test('고르기 목록은 지금 있는 이름의 키를 그대로 쓰고 기본값은 없는 것만 더한다(보기 순서는 기본값 순서)', () => {
    assert.deepEqual(categoryOptions(rows).map(option => option.label), ['매뉴얼', '절차서', '지침서', '양식', '규격']);
    assert.deepEqual(moduleOptions(rows), [{ key: 'common', label: COMMON_MODULE }, { key: 'qms-docs', label: '전사 문서' }]);
    assert.deepEqual(categoryOptions([]).map(option => option.key), ['manual', 'procedure', 'instruction', 'form', 'standard']);
    // 기본값의 키를 이미 다른 이름이 쓰고 있으면 더하지 않는다(같은 키에 이름이 둘 생기지 않게)
    const renamed = categoryOptions([row({ category: 'form', category_label: '서식' })]);
    assert.deepEqual(renamed.filter(option => option.key === 'form'), [{ key: 'form', label: '서식' }]);
});

test('새 자료 draft: 자동으로 채운 키가 resourceFiles 의 키 규칙을 통과해 발행까지 간다', async () => {
    const form = {
        base: null, category: NEW_OPTION, categoryNew: ' 검사 기준서 ', module: NEW_OPTION, moduleNew: '구매',
        title: ' 수입검사 기준 ', description: '첫 줄\n둘째 줄', sourceRef: '', revisionNote: ''
    };
    const draft = buildDraft(form, { ...context(), now: new Date(2026, 9, 2, 9, 0) });
    assert.match(draft.category, /^c-[a-z0-9]+$/);
    assert.match(draft.module, /^m-[a-z0-9]+$/);
    assert.match(draft.docKey, /^d20261002-[a-z0-9]{6}$/);
    assert.deepEqual([draft.categoryLabel, draft.moduleLabel, draft.title, draft.revisionNote], ['검사 기준서', '구매', '수입검사 기준', FIRST_NOTE]);
    assert.equal(draft.description, '첫 줄\n둘째 줄');
    assert.equal(draftProblem(draft), '');
    // resourceFiles.js 의 KEY_PATTERN · DOC_KEY_PATTERN 은 내보내지 않으므로, 그 규칙을 쓰는 실제 함수로 확인한다
    assert.doesNotThrow(() => buildResourceStoragePath({ id: 'id-1', module: draft.module, category: draft.category, docKey: draft.docKey, originalName: file.name }));
    const { files, state } = publisher();
    await files.publish({ draft, file, isAdmin: true });
    assert.equal(state.calls.length, 1);
    assert.deepEqual([state.calls[0].p_doc_key, state.calls[0].p_category_label, state.calls[0].p_revision_note], [draft.docKey, '검사 기준서', FIRST_NOTE]);
    // 이름이 비면 서버로 보내기 전에 쉬운 말로 알려 준다
    assert.equal(draftProblem(buildDraft({ ...form, categoryNew: '  ' }, context())), '구분을 입력하세요.');
    assert.equal(draftProblem(buildDraft({ ...form, title: ' ' }, context())), '자료명을 입력하세요.');
});

test('같은 이름을 고르거나 직접 입력하면 기존 키를 다시 쓴다', () => {
    const { categories, modules } = context();
    assert.equal(keyForLabel(categories, ' 절차서 ', 'c'), 'procedure');
    const typed = buildDraft({ base: null, category: NEW_OPTION, categoryNew: '매뉴얼', module: '전사 문서', title: '가' }, context());
    assert.deepEqual([typed.category, typed.module], ['manual', 'qms-docs']);
    const chosen = buildDraft({ base: null, category: '양식', module: COMMON_MODULE, title: '가' }, context());
    assert.deepEqual([chosen.category, chosen.module], ['form', 'common']);
    assert.equal(modules.length, 2);
});

test('문서 키는 이미 쓰는 키와 겹치면 다시 뽑는다', () => {
    const now = new Date(2026, 0, 5);
    const first = newDocKey({ now, random: () => 0.5 });
    assert.equal(first, 'd20260105-i00000');
    const sequence = [0.5, 0.5, 0.25];
    assert.equal(newDocKey({ taken: [first], now, random: () => sequence.shift() }), newDocKey({ now, random: () => 0.25 }));
    assert.equal(sequence.length, 0);
});

test('새 판 draft 는 원 자료의 업무·구분·문서 키와 이름을 그대로 쓴다', () => {
    const form = { base: rows[0], category: NEW_OPTION, categoryNew: '딴 구분', module: '딴 업무', title: '검사 절차서(개정)', description: '', sourceRef: 'NCR-9', revisionNote: ' 3.2항 수정 ' };
    const draft = buildDraft(form, context());
    assert.deepEqual(
        [draft.module, draft.moduleLabel, draft.category, draft.categoryLabel, draft.docKey],
        ['qms-docs', '전사 문서', 'procedure', '절차서', 'qp-sample-01']
    );
    assert.deepEqual([draft.title, draft.sourceRef, draft.revisionNote], ['검사 절차서(개정)', 'NCR-9', '3.2항 수정']);
    assert.equal(draftProblem(draft, true), '');
    assert.equal(draftProblem(buildDraft({ ...form, revisionNote: '  ' }, context()), true), '바뀐 점을 입력하세요.');
});

test('발행 실패 뒤 다시 누르면 영수증의 입력을 그대로 써서 파일을 다시 올리지 않는다', async () => {
    const form = { base: null, category: '양식', module: COMMON_MODULE, title: '검사성적서 양식', description: '', sourceRef: '', revisionNote: '' };
    const { files, state } = publisher();
    state.failRpc = true;
    let receipt;
    await assert.rejects(files.publish({ draft: buildDraft(form, { ...context(), random: () => 0.1 }), file, isAdmin: true }), (error) => {
        receipt = error.receipt;
        return error.code === 'RESOURCE_PUBLISH_FAILED';
    });
    assert.equal(receipt.uploaded, true);

    state.failRpc = false;
    const retry = buildDraft(form, { ...context(), receipt, random: () => 0.2 });
    assert.equal(retry.docKey, receipt.immutable.docKey); // 문서 키를 새로 뽑지 않는다
    await files.publish({ draft: retry, file, isAdmin: true, receipt });
    assert.equal(state.uploads, 1);
    assert.equal(state.calls.length, 2);
    assert.equal(state.calls[0].p_storage_path, state.calls[1].p_storage_path);
    // 영수증 없이 draft 를 다시 만들면 문서 키가 달라져 서버 연결 로직이 거부한다 — 그래서 화면은 영수증을 넘긴다
    await assert.rejects(files.publish({ draft: buildDraft(form, { ...context(), random: () => 0.2 }), file, isAdmin: true, receipt }), /영수증과 다릅니다/);
});

test('찾기: 자료명·구분·업무·원본 참조·파일명에서 찾고 영문 키로는 찾지 않는다', () => {
    const shuffled = [manual, row()];
    const titles = (options) => filterResources(shuffled, options).map(item => item.title);
    assert.deepEqual(titles(), ['검사 절차서', '품질매뉴얼']); // 등록일 최신순
    assert.deepEqual(shuffled.map(item => item.id), ['b', 'a']); // 받은 배열은 건드리지 않는다
    assert.deepEqual(titles({ search: ' 매뉴얼 ' }), ['품질매뉴얼']);
    assert.deepEqual(titles({ search: 'ncr-7' }), ['검사 절차서']);
    assert.deepEqual(titles({ search: 'HWPX' }), ['품질매뉴얼']);
    assert.deepEqual(titles({ search: '전사 문서' }), ['검사 절차서', '품질매뉴얼']);
    for (const key of ['qms-docs', 'procedure', 'manual', 'qp-sample-01', 'qm-01']) assert.deepEqual(titles({ search: key }), [], key);
    assert.deepEqual(titles({ category: '매뉴얼' }), ['품질매뉴얼']);
    // 검색어가 있으면 고른 구분(탭)과 무관하게 모든 구분에서 찾는다
    assert.deepEqual(titles({ category: '매뉴얼', search: '검사' }), ['검사 절차서']);
    assert.deepEqual(titles({ category: '규격', search: '전사 문서' }), ['검사 절차서', '품질매뉴얼']);
    assert.deepEqual(titles({ category: '규격', search: '   ' }), []); // 빈칸뿐인 검색어는 검색이 아니다 → 고른 구분만
    // 업무 고르기는 검색 중에도 적용된다
    assert.deepEqual(titles({ category: '매뉴얼', search: '검사', module: '없는 업무' }), []);
    assert.deepEqual(titles({ module: '없는 업무' }), []);
});

test('판 상태 · 새 자료/새 판 표시 · 확장자', () => {
    const history = [
        row({ id: 'r1', revision: 1, is_current: false }),
        row({ id: 'r3', revision: 3, is_current: false, is_deleted: true }),
        row(), manual,
        row({ id: 'x', module: 'ncr' }) // 문서 키가 같아도 업무가 다르면 다른 자료
    ];
    assert.deepEqual(history.slice(0, 3).map(revisionStatus), ['지난 판', '숨김', '최신']);
    assert.notEqual(docId(rows[0]), docId(history[4]));
    const now = new Date('2026-10-10T00:00:00.000Z').getTime();
    assert.equal(freshLabel(rows[0], now), '새 판');
    assert.equal(freshLabel(row({ revision: 1 }), now), '새 자료');
    assert.equal(freshLabel(manual, now), ''); // 39일 전
    assert.equal(freshLabel(row({ created_at: null }), now), '');
    assert.equal(fileExt('보고.서.HwpX'), 'HWPX');
});

// --- 2026-10-02 보기 순서 확인 (메인 보완) ---
import orderTest from 'node:test';
import orderAssert from 'node:assert/strict';
orderTest('고르기 목록·탭 순서: 기본 순서 → 그 밖의 이름(가나다), 업무는 전사 공통이 먼저 — 「기타」는 기본값이 아니라 자료에 있을 때만', async () => {
    const board = await import('../src/lib/resourceBoard.js');
    const sample = [
        { category: 'etc', category_label: '기타', module: 'm-x', module_label: '부적합 관리' },
        { category: 'c-x', category_label: '안내지', module: 'common', module_label: '전사 공통' },
        { category: 'form', category_label: '양식', module: 'common', module_label: '전사 공통' },
    ];
    orderAssert.deepEqual(board.categoryOptions(sample).map(o => o.label), ['매뉴얼', '절차서', '지침서', '양식', '규격', '기타', '안내지']);
    orderAssert.deepEqual(board.moduleOptions(sample).map(o => o.label), ['전사 공통', '부적합 관리']);
    orderAssert.deepEqual(board.categoryTabs(sample).map(c => c.label + ' ' + c.count), ['매뉴얼 0', '절차서 0', '지침서 0', '양식 1', '규격 0', '기타 1', '안내지 1']);
});

// --- 2026-10-02 2차: 구분 탭 · 관리 탭 · 되살리기 ---
test('구분 탭: 기본 5개는 자료가 없어도 늘 있고 그 밖의 구분은 가나다순 — 「전체」 탭과 기본 「기타」는 없다', () => {
    assert.deepEqual(categoryTabs([]), ['매뉴얼', '절차서', '지침서', '양식', '규격'].map(label => ({ label, count: 0 })));
    const sample = [
        row(), manual,
        row({ id: 'c', category: 'c-x', category_label: '안내지', module: 'm-x', module_label: '부적합 관리' }),
        row({ id: 'd', category: 'etc', category_label: '기타' }),
        row({ id: 'e', category: 'c-y', category_label: '검사 기준서' })
    ];
    const show = (tabs) => tabs.map(tab => `${tab.label} ${tab.count}`);
    assert.deepEqual(show(categoryTabs(sample)), ['매뉴얼 1', '절차서 1', '지침서 0', '양식 0', '규격 0', '검사 기준서 1', '기타 1', '안내지 1']);
    // 건수는 고른 업무의 것만 세고, 탭 목록은 그대로다
    assert.deepEqual(show(categoryTabs(sample, '부적합 관리')), ['매뉴얼 0', '절차서 0', '지침서 0', '양식 0', '규격 0', '검사 기준서 0', '기타 0', '안내지 1']);
    for (const tabs of [categoryTabs([]), categoryTabs(sample)]) assert.equal(tabs.some(tab => tab.label === '전체'), false);
    assert.equal(categoryOptions([]).some(option => option.label === '기타' || option.key === 'etc'), false);
    // 보여 줄 탭
    assert.equal(activeTabOf(categoryTabs([]), ''), '매뉴얼'); // 자료가 하나도 없으면 맨 앞
    assert.equal(activeTabOf(categoryTabs([row()]), ''), '절차서'); // 처음 열면 자료가 있는 첫 탭
    assert.equal(activeTabOf(categoryTabs(sample), '안내지'), '안내지');
    assert.equal(activeTabOf(categoryTabs(sample), '규격'), '규격'); // 0건이어도 기본 탭은 고른 그대로
    assert.equal(activeTabOf(categoryTabs([row()]), '안내지'), '절차서'); // 보던 구분이 사라지면 자료가 있는 첫 탭
    assert.equal(activeTabOf(categoryTabs(sample, '부적합 관리'), ''), '안내지'); // 고른 업무의 자료가 있는 첫 탭
});

test('새 자료 등록 창의 구분 처음 값 = 보고 있는 탭 — 관리 탭·검색 중(빈 값)이거나 고르기 목록에 없는 이름이면 비운다', () => {
    const options = categoryOptions([row({ category: 'form', category_label: '서식' })]); // 기본 「양식」의 키를 「서식」이 쓰고 있다
    assert.equal(startCategory(options, '서식'), '서식');
    assert.equal(startCategory(options, '규격'), '규격'); // 0건인 기본 탭도 고르기 목록에 있다
    assert.equal(startCategory(options, ''), ''); // 관리 탭·검색 중
    assert.equal(startCategory(options, '양식'), ''); // 탭에는 있어도 고르기 목록에 없는 이름 — 화면에 보이는 값과 실제 값이 어긋나지 않게 비운다
});

test('관리 탭: 자료별로 모아(최근 등록 자료가 위) 큰 판이 먼저 · 검색은 자료 단위 · 숨긴 것만 보기 · 요약', () => {
    const history = [
        row({ id: 'r1', revision: 1, is_current: false, title: '검사 절차(초판)', created_at: '2026-08-01T00:00:00.000Z' }),
        row({ id: 'r3', revision: 3, is_current: false, is_deleted: true, created_at: '2026-10-02T00:00:00.000Z' }),
        row(), manual,
        row({ id: 'x', module: 'ncr', created_at: '2026-07-01T00:00:00.000Z' }) // 문서 키가 같아도 업무가 다르면 다른 자료
    ];
    const ids = (options) => adminRows(history, options).map(item => item.id);
    assert.deepEqual(ids(), ['r3', 'a', 'r1', 'b', 'x']); // 자료의 최근 등록일: 검사 절차서 10-02 → 품질매뉴얼 09-01 → ncr 쪽 07-01
    assert.deepEqual(history.map(item => item.id), ['r1', 'r3', 'a', 'b', 'x']); // 받은 배열은 건드리지 않는다
    assert.deepEqual(ids({ hiddenOnly: true }), ['r3']);
    assert.deepEqual(ids({ search: ' 초판 ' }), ['r3', 'a', 'r1']); // 한 판만 맞아도 그 자료의 모든 판
    assert.deepEqual(ids({ search: '초판', hiddenOnly: true }), ['r3']);
    assert.deepEqual(ids({ search: '매뉴얼.HWPX' }), ['b']); // 파일명
    assert.deepEqual(ids({ search: '절차서' }), ['r3', 'a', 'r1', 'x']); // 구분
    for (const key of ['qms-docs', 'procedure', 'qp-sample-01', 'ncr']) assert.deepEqual(ids({ search: key }), [], key); // 영문 키로는 찾지 않는다
    assert.deepEqual(adminSummary(history), { docs: 3, revisions: 5, hidden: 1 });
    assert.deepEqual([adminRows(null), adminSummary(undefined)], [[], { docs: 0, revisions: 0, hidden: 0 }]);
});

test('되살리기: 관리자가 아니면 거부하고, 관리자는 서버 함수 resource_restore 를 p_id 로 부른다', async () => {
    const calls = [];
    let down = false;
    const files = createResourceFiles({
        apiClient: {
            async rpc(name, args) {
                calls.push([name, args]);
                if (down) throw new Error('RPC unavailable');
                return { id: args.p_id, is_current: true, is_deleted: false };
            }
        }
    });
    await assert.rejects(files.restore({ id: 'r1', isAdmin: false }), error => error.code === 'RESOURCE_ADMIN_REQUIRED' && error.message === '관리자만 자료를 되살릴 수 있습니다.');
    await assert.rejects(files.restore({ id: ' ', isAdmin: true }), error => error.code === 'RESOURCE_INVALID_ID');
    assert.equal(calls.length, 0); // 거부된 요청은 서버로 가지 않는다
    assert.deepEqual(await files.restore({ id: 'r1', isAdmin: true }), { id: 'r1', is_current: true, is_deleted: false });
    assert.deepEqual(calls, [['resource_restore', { p_id: 'r1' }]]);
    down = true;
    await assert.rejects(files.restore({ id: 'r1', isAdmin: true }), error => error.code === 'RESOURCE_RESTORE_FAILED' && error.message === '자료 되살리기에 실패했습니다.');
    assert.equal(typeof restoreResource, 'function'); // 화면이 쓰는 이름으로 내보냈다
});

// --- 2026-10-04 자료실 관리 권한 = 품질보증부(Active) · 최신본 미확인 표시 (스테이징 후보) ---
import { readFileSync } from 'node:fs';
import * as board from '../src/lib/resourceBoard.js';

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('자료실 관리 권한: 품질보증부 Active 만 — 사이트 관리자(is_admin)라도 타부서면 보기·현재본만', () => {
    const can = board.canManageResources;
    assert.equal(typeof can, 'function');
    assert.equal(can({ company: '품질보증부', status: 'Active', role: 'employee', is_admin: false }), true); // 품질보증부 사원
    assert.equal(can({ company: ' 품질보증부 ', status: 'Active' }), true); // 앞뒤 빈칸은 같은 부서
    assert.equal(can({ company: '품질보증부', status: 'Pending' }), false); // 승인 전
    assert.equal(can({ company: '품질보증부', status: 'active' }), false); // 서버와 같이 'Active' 정확 일치
    assert.equal(can({ company: '생산부', status: 'Active', is_admin: true, isAdmin: true }), false); // 타부서 사이트 관리자
    assert.equal(can({ company: '품질보증팀', status: 'Active' }), false);
    for (const user of [null, undefined, {}, { company: null, status: 'Active' }]) assert.equal(can(user), false);
});

test('Dashboard: 자료실만 canManageResources 로 바꾸고 회원관리·홈페이지 설정·게시 승인은 is_admin 그대로', () => {
    const dashboard = source('src/components/Dashboard.jsx');
    assert.match(dashboard, /case 'resources': return <ResourceRoom user=\{user\} isAdmin=\{canManageResources\(user\)\} \/>;/);
    assert.match(dashboard, /import \{ canManageResources \} from '\.\.\/lib\/resourceBoard';/);
    assert.match(dashboard, /case 'post_approval': return isAdmin \?/);
    assert.match(dashboard, /case 'members': return isAdmin \?/);
    assert.match(dashboard, /case 'settings_home': return isAdmin \?/);
    assert.match(dashboard, /\['post_approval', 'members', 'settings_home'\]\.includes\(activeTab\) && !isAdmin/);
});

test('최신본 미확인: 표시가 있는 행만 골라 「최신본」이라고 단정하지 않는다 — 다른 현행 자료는 그대로', () => {
    assert.equal(board.LATEST_UNVERIFIED, '최신본 미확인');
    const flagged = row({ revision_note: '스테이징 최초 등록 · 원본 R4 · 기준일 2024-05-03(파일 수정일, 확인 필요) · 최신본 미확인' });
    const byDescription = row({ revision_note: '최초 등록', description: '최신본 미확인 · 절차서 QAP-420-01 개정 R4' });
    assert.equal(board.isLatestUnverified(flagged), true);
    assert.equal(board.isLatestUnverified(byDescription), true);
    assert.equal(board.isLatestUnverified(row()), false);
    assert.equal(board.isLatestUnverified(manual), false);
    assert.equal(board.isLatestUnverified(null), false);
    // 상세 머리글의 판 상태
    assert.equal(board.latestLabel(flagged), '최신본 미확인');
    assert.equal(board.latestLabel(row()), '최신본');
    // 맨 위 안내: 미확인 행이 없으면 원래 문구 그대로, 있으면 그 행만 예외로 알린다
    const plain = board.latestNotice([row(), manual]);
    assert.equal(plain, '여기 올라온 파일이 최신본입니다. 내려받아 둔 파일이나 출력물은 개정 전 것일 수 있으니, 쓰기 전에 등록일을 확인하세요.');
    const mixed = board.latestNotice([row(), flagged]);
    assert.notEqual(mixed, plain);
    assert.match(mixed, /「최신본 미확인」/);
    assert.doesNotMatch(mixed, /^여기 올라온 파일이 최신본입니다/);
    assert.equal(board.latestNotice([]), plain);
});

test('ResourceRoom: 미확인 행은 목록 표시·상세 머리글에서 「최신본 미확인」, 맨 위 안내는 latestNotice', () => {
    const room = source('src/components/ResourceRoom.jsx');
    assert.match(room, /isLatestUnverified\(row\)/); // 목록의 자료명 옆 표시
    assert.match(room, /latestLabel\(detail\)/); // 상세 머리글
    assert.match(room, /latestNotice\(resources\)/); // 맨 위 안내
    assert.doesNotMatch(room, /\{detail\.revision\}판 · 최신본 · /); // 단정하던 머리글 제거
});

test('스테이징 SQL: 한 트랜잭션 · 스테이징 신원/원문 해시 사전 확인 · 함수 3개와 Storage·resources 정책만 품질보증부 판정으로', () => {
    const sql = source('sql/20261004_resource_room_department_access_staging.sql');
    const body = sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, ''); // 주석(되돌림 원문 포함) 제외한 실행부
    assert.equal((body.match(/^\s*begin\s*;/gim) || []).length, 1);
    assert.equal((body.match(/^\s*commit\s*;/gim) || []).length, 1);
    assert.match(body, /7623125441096521075/); // 스테이징 system_identifier
    assert.doesNotMatch(body, /zuahpjdsypovxdplxryw/); // 메인 참조 없음
    for (const hash of ['ccd916796d6691b60303fead5f610435', 'cf4ff96b7a02c1c3134dc15a210d5537', 'a75ddc446dc01ba2987fafa340e65736', '93381178e874703961a67505d8447eda']) {
        assert.match(body, new RegExp(hash)); // 원문 해시가 다르면 중단
    }
    for (const name of ['resource_publish_revision', 'resource_soft_delete', 'resource_restore']) {
        const fn = new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?\\$function\\$;`, 'i').exec(body)?.[0] || '';
        assert.ok(fn, name);
        assert.doesNotMatch(fn, /is_admin/, name); // 사이트 관리자 축으로 판정하지 않는다
        assert.match(fn, /u\.status = 'Active'/, name);
        assert.match(fn, /btrim\(coalesce\(u\.company, ''\)\) = '품질보증부'/, name);
        assert.match(fn, /set search_path to 'pg_catalog', 'public'/i, name);
        assert.match(fn, /security definer/i, name);
    }
    // 회원 보호 트리거: 비관리자 자기 company/status 변경 거부를 더하고 기존 신원·마지막 관리자 보호는 그대로
    const guard = /create or replace function public\.guard_users_admin\(\)[\s\S]*?\$function\$;/i.exec(body)?.[0] || '';
    assert.match(guard, /new\.company\s+is distinct from old\.company/);
    assert.match(guard, /new\.status\s+is distinct from old\.status/);
    assert.match(guard, /마지막 시스템 관리자는 해제할 수 없습니다/);
    assert.match(guard, /회원 등록 권한이 없습니다 \(가입 규격 위반\)/);
    // 정책: 바꾸는 이름은 이것뿐
    const touched = [...body.matchAll(/(?:alter|create|drop) policy (?:if exists )?"?([\w ]+?)"? on ([\w.]+)/gi)].map(m => `${m[2]}:${m[1]}`);
    assert.deepEqual([...new Set(touched)].sort(), [
        'public.resources:Enable ALL for authenticated users',
        'public.resources:resources_select_current_or_quality',
        'storage.objects:qms_files_authenticated_insert',
        'storage.objects:qms_files_authenticated_read'
    ]);
    assert.match(body, /split_part\(name, '\/', 1\) <> 'resources'/); // resources 밖(NCR 첨부 등) 경로는 그대로 허용
    assert.doesNotMatch(body, /grant |revoke /i); // EXECUTE ACL 은 create or replace 로 보존(바꾸지 않음)
});
