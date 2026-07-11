import db from './config/database.js';
db.execute("SELECT activity_date, total_marks FROM summary_report ORDER BY activity_date DESC LIMIT 50")
.then(([rows]) => { console.log("Rows:", rows); process.exit(0); })
.catch(console.error);
