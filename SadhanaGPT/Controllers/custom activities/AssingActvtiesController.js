import { getPaginatedData } from "../../../utils/dbUtils.js";
import { asyncHandler, mergeParam } from "../../../utils/utils.js";
import validateFields from "../../../utils/validation.js";
import db from "../../../config/database.js";
import crypto from "crypto";

export const getMentorSelectableActivities = asyncHandler(async (req, resp) => {
  try {
    const {
      user_id,
      page_no = 1,
      search_text = "",
      rowSelected,
      center_id = "",
      label_id = ""
    } = mergeParam(req);

    const { isValid, errors } = validateFields(mergeParam(req), {
      page_no: ["required"],
    });

    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const safeCenterId = db.escape(center_id);
    const safeLabelId = db.escape(label_id);

    const safeUserId = db.escape(user_id);

    const params = {
      tableName: `(SELECT * FROM activities WHERE counsellor_id IS NULL OR counsellor_id = ${safeUserId}) AS activities`,
      columns: `id AS master_activity_id, name, 
      description, unit, target, activity_type, counsellor_id,
      CASE
        ${label_id 
          ? `
            WHEN activities.status = 1 
                 AND NOT EXISTS (SELECT 1 FROM counselor_deleted_activities cda WHERE cda.center_id = ${safeCenterId} AND cda.master_activity_id = activities.id AND (cda.label_id = ${safeLabelId} OR cda.label_id IS NULL)) 
            THEN 1
            WHEN EXISTS (SELECT 1 FROM counselor_added_activities caa WHERE caa.master_activity_id = activities.id AND caa.center_id = ${safeCenterId} AND (caa.label_id = ${safeLabelId} OR caa.label_id IS NULL OR caa.label_id = 0))
                 AND NOT EXISTS (SELECT 1 FROM counselor_deleted_activities cda WHERE cda.center_id = ${safeCenterId} AND cda.master_activity_id = activities.id AND (cda.label_id = ${safeLabelId} OR cda.label_id IS NULL))
            THEN 1
          `
          : `
            WHEN (SELECT COUNT(*) FROM labels_list ll WHERE ll.center_id = ${safeCenterId}) = 0 THEN 0
            WHEN (
              SELECT COUNT(DISTINCT ll.id) FROM labels_list ll
              WHERE ll.center_id = ${safeCenterId}
              AND (
                (activities.status = 1 AND NOT EXISTS (SELECT 1 FROM counselor_deleted_activities cda WHERE cda.center_id = ${safeCenterId} AND cda.master_activity_id = activities.id AND (cda.label_id = ll.id OR cda.label_id IS NULL)))
                OR
                (EXISTS (SELECT 1 FROM counselor_added_activities caa WHERE caa.master_activity_id = activities.id AND caa.center_id = ${safeCenterId} AND (caa.label_id = ll.id OR caa.label_id IS NULL OR caa.label_id = 0))
                 AND NOT EXISTS (SELECT 1 FROM counselor_deleted_activities cda WHERE cda.center_id = ${safeCenterId} AND cda.master_activity_id = activities.id AND (cda.label_id = ll.id OR cda.label_id IS NULL)))
              )
            ) = (SELECT COUNT(*) FROM labels_list ll WHERE ll.center_id = ${safeCenterId}) THEN 1
          `
        }
        ELSE 0
      END AS status,
      CASE
        WHEN activities.status = 1 THEN 'default'
        WHEN activities.status = 2 THEN 'selectable'
        ELSE 'unknown'
      END AS status_type
     `,
      sortColumn: "id",
      sortOrder: "ASC",
      page_no,
      limit: rowSelected || 10,
      liveSearchFields: ["name", "description"],
      liveSearchTexts: [search_text, search_text],
      whereField: ["status"],
      whereValue: [0],
      whereOperator: ["!="],
    };

    const result = await getPaginatedData(params);

    return resp.json({
      status: 1,
      code: 200,
      message: ["Activities fetched successfully!"],
      data: result.data,
      total_page: result.totalPage,
      total: result.total,
    });
  } catch (error) {
    console.error("Error fetching mentor selectable activities:", error);
    return resp.json({
      status: 0,
      code: 500,
      message: "Error fetching mentor selectable activities",
    });
  }
});


export const assignActivitiesToStudents = asyncHandler(async (req, resp) => {
  try {
    const {
      counsellor_id,
      master_activity_ids, // Expecting an array
      user_ids, // Expecting an array
    } = mergeParam(req);

    const { isValid, errors } = validateFields(mergeParam(req), {
      counsellor_id: ["required"],
      master_activity_ids: ["required"],
      user_ids: ["required"],
    });

    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    // Validate arrays
    let activityIds = master_activity_ids;
    let studentIds = user_ids;
    
    // Sometimes form-data sends a single item as a string instead of array, so we ensure it's an array
    if (!Array.isArray(activityIds)) activityIds = [activityIds];
    if (!Array.isArray(studentIds)) studentIds = [studentIds];

    if (activityIds.length === 0) {
      return resp.json({ status: 0, code: 422, message: ["Please select at least one activity."] });
    }

    if (studentIds.length === 0) {
      return resp.json({ status: 0, code: 422, message: ["Please select at least one student."] });
    }

    // 1. Fetch details of selected activities from the master activities table
    const placeholders = activityIds.map(() => "?").join(",");
    const activitiesQuery = `SELECT id, name, description, unit, activity_type, target FROM activities WHERE id IN (${placeholders})`;
    
    const [activities] = await db.query(activitiesQuery, activityIds);

    if (activities.length === 0) {
      return resp.json({ status: 0, code: 404, message: ["Selected activities not found."] });
    }

    // 1.5 Get all existing master_activity_id for these students to prevent duplicates
    const studentPlaceholders = studentIds.map(() => "?").join(",");
    const existingQuery = `SELECT user_id, master_activity_id FROM fix_activities WHERE user_id IN (${studentPlaceholders}) AND master_activity_id IN (${placeholders})`;
    const [existingActivities] = await db.query(existingQuery, [...studentIds, ...activityIds]);
    const existingSet = new Set(existingActivities.map(row => `${row.user_id}_${row.master_activity_id}`));

    // 2. Prepare bulk insert data
    const values = [];
    const flatParams = [];
    
    activities.forEach((activity) => {
      studentIds.forEach((user_id) => {
        // Skip if the student already has this activity
        if (existingSet.has(`${user_id}_${activity.id}`)) return;
        
        values.push("(?, ?, ?, ?, ?, ?, ?, ?, ?)");
        flatParams.push(
          activity.id, // master_activity_id
          counsellor_id,
          activity.name,
          activity.description,
          activity.unit,
          activity.activity_type,
          activity.target,
          0, // own_by = 0 (Public)
          user_id
        );
      });
    });

    // 3. Execute Bulk Insert in Chunks (MySQL has a limit on placeholders, so we chunk large inserts)
    const CHUNK_SIZE = 500; // 500 rows per chunk
    let rowsInserted = 0;

    if (values.length > 0) {
      for (let i = 0; i < values.length; i += CHUNK_SIZE) {
        const chunkValues = values.slice(i, i + CHUNK_SIZE);
        const chunkParams = flatParams.slice(i * 9, (i + CHUNK_SIZE) * 9); // 9 columns per row

        const insertQuery = `
          INSERT INTO fix_activities 
          ( master_activity_id, counsellor_id, name, description, unit, activity_type, target, own_by, user_id) 
          VALUES ${chunkValues.join(", ")}
        `;

        const [result] = await db.query(insertQuery, chunkParams);
        rowsInserted += result.affectedRows;
      }
    }

    // 4. Also store in counselor_added_activities
    const userPlaceholders = studentIds.map(() => "?").join(",");
    const assignmentsQuery = `SELECT user_id, center_id, label_id FROM user_assignments WHERE user_id IN (${userPlaceholders})`;
    const [userAssignments] = await db.query(assignmentsQuery, studentIds);

    const caaValues = [];
    const caaParams = [];
    const insertedCombos = new Set();

    activities.forEach((activity) => {
      userAssignments.forEach((assignment) => {
        if (assignment.center_id && assignment.label_id) {
          const comboKey = `${counsellor_id}_${assignment.center_id}_${assignment.label_id}_${activity.id}`;
          if (!insertedCombos.has(comboKey)) {
            insertedCombos.add(comboKey);
            caaValues.push("(?, ?, ?, ?)");
            caaParams.push(counsellor_id, assignment.center_id, assignment.label_id, activity.id);
          }
        }
      });
    });

    if (caaValues.length > 0) {
      // Chunking for counselor_added_activities as well to be safe
      const CAA_CHUNK_SIZE = 500;
      for (let i = 0; i < caaValues.length; i += CAA_CHUNK_SIZE) {
        const chunkValues = caaValues.slice(i, i + CAA_CHUNK_SIZE);
        const chunkParams = caaParams.slice(i * 4, (i + CAA_CHUNK_SIZE) * 4);
        
        const caaInsertQuery = `
          INSERT IGNORE INTO counselor_added_activities 
          (counselor_id, center_id, label_id, master_activity_id) 
          VALUES ${chunkValues.join(", ")}
        `;
        await db.query(caaInsertQuery, chunkParams);
      }
    }

    return resp.json({
      status: 1,
      code: 200,
      message: [`Successfully assigned ${activities.length} activities to ${studentIds.length} students.`],
      data: { rowsInserted }
    });

  } catch (error) {
    console.error("Error assigning activities:", error);
    return resp.json({
      status: 0,
      code: 500,
      message: ["Error assigning activities to students."],
    });
  }
});

export const createCustomActivity = asyncHandler(async (req, resp) => {
  try {
    const { name, activity_type, target, counsellor_id, frequency } = mergeParam(req);
    
    // 1. Basic validation
    const { isValid, errors } = validateFields(mergeParam(req), {
      name: ["required"],
      activity_type: ["required"],
      counsellor_id: ["required"]
    });

    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

        // 2. Map the Frontend Tracking Types to your Database types
    let dbType = activity_type.toLowerCase();
    let unit = '';

    if (dbType === 'duration') {
      dbType = 'time';
      unit = 'mins'; // Saves 'mins' so you know this 30 means 30 minutes!
    } 
    else if (dbType === 'time') {
      dbType = 'time';
      unit = ''; // Or whatever unit you use for fixed times
    } 
    else if (dbType === 'count') {
      dbType = 'numb';
      unit = 'rounds'; // Or 'count'
    } 
    else if (dbType === 'yes/no') {
      dbType = 'boolean';
      unit = '';
    }

    // 3. Insert into the main activities table with the 'unit' column
    const insertQuery = `INSERT INTO activities (name, activity_type, target, unit, counsellor_id, status, frequency) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    const [result] = await db.query(insertQuery, [name, dbType, target || 0, unit, counsellor_id, 3, frequency || 'Daily']);

    return resp.json({
      status: 1,
      code: 200,
      message: ["Custom activity created successfully!"],
      data: { activity_id: result.insertId }
    });
  } catch (error) {
    console.error("Error creating custom activity:", error);
    return resp.json({
      status: 0,
      code: 500,
      message: ["Error creating custom activity."],
    });
  }
});

export const assignActivitiesToGroup = asyncHandler(async (req, resp) => {
  try {
    const { user_id, center_id, label_id, master_activity_ids } = mergeParam(req);

    const { isValid, errors } = validateFields(mergeParam(req), {
      user_id: ["required"],
      center_id: ["required"],
      master_activity_ids: ["required"]
    });

    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    let activityIds = master_activity_ids;
    if (!Array.isArray(activityIds)) activityIds = [activityIds];

    if (activityIds.length === 0) {
      return resp.json({ status: 0, code: 422, message: ["Please select at least one activity."] });
    }

    const placeholders = activityIds.map(() => "?").join(",");
    const activitiesQuery = `SELECT id, name, description, unit, activity_type, target FROM activities WHERE id IN (${placeholders})`;
    const [activities] = await db.query(activitiesQuery, activityIds);

    if (activities.length === 0) {
      return resp.json({ status: 0, code: 404, message: ["Selected activities not found."] });
    }

    // 1. Determine labels to assign
    let labelsToAssign = [];
    if (label_id) {
       labelsToAssign.push(label_id);
    } else {
       const [labels] = await db.query(`SELECT id FROM labels_list WHERE center_id = ?`, [center_id]);
       labelsToAssign = labels.map(l => l.id);
    }

    if (labelsToAssign.length === 0 && !label_id) {
        return resp.json({ status: 0, code: 422, message: ["No sub-groups exist for this group. Please create sub-groups first."] });
    }

    // 2. Insert into counselor_added_activities
    const caaValues = [];
    const caaParams = [];
    
    activities.forEach((activity) => {
      labelsToAssign.forEach(l_id => {
        caaValues.push("(?, ?, ?, ?)");
        caaParams.push(user_id, center_id, l_id, activity.id);
      });
    });

    if (caaValues.length > 0) {
      const caaInsertQuery = `
        INSERT IGNORE INTO counselor_added_activities 
        (counselor_id, center_id, label_id, master_activity_id) 
        VALUES ${caaValues.join(", ")}
      `;
      await db.query(caaInsertQuery, caaParams);
    }

    // 3. Delete from counselor_deleted_activities in case it was a default activity that is being re-added
    if (labelsToAssign.length > 0) {
       const labelPlaceholders = labelsToAssign.map(() => "?").join(",");
       const deleteCdaQuery = `DELETE FROM counselor_deleted_activities WHERE center_id = ? AND master_activity_id IN (${placeholders}) AND label_id IN (${labelPlaceholders})`;
       await db.query(deleteCdaQuery, [center_id, ...activityIds, ...labelsToAssign]);
    }

    // 4. Fetch all students in this group/sub-group
    let studentsQuery = `SELECT user_id FROM user_assignments WHERE center_id = ?`;
    const studentsParams = [center_id];
    
    if (label_id) {
      studentsQuery += ` AND label_id = ?`;
      studentsParams.push(label_id);
    }
    
    const [students] = await db.query(studentsQuery, studentsParams);
    
    // 3. Assign activities to these students
    let rowsInserted = 0;
    if (students.length > 0) {
      const studentIds = students.map(s => s.user_id);
      const studentPlaceholders = studentIds.map(() => "?").join(",");
      const existingQuery = `SELECT user_id, master_activity_id FROM fix_activities WHERE user_id IN (${studentPlaceholders}) AND master_activity_id IN (${placeholders})`;
      const [existingActivities] = await db.query(existingQuery, [...studentIds, ...activityIds]);
      const existingSet = new Set(existingActivities.map(row => `${row.user_id}_${row.master_activity_id}`));

      const values = [];
      const flatParams = [];
      
      activities.forEach((activity) => {
        students.forEach((student) => {
          // Skip if the student already has this activity
          if (existingSet.has(`${student.user_id}_${activity.id}`)) return;
          
          values.push("(?, ?, ?, ?, ?, ?, ?, ?, ?)");
          flatParams.push(
            activity.id, // master_activity_id
            user_id, // counsellor_id
            activity.name,
            activity.description,
            activity.unit,
            activity.activity_type,
            activity.target,
            0, // own_by = 0 (Public)
            student.user_id
          );
        });
      });

      const CHUNK_SIZE = 500;
      if (values.length > 0) {
        for (let i = 0; i < values.length; i += CHUNK_SIZE) {
          const chunkValues = values.slice(i, i + CHUNK_SIZE);
          const chunkParams = flatParams.slice(i * 9, (i + CHUNK_SIZE) * 9);

          const insertQuery = `
            INSERT INTO fix_activities 
            (master_activity_id, counsellor_id, name, description, unit, activity_type, target, own_by, user_id) 
            VALUES ${chunkValues.join(", ")}
          `;

          const [result] = await db.query(insertQuery, chunkParams);
          rowsInserted += result.affectedRows;
        }
      }
    }

    return resp.json({
      status: 1,
      code: 200,
      message: [`Successfully assigned ${activities.length} activities to the group. (${students.length} students updated)`]
    });

  } catch (error) {
    console.error("Error assigning activities to group:", error);
    return resp.json({
      status: 0,
      code: 500,
      message: ["Error assigning activities to group."],
    });
  }
});

export const deassignActivitiesFromGroup = asyncHandler(async (req, resp) => {
  try {
    const { center_id, label_id, master_activity_ids } = mergeParam(req);

    const { isValid, errors } = validateFields(mergeParam(req), {
      center_id: ["required"],
      master_activity_ids: ["required"]
    });

    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    let activityIds = master_activity_ids;
    if (!Array.isArray(activityIds)) activityIds = [activityIds];

    if (activityIds.length === 0) {
      return resp.json({ status: 0, code: 422, message: ["Please select at least one activity to remove."] });
    }

    // 1. Determine labels to remove
    let labelsToRemove = [];
    if (label_id) {
       labelsToRemove.push(label_id);
    } else {
       const [labels] = await db.query(`SELECT id FROM labels_list WHERE center_id = ?`, [center_id]);
       labelsToRemove = labels.map(l => l.id);
    }

    if (labelsToRemove.length === 0 && !label_id) {
        return resp.json({ status: 0, code: 422, message: ["No sub-groups exist for this group. Please create sub-groups first."] });
    }

    const activityPlaceholders = activityIds.map(() => "?").join(",");

    // 1. Delete from counselor_added_activities
    if (labelsToRemove.length > 0) {
      const labelPlaceholders = labelsToRemove.map(() => "?").join(",");
      let deleteCaaQuery = `DELETE FROM counselor_added_activities WHERE center_id = ? AND master_activity_id IN (${activityPlaceholders}) AND label_id IN (${labelPlaceholders})`;
      let deleteCaaParams = [center_id, ...activityIds, ...labelsToRemove];
      await db.query(deleteCaaQuery, deleteCaaParams);
    }

    // 1.5 Insert into counselor_deleted_activities so default activities (status=1) stay removed
    const cdaValues = [];
    const cdaParams = [];
    activityIds.forEach(id => {
      labelsToRemove.forEach(l_id => {
        cdaValues.push("(?, ?, ?)");
        cdaParams.push(center_id, id, l_id);
      });
    });
    
    if (cdaValues.length > 0) {
      const insertCdaQuery = `INSERT IGNORE INTO counselor_deleted_activities (center_id, master_activity_id, label_id) VALUES ${cdaValues.join(",")}`;
      await db.query(insertCdaQuery, cdaParams);
    }

    // 2. Fetch all students in this group/sub-group
    let studentsQuery = `SELECT user_id FROM user_assignments WHERE center_id = ?`;
    const studentsParams = [center_id];
    
    if (label_id) {
      studentsQuery += ` AND label_id = ?`;
      studentsParams.push(label_id);
    }
    
    const [students] = await db.query(studentsQuery, studentsParams);

    // 3. Delete from fix_activities for these students
    let rowsDeleted = 0;
    if (students.length > 0) {
      const studentIds = students.map(s => s.user_id);
      
      // Delete in chunks if there are many students, but typically IN clauses can handle a few hundred
      const CHUNK_SIZE = 500;
      for (let i = 0; i < studentIds.length; i += CHUNK_SIZE) {
        const studentChunk = studentIds.slice(i, i + CHUNK_SIZE);
        const studentPlaceholders = studentChunk.map(() => "?").join(",");
        
        const deleteFixQuery = `
          DELETE FROM fix_activities 
          WHERE master_activity_id IN (${activityPlaceholders}) 
          AND user_id IN (${studentPlaceholders})
        `;
        
        const [result] = await db.query(deleteFixQuery, [...activityIds, ...studentChunk]);
        rowsDeleted += result.affectedRows;
      }
    }

    return resp.json({
      status: 1,
      code: 200,
      message: [`Successfully removed ${activityIds.length} activities from the group. (${rowsDeleted} records deleted)`]
    });

  } catch (error) {
    console.error("Error deassigning activities from group:", error);
    return resp.json({
      status: 0,
      code: 500,
      message: ["Error removing activities from group."],
    });
  }
});
