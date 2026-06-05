const http = require('http');

// http 모듈 기반 fetch 구현
function fetchJson(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const reqOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: {
                ...options.headers
            }
        };

        const req = http.request(reqOptions, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                let json = {};
                try {
                    if (data) json = JSON.parse(data);
                } catch (e) {
                    json = { text: data };
                }
                resolve({
                    status: res.statusCode,
                    json: () => Promise.resolve(json)
                });
            });
        });

        req.on('error', (err) => {
            reject(err);
        });

        if (options.body) {
            req.write(options.body);
        }
        req.end();
    });
}

async function runVerification() {
    console.log('🧪 === 로컬 API 서버 기능 검증 시작 ===');
    const baseUrl = 'http://localhost:3001/dev_notes';
    let testNoteId = 'test-verification-id-' + Date.now();

    // 1. [실패 케이스] status: 'draft' 이며 필수 키워드가 누락된 데이터 생성 시도
    console.log('\n[테스트 1] status: "draft" + 필수 키워드 누락 요청 전송...');
    try {
        const res = await fetchJson(baseUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: testNoteId,
                title: '테스트용 임시 노트 (DNAS 검증용)',
                version: 'v9.9.9',
                status: 'draft',
                content: '이 글은 DNAS 통과 필수 단어가 전혀 들어가 있지 않습니다.'
            })
        });

        console.log(`응답 상태 코드: ${res.status}`);
        const data = await res.json();
        if (res.status === 400 && data.error && data.error.includes('DNAS 포맷 위반')) {
            console.log('✅ 성공: 400 Bad Request와 함께 DNAS 락이 정상 발동되었습니다.');
        } else {
            console.error('❌ 실패: DNAS 통제망이 오작동하여 유효하지 않은 드래프트가 등록되었습니다.', data);
        }
    } catch (err) {
        console.error('❌ 에러 발생:', err.message);
    }

    // 2. [성공 케이스] status: 'rejected' 이며 필수 키워드가 누락된 반려 데이터 생성 시도
    console.log('\n[테스트 2] status: "rejected" + 필수 키워드 누락 요청 전송 (반려 예외 검증)...');
    try {
        const res = await fetchJson(baseUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: testNoteId,
                title: '테스트용 임시 노트 (반려 예외 검증)',
                version: 'v9.9.9',
                status: 'rejected',
                content: '이 글은 반려 상태이므로 키워드가 없어도 예외적으로 통과되어야 합니다.'
            })
        });

        console.log(`응답 상태 코드: ${res.status}`);
        const data = await res.json();
        if (res.status === 201) {
            console.log('✅ 성공: 반려 상태의 노트는 DNAS 락을 우회하여 정상 생성되었습니다.');
        } else {
            console.error('❌ 실패: 반려 예외 처리가 오작동했습니다.', data);
        }
    } catch (err) {
        console.error('❌ 에러 발생:', err.message);
    }

    // 3. [성공 케이스] 날짜 수동 포맷 수정 검증
    console.log('\n[테스트 3] 승인 날짜 수동 포맷 ("YYYY-MM-DD 12:00") 반영 검증...');
    try {
        const testDate = '2026-06-01 12:00';
        const res = await fetchJson(`${baseUrl}/${testNoteId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: 'published',
                date: testDate
            })
        });

        console.log(`응답 상태 코드: ${res.status}`);
        const data = await res.json();
        if (res.status === 200 && data.status === 'published' && data.date === testDate) {
            console.log(`✅ 성공: 승인 상태 변경 및 지정 배포일(${data.date})이 완벽히 기록되었습니다.`);
        } else {
            console.error('❌ 실패: 날짜 수동 패치가 실패했습니다.', data);
        }
    } catch (err) {
        console.error('❌ 에러 발생:', err.message);
    }

    // 4. [정리] 테스트 데이터 청소
    console.log('\n[청소] 테스트 생성 데이터 삭제 처리...');
    try {
        const res = await fetchJson(`${baseUrl}/${testNoteId}`, {
            method: 'DELETE'
        });
        if (res.status === 200) {
            console.log('✅ 성공: 테스트용 노치가 로컬 DB에서 안전하게 삭제되었습니다.');
        } else {
            console.error('❌ 실패: 테스트용 데이터 삭제 실패');
        }
    } catch (err) {
        console.error('❌ 에러 발생:', err.message);
    }

    console.log('\n🏁 === 로컬 API 서버 기능 검증 종료 ===');
}

runVerification();
