const https = require('https');
const url = 'https://srzaanvojyhwzugoaimk.supabase.co/rest/v1/';

https.get(url, (res) => {
    console.log(`스테이징 통신 상태 코드: ${res.statusCode}`);
    if (res.statusCode === 404) {
         console.log("확인 완료: 스테이징 프로젝트가 폭파(삭제)되어 더 이상 존재하지 않습니다! (404 Not Found)");
    } else {
         console.log(`확인 에러: 현재 상태는 폭파된 것이 아닙니다. 연결이 살아있습니다. (코드: ${res.statusCode})`);
    }
}).on('error', (e) => {
    if (e.code === 'ENOTFOUND') {
        console.log("확인 완료: 스테이징 서버 존재하지 않음 (DNS 없음, 완전히 삭제됨)");
    } else {
        console.log("기타 에러:", e.message);
    }
});
