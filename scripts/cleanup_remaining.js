
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

if (!supabaseUrl || !supabaseKey) { process.exit(1); }

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateRemaining() {
  console.log("🧹 Starting Cleanup Migration (Small Tables Only)...");
  
  const dbPath = path.join(__dirname, '../db.json');
  const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

  // Only target the failed ones
  const tables = ['users', 'notices', 'resources'];

  for (const table of tables) {
    const data = dbData[table];
    if (!data || data.length === 0) continue;

    console.log(`📦 Retrying ${table} (${data.length} rows)...`);
    
    // Upload all at once (small data)
    const { error } = await supabase.from(table).upsert(data);
    
    if (error) {
      console.error(`❌ Still failing ${table}:`, error.message);
    } else {
      console.log(`✅ ${table} fixed and uploaded.`);
    }
  }
  console.log("\n✨ Cleanup Complete!");
}

migrateRemaining();
