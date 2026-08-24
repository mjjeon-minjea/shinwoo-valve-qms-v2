import { useState, useEffect, useRef, useCallback } from 'react';
import { Camera } from 'lucide-react';

/* 첨부 공용 모듈 — v10.2 (H: 캡처 붙여넣기 복원 · 처리확인 증빙 신설)
   작성화면(NCRCreate)과 결재화면(NCRDetail 처리확인 증빙)이 「같은 규칙」으로 파일을 받게 하려고
   축소·용량제한·붙여넣기 로직을 한 곳에 모았다.
   ※ lib/ncrFlow.js와 같은 이유 — 중복 정의 금지. 두 파일에 복사해 두면 한쪽만 고쳐져
     「작성화면은 축소되는데 결재화면은 원본이 그대로 들어가는」 식으로 규칙이 갈린다. */

/* 첨부 분류(ncr_attachments.category) — 1·2·3은 작성화면, 4는 처리확인 단계 증빙(신설).
   숫자를 코드 곳곳에 흩어 쓰면 4를 추가할 때처럼 빠뜨리는 곳이 생기므로 이름을 붙여 둔다. */
export const ATT_CAT = { PHOTO: 1, DRAWING: 2, REF: 3, CLOSED: 4 };
export const ATT_CAT_LABEL = { 1: '사진대지', 2: '도면', 3: '관련자료', 4: '처리확인 증빙' };

/* 이미지 축소: 최대 1280px · JPEG 0.8 dataURL — 원본 저장 금지(DB 비대 방지) */
export const shrinkImage = (file) => new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('파일 읽기 실패'));
    fr.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('이미지 로드 실패'));
        img.onload = () => {
            const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
            const c = document.createElement('canvas');
            c.width = Math.max(1, Math.round(img.width * scale));
            c.height = Math.max(1, Math.round(img.height * scale));
            const ctx = c.getContext('2d');
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, c.width, c.height); // 투명 PNG → JPEG 검정 배경 방지
            ctx.drawImage(img, 0, 0, c.width, c.height);
            resolve({ name: file.name, dataurl: c.toDataURL('image/jpeg', 0.8) });
        };
        img.src = fr.result;
    };
    fr.readAsDataURL(file);
});

/* Phase 4: 비이미지 파일 — 5MB 이하만 dataURL 그대로 보관 */
export const NONIMG_MAX = 5 * 1024 * 1024;
export const readAsDataURL = (file) => new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('파일 읽기 실패'));
    fr.onload = () => resolve({ name: file.name, dataurl: fr.result });
    fr.readAsDataURL(file);
});

/* 파일 1건 → {name, dataurl}. 이미지면 축소, 아니면 5MB 제한.
   붙여넣기·파일선택이 반드시 이 함수를 통과하게 해서 「붙여넣기만 원본으로 새는」 일을 막는다. */
export const processAnyFile = (file) => {
    if (file.type.startsWith('image/')) return shrinkImage(file);
    if (file.size > NONIMG_MAX) return Promise.reject(new Error(`'${file.name}' — 이미지가 아닌 파일은 5MB 이하만 첨부할 수 있습니다.`));
    return readAsDataURL(file);
};

export const isImageAtt = (a) => (a?.dataurl || '').startsWith('data:image');

/* 클립보드 이미지에는 파일명이 없다(대개 image.png) — 시뮬레이터 v9.3과 같은 규칙으로 시각 이름을 붙인다 */
export const captureFileName = () => `캡처_${new Date().toTimeString().slice(0, 8).replaceAll(':', '')}.png`;

/* ── 전역 Ctrl+V 캡처 붙여넣기 (시뮬레이터 v7.1~v9.3 기능 복원) ──
   동작: 첨부 슬롯의 pastezone에 마우스를 올리면 그 슬롯이 대상(target)이 되고,
        전역 paste 이벤트에서 clipboardData의 이미지 아이템을 꺼내 그 슬롯에 넣는다.
   주의 3가지
   ① 대상이 없거나(어느 pastezone에도 마우스가 없음) 클립보드에 이미지가 없으면 절대 가로채지 않는다
      → 부적합 내용 등 텍스트 입력칸의 일반 붙여넣기가 그대로 동작해야 한다.
   ② 리스너는 1회만 등록하고 언마운트 시 반드시 제거한다(화면 전환마다 쌓이면 한 번 붙여넣기에 여러 번 반응).
   ③ 대상·콜백은 ref로 읽는다 — state를 deps에 넣으면 마우스를 올릴 때마다 리스너를 떼었다 붙인다. */
export const useCapturePaste = (onCapture, onNotice) => {
    /* 08-23 개선 — 「마우스 올리고 Ctrl+V」만으로는 실무에서 잘 안 된다.
       Win+Shift+S로 캡처하고 돌아오면 브라우저가 키보드 포커스를 잃은 상태라
       Ctrl+V가 페이지까지 오지 않는 경우가 많다(차장님 실사용 지적).
       그래서 길을 셋으로 늘린다.
         ⓐ [클립보드에서 가져오기] 버튼 — 클릭 한 번. 포커스·마우스 위치 무관 (제일 확실)
         ⓑ [Ctrl+V 고정] — 슬롯을 못박아 두면 마우스를 떼도 Ctrl+V가 그 슬롯으로 간다
         ⓒ 기존 방식 — 마우스 올린 채 Ctrl+V */
    const [hover, setHover] = useState(null);
    const [pinned, setPinned] = useState(null);
    const activeRef = useRef(null);
    const cbRef = useRef(onCapture); cbRef.current = onCapture;
    const noRef = useRef(onNotice); noRef.current = onNotice;

    const current = pinned || hover;
    activeRef.current = current;

    useEffect(() => {
        const onPaste = (e) => {
            const t = activeRef.current;
            if (!t) return;
            const items = e.clipboardData && e.clipboardData.items;
            if (!items) return;
            const hit = [...items].find(it => it.type && it.type.startsWith('image/'));
            if (!hit) return;                                 // 이미지 아님 → 텍스트 붙여넣기 보호
            const blob = hit.getAsFile();
            if (!blob) return;
            e.preventDefault();
            const named = new File([blob], captureFileName(), { type: blob.type || 'image/png' });
            Promise.resolve(cbRef.current && cbRef.current(t, named)).catch(() => { });
        };
        document.addEventListener('paste', onPaste);
        return () => document.removeEventListener('paste', onPaste);
    }, []);

    const pin = useCallback((t) => setPinned(prev => (prev === t ? null : t)), []);

    /* ⓐ 클립보드 직접 읽기 — 버튼 클릭이 곧 사용자 제스처라 권한이 통과된다.
       localhost·https 에서만 동작하고, 처음 한 번은 브라우저가 권한을 물을 수 있다. */
    const grab = useCallback(async (t) => {
        const say = (m) => noRef.current && noRef.current(m);
        try {
            if (!navigator.clipboard || !navigator.clipboard.read) {
                say('이 브라우저에서는 클립보드 읽기가 안 됩니다 — 마우스를 올리고 Ctrl+V 를 쓰거나 파일로 첨부하세요.'); return;
            }
            const items = await navigator.clipboard.read();
            for (const it of items) {
                const type = (it.types || []).find(x => x.startsWith('image/'));
                if (!type) continue;
                const blob = await it.getType(type);
                await cbRef.current(t, new File([blob], captureFileName(), { type }));
                return;
            }
            say('클립보드에 이미지가 없습니다 — 화면을 먼저 캡처(Win+Shift+S)한 뒤 다시 눌러 주세요.');
        } catch (e) {
            const m = String((e && e.message) || e);
            say(/permission|denied|NotAllowed/i.test(m)
                ? '브라우저가 클립보드 읽기를 막았습니다 — 주소창 왼쪽 자물쇠 → 클립보드 「허용」으로 바꾼 뒤 다시 시도하세요.'
                : '클립보드를 읽지 못했습니다: ' + m);
        }
    }, []);

    return { current, target: current, setHover, setTarget: setHover, pin, pinned, grab };
};

/* 캡처 붙여넣기 안내 영역 — 버튼 2개(가져오기·고정) + 기존 호버 방식 */
export const PasteZone = ({ target, current, setHover, setTarget, pin, pinned, grab,
    tail = '(또는 아래 파일 선택)', className = '' }) => {
    const hv = setHover || setTarget;
    const on = current === target;
    const fixed = pinned === target;
    const btn = 'shrink-0 rounded border px-2 py-1 text-[11px] font-semibold transition-colors';
    return (
        <div
            data-paste-target={target}
            onMouseEnter={() => hv && hv(target)}
            onMouseLeave={() => hv && hv(null)}
            className={`flex flex-wrap items-center gap-1.5 rounded border border-dashed px-3 py-2 text-[11px] leading-snug transition-colors ${on
                ? 'border-amber-400 bg-amber-50 text-amber-700'
                : 'border-slate-300 bg-slate-50/70 text-slate-500'} ${className}`}>
            <Camera className="w-3.5 h-3.5 shrink-0" />
            <span className="mr-auto"><b>캡처 붙여넣기</b> — 캡처한 뒤 <b>[클립보드에서 가져오기]</b>를 누르세요 {tail}</span>
            <button type="button" onClick={() => grab && grab(target)}
                className={`${btn} border-amber-400 bg-amber-500 text-white hover:bg-amber-600`}>클립보드에서 가져오기</button>
            <button type="button" onClick={() => pin && pin(target)} title="고정하면 마우스를 떼도 Ctrl+V가 이 칸으로 들어갑니다"
                className={`${btn} ${fixed ? 'border-amber-500 bg-white text-amber-700' : 'border-slate-300 bg-white text-slate-500 hover:bg-slate-50'}`}>
                {fixed ? '고정 해제' : 'Ctrl+V 고정'}</button>
        </div>
    );
};

