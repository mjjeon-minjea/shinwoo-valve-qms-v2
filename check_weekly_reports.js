const fs = require('fs');

try {
    const db = JSON.parse(fs.readFileSync('./db.json', 'utf8'));
    const reports = db.weekly_reports || [];
    const mayReports = reports.filter(r => {
        // Filter by author: "이종선" or check authorName
        const isLee = r.authorName && r.authorName.includes('이종선');
        
        // Filter by May: check weekStartDate or createdAt
        const dateString = r.weekStartDate || r.createdAt || r.date || '';
        const isMay = dateString.includes('-05-') || dateString.startsWith('2026-05');
        
        return isLee && isMay;
    });

    console.log(JSON.stringify(mayReports, null, 2));
} catch (e) {
    console.error('Error reading db.json:', e);
}
