import db from "./config/database.js";

async function createTable() {
    try {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS student_ai_reports (
                id INT AUTO_INCREMENT PRIMARY KEY,
                studentId VARCHAR(50) NOT NULL,
                rangeType VARCHAR(50) NOT NULL,
                fromDate DATE NOT NULL,
                toDate DATE NOT NULL,
                kpis JSON,
                analysis JSON,
                model VARCHAR(50) DEFAULT 'openai/gpt-oss-120b',
                generatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log("student_ai_reports table created or already exists.");
        process.exit(0);
    } catch (err) {
        console.error("Error creating table:", err);
        process.exit(1);
    }
}

createTable();
