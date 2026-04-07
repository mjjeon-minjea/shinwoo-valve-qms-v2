import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkAuthSystem() {
    console.log("------------------------------------------");
    console.log("🔍 스테이징 인증 서버(GoTrue) 정밀 진단 시작...");
    console.log(`📡 대상 URL: ${process.env.VITE_SUPABASE_URL}`);
    console.log("------------------------------------------\n");

    // 2. 새로운 기명 로그인이 가능한지 '회원가입'을 때려봅니다.
    const testEmail = `test_witness_${Date.now()}@shinwoovalve.com`;
    console.log(`🚀 신규 회원가입 시도 중... (${testEmail})`);

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: testEmail,
        password: 'password123'
    });

    if (signUpError) {
        console.log("🛑 [진단 결과: 엔진 파손]");
        console.log("상태 코드 (Status):", signUpError.status);
        console.log("에러 메시지 (Message):", signUpError.message);
        
        if (signUpError.message.includes("Database error querying schema")) {
            console.log("\n⚠️ [최종 판정: 이 프로젝트는 망가졌습니다]");
            console.log("엔진 자체가 고장 나서 회원가입조차 불가능합니다. '삭제'가 유일한 정답입니다.");
        }
    } else {
        console.log("✅ [진단 결과: 엔진 기적적 생존!]");
        console.log("회원가입이 성공했습니다! 프로젝트 전체 삭제는 필요 없습니다.");
        console.log("테이블 구조(Table)만 다시 깔아드리면 바로 고칠 수 있는 상태입니다.");
    }
}

checkAuthSystem();
