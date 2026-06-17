import db from "./config/database.js";

async function createTable() {
    try {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS ai_reports (
                id INT AUTO_INCREMENT PRIMARY KEY,
                student_id VARCHAR(50) NOT NULL,
                range_type VARCHAR(50) NOT NULL,
                date_from DATE NOT NULL,
                date_to DATE NOT NULL,
                kpi_data JSON,
                ai_analysis JSON,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log("ai_reports table created or already exists.");
        process.exit(0);
    } catch (err) {
        console.error("Error creating table:", err);
        process.exit(1);
    }
}

createTable();
