import test from 'node:test';
import assert from 'node:assert/strict';

import {
    canApprove,
    isNcrRouteStaff,
    roleOf,
    techApprovalDecision
} from '../src/lib/ncrRoles.js';

const settingsOn = { allow_deputy: true };
const settingsOff = { allow_deputy: false };

const user = (name, company, rank, role) => ({ name, company, rank, role });

test('손양수 director는 직급 문자열과 무관하게 품질 NCR 발행승인 권한이 있다', () => {
    const ro = roleOf(user('손양수', '품질보증부', '부장', 'director'), settingsOff);
    assert.equal(ro.isQaHead, true);
    assert.equal(ro.isQaApprover, true);
});

test('최용석 director는 생산부 회신의 부서장 승인권자다', () => {
    const ro = roleOf(user('최용석', '생산부', '이사', 'director'), settingsOff);
    assert.equal(ro.isDeptHead('생산부'), true);
    assert.equal(ro.isDeptDeputy('생산부'), false);
});

test('조찬복 manager는 allow_deputy가 true일 때만 생산부 대결권자다', () => {
    const deputy = user('조찬복', '생산부', '부장', 'manager');
    assert.equal(roleOf(deputy, settingsOn).isDeptDeputy('생산부'), true);
    assert.equal(roleOf(deputy, settingsOff).isDeptDeputy('생산부'), false);
    assert.equal(roleOf(deputy, null).isDeptDeputy('생산부'), false);
});

test('기술 회신 확정은 저장 직전에도 role과 allow_deputy를 재검사하고 대결 여부를 남긴다', () => {
    const director = user('기술부서장', '응용기술팀', '임의직급', 'director');
    const manager = user('기술차석', '응용기술팀', '임의직급', 'manager');

    assert.deepEqual(techApprovalDecision(director, null), { allowed: true, deputy: false });
    assert.deepEqual(techApprovalDecision(manager, settingsOn), { allowed: true, deputy: true });
    assert.deepEqual(techApprovalDecision(manager, settingsOff), { allowed: false, deputy: false });
    assert.deepEqual(techApprovalDecision(manager, null), { allowed: false, deputy: false });
    assert.deepEqual(techApprovalDecision(user('관리자', '응용기술팀', '임의직급', 'admin'), settingsOn), { allowed: false, deputy: false });
});

test('정준길 employee는 실무자이며 승인권자가 아니다', () => {
    const employee = user('정준길', '생산부', '차장', 'employee');
    const ro = roleOf(employee, settingsOn);
    assert.equal(ro.isDeptStaff('생산부'), true);
    assert.equal(ro.isDeptHead('생산부'), false);
    assert.equal(ro.isDeptDeputy('생산부'), false);
    assert.equal(isNcrRouteStaff(employee), true);
});

test('권병수 admin은 기존 admin 값은 유지하되 NCR director로 간주하지 않는다', () => {
    const admin = user('권병수', '품질보증부', '이사', 'admin');
    const ro = roleOf(admin, settingsOn);
    assert.equal(ro.role, 'admin');
    assert.equal(ro.isQaHead, false);
    assert.equal(ro.isQaApprover, false);
    assert.equal(ro.isDeptHead('품질보증부'), false);
});

test('레거시 승인도 직급이 아니라 director 또는 허용된 manager role로 판정한다', () => {
    const report = { status: '발행', dept: '생산부' };
    assert.equal(canApprove(user('최용석', '생산부', '사원', 'director'), report, settingsOff), true);
    assert.equal(canApprove(user('조찬복', '생산부', '이사', 'manager'), report, settingsOn), true);
    assert.equal(canApprove(user('조찬복', '생산부', '이사', 'manager'), report, settingsOff), false);
    assert.equal(canApprove(user('정준길', '생산부', '이사', 'employee'), report, settingsOn), false);
    assert.equal(canApprove(user('권병수', '생산부', '이사', 'admin'), report, settingsOn), false);
});

test('NCR 담당자 후보도 직급이 아니라 employee role만 허용한다', () => {
    assert.equal(isNcrRouteStaff(user('실무자', '자재부', '부장', 'employee')), true);
    assert.equal(isNcrRouteStaff(user('부서장', '자재부', '사원', 'director')), false);
    assert.equal(isNcrRouteStaff(user('차석', '자재부', '대리', 'manager')), false);
    assert.equal(isNcrRouteStaff(user('관리자', '자재부', '사원', 'admin')), false);
});
