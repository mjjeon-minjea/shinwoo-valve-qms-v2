import { ncrKey } from './ncrNo.js';

/* 과거 부적합 조회(종이 보고서 원본 PDF와 대조해 정리한 값) — 화면 거르기·표시 규칙. 보기 전용. */
export const LEGACY_DISPOSITIONS = ['현상태사용', '수리', '재작업', '반송', '폐기', '관련부품 수정'];

const squash = (s) => String(s ?? '').replace(/\s+/g, '').toLowerCase();

/* 검색어 = 번호·제품·업체·부적합내용·도면번호. 처리방안은 한 보고서에 여러 개 체크된 건이 있어 「포함」으로 거른다. */
export const matchLegacy = (r, q = '', disp = '') =>
    (!disp || squash(r.disposition).includes(squash(disp))) &&
    (!q.trim() || [r.ncr_no, r.product, r.supplier, r.defect_desc, r.drawing_no].join(' ').toLowerCase().includes(q.trim().toLowerCase()));

/* value_note 의 「엑셀값: 처리방안, 완료일」 → ['처리방안', '완료일'] (PDF에서 못 읽어 관리대장 엑셀 값을 넣은 칸) */
export const excelCols = (note) => ((/엑셀값: ([^·]+)/.exec(note || '') || [])[1] || '').split(',').map(s => s.trim()).filter(Boolean);

export const fmtCost = (n) => (n == null ? '' : `${Number(n).toLocaleString('ko-KR')}원`);

/* ── 부적합 대장(NCRLedger)이 두 표를 함께 읽는다 ──
   종이 건(ncr_legacy) 한 줄을 새 보고서(ncr_reports)와 같은 칸 이름으로 바꾼다. 원본 줄은 legacy 에 그대로 둔다(과거 상세 창용).
   처리방안은 새 체계 표준값(disposition_std), 종이 원문은 paper_disposition. 종이엔 전체수량·작성자 칸이 없다. */
export const legacyToLedgerRow = (r) => ({
    id: `paper-${r.id}`, source: 'paper', legacy: r,
    ncr_no: r.ncr_no, occur_date: r.issue_date || '', supplier: r.supplier || '', supplier_code: r.supplier_code ?? null,
    item_name: [r.product, r.part, r.spec].filter(Boolean).join(' '), drawing_no: r.drawing_no || '',
    qty_total: null, qty_defect: r.qty_defect, defect_desc: r.defect_desc || '', code: r.code || '',
    disposition: r.disposition_std || '', concession_type: r.concession_type || null, paper_repair: !!r.paper_repair,
    paper_disposition: r.disposition || '', status: r.closed ? '종결' : '미종결', author_name: '',
    cost_total: r.cost_total ?? r.quality_cost ?? null
});
export const isPaper = (r) => r?.source === 'paper';

/* 정렬·기간은 날짜로 — 번호 문자열은 「NCR 26-001」(새)과 「26-001」(종이)이 섞여 순서가 틀어진다. 같은 날이면 번호 숫자 순. */
export const ledgerDate = (r) => String(r.occur_date || r.date || r.created_at || '').slice(0, 10);
export const ledgerYear = (r) => ledgerDate(r).slice(0, 4);
export const inPeriod = (r, year) => year === 'all' || ledgerYear(r) === String(year);
/* 병행 기간엔 같은 부적합이 종이·QMS 둘 다 있다 — 같은 번호면 QMS 줄 하나만 남기고 종이 원본을 paper 로 붙인다. */
export const mergeLedger = (reports = [], legacy = []) => {
    const qms = new Set(reports.map(r => ncrKey(r.ncr_no)));
    const paperOf = new Map(legacy.filter(l => qms.has(ncrKey(l.ncr_no))).map(l => [ncrKey(l.ncr_no), legacyToLedgerRow(l)]));
    return [...reports.map(r => (paperOf.has(ncrKey(r.ncr_no)) ? { ...r, paper: paperOf.get(ncrKey(r.ncr_no)) } : r)),
        ...legacy.filter(l => !qms.has(ncrKey(l.ncr_no))).map(legacyToLedgerRow)]
    .sort((a, b) => ledgerDate(b).localeCompare(ledgerDate(a)) || String(b.ncr_no || '').localeCompare(String(a.ncr_no || ''), 'ko', { numeric: true }));   // 최신이 1쪽(차장 QA 11/17)
};

/* 선택한 원본 PDF 여러 개를 zip 하나로 — 압축 없이 담기(PDF는 이미 압축돼 있어 줄지 않는다). 새 라이브러리 없이 zip 규격 최소만.
   files = [{ name, data: Uint8Array }] → Uint8Array. 파일 이름은 UTF-8(한글 그대로 보이게 플래그 0x0800). */
const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (d) => { let c = 0xFFFFFFFF; for (let i = 0; i < d.length; i++) c = CRC[(c ^ d[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
export const makeZip = (files) => {
    const enc = new TextEncoder(), parts = [], cen = [];
    let off = 0;
    const hdr = (sig, size) => { const b = new DataView(new ArrayBuffer(size)); b.setUint32(0, sig, true); return b; };
    for (const f of files) {
        const name = enc.encode(f.name), crc = crc32(f.data), len = f.data.length;
        const L = hdr(0x04034b50, 30);
        L.setUint16(4, 20, true); L.setUint16(6, 0x0800, true); L.setUint32(14, crc, true); L.setUint32(18, len, true); L.setUint32(22, len, true); L.setUint16(26, name.length, true);
        const C = hdr(0x02014b50, 46);
        C.setUint16(4, 20, true); C.setUint16(6, 20, true); C.setUint16(8, 0x0800, true); C.setUint32(16, crc, true); C.setUint32(20, len, true); C.setUint32(24, len, true); C.setUint16(28, name.length, true); C.setUint32(42, off, true);
        parts.push(new Uint8Array(L.buffer), name, f.data); cen.push(new Uint8Array(C.buffer), name);
        off += 30 + name.length + len;
    }
    const cenLen = cen.reduce((a, b) => a + b.length, 0);
    const E = hdr(0x06054b50, 22);
    E.setUint16(8, files.length, true); E.setUint16(10, files.length, true); E.setUint32(12, cenLen, true); E.setUint32(16, off, true);
    const all = [...parts, ...cen, new Uint8Array(E.buffer)], out = new Uint8Array(off + cenLen + 22);
    let p = 0; for (const a of all) { out.set(a, p); p += a.length; }
    return out;
};
