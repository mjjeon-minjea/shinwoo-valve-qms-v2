const http = require('http');

function checkPort(port, name) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}`, (res) => {
      console.log(`[OK] ${name} (포트 ${port}) : 정상 실행 중`);
      resolve(true);
    }).on('error', (e) => {
      console.log(`[FAIL] ${name} (포트 ${port}) : 꺼져 있음!`);
      resolve(false);
    });
    
    // 짧은 타임아웃 설정
    req.setTimeout(2000, () => {
        req.destroy();
        console.log(`[FAIL] ${name} (포트 ${port}) : 응답 없음!`);
        resolve(false);
    });
  });
}

async function main() {
  console.log("===================================================");
  console.log("              QMS 개발 서버 구동 상태 점검");
  console.log("===================================================\n");

  const frontend = await checkPort(5173, "프론트엔드 서버(Vite)");
  const backend = await checkPort(3001, "백엔드 API 서버(JSON Server)");

  console.log("\n===================================================");
  if (frontend && backend) {
    console.log("모든 서버가 정상적으로 켜져 있습니다. 브라우저로 접속 가능합니다!");
    console.log("접속 주소: http://localhost:5173");
  } else {
    console.log("하나 이상의 서버가 꺼져 있습니다.");
    console.log("개발 환경을 실행하려면 터미널 창을 두 개 열고 각각 아래 명령어를 입력하세요:");
    console.log("  1. npm run dev");
    console.log("  2. node server.js");
  }
  console.log("===================================================");
}

main();
