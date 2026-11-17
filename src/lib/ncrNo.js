/* 새 NCR 번호 = 같은 해 종이 대장(ncr_legacy)과 새 보고서(ncr_reports) 중 큰 일련번호 + 1.
   종이 「26-051」「14-0001」「17-029-01」(가지 -01은 본 번호 29로) · 새 「NCR 26-035」. 다른 해 번호는 무시. */
export const nextNcrNo = (yy, nos) => {
    const seqs = nos
        .map(n => /^(?:NCR )?(\d{2})-(\d+)/.exec(n || ''))
        .filter(m => m && m[1] === yy)
        .map(m => parseInt(m[2], 10));
    return `NCR ${yy}-${String((seqs.length ? Math.max(...seqs) : 0) + 1).padStart(3, '0')}`;
};

/* 번호 비교용 열쇠 — 공백·「NCR」 접두·일련번호 앞 0 차이 무시(「NCR 26-075」 = 「26-075」 = 「26-0075」 = 「26-75」).
   2014년 종이 「14-0001」도 「14-1」로 비교. 가지 꼬리 -NN 은 그대로 붙인다. 표시·pdf_path 는 원문 그대로 쓰고 비교에만 쓴다. */
export const ncrKey = (n) => {
    const s = String(n ?? '').replace(/\s+/g, '').replace(/^NCR/i, '').toUpperCase();
    const m = /^(\d{2})-(\d+)(-\d+)?$/.exec(s);
    return m ? `${m[1]}-${parseInt(m[2], 10)}${m[3] ? `-${parseInt(m[3].slice(1), 10)}` : ''}` : s;
};

/* 직접 입력(병행 기간) — 「26-75」「ncr 26-075」「NCR26-075-01」 → 「NCR 26-075(-01)」. 형식이 아니면 null.
   일련번호는 숫자값을 3자리로 채운다(「26-0075」「26-75」→「NCR 26-075」, 4자리 이상은 그대로) — 저장 문자열이 하나여야 DB UNIQUE(23505)가 막는다. */
export const normNcrNo = (s) => {
    const m = /^(?:NCR)?(\d{2})-(\d{1,4})(-\d{2})?$/i.exec(String(s ?? '').replace(/\s+/g, ''));
    return m ? `NCR ${m[1]}-${String(parseInt(m[2], 10)).padStart(3, '0')}${m[3] || ''}` : null;
};
