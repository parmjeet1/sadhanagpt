import db from '../../config/database.js';
import moment from 'moment';

/**
 * Calculates and inserts ranks for a specific period.
 * @param {string} fromDate - YYYY-MM-DD
 * @param {string} toDate - YYYY-MM-DD
 * @param {string} type - 'current_week' or 'last_week'
 */
const calculateAndStoreRanks = async (fromDate, toDate, type) => {
    try {
        console.log(`[RankJob] Starting calculation for ${type} (${fromDate} to ${toDate})`);
        const daysInPeriod = moment(toDate).diff(moment(fromDate), 'days') + 1;

        // 1. Fetch raw marks for all students
        const query = `
            SELECT 
                u.user_id AS student_id,
                u.name AS student_name,
                ua.counsellor_id,
                ua.center_id,
                COALESCE(SUM(sr.total_marks), 0) AS total_marks,
                COALESCE(MAX(sr.max_possible_marks), 0) AS daily_max_marks
            FROM users u
            LEFT JOIN user_assignments ua ON u.user_id = ua.user_id
            LEFT JOIN summary_report sr ON u.user_id = sr.user_id AND sr.activity_date BETWEEN ? AND ?
            WHERE u.user_type IN ('student', 'counsellor')
            GROUP BY u.user_id, u.name, ua.counsellor_id, ua.center_id
        `;
        
        const [rows] = await db.execute(query, [fromDate, toDate]);
        
        // 2. Compute percentages
        let studentsList = rows.map(student => {
            const numericMarks = Number(student.total_marks);
            const dailyMaxMarks = Number(student.daily_max_marks);
            const maxMarks = dailyMaxMarks * daysInPeriod;
            const percentage = maxMarks > 0 ? Math.round((numericMarks / maxMarks) * 100) : 0;
            return {
                ...student,
                total_marks: numericMarks,
                percentage: percentage
            };
        });

        // 3. Calculate True Global Rank (across all students)
        studentsList.sort((a, b) => b.percentage - a.percentage);
        studentsList.forEach((student, index) => {
            student.global_rank = index + 1;
        });

        // 4. Calculate Group Rank (grouped by center_id)
        const centerGroups = {};
        studentsList.forEach(student => {
            if (!student.center_id) return;
            if (!centerGroups[student.center_id]) {
                centerGroups[student.center_id] = [];
            }
            centerGroups[student.center_id].push(student);
        });

        Object.values(centerGroups).forEach(group => {
            group.sort((a, b) => b.percentage - a.percentage);
            group.forEach((student, index) => {
                student.group_rank = index + 1;
            });
        });

        // 5. Delete old entries for this type
        await db.execute(`DELETE FROM weekly_student_ranks WHERE type = ?`, [type]);

        // 6. Bulk Insert
        if (studentsList.length > 0) {
            const insertQuery = `
                INSERT INTO weekly_student_ranks 
                (user_id, counsellor_id, center_id, period_start, period_end, global_rank, group_rank, total_marks, percentage, type) 
                VALUES ?
            `;
            const values = studentsList.map(s => [
                s.student_id,
                s.counsellor_id,
                s.center_id || null,
                fromDate,
                toDate,
                s.global_rank || null,
                s.group_rank || null,
                s.total_marks,
                s.percentage,
                type
            ]);
            await db.query(insertQuery, [values]);
        }

        console.log(`[RankJob] Successfully stored ${studentsList.length} ranks for ${type}.`);
    } catch (error) {
        console.error(`[RankJob] Error calculating ranks for ${type}:`, error);
    }
};

export const runWeeklyRankJob = async () => {
    console.log("[RankJob] Starting nightly rank calculations...");
    
    // CURRENT WEEK: Monday of this week to Yesterday
    const thisMonday = moment().startOf('isoWeek').format('YYYY-MM-DD');
    const yesterday = moment().subtract(1, 'days').format('YYYY-MM-DD');
    
    if (moment(thisMonday).isSameOrBefore(yesterday)) {
        await calculateAndStoreRanks(thisMonday, yesterday, 'current_week');
    } else {
        await calculateAndStoreRanks(thisMonday, thisMonday, 'current_week');
    }

    // LAST WEEK: Previous Monday to Previous Sunday
    const lastSunday = moment().startOf('isoWeek').subtract(1, 'days').format('YYYY-MM-DD');
    const lastMonday = moment(lastSunday).subtract(6, 'days').format('YYYY-MM-DD');
    await calculateAndStoreRanks(lastMonday, lastSunday, 'last_week');

    console.log("[RankJob] Finished nightly rank calculations.");
};
