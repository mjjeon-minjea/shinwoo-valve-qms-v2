
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

async function uploadSpecificData() {
  console.log("🚀 Uploading Users and Weekly Reports...");
  
  const dbPath = path.join(__dirname, '../db.json');
  const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

  // 1. Upload Users (Member Management)
  if (dbData.users && dbData.users.length > 0) {
    console.log(`👤 Uploading ${dbData.users.length} Users...`);
    const { error } = await supabase.from('users').upsert(dbData.users);
    if (error) console.error("❌ Users upload failed:", error.message);
    else console.log("✅ Users uploaded successfully.");
  }

  // 2. Upload Weekly Reports (Task Status)
  if (dbData.weekly_reports && dbData.weekly_reports.length > 0) {
    console.log(`📅 Uploading ${dbData.weekly_reports.length} Weekly Reports...`);
    const { error } = await supabase.from('weekly_reports').upsert(dbData.weekly_reports);
    if (error) console.error("❌ Weekly Reports upload failed:", error.message);
    else console.log("✅ Weekly Reports uploaded successfully.");
  }
  
  console.log("✨ Specific Data Upload Complete!");
}

uploadSpecificData();
