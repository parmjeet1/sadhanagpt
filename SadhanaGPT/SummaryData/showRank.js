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
