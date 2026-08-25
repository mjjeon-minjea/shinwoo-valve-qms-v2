import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { DEFAULT_USER_ROLE } from '../src/lib/ncrRoles.js';

test('신규·fallback 사용자 role의 정본은 employee다', () => {
    assert.equal(DEFAULT_USER_ROLE, 'employee');
    const source = fs.readFileSync(new URL('../src/contexts/UserContext.jsx', import.meta.url), 'utf8');
    assert.doesNotMatch(source, /role:\s*['"](?:user|사원)['"]/);
    assert.ok((source.match(/role:\s*DEFAULT_USER_ROLE/g) || []).length >= 2);
});

test('기존 admin 편집창은 admin 값을 보존하되 일반 계정에 admin 승격 옵션을 열지 않는다', () => {
    const source = fs.readFileSync(new URL('../src/components/UserManagement.jsx', import.meta.url), 'utf8');
    assert.match(source, /editingUser\.role === 'admin'[\s\S]*?<option value="admin">/);
    const addForm = source.slice(source.indexOf('name="role"', source.indexOf('name="role"') + 1));
    assert.doesNotMatch(addForm, /<option value="admin">/);
});

test('기술 manager 대결 버튼은 부서장이 아니라 차석 대결로 표시한다', () => {
    const source = fs.readFileSync(new URL('../src/components/NCRDetail.jsx', import.meta.url), 'utf8');
    const panelStart = source.indexOf("mode === 'techHead'");
    const buttonStart = source.indexOf("report.status === '기술문의' && ro.isTechApprover");
    assert.notEqual(panelStart, -1);
    assert.notEqual(buttonStart, -1);
    assert.match(source.slice(panelStart, panelStart + 500), /ro\.isTechDeputy && !ro\.isTechHead \? '차석 대결' : '기술부서장'/);
    assert.match(source.slice(buttonStart, buttonStart + 500), /ro\.isTechDeputy && !ro\.isTechHead \? '차석 대결' : '기술부서장'/);
});
