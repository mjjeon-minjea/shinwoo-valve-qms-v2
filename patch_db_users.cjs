
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'db.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

// 1. Update Users (Add roles and mock users)
const users = [
    {
        id: "1",
        name: "전민재",
        company: "품질보증부",
        role: "manager", // 과장
        email: "mjjeon@shinwoovalve.com",
        password: "1",
        date: "2025-12-30",
        status: "Active"
    },
    {
        id: "2",
        name: "이종선",
        company: "품질보증부",
        role: "employee", // 사원
        email: "jslee@shinwoovalve.com",
        password: "1",
        date: "2026-01-01",
        status: "Active"
    },
    {
        id: "3",
        name: "박부장",
        company: "품질보증부",
        role: "director", // 부장
        email: "bjpark@shinwoovalve.com",
        password: "1",
        date: "2026-01-01",
        status: "Active"
    }
];

// 2. Add Weekly Reports Collection (Initialize if not exists)
if (!db.weekly_reports) {
    db.weekly_reports = [];
}

// Update DB object
db.users = users;

// Write back to file
fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
console.log('Database updated: Added roles and weekly_reports collection.');
