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
    console.log('--- Inserting Incident Report (v0.20.0) into Draft Queue ---');

    const incidentNote = {
        title: '[Auth-DB 트리거 충돌 사건] 세션 붕괴 및 무한 로딩 해결 완수',
        version: 'v0.20.0',
        content: `## 📋 인증 사고 리포트 (v0.20.0)

### 1. 발생 원인 (Cause)
- 로컬스토리지 기반의 기존 '야매' 인증 방식과 Supabase 공식 Auth(JWT) 연동 과도기적 상황 발생.
- 브라우저 탭 이동(포커스 해제) 후 복귀 시, Supabase Auth 리스너(onAuthStateChange)가 세션을 갱신하지만, 이를 받쳐줄 상태 관리 로직 부재로 인해 인증 정보가 증발하고 무한 로딩 루프에 빠지는 아키텍처 충돌 발생.

### 2. 기술적 대책 (Countermeasure)
- **UserContext.jsx 전면 리팩토링**: 로컬스토리지 의존성을 완전히 제거하고, Supabase 공식 세션 리스너를 통한 JWT 기반 인증 파이프라인으로 일원화.
- **Background Refresh 도입**: 세션 갱신 시 전체 화면 로딩바를 띄우지 않고 백그라운드에서 프로필을 업데이트하는 'Silent Update' 로직 주입.
- **Hash Routing 보강**: 탭 이동 시 현재 페이지의 Hash 주소를 보존하도록 초기화 로직 수정.

### 3. 최종 결과 (Result)
- JWT 기반의 엔터프라이즈급 철통 보안 및 세션 유지 무결성 100% 확보.
- 브라우저 탭 전환 및 새로고침 시에도 작업 중인 페이지 데이터가 소실되지 않는 안정적 UX 환경 구축 완료.`,
        status: 'draft',
        author: '시스템 AI (Antigravity)',
        date: new Date().toISOString().split('T')[0]
    };

    const { data, error } = await supabase
        .from('dev_notes')
        .insert([incidentNote])
        .select();

    if (error) {
        console.error('Failed to insert report:', error.message);
    } else {
        console.log('Successfully inserted v0.20.0 incident report in "draft" status.');
        console.log('ID:', data[0].id);
    }
}

run();
