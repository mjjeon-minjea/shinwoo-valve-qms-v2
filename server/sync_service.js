// server/sync_service.js
import cron from 'node-cron';
import { executeQuery } from './db_connector.js';
import { supabase } from './supabase_client.js';

// Mapping: Legacy View Name -> Supabase Table Name
const SYNC_MAP = {
  'V_QMS_INBOUND': 'qms_inbound',
  'V_QMS_PROCESS': 'qms_process',
  'V_ITEM_MASTER': 'item_master'
};

async function syncTable(viewName, tableName) {
  console.log(`🔄 [Sync] Starting sync: ${viewName} -> ${tableName}`);
  
  try {
    // 1. Fetch from Local DB
    const rows = await executeQuery(viewName);
    if (!rows || rows.length === 0) {
      console.log(`   Detailed: No new data in ${viewName}`);
      return;
    }

    // 2. Upsert to Supabase
    // Note: This assumes the tables exist in Supabase. 
    // If simple INSERT is needed, use .insert()
    const { error } = await supabase
      .from(tableName)
      .upsert(rows); // Upsert based on Primary Key

    if (error) {
      throw error;
    }

    console.log(`✅ [Sync] Success! ${rows.length} rows synced to ${tableName}`);
  } catch (err) {
    console.error(`❌ [Sync] Failed for ${viewName}:`, err.message);
  }
}

export function startScheduler() {
  console.log("⏰ [Scheduler] Data Sync Service Started (Interval: Every 10 minutes)");

  // Schedule task: Run every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    console.log('\n--- 🚀 Scheduled Sync Triggered ---');
    for (const [view, table] of Object.entries(SYNC_MAP)) {
      await syncTable(view, table);
    }
    console.log('--- Sync Completed ---\n');
  });

  // Run once immediately on startup for testing
  /*
  console.log("⚡ [Scheduler] Running immediate initial sync...");
  (async () => {
    for (const [view, table] of Object.entries(SYNC_MAP)) {
      await syncTable(view, table);
    }
  })();
  */
}
