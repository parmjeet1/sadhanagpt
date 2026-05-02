import axios from 'axios';
import db from '../../config/database.js'
import webpush from 'web-push';
import dotenv from 'dotenv';
webpush.setVapidDetails(
    'mailto:your-email@example.com', // Must be a valid email or URL
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);


export const sendSadhanaPushReminders = async () => {
    try {
        console.log("Starting Saturday Sadhana WEB PUSH reminders...");
        // Fetch only students who actually have a push subscription linked
        const [students] = await db.execute(`
            SELECT 
                u.name AS student_name,
                c.name AS mentor_name,
                ps.endpoint,
                ps.p256dh,
                ps.auth
            FROM user_counsellors uc
            JOIN users u ON uc.user_id = u.user_id
            JOIN users c ON uc.counsller_id = c.user_id
            JOIN push_subscriptions ps ON u.user_id = ps.user_id
           `);
       console.log("students", students);
        // WHERE c.auto_report_status = 1
        if (students.length === 0) {
            console.log("No students with push subscriptions found. Skipping.");
            return;
        }
        for (const student of students) {
            const studentName = student.student_name || "Student";
            const mentorName = student.mentor_name || "your Mentor";
            
           
            // Format the message
           const message = `Hare Krishna ${studentName}, kindly fill your sadhna for the last week in SadhnaGPT App because tomorrow the weekly report will be sent to your mentor ${mentorName}.`;
            // Prepare the subscription object required by web-push
            const pushSubscription = {
                endpoint: student.endpoint,
                keys: {
                    p256dh: student.p256dh,
                    auth: student.auth
                }
            };
            // The payload must be a stringified JSON
            const pushPayload = JSON.stringify({
                title: 'Sadhana Reminder',
                body: message
            });
            try {
                // Send the push notification
                await webpush.sendNotification(pushSubscription, pushPayload);
                // console.log(`✅ Push sent to ${studentName}`);
            } catch (pushErr) {
                // If statusCode is 410, it means the user manually blocked notifications or the subscription expired
                if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
                    console.log(`Subscription expired/revoked for ${studentName}. Removing from DB.`);
                    await db.execute(`DELETE FROM push_subscriptions WHERE endpoint = ?`, [student.endpoint]);
                } else {
                    console.error(` Push Failed for ${studentName}:`, pushErr.message);
                }
            }
            // Small delay to prevent rate limits
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        console.log("✅ All Web Push reminders processed.");
    } catch (error) {
        console.error("Critical error in sendSadhanaPushReminders:", error);
    }
};