import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dispositionLabel } from '../src/lib/ncrFlow.js';

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

test('대장 엑셀은 선택 탭이 아니라 전체 검색 결과를 사용한다', () => {
    const ledger = source('NCRLedger.jsx');
    assert.match(ledger, /const allFiltered\s*=/);
    assert.match(ledger, /const data = allFiltered\.map/);
    assert.match(ledger, /XLSX\.writeFile\(/);
    assert.doesNotMatch(ledger, /text\/csv/);
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

test('처리방안 구용어는 저장값을 건드리지 않고 정본으로 표시한다', () => {
    for (const legacy of ['반송', '불채용', '반품']) {
        assert.equal(dispositionLabel(legacy), '불채용(반송)');
    }
    assert.equal(dispositionLabel('폐기'), '폐기');
    assert.equal(dispositionLabel(' 반송 '), ' 반송 ');
    assert.equal(dispositionLabel(null), '');
});

test('작성·상세·대장·인쇄는 처리방안 표시 정본 함수를 공유한다', () => {
    const create = source('NCRCreate.jsx');
    const detail = source('NCRDetail.jsx');
    const ledger = source('NCRLedger.jsx');
    const print = source('NCRPrint.jsx');
    assert.match(create, /setDispList\([\s\S]{0,160}map\(dispositionLabel\)/);
    assert.match(detail, /dispositionLabel\(report\.disposition\)/);
    assert.match(detail, /dispositionLabel\(report\.judge_plan\.disp\)/);
    assert.match(detail, /dispositionLabel\(req\.to\)/);
    assert.match(detail, /dispositionLabel\(q\.to\)/);
    assert.match(detail, /\['수락', '거절', '반송'\]/);
    assert.match(detail, /act\('요청 반송'/);
    assert.match(ledger, /const dispCell = \(r\) => dispositionLabel\(r\.disposition\)/);
    assert.match(print, /const dispoText = dispositionLabel\(/);
    assert.match(print, /const judgePendingText[\s\S]{0,160}dispositionLabel\(judge\.disp\)/);
    assert.match(print, /처분방안 변경 요청 → \{dispositionLabel\(r\.disp_req\.to\)\}/);
    assert.match(print, /이전 변경 요청 → \{dispositionLabel\(q\.to\)\}/);
});
