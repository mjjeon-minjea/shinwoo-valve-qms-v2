import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
    console.log("🔍 Checking 'inspections' table...");

    // 1. Check existing IDs
    const { data: existing, error: fetchError } = await supabase
        .from('inspections')
        .select('id')
        .limit(5);
    
    if (fetchError) {
        console.error("❌ Fetch Error:", fetchError);
    } else {
        console.log("✅ Existing IDs:", existing.map(e => `${e.id} (${typeof e.id})`));
    }

    // 2. Try Insert WITHOUT ID (Auto-increment check)
    console.log("\n🧪 Test 1: Insert WITHOUT ID...");
    const testItem1 = {
        date: new Date().toISOString().split('T')[0],
        supplier: 'Debug_Bot',
        itemName: 'Test_Item_No_ID',
        totalQuantity: 10,
        inspectionQuantity: 5,
        defectQuantity: 0,
        result: '합격'
    };
    const { data: d1, error: e1 } = await supabase.from('inspections').insert(testItem1).select();
    if (e1) {
        console.error("❌ Insert WITHOUT ID Failed:", e1.message);
    } else {
        console.log("✅ Insert WITHOUT ID Success:", d1[0]);
        // Cleanup
        await supabase.from('inspections').delete().eq('id', d1[0].id);
    }

    // 3. Try Insert WITH String ID (Simulation of current bug)
    console.log("\n🧪 Test 2: Insert WITH String ID (Underscore)...");
    const badId = `${Date.now()}_debug`;
    const testItem2 = { ...testItem1, id: badId, itemName: 'Test_Item_Bad_ID' };
    const { data: d2, error: e2 } = await supabase.from('inspections').insert(testItem2).select();
    if (e2) {
        console.error("❌ Insert WITH String ID Failed:", e2.message);
    } else {
        console.log("✅ Insert WITH String ID Success (Unexpected!):", d2[0]);
        await supabase.from('inspections').delete().eq('id', d2[0].id);
    }
}

debug();
