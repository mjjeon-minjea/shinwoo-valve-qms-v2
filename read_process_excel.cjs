// 공정검사 엑셀 파일 구조 분석 스크립트
const xlsx = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'MES DATA', '공정별 검사대상 현황(2026.02월).xlsx');

try {
    const wb = xlsx.readFile(filePath);
    console.log('=== 시트 목록 ===');
    console.log(wb.SheetNames);
    
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(ws, { header: 1, raw: true });
    
    console.log('\n=== 전체 행 수 ===', data.length);
    console.log('\n=== 헤더 (0행) ===');
    console.log(JSON.stringify(data[0], null, 2));
    console.log('\n=== 1행 데이터 ===');
    console.log(JSON.stringify(data[1], null, 2));
    console.log('\n=== 2행 데이터 ===');
    console.log(JSON.stringify(data[2], null, 2));
    console.log('\n=== 3행 데이터 ===');
    console.log(JSON.stringify(data[3], null, 2));
    
    // JSON으로도 파싱해보기
    const jsonData = xlsx.utils.sheet_to_json(ws, { raw: true });
    console.log('\n=== JSON 변환 (첫 번째 레코드) ===');
    console.log(JSON.stringify(jsonData[0], null, 2));
    console.log('\n=== JSON 변환 (두 번째 레코드) ===');
    console.log(JSON.stringify(jsonData[1], null, 2));
    
    console.log('\n=== 키 목록 ===');
    console.log(Object.keys(jsonData[0] || {}));
    
} catch (e) {
    console.error('오류:', e.message);
}
