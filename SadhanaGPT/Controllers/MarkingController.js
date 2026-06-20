import { insertRecord } from "../../utils/dbUtils.js";
import { asyncHandler, mergeParam } from "../../utils/utils.js";
import validateFields from "../../utils/validation.js";

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
