import fs from 'fs';
import path from 'path';
import http from 'http';

const folder = "C:\\Users\\mjjeon\\Desktop\\QMS 프로젝트\\shinwoo-valve-qms\\MES DATA\\shinwoo-valve-qms_SQL Editor";

http.createServer((req, res) => {
    // CORS 적용 (모든 브라우저 창에서 호출 가능하도록)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    if (req.url === '/snippets') {
        try {
            const files = fs.readdirSync(folder).filter(f => f.endsWith('.txt') || f.endsWith('.sql'));
            const data = files.map(file => {
                const content = fs.readFileSync(path.join(folder, file), 'utf8');
                return { name: file.replace('.txt', ''), content: content };
            });
            res.end(JSON.stringify(data));
            console.log(`✅ [자동화 엔진] ${files.length}개 스니펫 전송 완료!`);
        } catch(e) {
            res.end(JSON.stringify({ error: e.message }));
        }
    } else {
        res.end("Antigravity Bridge Server");
    }
}).listen(9999, () => {
    console.log("🚀 [우회 통신망 가동] 포트 9999에서 브라우저 응답 대기 중...");
});
