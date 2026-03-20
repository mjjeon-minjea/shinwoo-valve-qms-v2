// server/mail_service.js
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

/**
 * 전송용 트랜스포터 설정
 */
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.mailplug.co.kr',
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: true, // 465는 true, 587은 false
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

/**
 * 주간 보고서 HTML 템플릿 생성
 */
const generateWeeklyReportTemplate = (data, weekRange) => {
    const { projects = [], issues = [], samples = [], schedules = [] } = data;

    const sectionStyle = "margin-bottom: 25px; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; font-family: 'Malgun Gothic', sans-serif; background-color: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.1);";
    const headerStyle = "padding: 12px 20px; background-color: #f9fafb; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #111827; font-size: 16px; display: flex; justify-content: space-between;";
    const itemStyle = "padding: 12px 20px; border-bottom: 1px solid #f3f4f6;";
    const badgeStyle = "display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: bold; border: 1px solid;";

    const getRankBadge = (name, rank) => {
        let color = "background-color: #f3f4f6; color: #374151; border-color: #d1d5db;";
        if (rank === '이사' || rank === '부장') color = "background-color: #f3e8ff; color: #6b21a8; border-color: #ddd6fe;";
        else if (rank === '차장' || rank === '과장') color = "background-color: #e0f2fe; color: #075985; border-color: #bae6fd;";
        else if (rank === '대리') color = "background-color: #ffedd5; color: #9a3412; border-color: #fed7aa;";
        else if (rank === '계장' || rank === '주임') color = "background-color: #dcfce7; color: #166534; border-color: #bbf7d0;";
        
        return `<span style="${badgeStyle} ${color} margin-right: 8px;">${name} ${rank}</span>`;
    };

    const renderProjects = projects.map(p => `
        <div style="${itemStyle}">
            <div style="margin-bottom: 6px;">
                ${getRankBadge(p.name, p.rank)}
                <span style="font-weight: bold; color: #1f2937;">${p.title}</span>
                ${p.note ? `<span style="margin-left: 8px; font-size: 13px; color: #4b5563;"> <span style="color: #4f46e5;">☞</span> ${p.note}</span>` : ''}
                <span style="float: right; font-size: 11px; color: #6b7280; background: #f3f4f6; padding: 2px 6px; border-radius: 4px;">${p.status}</span>
            </div>
            <div style="font-size: 14px; color: #4b5563; padding-left: 10px; line-height: 1.5;">
                <span style="color: #9ca3af; font-family: monospace; margin-right: 5px;">ㄴ</span>${p.content}
            </div>
        </div>
    `).join('');

    const renderIssues = issues.map(i => `
        <div style="${itemStyle}">
            <div style="margin-bottom: 6px;">
                ${getRankBadge(i.name, i.rank)}
                <span style="font-weight: bold; color: #b91c1c;">⚠ ${i.title}</span>
                ${i.note ? `<span style="margin-left: 8px; font-size: 13px; color: #4b5563;"> <span style="color: #ef4444;">☞</span> ${i.note}</span>` : ''}
                <span style="float: right; font-size: 11px; font-weight: bold; padding: 2px 6px; border-radius: 4px; ${
                    i.status === '발생' ? 'background-color: #fee2e2; color: #b91c1c;' : 
                    i.status === '완료' ? 'background-color: #dcfce7; color: #166534;' : 'background-color: #ffedd5; color: #9a3412;'
                }">${i.status}</span>
            </div>
            <div style="font-size: 14px; color: #4b5563; padding-left: 10px; line-height: 1.5;">
                <span style="color: #9ca3af; font-family: monospace; margin-right: 5px;">ㄴ</span>${i.content}
            </div>
        </div>
    `).join('');

    const renderSamples = samples.map(s => `
        <div style="${itemStyle}">
            <div style="margin-bottom: 4px;">
                ${getRankBadge(s.name, s.rank)}
                <span style="font-weight: bold; color: #1f2937;">${s.itemName}</span>
                <span style="margin-left: 8px; font-size: 12px; color: #2563eb; background: #eff6ff; padding: 1px 6px; border-radius: 4px; font-family: monospace;">진행률: ${s.progress}</span>
            </div>
            <div style="font-size: 13px; color: #4b5563; padding-left: 10px;">
                <span style="color: #9ca3af; margin-right: 5px;">[${s.note || '특이사항 없음'}]</span>
                <span style="font-weight: bold; color: #4338ca;">${s.status}</span>
            </div>
        </div>
    `).join('');

    const renderSchedules = schedules.map(sch => `
        <table width="100%" cellspacing="0" cellpadding="0" style="${itemStyle}">
            <tr>
                <td width="100" valign="top" style="padding-right: 10px;">${getRankBadge(sch.name, sch.rank)}</td>
                <td width="150" valign="top" style="font-size: 13px; font-weight: bold; color: #374151;">
                    ${sch.date} ${sch.type === '휴가' ? '<span style="color: #2563eb;">(종일)</span>' : (sch.time || '')}
                </td>
                <td valign="top" style="font-size: 13px; color: #111827;">
                    ${sch.content} ${sch.note ? `<span style="color: #9ca3af; font-size: 12px; margin-left: 5px;">(${sch.note})</span>` : ''}
                </td>
            </tr>
        </table>
    `).join('');

    const totalCount = projects.length + issues.length + samples.length + schedules.length;
    const projectCount = projects.length;
    const issueCount = issues.length;
    const sampleCount = samples.length;
    const scheduleCount = schedules.length;

    return `
    <div style="max-width: 850px; margin: 0 auto; color: #374151; line-height: 1.6; background-color: #f3f4f6; padding: 20px; font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;">
        <div style="background-color: #ffffff; padding: 30px; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
            <div style="text-align: center; border-bottom: 2px solid #111827; padding-bottom: 20px; margin-bottom: 30px;">
                <h1 style="color: #111827; margin: 0; font-size: 28px; letter-spacing: -0.5px;">주간 업무 통합 보고서</h1>
                <p style="color: #6b7280; margin: 10px 0 0 0; font-size: 16px;">보고 기간: ${weekRange}</p>
            </div>

            <!-- 요약 섹션 (5개 항목, Outlook 호환 Table) -->
            <table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 30px; background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
                <tr>
                    <td style="padding: 15px 5px; text-align: center;" width="19%">
                        <div style="font-size: 11px; color: #64748b; margin-bottom: 5px;">업무</div>
                        <div style="font-size: 18px; font-weight: bold; color: #1e293b;">${totalCount}건</div>
                    </td>
                    <td width="1" style="background-color: #e2e8f0; font-size: 1px;">&nbsp;</td>
                    <td style="padding: 15px 5px; text-align: center;" width="20%">
                        <div style="font-size: 11px; color: #64748b; margin-bottom: 5px;">인증 및 프로젝트</div>
                        <div style="font-size: 18px; font-weight: bold; color: #3b82f6;">${projectCount}건</div>
                    </td>
                    <td width="1" style="background-color: #e2e8f0; font-size: 1px;">&nbsp;</td>
                    <td style="padding: 15px 5px; text-align: center;" width="20%">
                        <div style="font-size: 11px; color: #64748b; margin-bottom: 5px;">이슈 및 불량</div>
                        <div style="font-size: 18px; font-weight: bold; color: #ef4444;">${issueCount}건</div>
                    </td>
                    <td width="1" style="background-color: #e2e8f0; font-size: 1px;">&nbsp;</td>
                    <td style="padding: 15px 5px; text-align: center;" width="20%">
                        <div style="font-size: 11px; color: #64748b; margin-bottom: 5px;">초도품 관리</div>
                        <div style="font-size: 18px; font-weight: bold; color: #6366f1;">${sampleCount}건</div>
                    </td>
                    <td width="1" style="background-color: #e2e8f0; font-size: 1px;">&nbsp;</td>
                    <td style="padding: 15px 5px; text-align: center;" width="20%">
                        <div style="font-size: 11px; color: #64748b; margin-bottom: 5px;">일정 및 근태</div>
                        <div style="font-size: 18px; font-weight: bold; color: #10b981;">${scheduleCount}건</div>
                    </td>
                </tr>
            </table>
            
            <div style="${sectionStyle}; border-top: 4px solid #3b82f6;">
                <table width="100%" cellspacing="0" cellpadding="0" style="${headerStyle}">
                    <tr>
                        <td align="left" style="font-weight: bold; color: #111827;">📊 인증 및 프로젝트 진행 현황</td>
                        <td align="right" style="font-size: 12px; color: #9ca3af;">총 ${projects.length}건</td>
                    </tr>
                </table>
                ${renderProjects || '<p style="padding: 20px; color: #9ca3af; text-align: center;">해당 사항 없음</p>'}
            </div>

            <div style="${sectionStyle}; border-top: 4px solid #ef4444;">
                <table width="100%" cellspacing="0" cellpadding="0" style="${headerStyle}">
                    <tr>
                        <td align="left" style="font-weight: bold; color: #111827;">🚨 공정 이슈 및 불량 현황</td>
                        <td align="right" style="font-size: 12px; color: #9ca3af;">총 ${issues.length}건</td>
                    </tr>
                </table>
                ${renderIssues || '<p style="padding: 20px; color: #9ca3af; text-align: center;">해당 사항 없음</p>'}
            </div>

            <div style="${sectionStyle}; border-top: 4px solid #6366f1;">
                <table width="100%" cellspacing="0" cellpadding="0" style="${headerStyle}">
                    <tr>
                        <td align="left" style="font-weight: bold; color: #111827;">📦 초도품 및 Sample 관리</td>
                        <td align="right" style="font-size: 12px; color: #9ca3af;">총 ${samples.length}건</td>
                    </tr>
                </table>
                ${renderSamples || '<p style="padding: 20px; color: #9ca3af; text-align: center;">해당 사항 없음</p>'}
            </div>

            <div style="${sectionStyle}; border-top: 4px solid #10b981;">
                <table width="100%" cellspacing="0" cellpadding="0" style="${headerStyle}">
                    <tr>
                        <td align="left" style="font-weight: bold; color: #111827;">📅 금주 일정 및 근태</td>
                        <td align="right" style="font-size: 12px; color: #9ca3af;">총 ${schedules.length}건</td>
                    </tr>
                </table>
                ${renderSchedules || '<p style="padding: 20px; color: #9ca3af; text-align: center;">해당 사항 없음</p>'}
            </div>

            <div style="text-align: center; font-size: 12px; color: #9ca3af; margin-top: 40px; border-top: 1px solid #f3f4f6; padding-top: 20px;">
                본 메일은 Shinwoo Valve QMS 시스템에서 자동으로 생성된 주간 보고서입니다.<br>
                &copy; 2026 신우밸브. All rights reserved.
            </div>
        </div>
    </div>
    `;
};

/**
 * 메일 발송 메인 함수
 */
export const sendWeeklyReportEmail = async (to, data, weekRange) => {
    const html = generateWeeklyReportTemplate(data, weekRange);
    
    const mailOptions = {
        from: `"QMS 시스템" <${process.env.SMTP_USER}>`,
        to: to,
        subject: `[QMS 보고] 주간 업무 현황 (${weekRange})`,
        html: html,
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Email sent: ' + info.response);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ Email send error:', error);
        throw error;
    }
};
