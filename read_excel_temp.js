const xlsx = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'MES DATA', '공정별 검사대상 현황(2026.02월).xlsx');
const workbook = xlsx.readFile(filePath);

const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

console.log("Sheet Name:", sheetName);
console.log("Total Rows:", data.length);
console.log("--- Header Rows (first 3) ---");
for (let i = 0; i < Math.min(3, data.length); i++) {
  console.log(data[i]);
}

console.log("\n--- Sample Data Rows (first 3) ---");
for (let i = 3; i < Math.min(6, data.length); i++) {
  console.log(data[i]);
}
