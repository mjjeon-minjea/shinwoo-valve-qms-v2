import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'db.json');
const mesDataPath = path.join(__dirname, '..', 'src', 'data', 'mes_process_inspections.json');

try {
  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  const mesData = JSON.parse(fs.readFileSync(mesDataPath, 'utf8'));

  // Overwrite process_inspections with the rich MES data
  db.process_inspections = mesData;

  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
  console.log(`Successfully seeded ${mesData.length} records into process_inspections.`);
} catch (e) {
  console.error('Failed to seed MES data:', e);
}
