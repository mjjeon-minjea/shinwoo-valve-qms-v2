import { supabase } from './api';

/* 261015 결재·회람으로 「내 차례」가 새로 생긴 계정에 알림 메일을 보내 달라고 서버(/api/ncr-notify)에 알린다.
   prev = 처리 직전 문서 상태(status·reviews·reject_note) — 서버가 「새로 생긴 차례」만 골라 보낸다(없으면 지금 차례 전부).
   메일 실패가 결재 흐름을 막지 않게 기다리지 않는다. */
export const notifyNcrTurn = (ncrId, prev) => supabase.auth.getSession()
    .then(({ data: { session } }) => session && fetch('/api/ncr-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ ncr_id: ncrId, prev })
    }))
    .catch(e => console.warn('[ncr-notify] 알림 메일 요청 실패', e));
