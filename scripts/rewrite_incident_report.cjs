const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envLocal = fs.readFileSync('.env.local', 'utf8');
const envMap = {};

envLocal.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
        envMap[match[1].trim()] = match[2].trim();
    }
});

const supabaseUrl = envMap['VITE_SUPABASE_URL'];
const supabaseKey = envMap['SUPABASE_SERVICE_ROLE_KEY'] || envMap['VITE_SUPABASE_ANON_KEY'];
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('--- 1. Deleting Rejected Note ---');
    // Version v0.20.0 and status rejected
    const { error: delErr } = await supabase
        .from('dev_notes')
        .delete()
        .eq('status', 'rejected')
        .eq('version', 'v0.20.0');

    if (delErr) {
        console.error('Failed to delete rejected note:', delErr.message);
    } else {
        console.log('Successfully deleted the old rejected note.');
    }

    console.log('--- 2. Inserting Epic Incident Report (v0.20.0) into Draft Queue ---');

    const incidentNote = {
        title: '[Auth-DB 트리거 충돌 사건] 야매 인증의 최후와 JWT 정석(正道)으로의 귀환',
        version: 'v0.20.0',
        content: `## 📋 인증 사고 리포트 (v0.20.0) : 대참사와 교훈

### 1. 사고 발생 경위 (The Context)
- **일시:** 2026년 4월 3일 금요일
- **현상:** QMS 개발 도중 황희찬 계장 등 특정 유저 계정으로 로그인 시도 시, 브라우저가 화면을 띄우지 못하고 **무한 로딩(Infinite Loading)** 루프에 빠지거나, 멀쩡하던 세션이 탭 전환 한 번에 즉시 폭파되는 초유의 2차 시스템 마비 현상 보고됨.

### 2. 원인 분석 및 가설 (The Why)
- **"대체 왜 우리 시스템만 터지는가?"** 
- 그동안 우리는 \`localStorage\`를 조작하여 인증을 흉내내는 이른바 **'야매(메모리 우회)' 방식**에 크게 의존하고 있었음.
- 그러나 Vercel 배포를 기점으로 공식 **Supabase Auth 서버(JWT)**가 전면에 나서면서, 기존의 낡은 \`public.users\` DB 테이블과 Auth 서버 간의 **비동기 무결성(Asynchronous Integrity)이 완전히 파괴**됨.
- 브라우저 탭을 이동했다 돌아오면 Supabase의 \`onAuthStateChange\` 리스너가 토큰을 갱신하려 드는데, 우리의 강제 우회 코드와 정면 충돌하며 세션을 자폭시키는 참사가 원인이었음.

### 3. 처절한 사투 (The Trial & Error)
- **1차 대응 (응급 복구 시도):** 로딩 컴포넌트에 예외 처리(if-else)를 덕지덕지 붙여 화면 렌더링을 억지로 유지해 보려 했으나, 보안 토큰이 없는 상태로 화면만 띄워지며 치명적 권한 우회 버그 발생. (실패)
- **2차 대응 (좀비 계정 소탕):** \`auth_id\`가 꼬여버린 좀비 계정들을 로컬 DB에서 강제로 소각. Auth와 Sync가 깨진 현상을 일부 완화했으나, 근본적인 탭 튕김(해시 리셋) 현상은 잡히지 않음. (절반의 성공)

### 4. 기술적 합의 및 결정 (The Rationalization)
- **"기술 부채에 타협은 없다. 정석만이 살 길이다."**
- 차장님의 단호한 지시 하에, 더 이상의 땜질식 처방을 전면 중단하고 **\`UserContext.jsx\`의 척추를 완전히 뜯어고치는 전면 리팩토링** 결단.
- 로컬스토리지 의존성을 코드 1줄도 남기지 않고 소각 처리. 모든 인증의 헤게모니를 Supabase Auth(JWT)에 100% 위임하는 엔터프라이즈급 아키텍처로 합의 도출.

### 5. 최종 조치 및 예방 (The Result)
- **철통 보안 확립:** \`auth_id\` 기반 단일 프로필 조회 파이프라인 완성으로 비정상 접근 시나리오 원천 차단.
- **Background Refresh 도입:** 세션 강제 갱신 시 화면 전체를 날려버리던 낡은 로딩 방식을 폐기. 백그라운드에서 조용히 프로필만 갱신하는 'Silent Update' 로직 주입.
- **Hash Routing 보전:** 브라우저 탭 이탈 및 복귀 시, 사용자가 머물던 주소(\`#home\` 등)를 기억하여 복원하는 튕김 방어 결함 수선 완료.
- **총평:** 이틀간의 생고생 끝에 시스템 모래성이 요새로 진화함. **"이 분야를 모르는 누가 보더라도 아하, 이때 이런 생고생을 해서 시스템이 단단해졌구나"**를 증명한 쾌거.`,
        status: 'draft',
        author: '시스템 AI (Antigravity)',
        date: new Date().toISOString().split('T')[0]
    };

    const { data, error } = await supabase
        .from('dev_notes')
        .insert([incidentNote])
        .select();

    if (error) {
        console.error('Failed to insert epic report:', error.message);
    } else {
        console.log('Successfully inserted v0.20.0 Epic incident report in "draft" status.');
    }
}

run();
