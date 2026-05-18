import fs from 'fs';

try {
    const db = JSON.parse(fs.readFileSync('./db.json', 'utf8'));
    const reports = db.weekly_reports || [];
    const mayLeeReports = reports.filter(r => {
        const authorName = r.authorName || '';
        const isLee = authorName.includes('이종선');
        const dateStr = r.weekStartDate || '';
        const isMay = dateStr.startsWith('2026-05');
        return isLee && isMay;
    });

    console.log(`Found ${mayLeeReports.length} reports for 이종선 in May 2026.`);
    console.log(JSON.stringify(mayLeeReports, null, 2));
} catch (e) {
    console.error('Error reading db.json:', e);
}
