import { getPaginatedData } from "../../utils/dbUtils.js";
import { asyncHandler, mergeParam } from "../../utils/utils.js";
import validateFields from "../../utils/validation.js";
import db from "../../config/database.js";
import crypto from "crypto";

export const getMentorSelectableActivities = asyncHandler(async (req, resp) => {
  try {
    const {
      page_no = 1,
      search_text = "",
      rowSelected,
    } = mergeParam(req);

    const { isValid, errors } = validateFields(mergeParam(req), {
      page_no: ["required"],
    });

    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const params = {
      tableName: "activities",
      columns: `id AS master_activity_id, name, 
      description, unit, target, activity_type, status, counsellor_id,
      CASE
    WHEN status = 1 THEN 'default'
    WHEN status = 2 THEN 'selectable'
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
          1, // own_by = 1 (assigned by mentor)
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
