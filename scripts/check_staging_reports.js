import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkData() {
    console.log("스테이징 DB 주간보고 데이터 확인 중...");
    const { data, error } = await supabase.from('weekly_reports').select('*').order('created_at', { ascending: false }).limit(5);
    
    if (error) {
        console.error("데이터 조회 에러 (RLS 차단 가능성):", error.message);
    } else {
        if (data && data.length > 0) {
            console.log("\n✅ 데이터가 존재합니다! 최신 5건 내역:");
            console.table(data.map(d => ({ 
                id: d.id, 
                title: d.title || '제목없음',
                created_at: d.created_at,
                author: d.author_id || d.user_id || '알수없음'
            })));
        } else {
            console.log("❌ 주간보고 테이블이 비어있거나, 조회 가능한 권한이 없습니다 (RLS).");
        }
    }
}
checkData();
