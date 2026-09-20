/* eslint-disable boundaries/no-unknown-files */
import test from 'node:test';
import assert from 'node:assert/strict';

import { concessionTypeLabel } from '../src/lib/ncrFlow.js';
import { isNcrFinished, isNcrRelatedToUser } from '../src/lib/ncrRoles.js';

const user = (email, company, role = 'employee') => ({ email, company, role });
const report = overrides => ({
    author_email: 'qa-author@example.test',
    dept: '생산부',
    status: '회람중',
    reviews: {
        생산부: { state: 'done', staff_email: 'assigned@example.test' },
        생산관리부: { state: 'skip' },
        자재부: { state: 'wait' }
    },
    ...overrides
});

test('특채 하위유형 수리만 특채-수리로 표시하고 저장값은 바꾸지 않는다', () => {
    assert.equal(concessionTypeLabel('수리'), '특채-수리');
    assert.equal(concessionTypeLabel('현상태 사용'), '현상태 사용');
    assert.equal(concessionTypeLabel(''), '');
});

test('종결과 무효만 완료 문서다', () => {
    assert.equal(isNcrFinished({ status: '종결' }), true);
    assert.equal(isNcrFinished({ status: '무효' }), true);
    assert.equal(isNcrFinished({ status: '회람중' }), false);
    assert.equal(isNcrFinished({ status: '작성중' }), false);
});

test('품질보증부는 모든 NCR과 관련된다', () => {
    assert.equal(isNcrRelatedToUser(user('qa@example.test', '품질보증부'), report()), true);
});

test('회람 대상 부서는 지정 담당자와 무관하게 관련되고 skip 부서는 제외된다', () => {
    const r = report();
    assert.equal(isNcrRelatedToUser(user('other-prod@example.test', '생산부'), r), true);
    assert.equal(isNcrRelatedToUser(user('other-mat@example.test', '자재부'), r), true);
    assert.equal(isNcrRelatedToUser(user('other-pm@example.test', '생산관리부'), r), false);
});

test('skip 회람행은 dept가 같아도 관련 문서가 아니다', () => {
    assert.equal(isNcrRelatedToUser(
        user('skipped@example.test', '생산관리부'),
        report({ dept: '생산관리부' })
    ), false);
});

test('작성자 본인과 회람행이 없는 레거시 처리부서는 관련 문서로 본다', () => {
    assert.equal(isNcrRelatedToUser(user('qa-author@example.test', '다른부서'), report()), true);
    assert.equal(isNcrRelatedToUser(user('legacy@example.test', '자재부'), report({ reviews: {}, dept: '자재부' })), true);
    assert.equal(isNcrRelatedToUser(user('none@example.test', '영업부'), report()), false);
});
