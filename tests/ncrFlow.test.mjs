import test from 'node:test';
import assert from 'node:assert/strict';

import { costRowsForEdit, costTotals, reviewedDispLabel, startNextReviewRound } from '../src/lib/ncrFlow.js';

test('회람 차수 — 시작 때 찍은 처리방안이 보존 차수에 그대로 남는다', () => {
    const r1 = { 생산부: { state: 'done', staff_name: '갑', opinion: 'approve' } };             // 작성 화면이 만든 1차(disp 없음)
    const r2 = startNextReviewRound(r1, ['생산부'], [], { disp: '특채(Concession)', conc: '수리' });
    assert.equal(r2.생산부.round_no, 2);
    assert.equal(r2.생산부.disp, '특채(Concession)');
    assert.equal(r2.생산부.conc, '수리');
    const r3 = startNextReviewRound({ 생산부: { ...r2.생산부, state: 'done', staff_name: '을' } }, ['생산부'], [], { disp: '폐기', conc: '' });
    const [h1, h2] = r3.생산부.review_rounds;
    assert.equal(h1.disp, undefined);                                  // 1차는 찍힌 값 없음 → 표시 폴백
    assert.equal(h2.disp, '특채(Concession)');                         // 2차는 자기 안을 기억
    assert.equal(r3.생산부.disp, '폐기');
    assert.equal('conc' in r3.생산부, false);                          // 특채 아니면 유형 칸 없음
    assert.equal('disp' in startNextReviewRound(r1, ['생산부']).생산부, false);   // plan 없이 부르면 종전 모양
});

test('회람 차수 — 보존 차수 처리방안 이름(폴백 포함)', () => {
    const report = { disposition: '특채(Concession)', disposition_prev: '재작업' };
    assert.equal(reviewedDispLabel({ disp: '특채(Concession)', conc: '수리' }, report), '특채(Concession) · 수리');
    assert.equal(reviewedDispLabel({ disp: '반송' }, report), '불채용(반송)');
    assert.equal(reviewedDispLabel({}, report), '재작업');                                   // 옛 문서 = disposition_prev
    assert.equal(reviewedDispLabel({}, { disposition: '폐기', disposition_prev: '' }), '미정');
    assert.equal(reviewedDispLabel({}, { disposition: '폐기', disposition_prev: null }), '폐기');   // 변경 없음 = 첫 안
});

test('품질비용 — 회수는 비용 합계에서 빠지고 따로 합산', () => {
    const items = [{ label: '주물비', amount: 120000 }, { label: '업체 감액', amount: '30,000', recovery: true }, { label: '운반', amount: '' }];
    assert.deepEqual(costTotals(items), { cost: 120000, recovery: 30000 });
    assert.deepEqual(costTotals([{ label: '자재부 감액', recovery: true }]), { cost: 0, recovery: 0 });   // 금액 없는 회수 = 0
    assert.deepEqual(costTotals(null), { cost: 0, recovery: 0 });
});

test('F1 — 부서 재회신 때 직전 비용을 되살려도 회수 표시가 남는다', () => {
    const saved = [{ label: '재작업비', amount: 120000 }, { label: '업체 감액', amount: 30000, recovery: true }];
    const rows = costRowsForEdit(saved);
    assert.deepEqual(rows, [{ label: '재작업비', amount: '120000' }, { label: '업체 감액', amount: '30000', recovery: true }]);
    assert.deepEqual(costTotals(rows), { cost: 120000, recovery: 30000 });   // 비용150,000/회수0 으로 바뀌지 않는다
});
