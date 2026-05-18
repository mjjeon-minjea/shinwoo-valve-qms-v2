import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://srzaanvojyhwzugoaimk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNyemFhbnZvanlod3p1Z29haW1rIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTIxMTQ3OSwiZXhwIjoyMDkwNzg3NDc5fQ.a0soVU-s6a8Cd7BjnqhZv4-4kEacdQsjLOR7xsTHr1A';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkReports() {
    try {
        console.log("Fetching from Supabase...");
        
        // Try 'weekly_reports' table first
        const { data, error } = await supabase
            .from('weekly_reports')
            .select('*')
            .ilike('authorName', '%이종선%');
            
        if (error) {
            console.error('Supabase error on weekly_reports:', error);
            // If the table name is different, we might need to query something else.
        } else {
            console.log(`Found ${data.length} reports in weekly_reports.`);
            const mayReports = data.filter(r => {
                const dateStr = r.weekStartDate || r.created_at || '';
                return dateStr.includes('-05-') || dateStr.startsWith('2026-05');
            });
            console.log(`Found ${mayReports.length} reports for May 2026.`);
            console.log(JSON.stringify(mayReports, null, 2));
        }
    } catch (e) {
        console.error('Script error:', e);
    }
}

checkReports();
