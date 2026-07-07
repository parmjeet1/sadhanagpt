import db from '../../config/database.js';

export const dailyStudentSummary = async (userId, targetDate) => {
    try {
        const query = `SELECT activity_id, marks FROM daily_report WHERE user_id = ? AND activity_date = ?`;
        const [reports] = await db.execute(query, [userId, targetDate]);

        let totalMarks = 0;
        let completedActivities = 0;

        if (reports && reports.length > 0) {
            completedActivities = reports.length;
            for (const report of reports) {
                totalMarks += parseFloat(report.marks) || 0;
            }
        }

        // Count total Assigned activities to User

        const totalAssigned = `SELECT COUNT(*) as total_activities FROM fix_activities WHERE user_id = ?`;

        const [countResult] = await db.execute(totalAssigned, [userId]);
        const totalActivitiesCount = countResult[0].total_activities || 0;

        // Insert data in summary_report table only if all activities are completely filled

        if (completedActivities === totalActivitiesCount && totalActivitiesCount > 0){

            const marksQuery = `SELECT SUM(m.marks) as max_marks FROM fix_activities f
                LEFT JOIN marking_rules m ON f.master_activity_id = m.master_activity_id
                WHERE f.user_id = ? 
                  AND m.status = 1 
                  AND m.frequency = 'daily'
                  AND m.is_max_marks = 1
            `;
            const [maxMarksResult] = await db.execute(marksQuery, [userId]);
            
            // Extract the value safely
            const maxPossibleMarks = maxMarksResult[0].max_marks || 0;

            const saveQuery = `INSERT INTO summary_report (user_id, activity_date, total_marks, max_possible_marks, completed_activities, total_activities, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW()) ON DUPLICATE KEY UPDATE total_marks = VALUES(total_marks), max_possible_marks = VALUES(max_possible_marks), completed_activities = VALUES(completed_activities), total_activities = VALUES(total_activities), updated_at = NOW()`;

            await db.execute(saveQuery, [userId, targetDate, totalMarks, maxPossibleMarks, completedActivities, totalActivitiesCount]);
        
            console.log(`Summary report generated for user ${userId} on date ${targetDate}`);
        } else {
            console.log (`Summary report skipped for user ${userId}: Completed ${completedActivities} out of ${totalActivitiesCount} activities.`);
        }
    } catch (error) {
        console.error(`Error generating summary report for user ${userId} on date ${targetDate}`, error);
        throw error;
    }
};