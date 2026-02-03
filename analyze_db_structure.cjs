const fs = require('fs');

try {
  const data = fs.readFileSync('db.json', 'utf8');
  const json = JSON.parse(data);
  const keys = Object.keys(json);
  
  console.log('--- DB Structure ---');
  keys.forEach(key => {
    const value = json[key];
    console.log(`Table: ${key}, Count: ${Array.isArray(value) ? value.length : 'Not an array'}`);
    if (Array.isArray(value) && value.length > 0) {
      console.log(`  Sample Keys: ${Object.keys(value[0]).join(', ')}`);
    }
  });
} catch (err) {
  console.error('Error reading DB:', err.message);
}
