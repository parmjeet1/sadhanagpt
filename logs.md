https://github.com/amandwivedi1357/HabitTracker?utm_source=chatgpt.com



892077567394-bomrlkgfoe32mvu3l1cpd47sqj077acn.apps.googleusercontent.com


mentor_student(id,student_id,mentor_id);
1,u001,u002
1,u001,u003
1,u003,u002
1,u004,u002

now guru c has  3 center
guru c does not care for stduents but just see  over view reports of karanpur , graphic era, UIT  , like guru c  just see how they performing.
guru d  has 3 centers (karanpur(50 student), graphic era(40 stdunet), UIT (70 student))

paramjeet

          
login -> choose mentor or without mentor ->
account_type (defult student);
become mentor add one student , if he logged in then verified as mentor.
u001- rukmani krishn prabhu (mentor of murli krishn prabhu)
u002 - murli krshn prabhu (mentor of manavantar prabhu)
u003 - manavanat prabhu (mentor of slochanand)
u004-slochanand prabhu (mentor of suraj)
u005- suraj prabhu (mentor of jashvir and paramjeet)
u006- jashiveer  (student)
u007- paramjeet (student)
account type(student, mentor), mentor_id(["u002","u003","u004"]), student_id(["u002","u003","u004"]) 
new user -loggedin u001,account_type(student) - become mentor (account type (mentor),students(["u002","u003","u004"])) and updated mentor_id in his mentor_id 

mentor_id in students mentor_id column['u001'];





  index.php?id=de4566
pay and ridect to.
select  url from promt_engineer where id=?

---
## June 23, 2026 - Work Summary

### 1. Fixed Duplicate Daily Reports (Race Condition)
- **Issue**: Frontend sending multiple simultaneous requests caused duplicate rows to be inserted.
- **Fix**: Created and ran `fix_daily_report_db.js` to clear duplicates and added a `UNIQUE INDEX` to the `daily_report` table on `(user_id, activity_id, activity_date)` to block duplicates at the MySQL engine level.

### 2. Fixed Array Misalignments in Student Registration
- **Issue**: The `insertRecord` function uses parallel arrays, but they were misaligned in the registration functions. The system was mapping `age` to `0` and `status` to the user's `age`.
- **Fix**: Re-aligned the column and value arrays in `studentRegister` (and verified `googleLogin`) within `StudentController.js` to ensure `age -> age`, `center_id -> 0`, and `status -> 1`.

### 3. Fixed Server Crashes from Global Error Logger
- **Issue**: The `error.log` file was filling up with `TypeError: Cannot read properties of undefined (reading 'stack')` instead of the actual error message.
- **Fix**: Modified `errorHandler` and `tryCatchErrorHandler` in `middleware/errorHandler.js` to safely check if `err` and `err.stack` exist before calling `.split(",")`. This prevents the logger from crashing when handling string or undefined errors.

### 4. Implemented Global Marking Scheme Fallback Logic
- **Issue**: If a student belonged to a center with no custom marking rules, or if they had no center assigned (`NULL`), they would receive zero marks for activities.
- **Fix**: Updated the `addSadhna` function in `StudentController.js` to first query `marking_rules` using the student's assigned `center_id`. If no rules are found, or if their `center_id` is null, it falls back to querying the Global Default Rule Set where `center_id = 0`.

### 5. Standardized "Remove Student From Group" Unassignment Strategy
- **Issue**: Attempting to unassign a student by passing `center_id = 0` to the assignment API would either fail validation or create a fake group `0`.
- **Strategy Agreed**: To properly unassign a student from a center, `center_id` will be set to `NULL` in the `user_assignments` table. A dedicated endpoint (`/remove-student-from-group`) was outlined for implementation on the frontend to avoid bypassing strict assignment validations.

---
## June 28, 2026 - Work Summary
# Marking Scheme UI & Database Integration Engine

## Business Requirement
Previously, marking schemes and their evaluation conditions were managed via hardcoded mock data in the frontend. 
Now, marking schemes are dynamic and fully configurable through database rules. The counselors need the ability to edit conditions (time bounds, counts, booleans) directly via a smart UI that understands data types and persists these rules centrally to the `marking_rules` MySQL table so the engine can calculate student marks dynamically.

---

## High-Level Architecture
Counselor edits scheme in UI
↓
UI handles provisional vs permanent states
↓
User clicks Save
↓
`saveScheme()` API Call
↓
Node.js `MarkingController`
↓
Bulk wipes old center rules
↓
Iterates and parses string rules to operators
↓
MySQL `marking_rules` database

---

## Technical Design
**Backend**: Added a batch insertion handler that intercepts the complete JSON payload of a marking scheme, wipes the outdated rules, parses textual condition strings into distinct DB columns (`condition_operator` and `condition_value`), and executes batch inserts.
**Frontend**: Implemented intelligent inline-editing inputs inside the React tables that restrict character inputs based on the activity type (e.g. `time` vs `number`), whilst preserving textual suffixes for UI presentation.
**State Management**: Provisional drafting mechanism (when a user begins editing a scheme) is strictly kept out of the backend to avoid mutating active schemas until final confirmation. 
**Validation**: Backend validates presence of `center_id` and payload shape.

==================================================

# FILES MODIFIED

Backend
* SadhanaGPT/Controllers/MarkingController.js
* routes/Routes.js

Frontend
* src/pages/counsellor/SchemeDetail.jsx
* src/pages/counsellor/DefaultSchemeDetail.jsx
* src/api/markingSchemes.js

==================================================

# FOR EVERY MODIFIED FILE

## File
SadhanaGPT/Controllers/MarkingController.js

Purpose
Handles logic for creating, fetching, and updating marking scheme rules in the database.

Functions Modified
### saveMarkingSchemeBatch()
Purpose
Wipes old rules and performs batch insertions of new marking rules for a specific center.
Changes
* Created function from scratch.
* Implemented deletion of existing rules mapped to `center_id`.
* Implemented iteration logic to parse complex nested JSON arrays (`subTables` vs `rows`).
* Implemented prefix matching to convert text conditions to operators (`<`, `<=`, `=`, `>`).
* Executed DB queries.
Reason
To centralize and persist marking rules reliably instead of using local storage caching.

---

## File
src/pages/counsellor/SchemeDetail.jsx

Purpose
Renders the individual tables and rows of a selected marking scheme for a counselor.

Functions Modified
### Render Condition SubTable (JSX Inline logic)
Purpose
Renders the actual rule row inside the React component.
Changes
* Extracted the numerical value from strings (e.g. `120` from `120 min`) to feed into `<input type="number">`.
* Kept suffix strings intact dynamically rendering them alongside the input to prevent browser input-clearing behavior.
* Toggled `type="time"` vs `type="number"` based on the activity data object.
Reason
The default HTML input field clears its value if it encounters non-numeric characters while type="number". We needed it to look seamless while still preserving the suffix context.

---

## File
src/pages/counsellor/DefaultSchemeDetail.jsx

Purpose
Renders the base "Default-Scheme" template representing system-wide fallback rules.

Functions Modified
### initialScheme (Constant)
Purpose
Hardcoded base activities template.
Changes
* Added exact database integer IDs (101 to 116) as `id` fields to each activity block.
Reason
MySQL was silently converting string-based dictionary keys (like `"wake_up_time"`) into `0` during insertion. We explicitly provided the integers to guarantee data integrity.

### handleEditInitiate()
Purpose
Generates a temporary clone for editing.
Changes
* Updated payload construction to map `id` to the newly added `data.id` instead of the object key string.
Reason
Ensures the provisional clone (and subsequent backend API payload) receives the proper integer IDs.

---

## File
src/api/markingSchemes.js

Purpose
Manages frontend API calls and local mock caching for marking schemes.

Functions Modified
### saveScheme()
Purpose
Handles saving of schemes from UI to backend/cache.
Changes
* Added conditional check for `isProvisional`.
* Routed `isProvisional=false` directly to a `postRequest('/save-marking-scheme')` HTTP call.
* Handled fallback ID generation using `Date.now()` to prevent unintended wiping of `center_id=1` (Default Scheme).
Reason
To wire up the UI to the Node.js backend without breaking the provisional drafting feature that allows counselors to cancel edits safely.

==================================================

# NEW FUNCTIONS

Function Name
saveMarkingSchemeBatch()

Location
SadhanaGPT/Controllers/MarkingController.js

Purpose
Takes the entire JSON document of a marking scheme, parses it, and persists every row into the database.

Parameters
* `req` (Express request object): Contains `center_id`, `counsellor_id`, and `activities` array in body.
* `resp` (Express response object)

Return Value
JSON response `{ status, code, message, data: { insertedCount } }`

Dependencies
* `insertRecord`, `deleteRecord` from `utils/dbUtils.js`
* `asyncHandler`, `mergeParam` from `utils/utils.js`

Internal Workflow
Extract parameters
↓
Validate arrays and fields
↓
DELETE all existing rows where `center_id` = target
↓
Loop over `activities` array
↓
Flatten `subTables` and `rows` arrays
↓
Match condition text to mapping table (e.g., "Up To" -> "<=")
↓
Extract operator and pure value
↓
INSERT row into `marking_rules` table
↓
Return total inserted count

==================================================

# FUNCTION CALL FLOW

Counselor clicks Save on Scheme UI
↓
`saveScheme(name, activities, schemeId, false)`
↓
Validate `counsellorId` from LocalStorage
↓
`postRequest('/save-marking-scheme', payload)`
↓
Express Route: `Routes.js` intercepts POST
↓
Middleware checks authentication & counselor role
↓
`MarkingController.saveMarkingSchemeBatch()`
↓
Extract `center_id`
↓
Execute `DELETE FROM marking_rules WHERE center_id = ?`
↓
Parse `activities` JSON array
↓
Map strings to `condition_operator` & `condition_value`
↓
Execute `INSERT INTO marking_rules...` for each row
↓
Return HTTP 200 Response
↓
Frontend updates local storage to keep UI fast
↓
UI shows success toast

==================================================

# DATABASE CHANGES

Tables modified:
None (Using existing `marking_rules` table)

Columns modified/added:
None

Data Correction (Bugfix):
* Corrected the insertion of `master_activity_id` which was erroneously being inserted as `0` due to string keys being passed to MySQL integer column.

==================================================

# SQL CHANGES

Purpose
Clear the database of the old marking scheme for a specific center to allow a fresh bulk insert, avoiding composite key/duplicate row issues.
Input
`center_id`
Output
Deleted Rows Count
Tables
`marking_rules`
```sql
DELETE FROM marking_rules WHERE center_id = ?;
```

Purpose
Insert a parsed, structured marking rule condition into the database.
Input
`center_id`, `master_activity_id`, `remark`, `frequency`, `condition_operator`, `condition_value`, `marks`, `counsellor_id`, `status`
Output
Insert ID
Tables
`marking_rules`
```sql
INSERT INTO marking_rules (center_id, master_activity_id, remark, frequency, condition_operator, condition_value, marks, counsellor_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
```

==================================================

# DATABASE FLOW

Frontend UI marking payload
↓
`MarkingController` parser
↓
`marking_rules` table (Batch inserted)
↓
(Future Implementation)
↓
`calculateBestMarks()` engine
↓
`daily_report.marks`
↓
Counselor Analytics Dashboard

==================================================

# API CHANGES

Endpoint
`/save-marking-scheme`

Method
POST

Controller
`saveMarkingSchemeBatch` in `MarkingController.js`

Request
```json
{
  "center_id": 1,
  "counsellor_id": "u002",
  "name": "Default Scheme",
  "isProvisional": false,
  "activities": [ ... ]
}
```

Response
```json
{
  "status": 1,
  "code": 200,
  "message": ["Successfully saved scheme. Inserted 75 new marking rules."],
  "data": { "insertedCount": 75 }
}
```

Validation
Strict checking that `center_id` and `counsellor_id` exist, and that `activities` is a valid Array.

Authentication
Protected by `Authorization`, `apiAuthentication`, and `checkCounsellor` middlewares.

Business Logic
Batch replace logic.

Breaking Changes
None.

==================================================

# FRONTEND CHANGES

Components modified
`SchemeDetail.jsx`, `DefaultSchemeDetail.jsx`

State
Maintained existing `schemeDraft` state, but updated the input `onChange` handlers to manipulate strings intelligently by re-attaching text suffixes before pushing to state.

API Integration
Replaced the local storage hard-save in `saveScheme` with a `postRequest` pointing to the real `/save-marking-scheme` backend route.

UI Changes
Condition inputs dynamically shift between HTML5 `<input type="time">` and `<input type="number">` based on the contextual activity's required data type.

==================================================

# BUSINESS LOGIC CHANGES

Previously
Scheme editing was fully mocked. Saving a scheme dumped the raw JSON representation into local storage cache.

Now
Scheme Edit
↓
Provisional Clone (Draft) created locally
↓
User Edits Data (Inputs adapt to data types)
↓
User Hits Save
↓
Payload validated
↓
Backend drops old rules
↓
Backend converts UI English ("Up To") to Math ("<=")
↓
MySQL Database stores structured rules
↓
Frontend syncs local cache to avoid visual reload

==================================================

# DATA TRANSFORMATIONS

Input (from UI payload)
`condition`: "Up To 22:15"
`id`: "sleep_time" (Prior to bugfix)

↓
Frontend mapping
↓

`id`: 101

↓
Backend Parser
↓

Operator extracted
`condition_operator`: "<="

↓
Value extracted
`condition_value`: "22:15"

↓
Database
`master_activity_id` = 101
`condition_operator` = '<='
`condition_value` = '22:15'

==================================================

# DEPENDENCIES

Utilities
`insertRecord`, `deleteRecord` from `utils/dbUtils.js`
`mergeParam`, `asyncHandler` from `utils/utils.js`

External libraries
None specific to this feature. Standard Express and React hooks.

==================================================

# EDGE CASES HANDLED

Provisional Cloning
↓
If a user hits 'Edit', the frontend creates a temporary draft (`isProvisional = true`). If this hit the database, it would instantly overwrite the live marking scheme with an unapproved draft. Logic was added to block `isProvisional` requests from calling the backend API.

String Keys from UI Components
↓
The UI was relying on string keys (`wake_up_time`) for indexing. When sent to the database, MySQL was implicitly coercing these strings to integer `0` for the `master_activity_id` column, breaking the relational link. Hardcoded integer `id` values were directly injected into the UI templates to ensure correct data types.

Null Scheme IDs
↓
If a scheme did not have an ID yet, the system defaulted to `center_id = 1` (the global default). This meant a counselor creating a new custom scheme would accidentally wipe the global default rules on their first save. Fixed by generating a fallback `Date.now()` integer to act as the `center_id` for brand new custom schemes.

==================================================

# TESTING

Manual testing
Performed end-to-end testing of editing default and custom marking schemes via the UI.

Database verification
Inspected the `marking_rules` table to confirm `master_activity_id` was no longer `0` and that 70+ rows were accurately generating proper mathematical operators in `condition_operator`.

API verification
Verified `POST /save-marking-scheme` returns 200 OK and logs no errors.

Frontend testing
Verified that modifying numeric inputs retains the text suffixes (e.g. `min`, `Days`).

==================================================

# FILES ADDED

None.

==================================================

# FILES REMOVED

None.

==================================================

# BREAKING CHANGES

None. The frontend continues to populate its visual UI from the local cache, meaning no components crash while waiting for the upcoming GET endpoints.

==================================================

# MIGRATION STEPS

No SQL schema migration scripts are required. Data correctness was fixed inside application logic.

==================================================

# KNOWN ISSUES

Pending work
The UI currently POSTS data to the backend correctly, but it still **READS** from local storage mock data on page load. A GET API must be implemented to fetch the saved marking rules.

Technical debt
`master_activity_id` values (101 to 116) are hardcoded into frontend constants (`DefaultSchemeDetail.jsx` and `markingSchemes.js`). Ideally, these should be dynamically fetched from the database's master activities table on load.

==================================================

# NEXT DEVELOPER NOTES

Where development should continue:
1. Backend: Implement `GET /marking-scheme/:center_id` inside `MarkingController.js`. It should fetch rows from `marking_rules`, grouping them by `master_activity_id`.
2. Frontend: Update `getSchemeActivities()` inside `src/api/markingSchemes.js` to hit this new GET endpoint using `getRequest()` instead of reading from `localStorage`.
3. Frontend: Format the fetched data back into the grouped JSON structure the UI expects (`{ activities: [ { rows: [] } ] }`).

Important assumptions:
The system assumes `center_id` is synonymous with the `schemeId`. All marking rules are globally mapped against the center they apply to. `center_id = 1` represents the Global Default Scheme.