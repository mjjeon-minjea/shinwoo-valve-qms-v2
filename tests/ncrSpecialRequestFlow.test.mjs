/* eslint-disable boundaries/no-unknown-files */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
    STATUS_LABEL,
    latestSpecialRequestApprovalCycle,
    reopenLatestDispositionRequests,
    startNextReviewRound
} from '../src/lib/ncrFlow.js';

const firstRound = () => ({
    생산부: {
        state: 'done',
        staff_email: 'staff@example.test',
        staff_name: '생산담당',
        opinion: 'approve',
        staff_cmt: '1차 검토',
        staff_at: '2026-09-19T10:00:00.000Z',
        head_name: '생산부장',
        head_cmt: '1차 승인',
        head_at: '2026-09-19T10:10:00.000Z',
        deputy: false,
        remand_note: '',
        disp_req: {
            to: '특채(Concession)',
            note: '특채 요청',
            by: '생산담당',
            at: '2026-09-19T10:00:00.000Z',
            resolved: '수락',
            resolved_by: '품질부장',
            resolved_at: '2026-09-19T10:20:00.000Z'
        }
    },
    자재부: { state: 'skip' },
    응용기술팀: {
        state: 'done',
        staff_name: '기술담당',
        head_name: '기술부장',
        staff_at: '2026-09-19T10:30:00.000Z',
        head_at: '2026-09-19T10:40:00.000Z'
    }
});

test('2차 회람은 1차 회신을 보존하고 선택 부서만 wait로 연다', () => {
    const before = firstRound();
    const frozen = structuredClone(before);
    const after = startNextReviewRound(before, ['생산부']);

    assert.deepEqual(before, frozen, '입력 reviews를 직접 변경하면 안 된다');
    assert.equal(after.생산부.round_no, 2);
    assert.equal(after.생산부.state, 'wait');
    assert.equal(after.생산부.staff_name, null);
    assert.equal(after.생산부.head_name, null);
    assert.equal(after.생산부.disp_req, undefined);
    assert.equal(after.생산부.review_rounds.length, 1);
    assert.equal(after.생산부.review_rounds[0].round_no, 1);
    assert.equal(after.생산부.review_rounds[0].staff_cmt, '1차 검토');
    assert.equal(after.생산부.review_rounds[0].disp_req.resolved, '수락');

    assert.equal(after.자재부.round_no, 2);
    assert.equal(after.자재부.state, 'skip');
    assert.equal(after.자재부.review_rounds.length, 1);
});

test('응용기술팀 선행 문의 row는 회차 초기화에서 그대로 둔다', () => {
    const before = firstRound();
    const after = startNextReviewRound(before, ['생산부']);
    assert.deepEqual(after.응용기술팀, before.응용기술팀);
});

test('최종반려는 최신 보존 회차의 처분방안 요청을 미해결 상태로 복원한다', () => {
    const second = startNextReviewRound(firstRound(), ['생산부']);
    second.생산부 = {
        ...second.생산부,
        state: 'done',
        staff_name: '2차담당',
        staff_cmt: '2차 검토',
        head_name: '2차부장'
    };

    const reopened = reopenLatestDispositionRequests(second);
    assert.equal(reopened.count, 1);
    assert.equal(reopened.reviews.생산부.disp_req.to, '특채(Concession)');
    assert.equal(reopened.reviews.생산부.disp_req.resolved, undefined);
    assert.equal(reopened.reviews.생산부.disp_req.resolved_by, undefined);
    assert.equal(reopened.reviews.생산부.disp_req.resolved_at, undefined);
    assert.equal(reopened.reviews.생산부.staff_name, '2차담당');
    assert.equal(reopened.reviews.생산부.review_rounds.length, 1);
});

test('특채요청 결재 대기의 절차서 표시명을 제공한다', () => {
    assert.equal(STATUS_LABEL['특채요청 결재 대기'], '처리방안-특채요청결재대기');
});

test('특채요청 결재 대기 중에도 작성자 회수 경로를 유지한다', () => {
    const source = readFileSync(new URL('../src/components/NCRDetail.jsx', import.meta.url), 'utf8');
    const start = source.indexOf('const canWithdrawV101');
    const end = source.indexOf('const canVoid', start);
    assert.match(source.slice(start, end), /'특채요청 결재 대기'/);
});

test('보완반려 뒤 재상신하면 과거 결재를 현재 회차 결재로 표시하지 않는다', () => {
    const history = [
        { action: '특채요청 검토 상신', actor_name: '담당1', at: '2026-09-19T10:00:00Z' },
        { action: '특채요청 반려·요청부서 보완', actor_name: '부장', at: '2026-09-19T10:01:00Z' },
        { action: '회람회신', actor_name: '요청부서', at: '2026-09-19T10:02:00Z' },
        { action: '특채요청 검토 상신', actor_name: '담당2', at: '2026-09-19T10:03:00Z' }
    ];
    const pending = latestSpecialRequestApprovalCycle(history);
    assert.equal(pending.submit.actor_name, '담당2');
    assert.equal(pending.decision, null);

    history.push({ action: '특채요청 채택·품질판단', actor_name: '부장', at: '2026-09-19T10:04:00Z' });
    const completed = latestSpecialRequestApprovalCycle(history);
    assert.equal(completed.submit.actor_name, '담당2');
    assert.equal(completed.decision.action, '특채요청 채택·품질판단');
});
