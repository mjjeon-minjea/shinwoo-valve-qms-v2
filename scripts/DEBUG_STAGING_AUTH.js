import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function debugAuth() {
    console.log("------------------------------------------");
    console.log("🧐 스테이징 인증 서버(REST API) 직통 호출 결과");
    console.log("------------------------------------------");

    const url = `${process.env.VITE_SUPABASE_URL}/auth/v1/token?grant_type=password`;
    const body = JSON.stringify({
        email: "test@example.com",
        password: "password123"
    });

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'apikey': process.env.VITE_SUPABASE_ANON_KEY,
                'Content-Type': 'application/json'
            },
            body: body
        });

        const status = response.status;
        const result = await response.json();

        console.log(`📡 서버 응답 코드: ${status}`);
        console.log(`📄 서버 응답 본문: ${JSON.stringify(result, null, 2)}`);
        console.log("------------------------------------------");

        if (status === 500) {
            console.log("🔴 [진단: 엔진 사망]");
            console.log("수파베이스 내부 엔진이 깨졌습니다. 삭제가 답입니다.");
        } else if (status === 400 && result.message?.includes('schema cache')) {
            console.log("🟠 [진단: 중간 단계 오류 (스키마 캐시 꼬임)]");
            console.log("엔진은 살았는데, 지도가 찢어졌습니다. 수리가 필요합니다.");
        } else if (status === 400) {
            console.log("✅ [진단: 엔진 살아있음]");
            console.log("아이디/비번 틀림으로 정상 응답함. 엔진은 멀쩡합니다.");
        }
    } catch (e) {
        console.log(`❌ 통신 실패: ${e.message}`);
    }
}

debugAuth();
