const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const excelFilePath = path.join(__dirname, 'MES DATA', '공정별 검사대상 현황(2026.02월).xlsx');
const outputJsonPath = path.join(__dirname, 'src', 'data', 'mes_process_inspections.json');

console.log('Reading Excel file...');
const workbook = xlsx.readFile(excelFilePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// Parse sheet to JSON objects using the first row as headers
const rawData = xlsx.utils.sheet_to_json(worksheet, { defval: null });

console.log(`Parsed ${rawData.length} rows.`);

// Clean and format data
const cleanData = rawData.map(row => {
    // Some headers might need normalization, but sheet_to_json uses the exact header string by default.
    return {
        id: row['지시번호'],
        processCode: row['공정'],
        workplaceFull: row['작업장명'],
        processType: row['검사구분'],
        itemCode: row['품목번호'],
        itemName: row['품목명칭'],
        inspectionDate: row['검사일자'],
        plannedQuantity: row['지시수량'] || 0,
        inspectedQuantity: row['검사수량'] || 0,
        failedQuantity: row['부적합수량'] || 0,
        passedQuantity: row['합격수량'] || 0,
        modelName: row['모델명'],
        workplace: row['작업장'],
        facility: row['설비명'],
        resolution: row['처리방안'],
        isResolutionEntered: row['처리방안 기입여부']
    };
});

// Ensure data directory exists
const dataDir = path.dirname(outputJsonPath);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

fs.writeFileSync(outputJsonPath, JSON.stringify(cleanData, null, 2), 'utf8');
console.log(`Successfully wrote ${cleanData.length} records to ${outputJsonPath}`);
