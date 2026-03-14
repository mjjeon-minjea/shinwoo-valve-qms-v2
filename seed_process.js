import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'db.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

if (!db.process_inspections) {
  db.process_inspections = [
    {
      "id": "p1",
      "date": new Date().toISOString().split('T')[0],
      "processName": "조립",
      "itemName": "BALL VALVE 50A",
      "inspector": "홍길동",
      "totalQuantity": 500,
      "inspectedQuantity": 50,
      "defectQuantity": 2,
      "defectType": "조립누락"
    },
    {
      "id": "p2",
      "date": new Date().toISOString().split('T')[0],
      "processName": "가공",
      "itemName": "STEM GUIDE POM",
      "inspector": "이종선",
      "totalQuantity": 1000,
      "inspectedQuantity": 100,
      "defectQuantity": 5,
      "defectType": "치수불량"
    },
    {
      "id": "p3",
      "date": new Date(Date.now() - 86400000).toISOString().split('T')[0],
      "processName": "도장",
      "itemName": "SCV-22A BODY",
      "inspector": "김철수",
      "totalQuantity": 200,
      "inspectedQuantity": 20,
      "defectQuantity": 1,
      "defectType": "외관불량"
    }
  ];
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
  console.log('Seeded process_inspections to db.json');
} else {
  console.log('process_inspections already exists');
}
