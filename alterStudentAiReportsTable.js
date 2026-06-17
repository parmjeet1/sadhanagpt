import db from "./config/database.js";

async function alterTable() {
    try {
        // Add createdBy column
        try {
            await db.execute(`ALTER TABLE student_ai_reports ADD COLUMN createdBy VARCHAR(50) NULL AFTER studentId`);
            console.log("Added createdBy column.");
        } catch (e) {
            console.log("createdBy column might already exist:", e.message);
        }

        // Add indexes
        try {
            await db.execute(`ALTER TABLE student_ai_reports ADD INDEX idx_studentId (studentId)`);
            console.log("Added idx_studentId.");
        } catch (e) {
            console.log("idx_studentId might already exist:", e.message);
        }

        try {
            await db.execute(`ALTER TABLE student_ai_reports ADD INDEX idx_generatedAt (generatedAt)`);
            console.log("Added idx_generatedAt.");
        } catch (e) {
            console.log("idx_generatedAt might already exist:", e.message);
        }

        try {
            await db.execute(`ALTER TABLE student_ai_reports ADD INDEX idx_rangeType (rangeType)`);
            console.log("Added idx_rangeType.");
        } catch (e) {
            console.log("idx_rangeType might already exist:", e.message);
        }

        process.exit(0);
    } catch (err) {
        console.error("Error altering table:", err);
        process.exit(1);
    }
}

alterTable();
