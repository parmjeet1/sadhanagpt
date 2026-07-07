import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });
  
  try {
    const [rows] = await db.execute(`
      SELECT cl.center_id, cl.name, cl.city,
      (SELECT COUNT(DISTINCT ua.user_id) FROM user_assignments ua WHERE ua.center_id = cl.center_id AND ua.counsellor_id COLLATE utf8mb4_unicode_ci = cl.counsller_id COLLATE utf8mb4_unicode_ci) AS total_student
      FROM center_list cl
      LIMIT 5
    `);
    console.log(rows);
  } catch (err) {
    console.error(err);
  }
  
  db.end();
}
run();
