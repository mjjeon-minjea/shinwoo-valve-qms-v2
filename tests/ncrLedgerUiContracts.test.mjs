import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = name => readFileSync(new URL(`../src/components/${name}`, import.meta.url), 'utf8');

test('대장은 내 진행중 기본 탭과 완료·전체 탭을 제공한다', () => {
    const ledger = source('NCRLedger.jsx');
    assert.match(ledger, /useState\('mine'\)/);
    assert.match(ledger, /내 진행중/);
    assert.match(ledger, /완료/);
    assert.match(ledger, /전체/);
});

test('대장 상세은 readOnly이며 실제 내 차례에만 결재함 이동을 위임한다', () => {
    const ledger = source('NCRLedger.jsx');
    const detail = source('NCRDetail.jsx');
    assert.match(ledger, /<NCRDetail[\s\S]{0,500}readOnly/);
    assert.match(ledger, /canProcess=\{myTurnV101\(user, selected, settings\)\}/);
    assert.match(detail, /readOnly\s*=\s*false/);
    assert.match(detail, /결재함에서 처리/);
    assert.match(detail, /readOnly\s*\?/);
});

test('대장 CSV는 선택 탭이 아니라 전체 검색 결과를 사용한다', () => {
    const ledger = source('NCRLedger.jsx');
    assert.match(ledger, /const allFiltered\s*=/);
    assert.match(ledger, /const lines = allFiltered\.map/);
});

test('Dashboard에서 넘긴 문서 ID는 결재함이 설정 로드 후 한 번 소비한다', () => {
    const dashboard = source('Dashboard.jsx');
    const inbox = source('NCRInbox.jsx');
    assert.match(dashboard, /ncrInboxTarget/);
    assert.match(dashboard, /targetReportId=\{ncrInboxTarget\}/);
    assert.match(inbox, /targetReportId/);
    assert.match(inbox, /onTargetConsumed/);
    assert.match(inbox, /!settings/);
});
