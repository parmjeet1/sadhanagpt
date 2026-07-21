import { insertRecord, deleteRecord } from "../../../utils/dbUtils.js";
import { asyncHandler, mergeParam } from "../../../utils/utils.js";
import validateFields from "../../../utils/validation.js";
import db from "../../../config/database.js";

export const addMarkingRule = asyncHandler(async (req, resp) => {
  try {
    const {
      master_activity_id,
      center_id,
      remark,
      frequency,
      condition_operator,
      condition_value,
      marks,
      counsellor_id,
      status = 1
    } = mergeParam(req);

    // Validate required fields
    const { isValid, errors } = validateFields(mergeParam(req), {
      master_activity_id: ["required"],
      center_id: ["required"],
      frequency: ["required"],
      condition_operator: ["required"],
      condition_value: ["required"],
      marks: ["required"],
      counsellor_id: ["required"],
    });

    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const columns = [
      "center_id",
      "master_activity_id",
      "remark",
      "frequency",
      "condition_operator",
      "condition_value",
      "marks",
      "counsellor_id",
      "status"
    ];

    const values = [
      center_id,
      master_activity_id,
      remark || "",
      frequency,
      condition_operator,
      condition_value,
      marks,
      counsellor_id,
      status
    ];

    // Insert into marking_rules table
    const result = await insertRecord("marking_rules", columns, values);

    if (result.affectedRows > 0) {
      return resp.json({
        status: 1,
        code: 200,
        message: ["Marking rule added successfully!"],
        data: { insertId: result.insertId }
      });
    } else {
      return resp.json({
        status: 0,
        code: 400,
        message: ["Failed to add marking rule."],
      });
    }
  } catch (error) {
    console.error("Error adding marking rule:", error);
    return resp.json({
      status: 0,
      code: 500,
      message: ["Error adding marking rule."],
    });
  }
});

export const saveMarkingSchemeBatch = asyncHandler(async (req, resp) => {
  try {
    const { center_id, counsellor_id, activities } = mergeParam(req);

    if (!center_id || !counsellor_id || !Array.isArray(activities)) {
      return resp.json({ status: 0, code: 422, message: ["Missing required fields or activities must be an array"] });
    }

    // Delete existing rules for this center_id
    await deleteRecord("marking_rules", "center_id", center_id);

    const columns = [
      "center_id",
      "master_activity_id",
      "remark",
      "frequency",
      "condition_operator",
      "condition_value",
      "marks",
      "counsellor_id",
      "status"
    ];

    let insertedCount = 0;

    for (const activity of activities) {
      // Clean activity id if it's a string like 'def1' or mock id
      let master_activity_id = activity.id;
      if (typeof master_activity_id === 'string' && master_activity_id.startsWith('def')) {
        master_activity_id = parseInt(master_activity_id.replace('def', ''), 10) || 1;
      }

      const frequency = activity.badge || "Daily";

      const processRows = async (rows) => {
        if (!rows) return;
        for (const row of rows) {
          const conditionStr = row.condition || "";
          
          let operator = "=";
          let value = conditionStr;
          
          const rulesMap = {
            "Before": "<=",
            "After": ">=",
            "Exact Time": "=",
            "At Least": ">=",
            "Up To": "<=",
            "Yes": "=",
            "No": "="
          };

          for (const [rule, op] of Object.entries(rulesMap)) {
            if (conditionStr.toLowerCase().startsWith(rule.toLowerCase())) {
              operator = op;
              value = conditionStr.substring(rule.length).trim();
              if (rule === "Yes" || rule === "No") {
                value = rule;
              }
              break;
            }
          }

          const values = [
            center_id,
            master_activity_id,
            "", // remark
            frequency,
            operator,
            value,
            row.marks || 0,
            counsellor_id,
            1 // status
          ];

          await insertRecord("marking_rules", columns, values);
          insertedCount++;
        }
      };

      if (activity.subTables) {
        for (const sub of activity.subTables) {
          await processRows(sub.rows);
        }
      } else if (activity.rows) {
        await processRows(activity.rows);
      }
    }

    return resp.json({
      status: 1,
      code: 200,
      message: ["Marking scheme saved successfully!"],
      data: { insertedCount }
    });

  } catch (error) {
    console.error("Error saving marking scheme batch:", error);
    return resp.json({
      status: 0,
      code: 500,
      message: ["Error saving marking scheme."],
    });
  }
});

export const getMarkingRules = asyncHandler(async (req, resp) => {
  try {
    const { center_id = 0, label_id = "" } = mergeParam(req);
    const safeCenterId = db.escape(center_id);

    const query = `
      SELECT 
        mr.*, 
        a.name AS activity_name, 
        a.unit AS activity_unit, 
        a.activity_type,
        a.description AS activity_description
      FROM marking_rules mr
      JOIN activities a ON mr.master_activity_id = a.id
      WHERE mr.center_id = ${safeCenterId} AND mr.status = 1
      ORDER BY mr.master_activity_id ASC, mr.marks DESC
    `;

    const [rows] = await db.query(query);

    return resp.json({
      status: 1,
      code: 200,
      message: ["Marking rules fetched successfully!"],
      data: rows
    });
  } catch (error) {
    console.error("Error fetching marking rules:", error);
    return resp.json({
      status: 0,
      code: 500,
      message: ["Error fetching marking rules."]
    });
  }
});
