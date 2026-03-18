import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { BrowserRouter } from 'react-router-dom';

// 무한 로딩 대비 방어 코드: 로컬 스토리지 캐시 검증
try {
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('supabase') || key.includes('auth-token'))) {
            const item = localStorage.getItem(key);
            if (item) {
                JSON.parse(item); // 파싱 테스트
            }
        }
    }
} catch (e) {
    console.warn('캐시 토큰 파싱 실패 감지. 저장소를 초기화하고 새로고침합니다.', e);
    localStorage.clear();
    window.location.reload();
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <BrowserRouter>
            <App />
        </BrowserRouter>
    </React.StrictMode>,
)
