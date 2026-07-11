import db from './config/database.js';
db.execute("SELECT u.user_id AS student_id, u.name, COALESCE(SUM(sr.total_marks), 0) AS total_marks, COALESCE(SUM(sr.max_possible_marks), 0) AS max_marks FROM users u JOIN summary_report sr ON u.user_id = sr.user_id WHERE sr.activity_date BETWEEN '2026-06-29' AND '2026-07-05' AND u.user_id IN (SELECT user_id FROM user_assignments WHERE counsellor_id = 'U000000083') GROUP BY u.user_id, u.name")
.then(([rows]) => { console.log("Rows:", rows); process.exit(0); })
.catch(console.error);
