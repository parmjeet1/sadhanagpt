import db from "../../config/database.js";
import EmailQueue from '../../utils/emails/emailQueue.js';

import { asyncHandler, mergeParam } from "../../utils/utils.js";
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import validateFields from '../../utils/validation.js';
import { generateOTP,saveOtp, verifyOtp } from '../../utils/utils.js';
import emailQueue from '../../utils/emails/emailQueue.js';
import { queryDB } from "../../utils/dbUtils.js";
import path from 'path';
import fs from 'fs';
export const Register=(req,resp)=>{
const{name, }=mergeParam(req)
   
    return resp.json({
        status:1,
        code:200,
        message:['success']

    })

}

export const sendEmailOtp = asyncHandler(async (req, res) => {
  const { email } = mergeParam(req);
  // Validation

  const { isValid, errors } = validateFields({ email }, { email: ['required', 'email'] });
  if (!isValid) {
    return res.json({ status: 0, code: 422, message: errors });
  }
    // const [[user]] = await db.execute(`SELECT name 
    //     FROM users WHERE email = ?
    //     `, [email],);

    // if (!user) {
    //     return resp.json({
    //     status: 0,
    //     code: 404,
    //     message: ["User not found"],
    //     });
    // }


  // Generate 6-digit OTP
  const otp = generateOTP(4);
  console.log(`Generated OTP for ${email}:`, otp); // Log OTP for debugging (remove in production)
  // Send via existing EmailQueue
  const subject = 'Hare Krishna - Your SadhanaGPT Login OTP';
  const html = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 30px; background-color: #fffaf0; border: 2px solid #ff9933; border-radius: 15px; max-width: 500px; margin: auto;">
        <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #e65c00; margin: 0; font-size: 28px;">Hare Krishna!</h1>
            <p style="color: #8b4513; font-style: italic; margin-top: 5px;">"Chant Hare Krishna and be happy"</p>
        </div>
        
        <div style="background-color: #ffffff; padding: 25px; border-radius: 10px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            <p style="color: #333; font-size: 16px; margin-bottom: 20px;">Please use the following OTP to continue your <b>Sadhana</b> progress on SadhanaGPT:</p>
            
            <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #d35400; padding: 15px; border: 1px dashed #ff9933; display: inline-block; border-radius: 8px; background: #fff9f0;">
                ${otp}
            </div>
            
            <p style="color: #666; font-size: 13px; margin-top: 25px;">This code will remain valid for <b>5 minutes</b>.</p>
        </div>
        <div style="margin-top: 25px; text-align: center; color: #8b4513;">
            <p style="margin: 5px 0; font-weight: bold;">Srila Prabhupada Ki Jaya!</p>
            <p style="font-size: 12px; color: #a0522d; margin-top: 15px;">
                Your servants,<br>
                <b>SadhanaGPT Team</b>
            </p>
        </div>
        
        <hr style="border: none; border-top: 1px solid #ffcc99; margin: 20px 0;">
        <p style="font-size: 11px; color: #bc8f8f; text-align: center;">
            If you did not request this login, please ignore this message.
        </p>
    </div>
  `;

  EmailQueue.addEmail(email, subject, html);
  // Save to memory
  saveOtp(email, otp);
  return res.json({
    status: 1,
    code: 200,
    otp,
    message: 'OTP sent successfully to your email.',
  });
});



export const verifyEmailOtp = asyncHandler(async (req, res) => {
  const { email, otp } = mergeParam(req);
  // Validation
  const { isValid, errors } = validateFields({ email, otp }, {
    email: ['required', 'email'],
    otp:   ['required'],
  });
  if (!isValid) {
    return res.json({ status: 0, code: 422, message: errors });
  }
  // 1. Check OTP memory
  if (!verifyOtp(email, otp)) {
    return res.json({
      status: 0,
      code: 401,
      message: 'Invalid or expired OTP.',
    });
  }
  // 2. Fetch User Details (using your specific query)
  const user_check = await queryDB(
    `SELECT u.access_token, u.user_id, u.name, u.email, u.user_type, 
    uc.counsller_id as primary_counsller_id FROM users u
    LEFT JOIN user_counsellors uc on u.user_id = uc.user_id AND uc.counsllor_type='primary'
    WHERE u.email = ? `,
    [email]
  );
  let responseData = {};
 
  if (user_check) {
    // Existing user found
    responseData = {
      status: "existing_user",
      user_id: user_check.user_id,
      name: user_check.name,
      email: user_check.email,
      user_type: user_check.user_type,
      counsller_id: user_check.primary_counsller_id, // Map the join result
      access_token: user_check.access_token
    };
    return res.json({
      status: 1,
      code: 200,
      message: 'Login successful.',
      data: responseData
    });
  } else {

     responseData = {
        status: "new_user",
        name: "",
        email: email,
        google_id: "",
        picture: ""
      };

    // This case shouldn't hit due to sendEmailOtp check, but kept for safety
    return res.json({
      status: 1,
      code: 200,
      data: responseData,
      message: ["User not found after verification."],
    });
  }
});
export const downloadErrorLog = asyncHandler(async (req, res) => {
    // 1. Define the path to your log file (it is in the backend root)
    const logFilePath = path.join(process.cwd(), 'error.log');

    // 2. Check if the file actually exists
    if (!fs.existsSync(logFilePath)) {
        return res.status(404).json({
            status: 0,
            code: 404,
            message: ["The error.log file does not exist yet."]
        });
    }

    // 3. Set headers to force the browser to download the file
    res.setHeader('Content-Disposition', 'attachment; filename="server-error.log"');
    res.setHeader('Content-Type', 'text/plain');

    // 4. Create a read stream and pipe it to the response
    const fileStream = fs.createReadStream(logFilePath);
    
    fileStream.on('error', (err) => {
        console.error("Error streaming log file:", err);
        res.status(500).send("Error downloading file.");
    });

    fileStream.pipe(res);
});


export const saveSubscription = async (req, res) => {
    try {
        const { user_id, subscription } = req.body;
        const { endpoint, keys } = subscription;
        const updateQuery = `UPDATE users SET reminder_enabled = 1, reminder_days = 3 WHERE user_id = ?`;
        await db.query(updateQuery, [user_id]);
        // 1. Check if this exact browser endpoint is already in the database
        const [existing] = await db.execute(`SELECT id FROM push_subscriptions WHERE endpoint = ?`, [endpoint]);
        
        if (existing.length > 0) {
            // The browser is already subscribed! Do nothing and return success.
            return res.status(200).json({ status: 1, message: "Push notifications  enabled!" });
        }

        // 2. If it is NOT in the database, insert it
        // (The ON DUPLICATE KEY UPDATE protects you from any rare 'auth' clashes)
        await db.execute(`
            INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) 
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                user_id = VALUES(user_id),
                endpoint = VALUES(endpoint),
                p256dh = VALUES(p256dh),
                created_at = CURRENT_TIMESTAMP
        `, [user_id, endpoint, keys.p256dh, keys.auth]);
       
        return res.status(200).json({ status: 1, message: "Push notifications enabled!" });
    } catch (error) {
        console.error("Subscription Error:", error);
        return res.status(500).json({ status: 0, message: "Failed to save subscription" });
    }
};

export const removeSubscription = async (req, res) => {
    try {
        const { user_id } = req.body;

        if (!user_id) {
            return res.status(400).json({ status: 0, message: "user_id is required" });
        }

        // 1. Delete all push subscription records for this user
        const [deleteResult] = await db.execute(
            `DELETE FROM push_subscriptions WHERE user_id = ?`,
            [user_id]
        );
        console.log(`Deleted ${deleteResult.affectedRows} push subscription(s) for user_id: ${user_id}`);

        // 2. Set reminder_enabled = 0 in the users table
        await db.query(
            `UPDATE users SET reminder_enabled = 0 WHERE user_id = ?`,
            [user_id]
        );

        return res.status(200).json({
            status: 1,
            message: "Push notifications disabled successfully",
            deleted_count: deleteResult.affectedRows
        });
    } catch (error) {
        console.error("Unsubscribe Error:", error);
        return res.status(500).json({ status: 0, message: "Failed to remove subscription" });
    }
};
export const updateReminderPreferences = async (req, res) => {
  try {
    const { user_id, reminder_enabled=false, reminder_days=3 } = mergeParam(req);

    // 1. Basic Validation
    const { isValid, errors } = validateFields(mergeParam(req), {
      user_id: ["required"],
      // reminder_enabled: ["required"],
      reminder_days: ["required"]
    });

    if (!isValid) {
        // Handle validation errors...
        return res.status(400).json({ status: 0, errors });
    }

    // Default values if not provided in the request
    const isEnabled = reminder_enabled === true || reminder_enabled === 1 ? 1 : 0;
    const days = parseInt(reminder_days) > 0 ? parseInt(reminder_days) : 3;

    // 2. MySQL Update Query
    const updateQuery = `
      UPDATE users 
      SET reminder_enabled = ?, reminder_days = ? 
      WHERE user_id = ?
    `;
    
    // Execute the query
    await db.query(updateQuery, [isEnabled, days, user_id]);

    // 3. 🧹 CLEANUP: If disabled, delete the old "dead" push subscriptions!
    // if (isEnabled === 0) {
    //   const deletePushQuery = `DELETE FROM push_subscriptions WHERE user_id = ?`;
    //   await db.query(deletePushQuery, [user_id]);
    // }

    // 4. Return Success Response
    return res.status(200).json({
      status: 1,
      message: 'Notification preferences updated successfully.',
      data: {
        reminder_enabled: isEnabled,
        reminder_days: days
      }
    });
  } catch (error) {
    console.error("Error in updateReminderPreferences:", error);
    return res.status(500).json({ 
      status: 0, 
      message: 'Internal server error while updating preferences.' 
    });
  }
};

export const checkPushNotificationStatus = async (req, res) => {
  try {
    const { user_id } = mergeParam(req);
    // 1. Basic Validation
    const { isValid, errors } = validateFields(mergeParam(req), {
      user_id: ["required"]
    });
    if (!isValid) {
      return res.status(400).json({ 
        status: 0, 
        message: 'Validation failed', 
        errors 
      });
    }
    // 2. Query the push_subscriptions table
    const query = `
      SELECT id 
      FROM push_subscriptions 
      WHERE user_id = ? 
      LIMIT 1
    `;
    
    const [result] = await db.query(query, [user_id]);
    
    // Handle the array format depending on your DB wrapper (extracting rows)
    const rows = Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result;
    // 3. If a row exists, they are subscribed
    const isSubscribed = rows && rows.length > 0;
    // 4. Return Success Response
    return res.status(200).json({
      status: 1,
      message: 'Subscription status fetched successfully.',
      isSubscribed: isSubscribed
    });
  } catch (error) {
    console.error("Error in checkPushStatus:", error);
    return res.status(500).json({ 
      status: 0, 
      message: 'Internal server error while checking push status.',
      isSubscribed: false // Safely default to false on error
    });
  }
};