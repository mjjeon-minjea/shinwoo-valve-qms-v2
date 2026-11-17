import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

import { matchLegacy, excelCols, fmtCost, makeZip, legacyToLedgerRow, mergeLedger, isPaper, inPeriod, ledgerYear } from '../src/lib/ncrLegacy.js';
import { readdirSync } from 'node:fs';
import { isNcrFinished } from '../src/lib/ncrRoles.js';
import { crc32 } from 'node:zlib';

/* seed·mockdb 는 개발웹 폴더에만 있다 — 깃허브 레포(테스트웹)에서는 이 데이터 시험만 건너뛴다 */
const HAS_SEED = existsSync(new URL('../../seed/ncr_legacy_2025.json', import.meta.url)) && existsSync(new URL('../../mockdb.json', import.meta.url));
const rows = HAS_SEED ? JSON.parse(readFileSync(new URL('../../seed/ncr_legacy_2025.json', import.meta.url), 'utf8')) : [];

test('과거 부적합 seed — 74건 · 번호 중복 없음 · 차장 결정 반영', { skip: !HAS_SEED }, () => {
    assert.equal(rows.length, 74);
    assert.equal(new Set(rows.map(r => r.ncr_no)).size, 74);
    const by = Object.fromEntries(rows.map(r => [r.ncr_no, r]));
    assert.equal(by['25-041'].disposition, '반송');
    assert.equal(by['25-041'].closed, true);
    assert.equal(by['25-065'].disposition, '수리 후 합격');
    assert.equal(by['25-065'].quality_cost, 119700);
    assert.equal(by['25-046'].product, 'SCV-H12');
});

test('검색·처리방안 거르기', { skip: !HAS_SEED }, () => {
    const tov = rows.filter(r => matchLegacy(r, 'tov'));
    assert.ok(tov.length > 0 && tov.every(r => /tov/i.test([r.ncr_no, r.product, r.supplier, r.defect_desc, r.drawing_no].join(' '))));
    assert.ok(rows.filter(r => matchLegacy(r, '', '수리')).some(r => r.ncr_no === '25-065'));   // 「수리 후 합격」도 수리로 잡힌다
    assert.ok(rows.filter(r => matchLegacy(r, '', '관련부품 수정')).some(r => r.ncr_no === '25-021')); // 복수 체크·띄어쓰기 달라도
    assert.equal(rows.filter(r => matchLegacy(r, '25-046')).length, 1);
});

test('엑셀값 칸 · 금액 표시', () => {
    assert.deepEqual(excelCols('엑셀값: 처리방안, 완료일 · 차장 결정'), ['처리방안', '완료일']);
    assert.deepEqual(excelCols(null), []);
    assert.equal(fmtCost(119700), '119,700원');
    assert.equal(fmtCost(null), '');
});

test('선택 다운로드 zip — 한글 이름 · 내용 · CRC', () => {
    const files = [{ name: '25-001.pdf', data: new TextEncoder().encode('%PDF-가') }, { name: '과거부적합_25-002.pdf', data: new Uint8Array([1, 2, 3]) }];
    const z = Buffer.from(makeZip(files));
    const end = z.length - 22;
    assert.equal(z.readUInt32LE(end), 0x06054b50);
    assert.equal(z.readUInt16LE(end + 10), 2);
    let p = 0;
    for (const f of files) {   // 앞에서부터 파일 머리글 → 이름 → 내용이 그대로 들어 있는지
        assert.equal(z.readUInt32LE(p), 0x04034b50);
        assert.equal(z.readUInt32LE(p + 14), crc32(f.data));
        const n = z.readUInt16LE(p + 26);
        assert.equal(z.subarray(p + 30, p + 30 + n).toString('utf8'), f.name);
        assert.deepEqual(z.subarray(p + 30 + n, p + 30 + n + f.data.length), Buffer.from(f.data));
        p += 30 + n + f.data.length;
    }
});


/* ── 새 칸(새 보고서와 같은 말) · 부적합 대장 합치기 ── */
const seedDir = new URL('../../seed/', import.meta.url);
const all = !HAS_SEED ? [] : readdirSync(seedDir).filter(f => /^ncr_legacy_\d{4}\.json$/.test(f)).flatMap(f => JSON.parse(readFileSync(new URL(f, seedDir), 'utf8')));
const db = HAS_SEED ? JSON.parse(readFileSync(new URL('../../mockdb.json', import.meta.url), 'utf8')) : { ncr_settings: [], vendors: [] };
const set = Object.fromEntries(db.ncr_settings.map(s => [s.id, s]));

test('seed 13개 연도 · 새 칸 값이 설정(ncr_settings)·업체 마스터 안에 있다', { skip: !HAS_SEED }, () => {
    assert.equal(all.length, 743);
    const vend = new Set(db.vendors.map(v => v.id));
    for (const r of all) {
        assert.ok(r.code === null || r.code in set.codes.map, r.ncr_no);
        assert.ok(r.disposition_std === null || set.dispositions.list.includes(r.disposition_std), r.ncr_no);
        assert.ok(r.concession_type === null || (r.disposition_std === '특채(Concession)' && set.dispositions.concession_types.includes(r.concession_type)), r.ncr_no);
        assert.equal(r.paper_repair, r.concession_type === '수리', r.ncr_no);   // 종이 「수리」는 따로 표시
        assert.ok(r.supplier_code === null || vend.has(r.supplier_code), r.ncr_no);
        assert.ok(['협력업체', '사내', '중국공장', '미기재'].includes(r.supplier_group), r.ncr_no);
        assert.equal(r.cost_total, r.quality_cost);
    }
    const by = Object.fromEntries(all.map(r => [r.ncr_no, r]));
    assert.equal(by['25-065'].disposition, '수리 후 합격');            // 원문 그대로
    assert.equal(by['25-065'].disposition_std, '특채(Concession)');
    assert.equal(by['25-041'].disposition_std, '불채용(반송)');
    assert.equal(by['14-0001'].code, 'A1');                            // 내부 기공
});

test('종이 건 → 대장 줄 · 날짜순 합치기 · 기간', { skip: !HAS_SEED }, () => {
    const p = legacyToLedgerRow(all.find(r => r.ncr_no === '25-065'));
    assert.ok(isPaper(p) && p.id === 'paper-25-065' && p.legacy.ncr_no === '25-065');
    assert.equal(p.occur_date, p.legacy.issue_date);
    assert.equal(p.disposition, '특채(Concession)');
    assert.equal(p.paper_disposition, '수리 후 합격');
    assert.equal(p.status, '종결');
    const reports = [{ id: 'n2', ncr_no: 'NCR 26-002', occur_date: '2026-08-12' }, { id: 'n1', ncr_no: 'NCR 26-001', occur_date: '2026-01-02' }];
    const legacy = [{ id: '26-010', ncr_no: '26-010', issue_date: '2026-01-05', closed: true }, { id: '25-074', ncr_no: '25-074', issue_date: '2025-12-30', closed: false }];
    const m = mergeLedger(reports, legacy);
    assert.deepEqual(m.map(r => r.ncr_no), ['NCR 26-002', '26-010', 'NCR 26-001', '25-074']);   // 최신순 · 번호 문자열 순이면 「26-010」이 맨 앞
    assert.deepEqual(m.filter(r => inPeriod(r, '2026')).length, 3);
    assert.equal(m.filter(r => inPeriod(r, 'all')).length, 4);
    assert.equal(ledgerYear(m[3]), '2025');
    assert.equal(m[3].status, '미종결');
});

test('병행 기간 — 같은 번호(종이·QMS)는 QMS 한 줄 + 종이 원본, 다른 번호는 그대로', () => {
    const reports = [{ id: 'n75', ncr_no: 'NCR 26-075', occur_date: '2026-11-10' }, { id: 'n76', ncr_no: 'NCR 26-076', occur_date: '2026-11-12' }];
    const legacy = [{ id: '26-075', ncr_no: ' 26-075', issue_date: '2026-11-09', closed: false }, { id: '26-074', ncr_no: '26-074', issue_date: '2026-11-01', closed: true }];
    const m = mergeLedger(reports, legacy);
    assert.deepEqual(m.map(r => r.ncr_no), ['NCR 26-076', 'NCR 26-075', '26-074']);
    const j = m.find(r => r.id === 'n75');
    assert.ok(!isPaper(j) && isPaper(j.paper) && j.paper.legacy.id === '26-075');   // 종이 원본 → 과거 상세로 열 수 있다
    assert.equal(m.find(r => r.id === 'n76').paper, undefined);
    assert.equal(m.filter(isPaper).length, 1);
});

test('D2 — 미종결 종이 건은 대장 「완료」 탭에서 빠진다 · F2 — 앞 0 다른 같은 번호도 합친다', () => {
    const m = mergeLedger([{ id: 'n75', ncr_no: 'NCR 26-075', occur_date: '2026-11-10', status: '종결' }],
        [{ id: '26-0075', ncr_no: '26-0075', issue_date: '2026-11-09', closed: true }, { id: '20-043', ncr_no: '20-043', issue_date: '2020-05-01', closed: false },
         { id: '20-044', ncr_no: '20-044', issue_date: '2020-05-02', closed: true }]);
    assert.equal(m.length, 3);
    assert.equal(m.find(r => r.id === 'n75').paper.legacy.ncr_no, '26-0075');   // 원문 번호 그대로
    assert.deepEqual(m.filter(isNcrFinished).map(r => r.ncr_no), ['NCR 26-075', '20-044']);
});
