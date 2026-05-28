# Agent Instructions: SadhanaGPT Backend Development Protocol

> [!IMPORTANT]

> **CRITICAL PROTOCOL FOR ALL AI CODING ASSISTANTS & AGENTS (e.g., Antigravity, Cursor, Copilot, etc.):**
> Before designing any implementation plans, writing scripts, or making edits in this repository, **you are strictly required to read and fully parse this entire document**. 
> Pay close attention to the **Database Schema & Spelling Gotchas** section, the utility functions reuse guidelines, and the **Plan, Implement, Review Workflow System** detailed below. Adhering to these constraints is mandatory to prevent system regressions and bugs.

Welcome! This document provides global instructions, technical guidelines, codebase quirks, and structural mappings for developers and agentic coding assistants working on the **SadhanaGPT Backend**.

---

## 🛠️ Tech Stack & Key Components

1. **Runtime & Framework**: Node.js (configured as ES Modules: `"type": "module"`) running an **Express** web server (`server.js`).
2. **Database**: MySQL managed via `mysql2/promise` connection pool (`./config/database.js`).
3. **Task Scheduling**: `node-cron` runs automated tasks such as weekly reports and inactivity reminders.
4. **Mailing System**: Custom in-memory `EmailQueue` (`./utils/emails/emailQueue.js`) built on top of `nodemailer` (`./utils/emails/mailer.js`). It enforces a **1-second throttle** between email dispatches to prevent TCP spam blocks by Gmail/SMTP hosts.
5. **Notifications**: Firebase Cloud Messaging (FCM) via push notification helpers (`./utils/utils.js`).
6. **File Uploads**: Multer-based uploading utility (`./utils/fileUpload.js`).

---

## ⚙️ Environment Configuration

To run the backend, create a `.env` file in the root directory. The file must include the following keys:
* **Server Port**: `PORT` (e.g., `2424`)
* **MySQL Database Connection**: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD`
* **Security & Auth Secrets**: `JWT_SECRET`, `API_AUTH_KEY`, `SESSION_SECRET`
* **SMTP/Mailing Settings**: `GMAIL_USER`, `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_ENCRYPTION`
* **Google OAuth Keys**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `BACKEND_URL`, `FRONT_END_CALL_BACK_URL`
* **VAPID Keys**: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`
* **AI Analysis**: `OPENAI_API_KEY` (Used to compile report insights)

## 🚀 Getting Started & Local Run

1. **Install Dependencies**:
   ```bash
   npm install
   ```
2. **Start in Development Mode** (runs server with nodemon reloading):
   ```bash
   npm run dev
   ```
3. **Start in Production Mode**:
   ```bash
   npm start
   ```

---

## 📂 Directory Structure

* **`server.js`**: Application entry point, configures Middlewares, CORS options, Session/Passport, and boots the Cron schedules.
* **`routes/`**: Contains route mappings:
  * [Routes.js](./routes/Routes.js): Master router containing authenticated, authorization-guarded, and role-based endpoints.
  * [auth.js](./routes/auth.js): Authentication routes (e.g., Google OAuth).
* **`middleware/`**: 
  * [AuthorizationMiddleware.js](./middleware/AuthorizationMiddleware.js): Verifies general API key security (`API_AUTH_KEY`).
  * [apiAuthenticationMiddleware.js](./middleware/apiAuthenticationMiddleware.js): Validates individual student/counsellor access tokens (`accesstoken` header) and roles.
  * [errorHandler.js](./middleware/errorHandler.js): Global express error handler.
* **`SadhanaGPT/`**: Central application logic.
  * **`Student/Controllers/`**: Student-centric features such as registering, profile management, and daily reports (Sadhana). Contains [StudentController.js](./SadhanaGPT/Student/Controllers/StudentController.js).
  * **`Mentors/`**: Counsellor-centric features including center management, label assignment, and note taking. Contains [CounslerController.js](./SadhanaGPT/Mentors/CounslerController.js) (Note spelling).
  * **`cronjobs/`**: Cron-triggered notifications: [Email-notificatiion.js](./SadhanaGPT/cronjobs/Email-notificatiion.js), [WebPushNotification.js](./SadhanaGPT/cronjobs/WebPushNotification.js), and [WhatsAppMessage.js](./SadhanaGPT/cronjobs/WhatsAppMessage.js).
* **`utils/`**: Utility helpers:
  * [dbUtils.js](./utils/dbUtils.js): Abstracted wrappers for `insertRecord`, `updateRecord`, `deleteRecord`, `queryDB`, and `getPaginatedData`.
  * [utils.js](./utils/utils.js): Parameter merging, random generators, push notification client, custom formatting, and wrappers.
  * [validation.js](./utils/validation.js): Form validation utility.

---

## ⚠️ Database Schema & Spelling Gotchas (CRITICAL)

The database schema contains several field name inconsistencies. **You must verify spelling against existing code/database fields before performing updates.**

### 1. Counselor Spelling (`counsller` vs `counsellor` vs `counslor`)
* **`users` table column**: `counsller_id` (Double 'l', no second 'o').
* **`user_counsellors` table columns**: `user_id` (student) & `counsller_id` (mentor).
* **`center_list` table column**: `counsller_id`.
* **`user_assignments` table column**: `counsellor_id` (Proper English spelling: double 'l' AND 'o').
* **`labels_list` table column**: `counsellor_id` (Proper English spelling).
* **Controller file path**: `SadhanaGPT/Mentors/CounslerController.js` (Single 'l', no 'o').

### 2. Label Spelling (`lable` vs `label`)
* **Route paths**: `/add-lable`, `/lable-list`, `/edit-lable`, `/delete-lable` (Spelled `lable`).
* **Database tables**: `labels_list` and `label_centers` (Spelled `label`).
* **Column names**: `label_id` in tables `user_assignments` and `label_centers`.

### 3. Activity Spelling (`acitivity` vs `activity`)
* **Route paths**: `/add-acitivity`, `/edit-acitivity`, `/delete-acitivity` (CRUD endpoints are spelled `acitivity`).
* **Route list path**: `/activity-list` (Spelled `activity-list`).
* **Database tables**: `fix_activities` (Spelled `activities` / `activity`).
* **Column names**: `activity_id` is standard, but watch out for legacy references such as `acitivity_id`.

### 4. Student Spelling (`studnet` vs `student`)
* **Request payloads**: Sometimes uses variables like `studnet_id` (e.g., in `addCounsller` endpoint parameters).
* **Folder name**: Spelled correctly as `Student`.

---

## 💻 Coding Guidelines & Conventions

1. **Request Parameter Parsing**: Always use the `mergeParam(req)` helper to extract values from both `req.query` and `req.body`:
   ```javascript
   const { user_id, email } = mergeParam(req);
   ```
2. **API Responses**: Always structure API responses using the `ResponseData` utility or standard response objects. Note that the `message` field **must be an array of strings** in cases of validation errors:
   ```javascript
   return resp.json({
     status: 0,
     code: 422,
     message: ["Email is already registered."]
   });
   ```
3. **Async Error Handling**: Wrap all route controller functions with the `asyncHandler` decorator to pass errors down to Express's global handler:
   ```javascript
   export const myRouteHandler = asyncHandler(async (req, resp) => { ... });
   ```
4. **Database Operations**: Prefer using the helpers in `utils/dbUtils.js` (e.g. `insertRecord`, `updateRecord`, `deleteRecord`, `queryDB`, `getPaginatedData`) to ensure query parameters are safely bound and connection pooling is managed correctly.
5. **Leverage Reusable Utilities**: Before implementing any custom helper logic, check `utils/utils.js` for existing reusable functions. Key helper methods already implemented include:
   * `generateOTP(length)`: For OTP code generation.
   * `checkNumber(countryCode, num)`: Phone number syntax and length validation.
   * `sendNotification(type, payload, created_by, receive_id)` / `createNotification(...)` / `pushNotification(...)`: Handling in-app and FCM push alerts.
   * `formatDateTimeInQuery(columns)` / `formatDateInQuery(columns)`: Formatting timestamps inside SELECT queries.
   * `numberToWords(num)`: Currency converter.
   * `uploadFiles` / `handleFileUpload` inside `utils/fileUpload.js`: Uploading logic.
6. **No Placeholders**: Never write mock responses or temporary placeholders when implementing new features. Generate and use actual dynamic data or save artifacts accordingly.

---

## 🔄 The Plan, Implement, Review Workflow System

Whenever you perform edits or introduce new features in this codebase, you **MUST** follow this structured protocol:

### Phase 1: Plan
1. **Analyze**: Search the codebase for similar implementations to match style. Check database mappings to avoid the spelling gotchas.
2. **Document**: Create an implementation plan (`implementation_plan.md` in the app's metadata/brain directory) describing what will change, files affected, and the exact database field names to be targeted.
3. **Clarify**: List any ambiguities or questions in the implementation plan. Set `request_feedback = true` in the plan's metadata and wait for explicit user approval before writing code.

### Phase 2: Implement
1. **Prepare**: Create the `task.md` checklist in the brain directory.
2. **Write Code**: Implement the changes incrementally. Mark tasks in `task.md` as in-progress (`[/]`) or complete (`[x]`).
3. **Preserve Integrity**: Do not delete unrelated comments, docstrings, or structure. Follow ES Module imports.
4. **Ensure Safety**: Handle database exceptions and release connections properly.

### Phase 3: Review
1. **Verify**: Ensure the code runs. Write tests or dry-run scripts inside the `/scratch/` directory.
2. **Log Results**: Create `walkthrough.md` documenting changes, verified endpoints, and screenshots/logs.
3. **Reflect**: Note if any new database quirks or spelling discrepancies were introduced or discovered, and update this `agent.md` instruction file accordingly.
