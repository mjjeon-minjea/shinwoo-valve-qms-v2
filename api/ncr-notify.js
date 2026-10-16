import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import { myTurnV101 } from '../src/lib/ncrRoles.js';
import { statusLabel } from '../src/lib/ncrFlow.js';   // 화면·인쇄와 같은 절차서 용어

/* NCR 「내 차례」 알림 메일 (261015)
   - 결재·회람으로 차례가 새로 생긴 계정에게 1통씩 보낸다. 판정은 결재함과 같은 myTurnV101(src/lib/ncrRoles.js).
     새로 생긴 차례 = 지금 문서의 차례 − 화면이 보낸 직전 상태(prev)의 차례. prev 가 없으면(새 발행요청) 지금 차례 전부.
     shortcut: prev 는 화면이 보낸 값을 믿는다(승인 회원만 호출 가능, 받는 사람은 실제 문서 상태로만 정해짐) — 남용이 보이면 결재 이력으로 판정하도록 바꾼다.
   - 시험 모드: NCR_MAIL_TO 가 있으면 모든 메일을 그 주소로 모으고, 원래 받을 사람을 제목·본문에 적는다.
     NCR_MAIL_TO 가 비면 보내지 않는다(261016 차장 「절대 나 말고 다른 사람 메일 보내면 안됨」) — 실제 계정 발송은 NCR_MAIL_LIVE=1 을 넣었을 때만.
   - 발신: 화면 표시 qms@(메일링) / 로그인·봉투 발신은 SMTP_USER — 예림 10/15 실발송 검증과 같은 구성.
   - 결재함 링크: QMS_BASE_URL(사이트 주소 — 스테이징/메인이 각자 설정)이 있을 때만. 링크 판은 스팸 처리 없이 들어오는 것을 시험으로 확인했다(10/15). */
const LABEL = {
    '발행승인 대기': '발행승인 요청', '특채승인 대기': '특채승인 요청', '특채요청 결재 대기': '특채요청 결재 요청',
    '최종승인 대기': '최종승인 요청', '종결승인 대기': '종결승인 요청', '무효승인 대기': '무효승인 요청',
    '특채판단': '특채 판단 요청', '종합검토': '종합검토 요청', '처리중': '처리 완료확인 요청',
    '기술문의': '기술 검토 요청', '회람중': '회람 검토 요청', '작성중': '반려 — 수정 요청'
};
// 같은 상태라도 내 부서 칸이 「담당 회신 완료(staffDone)」면 부서장·차석의 확인 차례다
const labelFor = (r, u) => {
    const st = (r.reviews || {})[r.status === '기술문의' ? '응용기술팀' : u.company]?.state;
    if (st === 'staffDone' && r.status === '회람중') return '부서 확인 요청';
    if (st === 'staffDone' && r.status === '기술문의') return '기술 회신 확인 요청';
    return LABEL[r.status] || r.status;
};

// actorEmail = 이번 동작을 한 사람 — 자기 동작으로 자기에게는 보내지 않는다(261016 시나리오: 작성자가 회수하자 본인에게 「반려 — 수정 요청」이 갔음)
export const newTurnUsers = (users, r, prev, settings, actorEmail) => {
    const before = prev ? { ...r, status: prev.status, reviews: prev.reviews, reject_note: prev.reject_note } : null;
    const was = new Set(before ? users.filter(u => myTurnV101(u, before, settings)).map(u => u.email) : []);
    return users.filter(u => u.email && u.email !== actorEmail && myTurnV101(u, r, settings) && !was.has(u.email));
};

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST 요청만 지원합니다.' });

    const { VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: anon, SUPABASE_SERVICE_ROLE_KEY: service,
            SMTP_USER, SMTP_PASS, NCR_MAIL_TO, NCR_MAIL_LIVE, QMS_BASE_URL } = process.env;
    if (!url || !anon || !service || !SMTP_USER || !SMTP_PASS) {
        return res.status(500).json({ error: '메일 환경 변수가 없습니다 — 발송하지 않았습니다.' });
    }
    if (!NCR_MAIL_TO && NCR_MAIL_LIVE !== '1') {   // 받는 사람 칸이 비어도 실제 계정으로 새지 않게
        return res.status(500).json({ error: '시험 받는 사람(NCR_MAIL_TO)이 없습니다 — 실제 계정 발송은 막혀 있어 보내지 않았습니다.' });
    }

    const token = (req.headers.authorization || '').replace(/^Bearer /, '');
    if (!token) return res.status(401).json({ error: '인증 토큰(JWT)이 누락되었습니다.' });

    try {
        const { data: { user }, error: userError } = await createClient(url, anon).auth.getUser(token);
        if (userError || !user) return res.status(401).json({ error: '유효하지 않거나 만료된 세션입니다.' });

        const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
        // 가입만 하고 승인 안 된(Pending) 계정은 메일을 못 쏘게 — admin-update-member 와 같은 auth_id 기준
        const { data: me } = await admin.from('users').select('status, email').eq('auth_id', user.id).single();
        if (me?.status !== 'Active') return res.status(403).json({ error: '승인된 회원만 가능합니다.' });

        const { ncr_id, prev } = req.body || {};
        const { data: r, error } = await admin.from('ncr_reports').select('*').eq('id', ncr_id).single();
        if (error || !r) return res.status(404).json({ error: 'NCR 을 찾지 못했습니다.' });

        const [{ data: approval }, { data: users }] = await Promise.all([
            admin.from('ncr_settings').select('*').eq('id', 'approval'),
            admin.from('users').select('name, email, company, rank, role').eq('status', 'Active')
        ]);
        const settings = { allow_deputy: approval?.[0]?.allow_deputy === true };   // 결재함(fetchNcrSettings)과 같은 기준 — 명시적 true 일 때만
        const targets = newTurnUsers(users || [], r, prev, settings, me.email);
        if (!targets.length) return res.status(200).json({ ok: true, sent: [] });

        const transport = nodemailer.createTransport({
            host: 'smtp.mailplug.co.kr', port: 465, secure: true,
            connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 10000,   // 메일서버가 막히면 Vercel 제한시간까지 매달리지 말고 바로 실패
            auth: { user: SMTP_USER, pass: SMTP_PASS },
            tls: { rejectUnauthorized: true, minVersion: 'TLSv1.2' }
        });
        const at = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
        const sent = [];
        for (const u of targets) {
            const label = labelFor(r, u);
            const to = NCR_MAIL_TO || u.email;
            const text = [
                ...(NCR_MAIL_TO ? [`※ 시험 발송 — 원래 받을 사람: ${u.name} (${[u.company, u.rank].filter(Boolean).join(' ')}) <${u.email}>`, ''] : []),
                `${u.name}님, 아래 부적합보고서(NCR)에 「${label}」 건이 있습니다.`,
                'QMS 결재함에서 확인해 주십시오.',
                '',
                `NCR 번호 : ${r.ncr_no || r.id}`,
                `현재 단계 : ${statusLabel(r.status)}`,
                `업체     : ${r.supplier || '-'}`,
                `품명     : ${r.item_name || '-'}${r.item_code ? ` (${r.item_code})` : ''}`,
                `작성자   : ${r.author_name || '-'}`,
                ...(r.status === '작성중' && r.reject_note ? [`반려 사유 : ${r.reject_note}`] : []),
                `알림시각 : ${at}`,
                ...(QMS_BASE_URL ? [`결재함   : ${QMS_BASE_URL.replace(/\/$/, '')}/#ncr_inbox`] : []),
                '',
                '※ 발신 전용 메일입니다(회신 불가).'
            ].join('\n');
            const info = await transport.sendMail({
                from: { name: 'QMS 관리자', address: 'qms@shinwoovalve.com' },
                to,
                envelope: { from: SMTP_USER, to: [to] },
                subject: `[QMS] ${NCR_MAIL_TO ? `[원래: ${u.name}] ` : ''}${label} — ${r.ncr_no || r.id}`,
                text
            });
            console.log('[ncr-notify] 발송', r.ncr_no, label, '→', u.email, NCR_MAIL_TO ? `(시험: ${to})` : '', info.messageId, info.response);
            sent.push({ to: u.email, label, messageId: info.messageId });
        }
        return res.status(200).json({ ok: true, test: !!NCR_MAIL_TO, sent });
    } catch (e) {
        console.error('[ncr-notify] 실패:', e.message);
        return res.status(500).json({ error: '메일 발송 실패: ' + e.message });
    }
}
