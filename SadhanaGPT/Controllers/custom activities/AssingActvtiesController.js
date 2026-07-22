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
        WHEN activities.status = 1 THEN 1
        WHEN (SELECT COUNT(*) FROM counselor_added_activities caa WHERE caa.master_activity_id = activities.id AND caa.center_id = ${safeCenterId} ${label_id ? `AND caa.label_id = ${safeLabelId}` : ""}) > 0 THEN 1
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

    // 2. Prepare bulk insert data
    const values = [];
    const flatParams = [];
    
    activities.forEach((activity) => {
      studentIds.forEach((user_id) => {
        // const activity_id = crypto.randomUUID(); // generate unique 36-char string for fix_activities
        
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
    const { name, activity_type, target, counsellor_id } = mergeParam(req);
    
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
    const insertQuery = `INSERT INTO activities (name, activity_type, target, unit, counsellor_id, status) VALUES (?, ?, ?, ?, ?, ?)`;
    const [result] = await db.query(insertQuery, [name, dbType, target || 0, unit, counsellor_id, 3]);

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

    // 1. Insert into counselor_added_activities
    const caaValues = [];
    const caaParams = [];
    
    // Convert label_id to null if empty
    const safeLabelId = label_id ? label_id : null;

    activities.forEach((activity) => {
      caaValues.push("(?, ?, ?, ?)");
      caaParams.push(user_id, center_id, safeLabelId, activity.id);
    });

    if (caaValues.length > 0) {
      const caaInsertQuery = `
        INSERT IGNORE INTO counselor_added_activities 
        (counselor_id, center_id, label_id, master_activity_id) 
        VALUES ${caaValues.join(", ")}
      `;
      await db.query(caaInsertQuery, caaParams);
    }

    // 2. Fetch all students in this group/sub-group
    let studentsQuery = `SELECT user_id FROM user_assignments WHERE center_id = ?`;
    const studentsParams = [center_id];
    
    if (safeLabelId) {
      studentsQuery += ` AND label_id = ?`;
      studentsParams.push(safeLabelId);
    }
    
    const [students] = await db.query(studentsQuery, studentsParams);
    
    // 3. Assign activities to these students
    let rowsInserted = 0;
    if (students.length > 0) {
      const values = [];
      const flatParams = [];
      
      activities.forEach((activity) => {
        students.forEach((student) => {
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

    const safeLabelId = label_id ? label_id : null;
    const activityPlaceholders = activityIds.map(() => "?").join(",");

    // 1. Delete from counselor_added_activities
    let deleteCaaQuery = `DELETE FROM counselor_added_activities WHERE center_id = ? AND master_activity_id IN (${activityPlaceholders})`;
    let deleteCaaParams = [center_id, ...activityIds];

    if (safeLabelId) {
      deleteCaaQuery += ` AND label_id = ?`;
      deleteCaaParams.push(safeLabelId);
    } else {
      deleteCaaQuery += ` AND label_id IS NULL`;
    }

    await db.query(deleteCaaQuery, deleteCaaParams);

    // 2. Fetch all students in this group/sub-group
    let studentsQuery = `SELECT user_id FROM user_assignments WHERE center_id = ?`;
    const studentsParams = [center_id];
    
    if (safeLabelId) {
      studentsQuery += ` AND label_id = ?`;
      studentsParams.push(safeLabelId);
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
