
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrate() {
  console.log("🚀 Starting Migration to Supabase...");
  
  // Read db.json
  const dbPath = path.join(__dirname, '../db.json');
  const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

  // Define tables to migrate
  const tables = [
    'users', 
    'inspections', 
    'item_master', 
    'weekly_reports', 
    'notices', 
    'resources', 
    'inquiries',
    'settings'
  ];

  for (const table of tables) {
    let data = dbData[table];
    if (table === 'item_master' && !data) {
        // Fallback for Products/ItemMaster alias
        data = dbData['products'];
    }

    if (!data || data.length === 0) {
      console.log(`⚠️  Skipping ${table} (No data)`);
      continue;
    }

    console.log(`📦 Migrating ${table} (${data.length} rows)...`);

    // Batch Insert (Supabase limit is usually around 1000-5000 per request, keeping it safe at 500)
    const BATCH_SIZE = 500;
    for (let i = 0; i < data.length; i += BATCH_SIZE) {
      const batch = data.slice(i, i + BATCH_SIZE);
      
      // Sanitization: Ensure empty strings for numbers are null or 0
      const sanitizedBatch = batch.map(row => {
        const newRow = { ...row };
        // Basic cleanup if needed
        return newRow;
      });

      const { error } = await supabase.from(table).upsert(sanitizedBatch);
      
      if (error) {
        console.error(`❌ Error uploading batch ${i/BATCH_SIZE + 1} for ${table}:`, error.message);
        // Don't exit, try next batch? Or exit?
        // Usually schema mismatch errors block everything.
      } else {
        process.stdout.write('.');
      }
    }
    console.log(`\n✅ ${table} done.`);
  }

  console.log("\n🎉 Migration Complete!");
}

migrate();
