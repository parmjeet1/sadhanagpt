import db from '../../config/database.js';
import { asyncHandler, mergeParam } from "../../utils/utils.js";

/**
 * API to fetch students rank from the weekly_student_ranks table
 */
export const getStudentRank = asyncHandler(async (req, res) => {
    try {
        const { center_id, user_id, ignore_50_rule, is_student_group_rank, rank_period, is_personal_rank } = mergeParam(req);
        
        const type = rank_period || 'current_week';

        let query = `
            SELECT 
                wsr.user_id AS student_id,
                u.name AS student_name,
                wsr.total_marks,
                wsr.percentage,
                wsr.global_rank,
                wsr.group_rank
            FROM weekly_student_ranks wsr
            JOIN users u ON wsr.user_id = u.user_id
            WHERE wsr.type = ?
        `;
        
        const params = [type];
        let rankField = 'global_rank';

        // Filter by center if requested
        if (center_id) {
            query += ` AND wsr.center_id = ?`;
            params.push(center_id);
            rankField = 'group_rank';
        } else if (is_student_group_rank === 'true' || is_student_group_rank === true) {
            // Group Rank: Filter by the logged-in user's group (center_id)
            query += ` AND wsr.center_id = (SELECT center_id FROM user_assignments WHERE user_id = ? LIMIT 1)`;
            params.push(user_id);
            rankField = 'group_rank';
        } else if (is_personal_rank === 'true' || is_personal_rank === true) {
            // Global Rank for a personal widget: true global, no filter!
            // It will fetch all students in the DB and use global_rank
        } else if (user_id) {
            // Global Rank: Filter by counsellor (Analytics View)
            query += ` AND wsr.counsellor_id = ?`;
            params.push(user_id);
        }

        query += ` ORDER BY wsr.${rankField} ASC`;

        const [rows] = await db.execute(query, params);
        console.log(`[Rank] Fetched for user_id ${user_id} (${type}):`, rows.length, "rows");

        let studentsList = rows.map(student => {
            return {
                student_id: student.student_id,
                student_name: student.student_name,
                total_marks: Number(student.total_marks),
                percentage: Number(student.percentage),
                rank: Number(student[rankField])
            };
        });

        // Apply 50% rule if needed
        if (ignore_50_rule !== 'true' && ignore_50_rule !== true) {
            studentsList = studentsList.filter(s => s.percentage >= 50);
        }

        // --- INSTANT RANK FOR NEW STUDENTS ---
        if (is_student_group_rank === 'true' || is_student_group_rank === true || center_id) {
            // Group Rank View: Inject all missing students from this group
            let targetCenterId = center_id;
            if (!targetCenterId && user_id) {
                const [[assign]] = await db.execute('SELECT center_id FROM user_assignments WHERE user_id = ? LIMIT 1', [user_id]);
                if (assign) targetCenterId = assign.center_id;
            }

            if (targetCenterId) {
                const [groupStudents] = await db.execute(`
                    SELECT u.user_id, u.name FROM user_assignments ua 
                    JOIN users u ON ua.user_id = u.user_id 
                    WHERE ua.center_id = ? AND u.user_type = 'student'
                `, [targetCenterId]);

                let currentLowestRank = studentsList.length > 0 ? Math.max(...studentsList.map(s => s.rank)) : 0;
                for (const gs of groupStudents) {
                    if (!studentsList.some(s => String(s.student_id) === String(gs.user_id))) {
                        currentLowestRank++;
                        studentsList.push({
                            student_id: gs.user_id, student_name: gs.name, total_marks: 0, percentage: 0, rank: currentLowestRank
                        });
                    }
                }
            }
        } else if (is_personal_rank === 'true' || is_personal_rank === true) {
            // Global Rank View: Inject only the requesting student if missing
            if (user_id && !studentsList.some(s => String(s.student_id) === String(user_id))) {
                const [[userInfo]] = await db.execute('SELECT name FROM users WHERE user_id = ?', [user_id]);
                if (userInfo) {
                    const lowestRank = studentsList.length > 0 ? Math.max(...studentsList.map(s => s.rank)) : 0;
                    studentsList.push({
                        student_id: user_id, student_name: userInfo.name, total_marks: 0, percentage: 0, rank: lowestRank + 1
                    });
                }
            }
        } else if (user_id) {
            // Counsellor Analytics View: Inject all missing students assigned to this counsellor
            const [counsellorStudents] = await db.execute(`
                SELECT u.user_id, u.name FROM user_counsellors uc 
                JOIN users u ON uc.user_id = u.user_id 
                WHERE uc.counsller_id = ? AND u.user_type = 'student'
            `, [user_id]);

            let currentLowestRank = studentsList.length > 0 ? Math.max(...studentsList.map(s => s.rank)) : 0;
            for (const cs of counsellorStudents) {
                if (!studentsList.some(s => String(s.student_id) === String(cs.user_id))) {
                    currentLowestRank++;
                    studentsList.push({
                        student_id: cs.user_id, student_name: cs.name, total_marks: 0, percentage: 0, rank: currentLowestRank
                    });
                }
            }
        }

        return res.json({
            status: 1,
            code: 200,
            message: ["Student ranks fetched successfully"],
            data: {
                period: type === 'current_week' ? 'This Week' : 'Last Week',
                ranks: studentsList
            }
        });

    } catch (error) {
        console.error("[Rank] Error fetching student ranks:", error);
        return res.json({
            status: 0,
            code: 500,
            message: ["Failed to fetch student ranks"]
        });
    }
});
