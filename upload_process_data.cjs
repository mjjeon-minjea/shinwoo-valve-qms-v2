// MES 공정검사 엑셀 파일 → process_inspections 배치 업로드 스크립트
const xlsx = require('xlsx');
const path = require('path');
const http = require('http');

// ---- 날짜 변환 ----
function parseExcelDate(val) {
    if (!val) return '';
    if (typeof val === 'number') {
        const date = new Date(Math.round((val - 25569) * 86400 * 1000));
        return date.toISOString().split('T')[0];
    }
    if (typeof val === 'string') {
        if (!isNaN(Number(val)) && !val.includes('-')) {
            const date = new Date(Math.round((Number(val) - 25569) * 86400 * 1000));
            return date.toISOString().split('T')[0];
        }
        return val.trim();
    }
    return String(val);
}

function parseNum(val) {
    if (val === undefined || val === null || val === '') return 0;
    const n = Number(val);
    return isNaN(n) ? 0 : n;
}

function findVal(row, keys) {
    for (const k of keys) {
        if (row[k] !== undefined && row[k] !== '') return row[k];
    }
    return '';
}

// ---- 엑셀 읽기 ----
const filePath = path.join(__dirname, 'MES DATA', '공정별 검사대상 현황(2026.02월).xlsx');
console.log('파일 읽는 중:', filePath);

const wb = xlsx.readFile(filePath);
const ws = wb.Sheets[wb.SheetNames[0]];
const rawRows = xlsx.utils.sheet_to_json(ws, { raw: true, defval: '' });

console.log(`총 ${rawRows.length}행 읽음`);

const mapped = rawRows.map((row, idx) => ({
    id: `pi_${Date.now()}_${idx}`,
    workOrderNo: String(findVal(row, ['지시번호']) || ''),
    processCode: String(findVal(row, ['공정']) || ''),
    workplaceFull: String(findVal(row, ['작업장명']) || ''),
    inspectionType: String(findVal(row, ['검사구분']) || ''),
    itemCode: String(findVal(row, ['품목번호']) || ''),
    itemName: String(findVal(row, ['품목명칭', '품목명']) || ''),
    inspectionDate: parseExcelDate(findVal(row, ['검사일자'])),
    plannedQuantity: parseNum(findVal(row, ['지시수량'])),
    inspectedQuantity: parseNum(findVal(row, ['검사수량'])),
    failedQuantity: parseNum(findVal(row, ['부적합수량'])),
    passedQuantity: parseNum(findVal(row, ['합격수량'])),
    orderNo: String(findVal(row, ['수주or계획번호', '수주번호']) || ''),
    resolution: String(findVal(row, ['처리방안']) || ''),
    workplaceCode: String(findVal(row, ['작업장코드']) || ''),
    modelName: String(findVal(row, ['모델명']) || ''),
    workplace: String(findVal(row, ['작업장']) || ''),
    equipmentName: String(findVal(row, ['설비명']) || ''),
    isResolutionEntered: String(findVal(row, ['처리방안 기입여부']) || '해당없음'),
}));

// 빈 행 제거
const valid = mapped.filter(r => r.inspectionDate && (r.itemName || r.modelName || r.workplaceFull));
console.log(`유효한 데이터: ${valid.length}건`);

// ---- HTTP POST 요청 ----
const body = JSON.stringify(valid);
const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/process_inspections/batch',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
    }
};

const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        console.log('응답:', data);
        const result = JSON.parse(data);
        if (result.success) {
            console.log(`✅ 업로드 완료! ${result.count}건이 추가되었습니다.`);
        } else {
            console.log('❌ 업로드 실패:', result);
        }
    });
});

req.on('error', (e) => {
    console.error('요청 오류:', e.message);
});

req.write(body);
req.end();
