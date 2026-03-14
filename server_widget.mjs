import notifier from 'node-notifier';
import cron from 'node-cron';
import isPortReachable from 'is-port-reachable';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let previouslyRunning = false;
let firstCheck = true;

async function checkServers() {
    try {
        const frontendObj = await isPortReachable(5173, { host: 'localhost' });
        const backendObj = await isPortReachable(3001, { host: 'localhost' });

        const isFrontendRunning = !!frontendObj;
        const isBackendRunning = !!backendObj;
        
        const currentlyRunning = isFrontendRunning && isBackendRunning;

        // 상태가 변경되었거나 첫 검사인 경우만 알림
        if (firstCheck || currentlyRunning !== previouslyRunning) {
            if (currentlyRunning) {
                notifier.notify({
                    title: 'QMS 서버 상태 알림',
                    message: '✅ 서버가 모두 정상적으로 켜졌습니다.\nhttp://localhost:5173',
                    icon: path.join(__dirname, 'public/vite.svg'), // 아이콘이 있으면 사용
                    sound: true,
                    wait: false
                });
            } else {
                let msg = '🚨 서버가 꺼져 있습니다!\n';
                if (!isFrontendRunning) msg += '- 프론트엔드 (5173) 꺼짐\n';
                if (!isBackendRunning) msg += '- 백엔드 API (3001) 꺼짐';

                notifier.notify({
                    title: 'QMS 서버 오류 경고',
                    message: msg,
                    icon: path.join(__dirname, 'public/vite.svg'), // 에러 아이콘 대체 가능
                    sound: true,
                    wait: false
                });
            }
        }

        previouslyRunning = currentlyRunning;
        firstCheck = false;

    } catch (error) {
        console.error("서버 점검 중 에러 발생:", error);
    }
}

// 10초마다 백그라운드에서 상태 체크
cron.schedule('*/10 * * * * *', () => {
    checkServers();
});

console.log('QMS 위젯 알림이가 백그라운드에서 실행 중입니다... (10초 주기 체크)');
checkServers(); // 최초 1회 즉시 실행
