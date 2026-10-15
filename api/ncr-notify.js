import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

/* 발행승인 요청 알림 메일 (261015)
   - 수신: NCR_MAIL_TO 한 곳(품질부서장 1명 고정 — 사람이 바뀌면 설정만 바꾼다). shortcut: 발송 기록·중복 방지 없음 — 필요해지면 붙인다.
   - 발신: 화면 표시 qms@(메일링) / 로그인·봉투 발신은 SMTP_USER — 예림 10/15 실발송 검증과 같은 구성.
   - 결재함 링크: QMS_BASE_URL(사이트 주소 — 스테이징/메인이 각자 설정)이 있을 때만 붙인다.
     외부 URL 이 든 메일이 회사 메일서버에서 [SPAM] 처리된 적이 있어(08-25) 링크 판은 스팸 여부를 시험으로 확인했다. */
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST 요청만 지원합니다.' });

    const { VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: anon, SUPABASE_SERVICE_ROLE_KEY: service,
            SMTP_USER, SMTP_PASS, NCR_MAIL_TO, QMS_BASE_URL } = process.env;
    if (!url || !anon || !service || !SMTP_USER || !SMTP_PASS || !NCR_MAIL_TO) {
        return res.status(500).json({ error: '메일 환경 변수가 없습니다 — 발송하지 않았습니다.' });
    }

    const token = (req.headers.authorization || '').replace(/^Bearer /, '');
    if (!token) return res.status(401).json({ error: '인증 토큰(JWT)이 누락되었습니다.' });

    try {
        const { data: { user }, error: userError } = await createClient(url, anon).auth.getUser(token);
        if (userError || !user) return res.status(401).json({ error: '유효하지 않거나 만료된 세션입니다.' });

        const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
        // 가입만 하고 승인 안 된(Pending) 계정은 메일을 못 쏘게 — admin-update-member 와 같은 auth_id 기준
        const { data: me } = await admin.from('users').select('status').eq('auth_id', user.id).single();
        if (me?.status !== 'Active') return res.status(403).json({ error: '승인된 회원만 가능합니다.' });
        const { data: ncr, error } = await admin.from('ncr_reports')
            .select('id, ncr_no, status, supplier, item_name, item_code, author_name')
            .eq('id', req.body?.ncr_id).single();
        if (error || !ncr) return res.status(404).json({ error: 'NCR 을 찾지 못했습니다.' });
        // 아무 문서로나 메일을 쏘지 못하게 — 방금 발행요청된(발행승인 대기) 문서만
        if (ncr.status !== '발행승인 대기') return res.status(409).json({ error: '발행승인 대기 상태가 아닙니다 — 발송하지 않았습니다.' });

        const text = [
            '아래 부적합보고서(NCR)의 발행승인 요청이 올라왔습니다.',
            'QMS 에 접속해 확인 후 승인 또는 반려해 주십시오.',
            '',
            `NCR 번호 : ${ncr.ncr_no || ncr.id}`,
            `업체     : ${ncr.supplier || '-'}`,
            `품명     : ${ncr.item_name || '-'}${ncr.item_code ? ` (${ncr.item_code})` : ''}`,
            `작성자   : ${ncr.author_name || '-'}`,
            `요청시각 : ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`,
            ...(QMS_BASE_URL ? [`결재함   : ${QMS_BASE_URL.replace(/\/$/, '')}/#ncr_inbox`] : []),
            '',
            '※ 발신 전용 메일입니다(회신 불가).'
        ].join('\n');

        const info = await nodemailer.createTransport({
            host: 'smtp.mailplug.co.kr', port: 465, secure: true,
            connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 10000,   // 메일서버가 막히면 Vercel 제한시간까지 매달리지 말고 바로 실패
            auth: { user: SMTP_USER, pass: SMTP_PASS },
            tls: { rejectUnauthorized: true, minVersion: 'TLSv1.2' }
        }).sendMail({
            from: { name: 'QMS 관리자', address: 'qms@shinwoovalve.com' },
            to: NCR_MAIL_TO,
            envelope: { from: SMTP_USER, to: [NCR_MAIL_TO] },
            subject: `[QMS] 발행승인 요청 — ${ncr.ncr_no || ncr.id}`,
            text
        });
        console.log('[ncr-notify] 발송', ncr.ncr_no, info.messageId, info.response);
        return res.status(200).json({ ok: true, messageId: info.messageId, accepted: info.accepted });
    } catch (e) {
        console.error('[ncr-notify] 실패:', e.message);
        return res.status(500).json({ error: '메일 발송 실패: ' + e.message });
    }
}
