import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildWeeklyReportDraftKey,
    clearWeeklyReportDraft,
    createWeeklyReportDraftUpdater,
    isWeeklyReportEditable,
    loadWeeklyReportDraft,
    saveWeeklyReportDraft
} from '../src/lib/weeklyReportDraft.js';

class FakeStorage {
    constructor() {
        this.values = new Map();
    }

    getItem(key) {
        return this.values.has(key) ? this.values.get(key) : null;
    }

    setItem(key, value) {
        this.values.set(key, String(value));
    }

    removeItem(key) {
        this.values.delete(key);
    }
}

const authorId = 'user-1';
const weekStartDate = '2026-07-27';

function makeReport(overrides = {}) {
    return {
        id: 42,
        authorId,
        weekStartDate,
        status: 'draft',
        schedule: [],
        projects: [],
        issues: [],
        samples: [],
        ...overrides
    };
}

test('builds the documented versioned key', () => {
    assert.equal(
        buildWeeklyReportDraftKey(authorId, weekStartDate),
        'qms:weekly-report-draft:v1:user-1:2026-07-27'
    );
});

test('round-trips a compatible draft for the same user, week, and report', () => {
    const storage = new FakeStorage();
    const report = makeReport({ projects: [{ title: 'draft' }] });

    assert.equal(saveWeeklyReportDraft({
        storage,
        authorId,
        weekStartDate,
        report,
        now: () => new Date('2026-07-27T01:02:03.000Z')
    }), true);

    assert.deepEqual(loadWeeklyReportDraft({
        storage,
        authorId,
        weekStartDate,
        serverReport: makeReport()
    }), report);
});

test('isolates drafts by user and week', () => {
    const storage = new FakeStorage();
    saveWeeklyReportDraft({ storage, authorId, weekStartDate, report: makeReport() });

    assert.equal(loadWeeklyReportDraft({
        storage,
        authorId: 'user-2',
        weekStartDate,
        serverReport: makeReport({ authorId: 'user-2' })
    }), null);
    assert.equal(loadWeeklyReportDraft({
        storage,
        authorId,
        weekStartDate: '2026-08-03',
        serverReport: makeReport({ weekStartDate: '2026-08-03' })
    }), null);
});

test('rejects malformed, version-mismatched, and context-mismatched envelopes', () => {
    const cases = [
        '{bad json',
        JSON.stringify({ version: 2 }),
        JSON.stringify({
            version: 1,
            authorId: 'other-user',
            weekStartDate,
            reportId: '42',
            report: makeReport()
        }),
        JSON.stringify({
            version: 1,
            authorId,
            weekStartDate,
            reportId: '42',
            report: makeReport({ weekStartDate: '2026-08-03' })
        }),
        JSON.stringify({
            version: 1,
            authorId,
            weekStartDate,
            reportId: '42',
            report: makeReport({ projects: {} })
        })
    ];

    for (const value of cases) {
        const storage = new FakeStorage();
        storage.setItem(buildWeeklyReportDraftKey(authorId, weekStartDate), value);
        assert.equal(loadWeeklyReportDraft({
            storage,
            authorId,
            weekStartDate,
            serverReport: makeReport()
        }), null);
        assert.equal(storage.getItem(buildWeeklyReportDraftKey(authorId, weekStartDate)), null);
    }
});

test('normalizes missing section arrays without mutating the stored report', () => {
    const storage = new FakeStorage();
    const report = makeReport();
    delete report.issues;
    saveWeeklyReportDraft({ storage, authorId, weekStartDate, report });

    const loaded = loadWeeklyReportDraft({
        storage,
        authorId,
        weekStartDate,
        serverReport: makeReport()
    });

    assert.deepEqual(loaded.issues, []);
    assert.equal(Object.hasOwn(report, 'issues'), false);
});

test('server report identity wins over null or different local identity', () => {
    for (const localId of [null, 99]) {
        const storage = new FakeStorage();
        saveWeeklyReportDraft({
            storage,
            authorId,
            weekStartDate,
            report: makeReport({ id: localId })
        });
        assert.equal(loadWeeklyReportDraft({
            storage,
            authorId,
            weekStartDate,
            serverReport: makeReport({ id: 42 })
        }), null);
    }
});

test('a blank server report only accepts a null-id local draft', () => {
    const serverReport = makeReport({ id: null });
    const storage = new FakeStorage();
    saveWeeklyReportDraft({
        storage,
        authorId,
        weekStartDate,
        report: makeReport({ id: 42 })
    });
    assert.equal(loadWeeklyReportDraft({ storage, authorId, weekStartDate, serverReport }), null);

    saveWeeklyReportDraft({
        storage,
        authorId,
        weekStartDate,
        report: makeReport({ id: null, projects: [{ title: 'new' }] })
    });
    assert.deepEqual(
        loadWeeklyReportDraft({ storage, authorId, weekStartDate, serverReport }).projects,
        [{ title: 'new' }]
    );
});

test('only the author draft and rejected reports are editable', () => {
    assert.equal(isWeeklyReportEditable(makeReport({ status: 'draft' }), authorId), true);
    assert.equal(isWeeklyReportEditable(makeReport({ status: 'rejected' }), authorId), true);
    for (const status of ['submitted', 'reviewed', 'approved']) {
        assert.equal(isWeeklyReportEditable(makeReport({ status }), authorId), false);
    }
    assert.equal(isWeeklyReportEditable(makeReport(), 'other-user'), false);
    assert.equal(isWeeklyReportEditable(null, authorId), false);
});

test('does not restore a draft over submitted, reviewed, or approved server state', () => {
    for (const status of ['submitted', 'reviewed', 'approved']) {
        const storage = new FakeStorage();
        saveWeeklyReportDraft({
            storage,
            authorId,
            weekStartDate,
            report: makeReport()
        });

        assert.equal(loadWeeklyReportDraft({
            storage,
            authorId,
            weekStartDate,
            serverReport: makeReport({ status })
        }), null);
    }
});

test('sequential same-tick functional updaters persist the final next state', () => {
    const storage = new FakeStorage();
    const initial = makeReport({ projects: [] });
    const addUpdater = createWeeklyReportDraftUpdater({
        storage,
        authorId,
        weekStartDate,
        update: previous => ({
            ...previous,
            projects: [...previous.projects, { title: '', status: 'pending' }]
        })
    });
    const editUpdater = createWeeklyReportDraftUpdater({
        storage,
        authorId,
        weekStartDate,
        update: previous => ({
            ...previous,
            projects: previous.projects.map((project, index) => (
                index === 0 ? { ...project, title: 'same-tick update' } : project
            ))
        })
    });

    const afterAdd = addUpdater(initial);
    const finalState = editUpdater(afterAdd);
    const envelope = JSON.parse(storage.getItem(
        buildWeeklyReportDraftKey(authorId, weekStartDate)
    ));

    assert.equal(finalState.projects[0].title, 'same-tick update');
    assert.deepEqual(envelope.report, finalState);
});

test('storage failures never throw and state updates still complete', () => {
    const throwingStorage = {
        getItem() { throw new Error('blocked'); },
        setItem() { throw new Error('quota'); },
        removeItem() { throw new Error('blocked'); }
    };
    const report = makeReport();

    assert.doesNotThrow(() => saveWeeklyReportDraft({
        storage: throwingStorage, authorId, weekStartDate, report
    }));
    assert.equal(loadWeeklyReportDraft({
        storage: throwingStorage, authorId, weekStartDate, serverReport: report
    }), null);
    assert.doesNotThrow(() => clearWeeklyReportDraft({
        storage: throwingStorage, authorId, weekStartDate
    }));

    const updater = createWeeklyReportDraftUpdater({
        storage: throwingStorage,
        authorId,
        weekStartDate,
        update: previous => ({ ...previous, projects: [{ title: 'kept' }] })
    });
    assert.deepEqual(updater(report).projects, [{ title: 'kept' }]);
});

test('clear removes the current user and week draft', () => {
    const storage = new FakeStorage();
    saveWeeklyReportDraft({ storage, authorId, weekStartDate, report: makeReport() });

    assert.equal(clearWeeklyReportDraft({ storage, authorId, weekStartDate }), true);
    assert.equal(storage.getItem(buildWeeklyReportDraftKey(authorId, weekStartDate)), null);
});
