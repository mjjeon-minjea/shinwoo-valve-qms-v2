import test from 'node:test';
import assert from 'node:assert/strict';

import { nextNcrNo, normNcrNo, ncrKey } from '../src/lib/ncrNo.js';

test('새 NCR 번호 — 종이 대장과 이어진다', () => {
    assert.equal(nextNcrNo('26', ['NCR 26-035', '26-051', '26-050']), 'NCR 26-052');   // 종이가 더 크면 종이 다음
    assert.equal(nextNcrNo('26', ['NCR 26-060', '26-051']), 'NCR 26-061');              // 새 보고서가 더 크면 그 다음
    assert.equal(nextNcrNo('26', ['26-051', '26-007']), 'NCR 26-052');                  // 종이만
    assert.equal(nextNcrNo('26', []), 'NCR 26-001');                                    // 둘 다 없음
    assert.equal(nextNcrNo('26', ['NCR 25-090', '25-120', '14-0001']), 'NCR 26-001');   // 다른 해 무시
    assert.equal(nextNcrNo('17', ['17-029-01', '17-028']), 'NCR 17-030');               // 가지 번호는 본 번호로
    assert.equal(nextNcrNo('14', ['14-0001', '14-0012']), 'NCR 14-013');                // 네 자리 일련번호
    assert.equal(nextNcrNo('26', [null, '', '무효', 'NCR 26-abc']), 'NCR 26-001');      // 이상한 값은 건너뜀
});

test('직접 입력 번호 — 정규화 · 형식 검사 · 비교 열쇠', () => {
    assert.equal(normNcrNo('26-075'), 'NCR 26-075');
    assert.equal(normNcrNo(' ncr 26-75 '), 'NCR 26-075');
    assert.equal(normNcrNo('NCR26-075-01'), 'NCR 26-075-01');
    for (const bad of ['', null, '2026-075', '26075', '26-', 'NCR 26-abc', '26-12345']) assert.equal(normNcrNo(bad), null, String(bad));
    assert.equal(ncrKey('NCR 26-075'), ncrKey(' 26-075'));
    assert.notEqual(ncrKey('NCR 26-075'), ncrKey('26-076'));
});

test('F2 — 앞 0 차이는 같은 번호 · 가지번호는 다른 번호 · 저장 문자열 하나', () => {
    assert.equal(ncrKey('26-075'), ncrKey('26-0075'));
    assert.equal(ncrKey('NCR 26-75'), ncrKey('26-075'));
    assert.equal(ncrKey('14-0001'), ncrKey('NCR 14-001'));
    assert.notEqual(ncrKey('17-029'), ncrKey('17-029-01'));
    assert.equal(ncrKey('17-029-01'), ncrKey('NCR 17-29-01'));
    for (const s of ['26-0075', '26-75', '26-075', 'ncr 26-075']) assert.equal(normNcrNo(s), 'NCR 26-075', s);
    assert.equal(normNcrNo('26-1234'), 'NCR 26-1234');   // 4자리 이상은 그대로
});
