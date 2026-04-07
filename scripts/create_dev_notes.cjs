const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Key in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupDevNotes() {
    console.log('1. Creating dev_notes table using REST API wrapper trick or rpc...');
    
    // Using execute_sql RPC that was created during previous sessions
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS public.dev_notes (
            id SERIAL PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            version TEXT,
            status TEXT DEFAULT 'published',
            author_id UUID REFERENCES auth.users(id),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
        );

        -- Optional: Setup RLS
        ALTER TABLE public.dev_notes ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "dev_notes_select_all" ON public.dev_notes;
        CREATE POLICY "dev_notes_select_all" ON public.dev_notes FOR SELECT USING (true);
        
        DROP POLICY IF EXISTS "dev_notes_insert_admin" ON public.dev_notes;
        CREATE POLICY "dev_notes_insert_admin" ON public.dev_notes FOR INSERT USING (true);
        
        DROP POLICY IF EXISTS "dev_notes_update_admin" ON public.dev_notes;
        CREATE POLICY "dev_notes_update_admin" ON public.dev_notes FOR UPDATE USING (true);
        
        DROP POLICY IF EXISTS "dev_notes_delete_admin" ON public.dev_notes;
        CREATE POLICY "dev_notes_delete_admin" ON public.dev_notes FOR DELETE USING (true);
    `;

    const { data: createData, error: createError } = await supabase.rpc('execute_sql', { sql_query: createTableQuery });
    
    if (createError) {
        console.error('Error creating table:', createError);
        // Sometimes RPC isn't available. Let's just output the error and try inserting anyway just in case it exists.
    } else {
        console.log('Table created successfully.');
    }

    console.log('2. Inserting seed data...');
    const seedData = [
        {
            title: 'V0.19.0 업데이트 내역',
            content: '게시물 승인 파이프라인(Draft to Publish) 구축 완료\n관리자 페이지 기능 향상',
            version: 'v0.19.0',
            status: 'draft'
        },
        {
            title: 'V3.1 데이터 동기화 완료',
            content: '상용망 데이터 5만건 이관 완료 및 스테이징 DB 안정화 구축',
            version: 'v0.19.1',
            status: 'published'
        }
    ];

    const { data: insertData, error: insertError } = await supabase.from('dev_notes').insert(seedData).select();

    if (insertError) {
        console.error('Error inserting seed data:', insertError);
    } else {
        console.log('Seed data inserted successfully:', insertData);
    }
}

setupDevNotes();
