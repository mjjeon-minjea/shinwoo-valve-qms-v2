import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X } from 'lucide-react';
import { api } from '../lib/api';
import { isNewFlow, statusLabel } from '../lib/ncrFlow';

/* NCR 인쇄 뷰 — FORM 933-07 REV.2 · v10.1 정통 복원
   v9.3 시뮬레이터 §7(인쇄물 구성) 사양 재구현(React + 인라인 인쇄 CSS):
   · @page A4 세로, body 직계 자식 중 오버레이만 출력(display:none 방식 — visibility 방식은 백지 페이지 유발 실측)
   · 결재란 5칸(작성/발행승인/최종승인/완료확인/종결승인) — 인영 SVG 대신 서명자 성명 텍스트(고딕 굵게)
   · 본문 섹터 1~5 + 별지(응용기술팀 선행 문의) + 부서 회람표, 데이터 있는 섹터만 출력
   · 사진대지 1쪽=2쌍(가로형 4:3 사진 4장), 첨부 섹션별 page-break-before
   · 레거시(flow_ver 'v10.0' 또는 값 없음) 문서는 종전 렌더(결재란 2칸 + 본문 표)를 그대로 유지 — 판정은 lib/ncrFlow.js
   portal로 document.body 직하에 렌더하여 앱 UI(#root)를 인쇄에서 통째로 제외 */

const PRINT_CSS = `
.ncrp-root{position:fixed;inset:0;z-index:100;background:#f1f5f9;overflow-y:auto;}
.ncrp-toolbar{position:sticky;top:0;z-index:10;background:#1e293b;color:#fff;display:flex;justify-content:space-between;align-items:center;padding:10px 20px;}
.ncrp-sheet{background:#fff;max-width:194mm;margin:16px auto 40px;padding:14mm 12mm;box-shadow:0 4px 16px rgba(15,23,42,.18);color:#0f172a;font-size:12px;line-height:1.6;}
.ncrp-formno{font-family:monospace;font-size:10px;letter-spacing:.12em;color:#475569;border:1px solid #cbd5e1;display:inline-block;padding:2px 8px;border-radius:2px;}
.ncrp-title{text-align:center;font-size:24px;font-weight:800;letter-spacing:.2em;margin:6px 0 2px;text-indent:.2em;}
.ncrp-sub{text-align:center;font-size:10px;letter-spacing:.14em;color:#64748b;margin-bottom:12px;}
.ncrp-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;break-inside:avoid;page-break-inside:avoid;}
table.ncrp-apr{border-collapse:collapse;font-size:11px;break-inside:avoid;page-break-inside:avoid;}
table.ncrp-apr th,table.ncrp-apr td{border:1px solid #64748b;padding:3px 10px;text-align:center;}
table.ncrp-apr th{background:#f1f5f9;font-weight:700;}
table.ncrp-apr .side{width:22px;background:#f1f5f9;font-weight:700;}
table.ncrp-apr td{height:26px;min-width:74px;}
table.ncrp-apr .when{font-family:monospace;font-size:9px;color:#475569;height:auto;}
.ncrp-sig{font-family:'Malgun Gothic','Apple SD Gothic Neo','Noto Sans KR',sans-serif;font-weight:800;font-size:12px;letter-spacing:.06em;color:#0f172a;}
.ncrp-sig.sm{font-size:11px;}
.ncrp-wait{color:#94a3b8;font-size:10px;letter-spacing:.08em;}
table.ncrp-form{width:100%;border-collapse:collapse;border:1.5px solid #334155;margin-top:10px;}
table.ncrp-form th{background:#f1f5f9;border:1px solid #94a3b8;padding:7px 9px;width:88px;font-size:11px;letter-spacing:.12em;text-align:center;white-space:nowrap;font-weight:700;color:#334155;}
table.ncrp-form td{border:1px solid #94a3b8;padding:7px 10px;vertical-align:top;}
.ncrp-pre{white-space:pre-wrap;min-height:52px;}
.ncrp-pre.s{min-height:0;}
.ncrp-sect{page-break-before:always;break-before:page;}
.ncrp-sect h4{font-size:13px;font-weight:800;letter-spacing:.06em;border-bottom:1.5px solid #334155;padding-bottom:5px;margin-bottom:10px;}
.ncrp-sect h4 small{font-weight:400;color:#64748b;margin-left:8px;letter-spacing:0;}
.ncrp-bsect{margin-top:16px;break-inside:avoid;page-break-inside:avoid;}
.ncrp-bsect h4{font-size:13px;font-weight:800;letter-spacing:.06em;border-bottom:1.5px solid #334155;padding-bottom:5px;margin-bottom:8px;display:flex;align-items:baseline;flex-wrap:wrap;gap:8px;}
.ncrp-bsect h4 small{font-weight:400;color:#64748b;letter-spacing:0;font-size:10px;}
.ncrp-bsect h4 .dispo{font-weight:800;color:#1d4ed8;letter-spacing:0;}
.ncrp-badge{display:inline-block;font-size:9px;font-weight:800;letter-spacing:.1em;padding:1px 7px;border:1px solid;border-radius:2px;}
.ncrp-badge.spec{color:#b45309;border-color:#fcd34d;background:#fffbeb;}
.ncrp-badge.ok{color:#047857;border-color:#a7f3d0;background:#ecfdf5;}
.ncrp-badge.no{color:#b91c1c;border-color:#fecaca;background:#fef2f2;}
.ncrp-badge.gray{color:#475569;border-color:#cbd5e1;background:#f8fafc;}
table.ncrp-rev{width:100%;border-collapse:collapse;border:1px solid #94a3b8;margin-top:8px;font-size:11px;}
table.ncrp-rev th{background:#f1f5f9;border:1px solid #94a3b8;padding:5px 6px;font-size:10px;letter-spacing:.08em;font-weight:700;color:#334155;text-align:center;white-space:nowrap;}
table.ncrp-rev td{border:1px solid #94a3b8;padding:5px 7px;vertical-align:top;}
table.ncrp-rev td.c{text-align:center;white-space:nowrap;}
table.ncrp-rev tr{break-inside:avoid;page-break-inside:avoid;}
.ncrp-skip{text-align:center;letter-spacing:.5em;color:#94a3b8;font-weight:700;}
.ncrp-when{font-family:monospace;font-size:9px;color:#475569;}
.ncrp-note{font-size:10px;color:#64748b;margin-top:3px;}
.ncrp-note.re{color:#7e22ce;}
.ncrp-void{border:1.5px solid #94a3b8;background:#f8fafc;color:#334155;padding:7px 12px;margin-top:10px;font-size:11px;font-weight:700;letter-spacing:.06em;display:flex;justify-content:space-between;gap:12px;break-inside:avoid;}
.ncrp-void .why{font-weight:400;color:#475569;letter-spacing:0;}
.ncrp-cost{width:100%;border-collapse:collapse;font-size:11px;margin-top:4px;}
.ncrp-cost td{border-bottom:1px dotted #cbd5e1;padding:2px 0;}
.ncrp-cost td.amt{text-align:right;font-family:monospace;white-space:nowrap;}
.ncrp-cost tr.sum td{border-top:1px solid #64748b;border-bottom:0;font-weight:800;padding-top:3px;}
.ncrp-cost tr.sub td{border-bottom:1px dotted #cbd5e1;color:#475569;font-weight:700;}
.ncrp-stage{font-size:9px;font-weight:800;color:#64748b;margin-right:4px;letter-spacing:.04em;}
.ncrp-chg{font-size:10px;font-weight:400;color:#475569;margin-left:8px;letter-spacing:0;white-space:normal;word-break:break-all;}
.ncrp-pairpage{page-break-after:always;break-after:page;}
.ncrp-pairpage:last-child{page-break-after:auto;break-after:auto;}
.ncrp-pair{display:grid;grid-template-columns:1fr 1fr;gap:12px;border:1px dashed #94a3b8;padding:10px;margin-bottom:12px;break-inside:avoid;page-break-inside:avoid;position:relative;}
.ncrp-pairno{position:absolute;top:-9px;left:10px;background:#fff;padding:0 6px;font-size:10px;font-weight:700;color:#475569;letter-spacing:.08em;}
.ncrp-cell h5{text-align:center;font-size:11px;font-weight:800;letter-spacing:.2em;border:1px solid;padding:3px 0;margin-bottom:6px;}
.ncrp-cell.good h5{color:#047857;border-color:#a7f3d0;background:#ecfdf5;}
.ncrp-cell.bad h5{color:#b91c1c;border-color:#fecaca;background:#fef2f2;}
.ncrp-photo{width:100%;aspect-ratio:4/3;object-fit:cover;background:#f8fafc;display:block;border:1px solid #cbd5e1;}
.ncrp-empty{aspect-ratio:4/3;display:flex;align-items:center;justify-content:center;color:#94a3b8;border:1px dashed #cbd5e1;font-size:11px;}
.ncrp-att{border:1px solid #cbd5e1;padding:8px;margin-bottom:12px;break-inside:avoid;page-break-inside:avoid;}
.ncrp-att img{width:100%;max-height:118mm;object-fit:contain;background:#f8fafc;display:block;}
.ncrp-cap{font-family:monospace;font-size:10px;color:#475569;text-align:center;margin-top:4px;word-break:break-all;}
/* H-④ 첨부 목록 표 — 종이만 봐도 무슨 증거가 붙어 있는지 알 수 있게 본문 끝에 인쇄.
   table-layout:fixed + 백분율 col 폭 + word-break로 긴 파일명이 A4 폭을 밀어내지 않게 한다(과거 N-1 재발 방지). */
table.ncrp-attlist{width:100%;table-layout:fixed;border-collapse:collapse;border:1px solid #94a3b8;margin-top:6px;font-size:10px;}
table.ncrp-attlist th{background:#f1f5f9;border:1px solid #94a3b8;padding:4px 6px;font-size:9.5px;letter-spacing:.08em;font-weight:700;color:#334155;text-align:center;}
table.ncrp-attlist td{border:1px solid #94a3b8;padding:4px 6px;vertical-align:top;}
table.ncrp-attlist td.fn{font-family:monospace;word-break:break-all;overflow-wrap:anywhere;}
table.ncrp-attlist td.c{text-align:center;word-break:keep-all;}
table.ncrp-attlist td.dt{text-align:center;font-family:monospace;font-size:9px;color:#475569;word-break:break-all;}
table.ncrp-attlist tr{break-inside:avoid;page-break-inside:avoid;}
.ncrp-tail{margin-top:22px;padding-top:8px;border-top:1.5px solid #334155;display:flex;justify-content:space-between;font-family:monospace;font-size:9px;letter-spacing:.12em;color:#94a3b8;}
@media print{
  @page{size:A4 portrait;margin:11mm 10mm;}
  html,body{background:#fff!important;}
  body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  body > *:not(.ncrp-root){display:none!important;}
  .ncrp-root{position:static!important;overflow:visible!important;background:#fff!important;}
  .ncrp-noprint{display:none!important;}
  .ncrp-sheet{max-width:none!important;margin:0!important;padding:0!important;box-shadow:none!important;}
  .ncrp-bsect,.ncrp-head,table.ncrp-apr,table.ncrp-rev tr,.ncrp-void{break-inside:avoid!important;page-break-inside:avoid!important;}
  .ncrp-photo{max-height:64mm;}
  .ncrp-att img{max-height:110mm;}
  img{max-width:100%;}
}
`;

/* 쌍 그룹핑: category 1을 pair_no별 {good, bad}로 — 인쇄 1쪽=2쌍 */
/* v10.2 D-07 — 같은 pair_no·같은 kind 사진이 2장 이상이면 기존에는 나중 것이 앞 것을 조용히 덮어써
   증거 사진이 유실되었다. 이제 자리가 찬 경우 다음 빈 쌍으로 이월해 한 장도 버리지 않는다. */
export const groupPairs = (atts) => {
    const map = new Map();
    const slot = (no) => { if (!map.has(no)) map.set(no, { no, good: null, bad: null }); return map.get(no); };
    (atts || []).filter(a => a.category === 1).forEach(a => {
        const key = a.kind === '정상' ? 'good' : 'bad';
        let no = a.pair_no || 1;
        while (slot(no)[key]) no += 1;      // 자리가 차 있으면 다음 쌍으로 이월
        slot(no)[key] = a;
    });
    return [...map.values()].sort((a, b) => a.no - b.no);
};

const chunk2 = (arr) => {
    const out = [];
    for (let i = 0; i < arr.length; i += 2) out.push(arr.slice(i, i + 2));
    return out;
};

const fmtDate = (iso) => (iso || '').slice(0, 10);
const fmtDT = (iso) => {
    const s = iso || '';
    if (!s) return '';
    return s.length >= 16 ? `${s.slice(0, 10)} ${s.slice(11, 16)}` : s.slice(0, 10);
};
const won = (n) => `₩${Number(n || 0).toLocaleString()}`;

/* H-④ 첨부 목록 표의 「종류」 칸 — category 숫자를 종이에 그대로 찍으면 알아볼 수 없다 */
const ATT_KIND = { 1: '사진대지', 2: '도면', 3: '관련자료', 4: '처리확인 증빙' };

/* 인쇄 전용 설정 로드 — 호출부 시그니처 변경 없이 NCRPrint가 자체 로드
   (NCRDetail의 fetchNcrSettings를 쓰면 NCRDetail↔NCRPrint 순환 import가 되므로 여기서 별도 구현) */
export const fetchPrintSettings = async () => {
    try {
        const res = await api.fetch('/ncr_settings');
        const rows = (await res.json()) || [];
        const pick = (id) => rows.find(s => s.id === id) || {};
        return {
            codes: pick('codes').map || {},
            dispositions: pick('dispositions').list || [],
            concession_types: pick('dispositions').concession_types || [],
            routing: pick('routing') || {},
            approval: pick('approval') || {}
        };
    } catch {
        return { codes: {}, dispositions: [], routing: {}, approval: {} };
    }
};

/* history(ncr_approvals)에서 해당 action의 마지막 기록 */
const lastOf = (history, ...actions) =>
    (history || []).filter(h => actions.includes(h.action)).slice(-1)[0] || null;

const NCRPrint = ({ report, history, attachments, onClose }) => {
    const pairs = groupPairs(attachments);
    const drawings = (attachments || []).filter(a => a.category === 2);
    const refs = (attachments || []).filter(a => a.category === 3);
    /* v10.2 H-④ — 처리확인 단계 증빙(category 4). #2·#3과 같은 규칙으로 별지 인쇄한다. */
    const closedAtts = (attachments || []).filter(a => Number(a.category) === 4);
    /* H-④ 첨부 목록 표용 — 분류 순(1→4), 같은 분류 안에서는 쌍번호·등록시각 순 */
    const attList = [...(attachments || [])].sort((x, y) =>
        (Number(x.category) - Number(y.category))
        || ((x.pair_no || 0) - (y.pair_no || 0))
        || String(x.at || '').localeCompare(String(y.at || '')));

    /* 설정(코드표 등) 자체 로드 */
    const [settings, setSettings] = useState(null);
    useEffect(() => { let live = true; fetchPrintSettings().then(s => { if (live) setSettings(s); }); return () => { live = false; }; }, []);

    /* 결재 이력: prop 우선, 없으면 자체 로드(호출부 시그니처 유지) */
    const [ownHist, setOwnHist] = useState(null);
    useEffect(() => {
        if (history) return;
        let live = true;
        api.fetch('/ncr_approvals')
            .then(r => r.json())
            .then(d => {
                if (!live) return;
                setOwnHist((d || [])
                    .filter(h => h.report_id === report.id)
                    .sort((a, b) => (a.at || '').localeCompare(b.at || '')));
            })
            .catch(() => { if (live) setOwnHist([]); });
        return () => { live = false; };
    }, [history, report.id]);
    const hist = history || ownHist || [];

    /* ── 판 분기: 새 흐름(v10.1 이후) vs 레거시(v10.0 · flow_ver 없음) ──
       v10.2 G-⑦: 종전에는 `flow_ver === 'v10.1'` 정확일치를 이 파일에서 따로 들고 있어,
       flow_ver가 v10.2가 되는 순간 정상 문서의 결재란이 5칸→2칸으로 무너졌다(F #44 실측).
       판정은 lib/ncrFlow.js 한 곳에만 둔다 — 「레거시가 아니면 새 흐름」. */
    const newFlow = isNewFlow(report);
    const isVoid = report.status === '무효';
    /* N-3 - 무효 띠가 status==='무효'일 때만 나와, 「무효승인 대기」 문서는 평범한 정상 서식으로 인쇄됐다.
       승인 전이라도 무효 상신이 걸려 있다는 사실은 종이에 보여야 한다. */
    const isVoidPending = report.status === '무효승인 대기';
    const status = report.status || '';
    /* I-① 상태 이름표 — 종이에 찍는 글자만 절차서 용어로 바꾼다.
       위 `status`는 결재란 5칸 판정(작성중·발행승인 대기·최종승인 대기·종결승인 대기 비교)에
       그대로 쓰이므로 절대 건드리지 않는다. 표시용은 이 변수 하나만 쓴다. */
    const statusDisp = statusLabel(status);

    const codeLabel = report.code ? `${report.code}${settings?.codes?.[report.code] ? ` · ${settings.codes[report.code]}` : ''}` : '';
    const judge = report.judge_plan || null;
    /* N-4 — judge_plan은 「상신했을 뿐 아직 승인 전」인 내용이다. 무조건 우선 사용하면
       「특채승인 대기」 상태에서 뽑은 종이가 미확정 특채를 확정된 것처럼 보여준다.
       특채 승인이 나기 전에는 상신 내용임을 명시하고, 승인 후에는 확정값(report.disposition)을 쓴다. */
    /* 상신은 「특채판단·특채승인 대기」 상태에서만 미승인이다. 이력 액션명으로 판정하면
       레거시 문서의 '특채 승인'(공백 포함)을 놓쳐 종결 문서에도 「승인 전」이 찍힌다(D영역 회귀 실측). */
    const judgePending = newFlow && !isVoid && !!judge && ['특채판단', '특채승인 대기'].includes(report.status || '');
    const isSpecial = judge?.kind === 'special' || /특채/.test(report.disposition || '');
    const dispoText = (judgePending ? report.disposition : (judge?.disp || report.disposition)) || '';
    /* v10.2 특채 하위유형 병기 — 절차서 5.3.4 */
    const concText = (judgePending ? (report.concession_type || '') : (judge?.conc || report.concession_type)) || '';
    const dispoFull = dispoText ? (concText ? `${dispoText} — ${concText}` : dispoText) : '';
    /* 승인 전 상신 내용은 「(상신 · 승인 전)」으로 따로 보여준다 — 숨기지 않되 확정과 섞지 않는다 */
    const judgePendingText = judgePending && judge?.disp
        ? `${judge.disp}${judge.conc ? ` — ${judge.conc}` : ''}` : '';

    /* ── 7-2. 결재란 5칸 데이터 ── */
    const aIssue = lastOf(hist, '발행승인');
    const aFinal = lastOf(hist, '최종승인');
    const aClose = lastOf(hist, '종결승인');
    const aDone = lastOf(hist, '완료확인');
    const closed = report.closed || null;

    /* B-20 처분방안 변경(폐기 ↔ 불채용(반송)) — 종이에도 「무엇에서 무엇으로 · 누가 요청 · 누가 승인」이 남아야 한다.
       disposition은 종합검토 상신 시점에 이미 바뀌므로, 최종승인 이력이 없는 문서에 승인 문구를 쓰면
       일어나지 않은 결재를 종이가 단언하게 된다 → 최종승인 이력 유무로 분기한다. */
    const dispChangeDept = Object.entries(report.reviews || {})
        .filter(([, r]) => r?.disp_req?.resolved === '수락')
        .map(([d]) => d).join('·');
    /* 미정('')에서 바뀐 경우도 변경으로 표기한다 — 빈 문자열은 거짓값이라 누락됐다(260829). */
    const dispChangeNote = (report.disposition_prev !== null && report.disposition_prev !== undefined)
        ? `← ${report.disposition_prev || '미정'}에서 변경 (${dispChangeDept ? `요청 ${dispChangeDept} · ` : ''}${aFinal ? '승인 품질부서장 최종승인' : '최종승인 전'})`
        : '';

    const aprCells = [
        {
            label: '작 성',
            name: report.author_name || '',
            at: report.created_at,
            done: !!report.author_name && !['작성중', '무효'].includes(status),
            waiting: status === '작성중' ? '작성 중' : null
        },
        {
            label: '발행승인',
            name: aIssue?.actor_name || '',
            at: aIssue?.at,
            /* 재발행 대기·작성 복귀 중엔 이전 결재 은닉 (v9.0 감사수리 C-1+M-1) */
            done: !!aIssue && !['작성중', '발행승인 대기'].includes(status)
        },
        {
            label: '최종승인',
            name: aFinal?.actor_name || '',
            at: aFinal?.at,
            done: !!aFinal && status !== '최종승인 대기'
        },
        {
            label: '완료확인',
            name: closed?.by || aDone?.actor_name || '',
            at: closed?.at || aDone?.at,
            done: !!(closed?.at || aDone)
        },
        {
            label: '종결승인',
            name: aClose?.actor_name || '',
            at: aClose?.at,
            done: !!aClose && status !== '종결승인 대기'
        }
    ];

    /* ── 결재란 렌더 ── */
    const ApprovalGrid5 = () => (
        <table className="ncrp-apr">
            <tbody>
                <tr>
                    <th className="side" rowSpan={3}>결<br />재</th>
                    {aprCells.map(c => <th key={c.label}>{c.label}</th>)}
                </tr>
                <tr>
                    {aprCells.map(c => (
                        <td key={c.label}>
                            {c.done && c.name
                                ? <span className="ncrp-sig">{c.name}</span>
                                : c.waiting ? <span className="ncrp-wait">{c.waiting}</span> : '·'}
                        </td>
                    ))}
                </tr>
                <tr>
                    {aprCells.map(c => (
                        <td key={c.label} className="when">{c.done && c.at ? fmtDate(c.at) : '·'}</td>
                    ))}
                </tr>
            </tbody>
        </table>
    );

    /* 레거시(v10.0) 결재란 2칸 — 현행 렌더 유지 */
    const legacyIssued = lastOf(hist, '발행', '재발행');
    const legacyApproved = lastOf(hist, '승인', '특채 승인');
    const ApprovalGrid2 = () => (
        <table className="ncrp-apr">
            <tbody>
                <tr><th className="side" rowSpan={3}>결<br />재</th><th>발 행</th><th>승 인</th></tr>
                <tr>
                    <td>{legacyIssued?.actor_name || ''}</td>
                    <td>{legacyApproved?.actor_name || ''}</td>
                </tr>
                <tr>
                    <td className="when">{legacyIssued ? fmtDate(legacyIssued.at) : '·'}</td>
                    <td className="when">{legacyApproved ? fmtDate(legacyApproved.at) : '·'}</td>
                </tr>
            </tbody>
        </table>
    );

    /* ── 무효 문서 띠 ──
       v10.2 D-08: 무효가 2단 결재(무효상신 → 무효승인)로 바뀌어 액션명이 '무효승인'이다.
       구 문서('무효')도 함께 찾고, 상신자·승인자를 모두 인쇄해 근거가 종이에 남게 한다. */
    const voidReq = lastOf(hist, '무효상신');
    const voidRec = lastOf(hist, '무효승인') || lastOf(hist, '무효');
    const VoidBand = () => (
        <div className="ncrp-void">
            <span>즉시종결(무효)</span>
            <span className="why">
                사유: {report.void_note || voidReq?.comment || voidRec?.comment || '—'}
                {voidReq?.actor_name ? ` · 상신 ${voidReq.actor_name}${voidReq.at ? ' ' + fmtDT(voidReq.at) : ''}` : ''}
                {voidRec?.actor_name ? ` · 승인 ${voidRec.actor_name}${voidRec.at ? ' ' + fmtDT(voidRec.at) : ''}` : ''}
            </span>
            {/* v10.2 G-⑧ — 「통계 제외」는 문구뿐이었다(무효를 빼는 집계 코드 없음 · F #72).
                종이에 잘못된 단언이 남지 않도록 실제 절차대로 적는다. */}
            <span>넘버링 유지 · 통계 자동 제외 아님 — 집계 시 대장에서 상태 「무효」 제외</span>
        </div>
    );

    /* N-3 - 무효 승인 전 문서용 띠. 확정 무효와 구분되게 「승인 대기」임을 못박는다. */
    const VoidPendingBand = () => (
        <div className="ncrp-void" style={{ borderStyle: 'dashed' }}>
            <span>즉시종결(무효) 상신 - 품질부서장 승인 대기</span>
            <span className="why">
                {report.void_req?.kind ? `구분: ${report.void_req.kind} · ` : ''}
                사유: {report.void_req?.note || voidReq?.comment || '-'}
                {report.void_req?.by ? ` · 상신 ${report.void_req.by}${report.void_req.at ? ' ' + fmtDT(report.void_req.at) : ''}` : ''}
            </span>
            <span>아직 무효 아님 · 승인 시 확정</span>
        </div>
    );

    /* ── 1. 부적합사항 (기존 본문 표 + 부적합 코드) ── */
    const FormTable = () => (
        <table className="ncrp-form">
            <tbody>
                <tr>
                    <th>NCR 번호</th><td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{report.ncr_no}</td>
                    <th>발 생 일</th><td>{report.occur_date || ''}</td>
                </tr>
                <tr>
                    <th>업체(발생처)</th><td>{report.supplier || ''}</td>
                    <th>도면번호</th><td>{report.drawing_no || '—'}</td>
                </tr>
                <tr>
                    <th>품 명</th><td>{report.item_name || ''}</td>
                    <th>수 량</th>
                    <td>부적합 <b>{report.qty_defect}EA</b> / 전체 {report.qty_total == null ? '파악중' : `${report.qty_total}EA`}</td>
                </tr>
                {newFlow && (
                    <tr>
                        <th>부적합 코드</th>
                        <td colSpan={3}>{codeLabel || '—'}</td>
                    </tr>
                )}
                <tr>
                    <th>부적합 내용</th>
                    <td colSpan={3}><div className="ncrp-pre">{report.defect_desc || ''}</div></td>
                </tr>
                <tr>
                    <th>처리방안</th><td>{dispoFull || '미정'}{dispChangeNote && <span className="ncrp-chg">{dispChangeNote}</span>}{judgePendingText && <span className="ncrp-chg">← 상신 「{judgePendingText}」 · 품질부서장 승인 전</span>}</td>
                    <th>처리부서</th><td>{report.dept || '—'}</td>
                </tr>
                {/* FORM 933-07 「Recommended by」 — 처리방안 마련자. 발행 시 확정되며 트랙이 바뀌어도 유지된다. */}
                <tr>
                    <th>처리방안 마련자</th><td colSpan={3}>{report.disposition_by || '—'}<small>{report.disposition_by ? ' (품질보증부)' : ''}</small></td>
                </tr>
                <tr>
                    <th>작 성 자</th>
                    <td colSpan={3}>{report.author_name}{report.author_company ? ` (${report.author_company})` : ''}</td>
                </tr>
            </tbody>
        </table>
    );

    const SectorDefect = () => (
        <div className="ncrp-bsect">
            <h4>1. 부적합사항 {codeLabel && <small>코드 {codeLabel}</small>}</h4>
            <FormTable />
        </div>
    );

    /* ── 별지. 응용기술팀 선행 문의 ── */
    const techRev = (report.reviews || {})['응용기술팀'] || null;
    const SectorTech = () => (
        <div className="ncrp-bsect">
            <h4>별지. 응용기술팀 선행 문의 <small>(특채 트랙 · 타 부서 발송 없음)</small></h4>
            <table className="ncrp-rev">
                <thead>
                    <tr><th style={{ width: 70 }}>구분</th><th style={{ width: 90 }}>담당 검토인</th><th>회신 내용</th><th style={{ width: 90 }}>기술부서장</th><th style={{ width: 92 }}>일시</th></tr>
                </thead>
                <tbody>
                    <tr>
                        <td className="c">선행 문의</td>
                        <td className="c">
                            {techRev?.staff_name ? <span className="ncrp-sig sm">{techRev.staff_name}</span> : '·'}
                        </td>
                        <td>
                            <div className="ncrp-pre s">{report.tech_reply?.summary || techRev?.staff_cmt || '—'}</div>
                            {techRev?.head_cmt && <div className="ncrp-note">기술부서장 의견: {techRev.head_cmt}</div>}
                        </td>
                        <td className="c">
                            {techRev?.head_name
                                ? <span className="ncrp-sig sm">{techRev.head_name}{techRev.deputy ? ' (대결)' : ''}</span>
                                : '·'}
                        </td>
                        <td className="c ncrp-when">{fmtDT(report.tech_reply?.at || techRev?.head_at || techRev?.staff_at) || '·'}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    );

    /* ── 부서 회람표 (7-4) ── */
    const reviewRows = () => {
        const rv = report.reviews || {};
        const order = (settings?.routing?.default_depts || []).filter(d => d in rv);
        const rest = Object.keys(rv).filter(d => !order.includes(d));
        return [...order, ...rest].map(dept => ({ dept, r: rv[dept] || {} }));
    };

    const ReviewTable = () => {
        const rows = reviewRows();
        if (!rows.length) return null;
        return (
            <table className="ncrp-rev">
                <thead>
                    <tr>
                        <th style={{ width: 78 }}>회람 부서</th>
                        <th style={{ width: 84 }}>담당 검토인</th>
                        <th>검토 의견</th>
                        <th style={{ width: 92 }}>부서장 결재</th>
                        <th style={{ width: 92 }}>일시</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(({ dept, r }) => {
                        /* 응용기술팀: 특채 트랙 선행 문의 — 본회람 제외 */
                        if (dept === '응용기술팀' && report.tech_flag) {
                            return (
                                <tr key={dept}>
                                    <td className="c">{dept}</td>
                                    <td colSpan={4} className="ncrp-note" style={{ marginTop: 0 }}>
                                        선행 문의 완료 — 본회람 제외 · 회신 내용은 별지(응용기술팀 선행 문의) 참조
                                    </td>
                                </tr>
                            );
                        }
                        /* 회람 제외 부서 */
                        if (r.state === 'skip') {
                            return (
                                <tr key={dept}>
                                    <td className="c">{dept}</td>
                                    <td colSpan={4} className="ncrp-skip">회 람 제 외</td>
                                </tr>
                            );
                        }
                        const replied = r.state === 'staffDone' || r.state === 'done' || !!r.staff_at;
                        return (
                            <tr key={dept}>
                                <td className="c">{dept}</td>
                                <td className="c">
                                    {r.staff_name
                                        ? <span className="ncrp-sig sm">{r.staff_name}</span>
                                        : <span className="ncrp-wait">·</span>}
                                </td>
                                <td>
                                    {replied ? (
                                        <>
                                            {r.opinion && (
                                                <span className={`ncrp-badge ${r.opinion === 'approve' ? 'ok' : 'no'}`}>
                                                    {r.opinion === 'approve' ? '승인 의견' : '반려 의견'}
                                                </span>
                                            )}
                                            <div className="ncrp-pre s" style={{ marginTop: r.opinion ? 4 : 0 }}>{r.staff_cmt || '—'}</div>
                                            {r.head_cmt && <div className="ncrp-note">부서장 의견: {r.head_cmt}</div>}
                                            {r.remand_note && <div className="ncrp-note re">부서 내 재검토: {r.remand_note}</div>}
                                            {/* B-20/B-21 — 거절된 변경 요청·부서가 올린 품질비용도 종이에 흔적을 남긴다 */}
                                            {r.disp_req && (
                                                <div className="ncrp-note">
                                                    [처분방안 변경 요청 → {r.disp_req.to}]{r.disp_req.resolved ? ` (${r.disp_req.resolved})` : ''}
                                                </div>
                                            )}
                                            {Array.isArray(r.cost_items) && r.cost_items.length > 0 && (
                                                <div className="ncrp-note">
                                                    [품질비용] {r.cost_items.map((c, i) => `${c.label || `항목 ${i + 1}`} ${won(c.amount)}`).join(' · ')}
                                                    {' · 소계 '}{won(r.cost_items.reduce((a, c) => a + Number(c.amount || 0), 0))}
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <span className="ncrp-skip" style={{ letterSpacing: '.3em' }}>미회신</span>
                                    )}
                                </td>
                                <td className="c">
                                    {/* N-2 — 재질의·부서 내 재검토로 state가 wait로 되돌아가면 결재는 무효다.
                                        head_name 존재만 보고 찍으면 「결재 안 한 부서장이 결재한 것」으로 종이에 남는다. */}
                                    {r.head_name && r.state === 'done'
                                        ? <span className="ncrp-sig sm">{r.head_name}{r.deputy ? ' (대결)' : ''}</span>
                                        : r.head_name
                                            ? <span className="ncrp-wait">재검토 중 (이전 결재 {r.head_name} 무효)</span>
                                            : (r.state === 'staffDone' ? <span className="ncrp-wait">대기</span> : '·')}
                                </td>
                                <td className="c ncrp-when">{fmtDT(r.head_at || r.staff_at) || '·'}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        );
    };

    /* ── 2. 처리방안 ── */
    const hasReviews = Object.keys(report.reviews || {}).length > 0;
    const SectorDisposition = () => (
        <div className="ncrp-bsect">
            <h4>
                <span>2. 처리방안 — <span className="dispo">{dispoFull || '미정'}</span>{dispChangeNote && <span className="ncrp-chg">{dispChangeNote}</span>}{judgePendingText && <span className="ncrp-chg">← 상신 「{judgePendingText}」 · 품질부서장 승인 전</span>}</span>
                {isSpecial && <span className="ncrp-badge spec">{judgePending ? '특채 — 승인 대기' : '특채 — 품질부서장 전결'}</span>}
                {aIssue && <small>(발행승인 {fmtDate(aIssue.at)} {aIssue.actor_name})</small>}
                {report.disposition_by && <small>(마련 {report.disposition_by})</small>}
            </h4>
            {judge?.note && <div className="ncrp-pre s" style={{ marginBottom: 6 }}>{judge.note}</div>}
            {judge?.depts?.length > 0 && (
                <div className="ncrp-note" style={{ marginBottom: 4 }}>회람 대상 지정: {judge.depts.join(' · ')}</div>
            )}
            {report.tech_reply?.summary && (
                <div className="ncrp-note">
                    응용기술팀 회신 요약(자동 첨부): {report.tech_reply.summary}
                    {report.tech_reply.at ? ` · ${fmtDT(report.tech_reply.at)}` : ''}
                </div>
            )}
            {hasReviews && <ReviewTable />}
        </div>
    );

    /* ── 3. 품질담당자 종합검토 ── */
    const SectorQa = () => (
        <div className="ncrp-bsect">
            <h4><span>3. 품질담당자 종합검토</span>
                {report.qa_summary?.text
                    ? <span className="ncrp-badge gray">상신</span>
                    : <span className="ncrp-badge no">상신 없음 — 반려·되돌림</span>}
                {report.qa_summary?.at && <small>{fmtDT(report.qa_summary.at)}</small>}</h4>
            <div className="ncrp-pre s">{report.qa_summary?.text || '종합검토 상신 내용 없음 (반려 또는 되돌림). 아래 처리방안 비용은 직전 확정분입니다.'}</div>
            {/* B-21 — 처리방안 확정 시점의 1차 품질비용. 완료확인(섹터5) 전에도 종이에 나오게 한다 */}
            {report.cost_stage1 && (
                <table className="ncrp-cost">
                    <tbody>
                        {(report.cost_stage1.items || []).map((c, i) => (
                            <tr key={i}>
                                <td>
                                    {c.dept ? <span className="ncrp-stage">[{c.dept}]</span> : null}
                                    {c.label || `항목 ${i + 1}`}
                                </td>
                                <td className="amt">{won(c.amount)}</td>
                            </tr>
                        ))}
                        <tr className="sum">
                            <td>품질비용 — 처리방안 확정 소계</td>
                            <td className="amt">{won(report.cost_stage1.total)}</td>
                        </tr>
                    </tbody>
                </table>
            )}
            {report.cost_stage1 && Number(report.cost_stage1.total || 0) === 0 && report.cost_stage1.zero_why
                ? <div className="ncrp-note">0원 사유: {report.cost_stage1.zero_why}</div> : null}
            {/* N-1 — 상신자는 qa_summary.by(실제 상신한 사람)다. author_name(작성자)을 찍으면
                작성자와 상신자가 다를 때 종이에 틀린 이름이 남는다. */}
            {report.qa_summary?.text && (
                <div className="ncrp-note">
                    종합검토 상신: <span className="ncrp-sig sm">{report.qa_summary?.by || report.author_name || '품질담당자'}</span>
                </div>
            )}
        </div>
    );

    /* ── 4. 최종 승인 (전결) ── */
    const SectorFinal = () => (
        <div className="ncrp-bsect">
            <h4><span>4. 최종 승인</span>
                <span className={`ncrp-badge ${isSpecial ? 'spec' : 'ok'}`}>{isSpecial ? '특채 전결' : '전 결'}</span></h4>
            <div>
                품질부서장(전결) 전자승인 · {fmtDT(aFinal?.at) || '—'}
                {aFinal?.actor_name && <> — <span className="ncrp-sig">{aFinal.actor_name}</span></>}
            </div>
            {aFinal?.comment && <div className="ncrp-note">승인 의견: {aFinal.comment}</div>}
            <div className="ncrp-note">(종이 원본 없음 — 전자 결재 · 서명자 성명으로 표기)</div>
        </div>
    );

    /* ── 5. 처리 완료확인 · 품질비용 · 시정조치 ── */
    const SectorClosed = () => {
        const items = closed?.cost_items || [];
        const total = closed?.cost_total != null
            ? closed.cost_total
            : items.reduce((s, it) => s + Number(it.amount || 0), 0);
        /* B-21 2단 산출 — 1차(처리방안 확정분) 소계가 보존된 문서만 3줄 소계로 출력한다 */
        const twoStage = closed?.cost_stage1_total != null;
        const s1Total = Number(closed?.cost_stage1_total || 0);
        const addTotal = Number(total || 0) - s1Total;
        return (
            <div className="ncrp-bsect">
                <h4><span>5. 처리 완료확인 · 품질비용 · 시정조치</span>
                    {closed?.at && <small>{fmtDT(closed.at)}</small>}
                    {aClose && <span className="ncrp-badge ok">종 결</span>}</h4>
                <table className="ncrp-form">
                    <tbody>
                        <tr>
                            <th>완료확인</th>
                            <td>
                                <div className="ncrp-pre s">{closed?.note || '—'}</div>
                                <div className="ncrp-note">
                                    확인자: <span className="ncrp-sig sm">{closed?.by || aDone?.actor_name || '—'}</span>
                                    {closed?.at ? ` · ${fmtDT(closed.at)}` : ''}
                                </div>
                            </td>
                        </tr>
                        <tr>
                            <th>품질비용</th>
                            <td>
                                {items.length > 0 ? (
                                    <table className="ncrp-cost">
                                        <tbody>
                                            {items.map((it, i) => (
                                                <tr key={i}>
                                                    <td>
                                                        {twoStage && it.stage ? <span className="ncrp-stage">[{it.stage}]</span> : null}
                                                        {it.dept ? `${it.dept} · ` : ''}{it.label || `항목 ${i + 1}`}
                                                        {it.edit_why ? <span className="ncrp-chg">수정 사유: {it.edit_why}</span> : null}
                                                    </td>
                                                    <td className="amt">{won(it.amount)}</td>
                                                </tr>
                                            ))}
                                            {twoStage && (<>
                                                <tr className="sub"><td>처리방안 소계</td><td className="amt">{won(s1Total)}</td></tr>
                                                <tr className="sub"><td>추가 소계</td><td className="amt">{won(addTotal)}</td></tr>
                                            </>)}
                                            <tr className="sum">
                                                <td>합 계</td>
                                                <td className="amt">{won(total)}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                ) : (
                                    <div>합계 <b>{won(total)}</b></div>
                                )}
                                {Number(total) === 0 && (
                                    <div className="ncrp-note">0원 사유: {closed?.zero_why || report.cost_stage1?.zero_why || '—'}</div>
                                )}
                            </td>
                        </tr>
                        <tr>
                            <th>시정조치</th>
                            <td>
                                <span className={`ncrp-badge ${closed?.car === '유' ? 'no' : 'gray'}`}>{closed?.car || '무'}</span>
                                {closed?.car === '유' && (
                                    <span style={{ marginLeft: 8, fontFamily: 'monospace' }}>CAR 번호: {closed?.car_no || '—'}</span>
                                )}
                            </td>
                        </tr>
                        {aClose && (
                            <tr>
                                <th>종결 승인</th>
                                <td>
                                    <span className="ncrp-sig sm">{aClose.actor_name}</span>
                                    <span className="ncrp-when" style={{ marginLeft: 8 }}>{fmtDT(aClose.at)}</span>
                                    {aClose.comment && <div className="ncrp-note">{aClose.comment}</div>}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        );
    };

    const PairCell = ({ att, side }) => (
        <div className={`ncrp-cell ${side}`}>
            <h5>{side === 'good' ? '정 상 (양 품)' : '부 적 합 (불 량)'}</h5>
            {att ? <img className="ncrp-photo" src={att.dataurl} alt={att.name || ''} /> : <div className="ncrp-empty">사진 없음</div>}
            {att?.name && <div className="ncrp-cap">{att.name}</div>}
        </div>
    );

    const AttSection = ({ title, count, items }) => (
        <div className="ncrp-sect">
            <h4>{title} <small>{count}건</small></h4>
            {items.map((a, i) => (
                <div key={a.id ?? i} className="ncrp-att">
                    {(a.dataurl || '').startsWith('data:image') ? (
                        <>
                            <img src={a.dataurl} alt={a.name || ''} />
                            <div className="ncrp-cap">{a.name || `자료 ${i + 1}`}</div>
                        </>
                    ) : (
                        /* Phase 4: 비이미지 첨부 — 파일명 텍스트 줄만 출력 */
                        <div className="ncrp-cap" style={{ textAlign: 'left' }}>첨부 파일: {a.name || `자료 ${i + 1}`}</div>
                    )}
                </div>
            ))}
        </div>
    );

    /* 섹터 표시 조건 (데이터 있을 때만 · 무효면 2~5 전부 미표시) */
    /* N-5 - 무효 가드가 별지에만 없어, 기술 문의를 거친 문서를 무효 처리하면 별지가 함께 인쇄됐다. */
    const showTech = newFlow && !isVoid && !!report.tech_flag && (!!report.tech_reply || !!techRev) && techRev?.state !== 'skip';
    const showDispo = newFlow && !isVoid && (!!dispoText || !!judge || hasReviews);
    /* 최종반려(doFinalReject)가 qa_summary를 null로 지워도 확정된 1차 비용은 종이에서 사라지면 안 된다 */
    const showQa = newFlow && !isVoid && (!!report.qa_summary?.text || !!report.cost_stage1);
    const showFinal = newFlow && !isVoid && !!aFinal;
    const showClosed = newFlow && !isVoid && !!closed;

    return createPortal(
        <div className="ncrp-root">
            <style>{PRINT_CSS}</style>
            <div className="ncrp-toolbar ncrp-noprint">
                <span style={{ fontSize: 13, fontWeight: 700 }}>인쇄 미리보기 — {report.ncr_no} (FORM 933-07)</span>
                <span style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => window.print()}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#2563eb', color: '#fff', border: 0, borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                        <Printer size={15} /> 인쇄하기
                    </button>
                    <button onClick={onClose}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#475569', color: '#fff', border: 0, borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                        <X size={15} /> 닫기
                    </button>
                </span>
            </div>

            <div className="ncrp-sheet">
                {/* ── 1쪽: 933-07 본문 서식 ── */}
                <div className="ncrp-head">
                    <div>
                        <span className="ncrp-formno">FORM 933-07 · REV.2</span>
                        <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13, marginTop: 6 }}>{report.ncr_no}</div>
                        <div style={{ fontSize: 10, color: '#64748b', marginTop: 2, letterSpacing: '.08em' }}>
                            문서 상태: {statusDisp || '—'}{newFlow ? '' : ' · 구 흐름(레거시) 문서'}
                        </div>
                    </div>
                    {newFlow ? <ApprovalGrid5 /> : <ApprovalGrid2 />}
                </div>
                <div className="ncrp-title">부적합 보고서</div>
                <div className="ncrp-sub">NONCONFORMANCE REPORT · FORM 933-07 REV.2 · 신우밸브 품질보증부</div>

                {/* 무효 문서 띠 — 섹터 2~5 미표시 */}
                {newFlow && isVoid && <VoidBand />}
                {newFlow && isVoidPending && <VoidPendingBand />}

                {/* 1. 부적합사항 (v10.1) / 본문 표 (레거시) */}
                {newFlow ? <SectorDefect /> : <FormTable />}

                {/* 별지 · 2~5 섹터 */}
                {showTech && <SectorTech />}
                {showDispo && <SectorDisposition />}
                {showQa && <SectorQa />}
                {showFinal && <SectorFinal />}
                {showClosed && <SectorClosed />}

                <div style={{ marginTop: 10, fontSize: 11, color: '#64748b' }}>
                    첨부: {[
                        pairs.length ? `#1 사진대지 ${pairs.length}쌍` : null,
                        drawings.length ? `#2 도면 ${drawings.length}건` : null,
                        refs.length ? `#3 관련자료 ${refs.length}건` : null,
                        closedAtts.length ? `#4 처리확인 증빙 ${closedAtts.length}건` : null
                    ].filter(Boolean).join(' · ') || '없음'}
                </div>

                {/* ── H-④ 첨부 목록 표 ──
                    별지를 넘겨보지 않아도 무슨 증거가 붙어 있는지 종이 한 장에서 알 수 있게 한다.
                    첨부가 하나도 없으면 표 자체를 출력하지 않는다(빈 표는 서식만 어지럽힌다).
                    「올린 사람」: 처리확인 증빙(#4)만 올린 사람(by)을 따로 기록한다 —
                    #1~#3은 작성화면에서 작성자가 올리는 것이라 작성자명으로 표기한다. */}
                {attList.length > 0 && (
                    <div className="ncrp-bsect">
                        <h4>첨부 목록 <small>총 {attList.length}건</small></h4>
                        <table className="ncrp-attlist">
                            <colgroup>
                                <col style={{ width: '44%' }} /><col style={{ width: '18%' }} />
                                <col style={{ width: '16%' }} /><col style={{ width: '22%' }} />
                            </colgroup>
                            <thead>
                                <tr><th>파일명</th><th>종류</th><th>올린 사람</th><th>일시</th></tr>
                            </thead>
                            <tbody>
                                {attList.map((a, i) => (
                                    <tr key={a.id ?? i}>
                                        <td className="fn">{a.name || `자료 ${i + 1}`}</td>
                                        <td className="c">{ATT_KIND[Number(a.category)] || '기타'}</td>
                                        <td className="c">{a.by || report.author_name || '—'}</td>
                                        <td className="dt">{fmtDT(a.at) || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                <div className="ncrp-tail">
                    <span>SHINWOO VALVE CO., LTD. — QUALITY ASSURANCE DEPT.</span>
                    <span>FORM 933-07 (REV.2) · {report.ncr_no}</span>
                </div>

                {/* ── #1 사진대지: 1쪽=2쌍(가로형 4:3 사진 4장) ── */}
                {pairs.length > 0 && (
                    <div className="ncrp-sect">
                        <h4>첨부#1 — 사진 전·후 대비표 (사진대지) <small>{pairs.length}쌍 · 1쪽=2쌍(사진 4장)</small></h4>
                        {chunk2(pairs).map((page, pi) => (
                            <div key={pi} className="ncrp-pairpage">
                                {page.map(p => (
                                    <div key={p.no} className="ncrp-pair">
                                        <span className="ncrp-pairno">쌍 {p.no}</span>
                                        <PairCell att={p.good} side="good" />
                                        <PairCell att={p.bad} side="bad" />
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                )}

                {/* ── #2 도면 · #3 관련자료 · #4 처리확인 증빙: 이미지 크게 1쪽당 1~2장 ── */}
                {drawings.length > 0 && <AttSection title="첨부#2 — 해당 도면" count={drawings.length} items={drawings} />}
                {refs.length > 0 && <AttSection title="첨부#3 — 관련자료" count={refs.length} items={refs} />}
                {/* H-④ 처리확인 증빙 별지 — 이미지는 인쇄, 비이미지는 파일명 텍스트만(#2·#3과 동일 규칙) */}
                {closedAtts.length > 0 && <AttSection title="첨부#4 — 처리확인 증빙" count={closedAtts.length} items={closedAtts} />}
            </div>
        </div>,
        document.body
    );
};

export default NCRPrint;
