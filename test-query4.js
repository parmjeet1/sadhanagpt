import db from './config/database.js';
db.execute("SELECT u.user_id AS student_id, u.name, COALESCE(SUM(sr.total_marks), 0) AS total_marks FROM users u JOIN summary_report sr ON u.user_id = sr.user_id WHERE sr.activity_date BETWEEN '2026-06-29' AND '2026-07-05' GROUP BY u.user_id, u.name HAVING total_marks > 0")
.then(([rows]) => { console.log("Rows:", rows); process.exit(0); })
.catch(console.error);
