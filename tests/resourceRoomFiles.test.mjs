import test from 'node:test';
import assert from 'node:assert/strict';

import {
    MAX_RESOURCE_FILE_SIZE,
    buildResourceStoragePath,
    createResourceFiles,
    mimeForResourceFile,
    validateResourceFile
} from '../src/lib/resourceFiles.js';

const SHA = 'a'.repeat(64);
const RESOURCE_ID = '11111111-1111-4111-8111-111111111111';

function resource(overrides = {}) {
    return {
        id: RESOURCE_ID,
        module: 'weekly-report',
        module_label: '주간보고',
        category: 'attachment',
        category_label: '첨부',
        doc_key: '2026-w36',
        revision: 1,
        title: '36주차 주간보고',
        description: '',
        source_ref: null,
        revision_note: '',
        storage_path: 'resources/weekly-report/attachment/2026/2026-w36/11111111-1111-4111-8111-111111111111--주간보고.pdf',
        original_name: '주간보고.pdf',
        file_size: 4,
        mime_type: 'application/pdf',
        sha256: SHA,
        registered_by_name: '관리자',
        created_at: '2026-09-07T00:00:00.000Z',
        is_current: true,
        is_deleted: false,
        ...overrides
    };
}

function file(name = '주간보고.pdf', size = 4, type = 'application/pdf') {
    return {
        name,
        size,
        type,
        async arrayBuffer() { return new Uint8Array([1, 2, 3, 4]).buffer; }
    };
}

function response(rows) {
    return { ok: true, json: async () => rows };
}

test('accepts arbitrary module/category keys, preserves Korean original name, and maps exact canonical MIME values', () => {
    const custom = file('제출본.hwpx', 4, '');
    assert.equal(mimeForResourceFile(custom), 'application/vnd.hancom.hwpx');
    assert.equal(mimeForResourceFile(file('제출본.hwp', 4, '')), 'application/x-hwp');
    assert.equal(mimeForResourceFile(file('제출본.docx', 4, '')), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    assert.equal(mimeForResourceFile(file('제출본.pdf', 4, '')), 'application/pdf');
    assert.doesNotThrow(() => validateResourceFile(custom));

    const path = buildResourceStoragePath({
        id: RESOURCE_ID,
        module: 'incoming-inspection',
        category: 'supplier-form',
        docKey: 'lot-2026.09',
        originalName: custom.name,
        now: new Date('2026-09-07T00:00:00Z')
    });
    assert.equal(path, 'resources/incoming-inspection/supplier-form/2026/lot-2026.09/11111111-1111-4111-8111-111111111111--file.hwpx');
});

test('rejects disallowed extensions and a file one byte over the 20 MiB boundary', () => {
    assert.throws(() => validateResourceFile(file('script.js')), /허용되지 않는 파일 확장자/);
    assert.doesNotThrow(() => validateResourceFile(file('limit.pdf', MAX_RESOURCE_FILE_SIZE)));
    assert.throws(() => validateResourceFile(file('too-large.pdf', MAX_RESOURCE_FILE_SIZE + 1)), /20 MiB/);
});

test('lists only current non-deleted resources and keeps failures distinct from an empty result', async () => {
    const calls = [];
    const files = createResourceFiles({
        apiClient: {
            async fetch(path) {
                calls.push(path);
                return response([resource(), resource({ id: 'old', is_current: false }), resource({ id: 'deleted', is_deleted: true })]);
            }
        }
    });
    const rows = await files.listCurrent();
    assert.deepEqual(rows.map(row => row.id), [RESOURCE_ID]);
    assert.match(calls[0], /is_current=eq.true/);
    assert.match(calls[0], /is_deleted=eq.false/);

    const unavailable = createResourceFiles({ apiClient: { async fetch() { throw new Error('404'); } } });
    await assert.rejects(unavailable.listCurrent(), /자료실 목록을 불러오지 못했습니다/);
});

test('does not expose publish or revision history helpers to a non-admin caller', async () => {
    const files = createResourceFiles({
        apiClient: { async fetch() { return response([resource()]); } },
        hashFile: async () => SHA
    });
    const draft = {
        module: 'weekly-report', moduleLabel: '주간보고', category: 'attachment', categoryLabel: '첨부',
        docKey: '2026-w36', title: '36주차 주간보고', description: '', sourceRef: '', revisionNote: ''
    };

    await assert.rejects(files.publish({ draft, file: file(), isAdmin: false }), /관리자만 자료를 발행할 수 있습니다/);
    await assert.rejects(files.listHistory({ isAdmin: false }), /관리자만 개정 이력을 볼 수 있습니다/);
});

test('keeps an upload receipt after publish failure, retries the same RPC without re-upload, and rejects changed immutable input', async () => {
    const uploads = [];
    const rpcCalls = [];
    let failPublish = true;
    const selectedFile = file();
    const files = createResourceFiles({
        apiClient: {
            async rpc(name, args) {
                rpcCalls.push({ name, args });
                if (failPublish) throw new Error('RPC unavailable');
                return resource({ id: args.p_id, storage_path: args.p_storage_path, sha256: args.p_sha256 });
            }
        },
        supabaseClient: {
            storage: {
                from() {
                    return {
                        async upload(path, body, options) {
                            uploads.push({ path, body, options });
                            return { data: { path }, error: null };
                        }
                    };
                }
            }
        },
        createId: () => RESOURCE_ID,
        hashFile: async () => SHA,
        now: () => new Date('2026-09-07T00:00:00Z')
    });
    const draft = {
        module: 'weekly-report', moduleLabel: '주간보고', category: 'attachment', categoryLabel: '첨부',
        docKey: '2026-w36', title: '36주차 주간보고', description: '', sourceRef: '', revisionNote: ''
    };

    let receipt;
    await assert.rejects(files.publish({ draft, file: selectedFile, isAdmin: true }), error => {
        receipt = error.receipt;
        return error.code === 'RESOURCE_PUBLISH_FAILED';
    });
    assert.equal(uploads.length, 1);
    assert.equal(rpcCalls.length, 1);
    assert.equal(receipt.id, RESOURCE_ID);

    failPublish = false;
    const saved = await files.publish({ draft, file: selectedFile, receipt, isAdmin: true });
    assert.equal(saved.id, RESOURCE_ID);
    assert.equal(uploads.length, 1);
    assert.equal(rpcCalls.length, 2);
    assert.equal(rpcCalls[0].args.p_storage_path, rpcCalls[1].args.p_storage_path);
    await assert.rejects(files.publish({ draft: { ...draft, title: '변경됨' }, file: selectedFile, receipt, isAdmin: true }), /재시도 입력값이 최초 업로드 영수증과 다릅니다/);
});

test('re-reads a resource before a 300-second signed download and blocks deleted rows while allowing admin history', async () => {
    const signs = [];
    const active = resource({ is_current: false });
    const files = createResourceFiles({
        apiClient: { async fetch() { return response([active]); } },
        supabaseClient: {
            storage: {
                from() {
                    return {
                        async createSignedUrl(path, seconds, options) {
                            signs.push({ path, seconds, options });
                            return { data: { signedUrl: 'https://example.test/signed' }, error: null };
                        }
                    };
                }
            }
        }
    });
    const url = await files.createDownload({ id: RESOURCE_ID, isAdmin: true });
    assert.equal(url, 'https://example.test/signed');
    assert.deepEqual(signs[0], {
        path: active.storage_path,
        seconds: 300,
        options: { download: active.original_name }
    });

    const deleted = createResourceFiles({ apiClient: { async fetch() { return response([resource({ is_deleted: true })]); } } });
    await assert.rejects(deleted.createDownload({ id: RESOURCE_ID, isAdmin: true }), /삭제된 자료/);
});
