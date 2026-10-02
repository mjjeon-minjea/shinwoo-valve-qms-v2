import test from 'node:test';
import assert from 'node:assert/strict';

import { createResourceFiles, validateResourceFile } from '../src/lib/resourceFiles.js';

// 자료실 「되살리기」(숨긴 자료 복구) — 가짜 서버 연결을 넣어, 화면 쪽 함수가 서버 함수 resource_restore 를 맞게 부르는지만 본다.
// 서버 쪽 규칙(지난 판을 최신본으로 둔갑시키지 않는다)은 개발웹 뿌리의 _test_resources.cjs ⑧ 이 확인한다.
function restorer(failRpc = false) {
    const calls = [];
    const files = createResourceFiles({
        apiClient: {
            async rpc(name, args) {
                calls.push([name, args]);
                if (failRpc) throw new Error('RPC unavailable');
                return { id: args.p_id, is_current: true, is_deleted: false };
            }
        }
    });
    return { files, calls };
}

test('되살리기 ① 관리자가 아니면 RESOURCE_ADMIN_REQUIRED 로 거부하고 서버를 부르지 않는다', async () => {
    const { files, calls } = restorer();
    await assert.rejects(files.restore({ id: 'r1', isAdmin: false }), error => error.code === 'RESOURCE_ADMIN_REQUIRED');
    assert.equal(calls.length, 0);
});

test('되살리기 ② 관리자는 서버 함수 resource_restore 를 { p_id } 로 부르고 그 결과를 돌려받는다', async () => {
    const { files, calls } = restorer();
    assert.deepEqual(await files.restore({ id: 'r1', isAdmin: true }), { id: 'r1', is_current: true, is_deleted: false });
    assert.deepEqual(calls, [['resource_restore', { p_id: 'r1' }]]);
});

test('되살리기 ③ 서버 함수가 실패하면 RESOURCE_RESTORE_FAILED', async () => {
    const { files, calls } = restorer(true);
    await assert.rejects(files.restore({ id: 'r1', isAdmin: true }), error => error.code === 'RESOURCE_RESTORE_FAILED');
    assert.equal(calls.length, 1);
});

// ── 개발웹 버그 수정(10-03) — 아래 2개는 되살리기가 아니라 「내려받기 주소의 파일 이름」과 「빈 파일 거부」를 본다 ──
test('내려받기 이름 — & # + 가 든 이름도 download= 뒤에 통째로(encodeURIComponent) 들어간다', async () => {
    const name = 'R&D 절차서 #3+.pdf';
    const row = { id: 'r1', storage_path: 'resources/qa/form/2026/d1/r1--file.pdf', original_name: name, is_current: true, is_deleted: false };
    const files = createResourceFiles({
        apiClient: { async fetch() { return { ok: true, json: async () => [row] }; } },
        // 실제 라이브러리(storage-js 2.91.0)와 같은 방식으로 주소를 만든다: encodeURI(주소 + '&download=' + 이름)
        supabaseClient: { storage: { from: () => ({
            async createSignedUrl(path, seconds, options) {
                return { data: { signedUrl: encodeURI(`https://example.test/object/sign/resource-files/${path}?token=t&download=${options.download}`) }, error: null };
            }
        }) } }
    });
    const url = await files.createDownload({ id: 'r1' });
    const tail = url.split('download=')[1];
    assert.equal(tail, encodeURIComponent(name));
    assert.doesNotMatch(tail, /[&#+]/);
    assert.equal(new URL(url).searchParams.get('download'), name); // 서버가 읽는 이름 = 올린 이름 그대로
});

test('빈 파일 — 크기 0 은 RESOURCE_FILE_EMPTY 로 거부하고 1바이트는 받는다', () => {
    assert.throws(() => validateResourceFile({ name: '빈파일.pdf', size: 0, type: 'application/pdf' }), error => error.code === 'RESOURCE_FILE_EMPTY');
    assert.doesNotThrow(() => validateResourceFile({ name: '한바이트.pdf', size: 1, type: 'application/pdf' }));
});
