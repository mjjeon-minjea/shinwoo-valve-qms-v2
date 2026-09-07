import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('successful save resets attachment restore before returning to new-document mode', () => {
    const source = readFileSync(new URL('../src/components/NCRCreate.jsx', import.meta.url), 'utf8');
    const success = source.slice(source.indexOf('const doneLabel'), source.indexOf("s: '저장 실패:"));
    assert.match(success, /status: 'idle'/);
    assert.match(success, /attachmentRestoreRef\.current = restore/);
    assert.match(success, /setAttachmentRestore\(restore\)/);
});

let isNcrAttachmentRestoreReady;
try {
    ({ isNcrAttachmentRestoreReady } = await import('../src/lib/ncrAttachmentRestore.js'));
} catch {
    // RED: the guard has not been implemented yet.
}

const edit = id => ({ id });

test('new NCR remains saveable only when no attachment restore is active', () => {
    assert.equal(isNcrAttachmentRestoreReady(null, { status: 'idle', docId: null }), true);
});

test('synchronous load guard blocks stale new-document handlers before editDoc renders', () => {
    for (const status of ['loading', 'failed', 'ready']) {
        assert.equal(isNcrAttachmentRestoreReady(null, { status, docId: 'other' }), false);
    }
});

test('editing save is blocked until the selected document attachments restore successfully', () => {
    assert.equal(isNcrAttachmentRestoreReady(edit('ncr-a'), { status: 'loading', docId: 'ncr-a' }), false);
    assert.equal(isNcrAttachmentRestoreReady(edit('ncr-a'), { status: 'failed', docId: 'ncr-a' }), false);
    assert.equal(isNcrAttachmentRestoreReady(edit('ncr-a'), { status: 'ready', docId: 'ncr-a' }), true);
});

test('a stale successful restore cannot authorize a different document', () => {
    assert.equal(isNcrAttachmentRestoreReady(edit('ncr-b'), { status: 'ready', docId: 'ncr-a' }), false);
});
