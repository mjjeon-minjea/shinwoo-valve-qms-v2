const fs = require('fs');
const db = JSON.parse(fs.readFileSync('db.json', 'utf8'));
let found = 0;
for (const key in db) {
  if (Array.isArray(db[key])) {
    const items = db[key].filter(i => JSON.stringify(i).includes('2026-02-') || JSON.stringify(i).includes('2026-03-'));
    if (items.length > 0 && key !== 'inspections' && key !== 'products' && key !== 'item_master' && key !== 'process_inspections') {
        console.log(`Found ${items.length} items with 2026-02/03 in ${key}`);
        found++;
    }
  }
}
if(found === 0) console.log('No hidden 2026-02/03 data found outside known large tables.');
