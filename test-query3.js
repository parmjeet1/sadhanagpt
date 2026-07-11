import db from './config/database.js';
db.execute("SELECT u.id, u.name, COALESCE(SUM(sr.total_marks), 0) AS total_marks FROM users u JOIN summary_report sr ON u.id = sr.user_id WHERE sr.activity_date >= '2026-06-29' AND sr.activity_date <= '2026-07-05' GROUP BY u.id, u.name")
.then(([rows]) => { console.log("Rows:", rows); process.exit(0); })
.catch(console.error);
