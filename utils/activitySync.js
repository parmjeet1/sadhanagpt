import db from "../config/database.js";

/**
 * Synchronizes a student's activities based on their assigned group and subgroup.
 * - Preserves personal activities (own_by = 1)
 * - Replaces group activities (own_by = 0) with the ones configured for the group/subgroup
 *
 * @param {Array<string>} student_ids - Array of student user_ids
 * @param {number|string} center_id - The ID of the center (group)
 * @param {number|string} label_id - The ID of the label (subgroup), 0 or undefined for uncategorized
 * @param {string} counsellor_id - The ID of the counselor making the change
 */
export const syncStudentActivities = async (student_ids, center_id, label_id, counsellor_id) => {
  if (!student_ids || student_ids.length === 0) return;

  const safeCenterId = db.escape(center_id || 0);
  const safeLabelId = db.escape(label_id || 0);

  try {
    // 1. Delete all existing group-assigned activities for these students
    const studentPlaceholders = student_ids.map(() => "?").join(",");
    const deleteQuery = `DELETE FROM fix_activities WHERE user_id IN (${studentPlaceholders}) AND own_by = 0`;
    await db.query(deleteQuery, student_ids);

    // 2. Determine which activities should be assigned
    let fetchActivitiesQuery = "";
    
    if (center_id == 0 || center_id == "0") {
      // Not in any group -> Assign all default activities that exist
      fetchActivitiesQuery = `
        SELECT id, name, description, unit, activity_type, target 
        FROM activities 
        WHERE status = 1
      `;
    } else if (center_id > 0 && (!label_id || label_id == 0 || label_id == "0")) {
      // In a group, but uncategorized subgroup -> Default activities EXCEPT globally deleted ones for this group
      fetchActivitiesQuery = `
        SELECT id, name, description, unit, activity_type, target 
        FROM activities 
        WHERE status = 1
          AND NOT EXISTS (
            SELECT 1 FROM counselor_deleted_activities cda 
            WHERE cda.master_activity_id = activities.id 
              AND cda.center_id = ${safeCenterId} 
              AND cda.label_id IS NULL
          )
      `;
    } else {
      // In a specific subgroup -> Intersection logic (same as UI)
      fetchActivitiesQuery = `
        SELECT id, name, description, unit, activity_type, target 
        FROM activities 
        WHERE 
          (
            EXISTS (
              SELECT 1 FROM counselor_added_activities caa 
              WHERE caa.master_activity_id = activities.id 
                AND caa.center_id = ${safeCenterId} 
                AND (caa.label_id = ${safeLabelId} OR caa.label_id IS NULL OR caa.label_id = 0)
            )
            AND NOT EXISTS (
              SELECT 1 FROM counselor_deleted_activities cda 
              WHERE cda.master_activity_id = activities.id 
                AND cda.center_id = ${safeCenterId} 
                AND (cda.label_id = ${safeLabelId} OR cda.label_id IS NULL)
            )
          )
          OR 
          (
            status = 1 
            AND NOT EXISTS (
              SELECT 1 FROM counselor_deleted_activities cda 
              WHERE cda.master_activity_id = activities.id 
                AND cda.center_id = ${safeCenterId} 
                AND (cda.label_id = ${safeLabelId} OR cda.label_id IS NULL)
            )
          )
      `;
    }

    const [activitiesToAssign] = await db.query(fetchActivitiesQuery);

    if (activitiesToAssign.length === 0) return; // Nothing to assign

    // 3. Insert the newly fetched activities into fix_activities for each student
    const insertValues = [];
    const insertParams = [];

    activitiesToAssign.forEach((activity) => {
      student_ids.forEach((student_id) => {
        insertValues.push("(?, ?, ?, ?, ?, ?, ?, ?)");
        insertParams.push(
          activity.id, counsellor_id || null, activity.name, activity.description, 
          activity.unit, activity.activity_type, activity.target, student_id
        );
      });
    });

    if (insertValues.length > 0) {
      // Trigger handles activity_id, own_by defaults to 0
      const insertQuery = `
        INSERT IGNORE INTO fix_activities 
        (master_activity_id, counsellor_id, name, description, unit, activity_type, target, user_id, own_by) 
        VALUES ${insertValues.join(", ").replace(/\)/g, ", 0)")}
      `;
      // I am appending ", 0" directly into the VALUES strings because I realized own_by was missing
      await db.query(insertQuery, insertParams);
    }
    
  } catch (err) {
    console.error("Error in syncStudentActivities:", err);
  }
};
