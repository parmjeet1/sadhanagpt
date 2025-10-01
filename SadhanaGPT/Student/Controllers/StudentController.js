
import { configDotenv } from "dotenv";
import bcrypt from "bcrypt"

import crypto from "crypto"

import { asyncHandler, checkNumber, generateOTP, mergeParam } from "../../../utils/utils.js";
import validateFields from "../../../utils/validation.js";
import { deleteRecord, insertRecord, queryDB, updateRecord } from "../../../utils/dbUtils.js";
import moment from "moment";
import db from '../../../config/database.js'
import emailQueue from "../../../utils/emails/emailQueue.js";

export const studentRegister = asyncHandler(async (req, resp) => {
const {name,age,country_code="+91",user_type,mobile,email,password,counsller_id,added_from='andorid',device_name="web"}=mergeParam(req)
 const { isValid, errors } = validateFields(mergeParam(req), {
        name               : ["required"],
        mobile             : ["required"],
        email              : ["required"],
        password           : ["required"],
        counsller_id       : ["required"],
        user_type          :['required']
       
    });
    // console.log("mergeParam(req)",mergeParam(req))
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });


    const res = checkNumber("+91", mobile);
    if(res.status == 0) return resp.json({ status:0, code:422, message: [res.msg] });
console.log("db.execute type:", typeof db.execute);

    const [[isExist]] = await db.execute(`
        SELECT COUNT(*) AS check_email FROM users AS u WHERE u.email = ?
    `, [ email ]);
  
    // if(isExist.check_mob > 0 || isExist.rsa_mob > 0 ) return resp.json({ status:0, code:422, message: ['The provided number already exists.'] });
    if(isExist.check_email > 0 ) return resp.json({ status:0, code:422, message: ['Email already registered.'] }); 
    
const hashedPassword = await bcrypt.hash(password, 10);

    const student = await insertRecord('users', [
        'user_id', 'name',  'email','password', 'mobile','age', 'status','counsller_id', 'added_from','device_name','user_type'
    ],[ 'U', name, email,hashedPassword, mobile,  0,age,counsller_id, added_from || 'WEB',device_name,user_type ]);
    
    if(!student) return resp.json({status:0, code:405, message: ["Failed to register. Please Try Again"], error: true}); 
    
    const user_id = 'U' + String(student.insertId).padStart(4, '0');
    await db.execute('UPDATE users SET user_id = ? WHERE id = ?', [user_id, student.insertId]);
    
    const result = {
        student_id     : user_id,
        name   : name,
        email  : email,
        country_code : country_code,
        mobile : mobile
    };
    return resp.json({ status:1, code:200, message: ["User registered successfully"], data:{user:result}});
});
export const login = asyncHandler(async (req, resp) => {
    const { email,password ,fcm_token} = mergeParam(req);

    const { isValid, errors } = validateFields(mergeParam(req), {
        email: ["required"], password: ["required"]
    });

    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const [[user_data]] = await db.execute(
        `SELECT user_id, name, email,user_type,counsller_id, password FROM users WHERE email = ? LIMIT 1`,
        [email]
    );

    if(!user_data) return resp.json({ status: 0, code: 422, message: ["The Email number is not registered with us. Kindly sign up."] });
    const isMatch = await bcrypt.compare(password, user_data.password);
    if (!isMatch) return resp.json({ status:0, code:405, error:true, message: ["Password is incorrect"] });
    if (user_data.status == 2) return resp.json({ status:0, code:405, error:true, message: ["You can not login as your status is inactive. Kindly contact to customer care"] });
    
    const token = crypto.randomBytes(12).toString('hex');
    console.log("token",token)
    const [update] = await db.execute(`UPDATE users SET access_token = ?, status = ? WHERE email = ?`, [token, 1, email]);
    if(update.affectedRows > 0){
        const result = {
            // image_url    : `${process.env.DIR_UPLOADS}rider_profile/`,
            user_id     : user_data.user_id,
            name   : user_data.name,
            email  : user_data.email,
            mobile : user_data.mobile,
            access_token : token,
            user_type:user_data.user_type,
            // counsller_id:user_data.counsller_id
        };
        user_data.user_type === 'student' ?  result.counsller_id=user_data.counsller_id : null;
    
        return resp.json({status:1, is_logged_id:1,  code:200, message: ["successfully Logged in !"], data: {user:result}});
    }else{
        return resp.json({status:0, code:405, message: ["Oops! There is something went wrong! Please Try Again"], error: true});
    }
});

export const logout = asyncHandler(async (req, resp) => {
    const {user_id} = mergeParam(req);
    if (!user_id) return resp.json({ status: 0, code: 422, message: ["Rider Id is required"] });
    
    const rider = queryDB(`SELECT EXISTS (SELECT 1 FROM users WHERE user_id = ?) AS rider_exists`, [user_id]);
    if(!rider) return resp.json({status:0, code:400, message: 'user ID Invalid!'});

    const update = await updateRecord('users', {status:0, access_token: ""},['user_id'], [user_id]);
    
    if(update.affectedRows > 0){
        return resp.json({status: 1, code: 200, message: 'Logged out sucessfully'});
    }else{
        return resp.json({status: 0, code: 405, message: 'Oops! There is something went wrong! Please Try Again'});
    }

});
export const forgetPassword = asyncHandler(async (req, resp) => {
    const {user_id} = mergeParam(req);
    if (!user_id) return resp.json({ status: 0, code: 422, message: ["user Id is required"] });
 const [[user_data]] = await db.execute(
        `SELECT user_id, name, email FROM users WHERE user_id = ? LIMIT 1`,
        [user_id]
    );

    if(!user_data) return resp.json({ status: 0, code: 422, message: ["The Email number is not registered with us. Kindly sign up."] });
    
     const otp_value=generateOTP(4);
    const htmlUser = `<html>
           <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
  <h3 style="color:#2c3e50;">Hello ${user_data.name},</h3>

  <p>We received a request to verify your account. Please use the following One-Time Password (OTP) to complete the process:</p>

  <p style="font-size: 20px; font-weight: bold; color: #e74c3c; letter-spacing: 3px;">
    ${otp_value}
  </p>

  <p>This OTP is valid for <strong>10 minutes</strong>. Please do not share it with anyone for security reasons.</p>

  <p>If you did not request this verification, please ignore this email.</p>

  <br/>
  <p>Best regards, <br/> <strong>Gita Joy</strong></p>
</body>
        </html>`;
  const mail_sent=   emailQueue.addEmail(user_data.email, 'OTP', htmlUser);
  console.log("mail_sent",mail_sent)
  
    updateRecord('users',{otp:otp_value},['user_id'],[user_id]);
  
  return resp.json({status: 1, code:200, message: "OTP has been sent to your Email. "});


});

export const verifyOTP = asyncHandler(async (req, resp) => {
    const {user_id,otp} = mergeParam(req);
    if (!user_id) return resp.json({ status: 0, code: 422, message: ["user Id is required"] });
 const [[user_data]] = await db.execute(
        `SELECT otp FROM users WHERE user_id = ? LIMIT 1`,
        [user_id]
    );

    if(!user_data) return resp.json({ status: 0, code: 422, message: ["The Email number is not registered with us. Kindly sign up."] });
    console.log("user_data",user_data.otp,'user otp ',otp)
    
    if(user_data.otp!=otp || user_data.otp==0){
  return resp.json({status: 0, code:201, message: ['Invailed OTP']});
    }
      updateRecord('users',{otp:''},['user_id'],[user_id]);
  
  return resp.json({status: 1, code:200, message: "verfied"});
  


});

export const addactivity= asyncHandler(async(req,resp)=>{

    const {user_id,name,description,count_type,activity_type}=req.body;
const { isValid, errors } = validateFields(mergeParam(req), {
        user_id: ["required"], 
        name: ["required"],
        // description: ["required"],
        count_type: ["required"],
        activity_type: ["required"],
        
    });

    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const insert_data=await insertRecord('activities',['user_id','name','description','count_type','activity_type'],
        [user_id,name,description,count_type,activity_type]
     );
     if(insert_data){
        return resp.json({status:1,code:200,message:['activity added successfully!']})
     }


})
export const editActivity = asyncHandler(async (req, resp) => {
    const { user_id,activtiy_id, name, description, count_type, activity_type } = req.body;

    const { isValid, errors } = validateFields(mergeParam(req), {
        activtiy_id: ["required"],
        name: ["required"],
        description: ["required"],
        count_type: ["required"],
        activity_type: ["required"],
    });

    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });



    const update_data = await updateRecord(
    'activities',
    { name, description, count_type, activity_type }, // updates object
    ['id','user_id'], // whereColumns
    [activtiy_id,user_id] // whereValues
);

    if (update_data) {
        return resp.json({ status: 1, code: 200, message: ['Activity updated successfully!'] });
    }

    return resp.json({ status: 0, code: 500, message: ['Failed to update activity'] });
});
export const deleteActivity = asyncHandler(async (req, resp) => {
    const { activity_id,user_id } = req.body;

    const { isValid, errors } = validateFields(mergeParam(req), {
        activity_id: ["required"],
    });

    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const delete_data = await deleteRecord('activities', 'id', activity_id);

    if (delete_data) {
        return resp.json({ status: 1, code: 200, message: ['Activity deleted successfully!'] });
    }

    return resp.json({ status: 0, code: 500, message: ['Failed to delete activity'] });
});

export const listActivities = asyncHandler(async (req, resp) => {
    const { user_id } = req.body;

    const { isValid, errors } = validateFields(mergeParam(req), {
        user_id: ["required"],
    });

    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const [activities] = await db.execute(`SELECT name,description,count_type,count_type
        
         FROM activities WHERE user_id=?`,[user_id]);

         const [fix_activities] = await db.execute(`SELECT name,description,count_type,count_type,activity_type
        
         FROM fix_activities`);


    if (activities && activities.length=== 0) {
    return resp.json({ status: 0, code: 404, message: ['No activities found for this user'] });
    }
    const data ={
        fix_activities:fix_activities,
        user_activities:activities

    }
    return resp.json({ status: 1, code: 200, data });


});
export const todayReportlist = asyncHandler(async (req, resp) => {
    const { user_id } = req.body;

    const { isValid, errors } = validateFields(mergeParam(req), {
        user_id: ["required"],
    });
const today_date = moment().format("YYYY-MM-DD");
console.log("today_date",today_date)

    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const [user_activities] = await db.execute(`SELECT 
      a.name, a.count_type, a.activity_type, r.note,r.activity_id,r.count
       from daily_report r
       JOIN activities a on r.activity_id=a.id
       where  r.user_id=? and DATE(r.created_at)=?
        `,[user_id,today_date]);

        const [fix_activities] = await db.execute(`SELECT 
      fa.name, fa.count_type, fa.activity_type, dr.note,dr.activity_id,dr.count
       from daily_report dr 
        JOIN fix_activities fa ON  fa.acitivity_id=dr.activity_id
       where  dr.user_id=? and DATE(dr.created_at)=?
        `,[user_id,today_date]);

       


    // if (!fix_activities && fix_activities.length=== 0 || user_activities) {
    // return resp.json({ status: 0, code: 404, message: ['No activities found for this user'] });
    // }
    const data ={
        fix_activities:fix_activities,
        user_activities:user_activities

    }
    return resp.json({ status: 1, code: 200, data });


});
export const detailReport = asyncHandler(async (req, resp) => {
    const { user_id, activity_id } = req.body;

    const { isValid, errors } = validateFields(mergeParam(req), {
        user_id: ["required"],
    });

    if (activity_id.startsWith('f')) {
     const [activity_details] = await db.execute(`SELECT 
      a.name, a.count_type, a.activity_type, DATE_FORMAT(a.created_at, '%Y-%m-%d') as created_at
       from fix_activities a 
       where  a.activity_id=? limit 1
        `,[activity_id]);

         const [report] = await db.execute(`SELECT note,count,DATE_FORMAT(created_at, '%W') AS day,DATE_FORMAT(created_at, '%Y-%m-%d') as created_at
      from daily_report

       where  user_id=? and activity_id=?
        `,[user_id,activity_id]);
       const  data={detail:activity_details,
        report
       }
    return resp.json({ status: 1, code: 200,message:['fixactivity data'], data});


} else {

     const [activity_details] = await db.execute(`SELECT 
      a.name, a.count_type, a.activity_type, DATE_FORMAT(a.created_at, '%Y-%m-%d') as created_at
       from activities a 
       where  a.id=? limit 1
        `,[activity_id]);

         const [report] = await db.execute(`SELECT note,count,DATE_FORMAT(created_at, '%W') AS day,DATE_FORMAT(created_at, '%Y-%m-%d') as created_at
      from daily_report

       where  user_id=? and activity_id=?
        `,[user_id,activity_id]);
       const  data={detail:activity_details,
        report
       }


    return resp.json({ status: 1, code: 200,message:['activity data'], data });


}

// console.log("today_date",today_date)



    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
/*
    const [user_activities] = await db.execute(`SELECT 
      a.name, a.count_type, a.activity_type, r.note,r.activity_id,r.count
       from daily_report r
       JOIN activities a on r.activity_id=a.id
       where  r.user_id=? and DATE(r.created_at)=?
        `,[user_id,today_date]);

        const [fix_activities] = await db.execute(`SELECT 
      fa.name, fa.count_type, fa.activity_type, dr.note,dr.activity_id,dr.count
       from daily_report dr 
        JOIN fix_activities fa ON  fa.acitivity_id=dr.activity_id
       where  dr.user_id=? and DATE(dr.created_at)=?
        `,[user_id,today_date]);

       


    // if (!fix_activities && fix_activities.length=== 0 || user_activities) {
    // return resp.json({ status: 0, code: 404, message: ['No activities found for this user'] });
    // }
    const data ={
        fix_activities:fix_activities,
        user_activities:user_activities

    }*/


});


export const addSadhna= asyncHandler(async(req,resp)=>{

    const {activity_id,count,note,time,user_id}=req.body;
//    const today_time = moment().format("YYYY-MM-DD HH:mm:ss");
const today_date = moment().format("YYYY-MM-DD");

    console.log("time now",today_date)
    const check_today_sadhana=await queryDB(`SELECT id  from daily_report where
         activity_id=? and DATE(created_at)=? `,[activity_id,today_date]);
    
    if(check_today_sadhana){ 
         console.log("created_at",check_today_sadhana.created_at)
  updateRecord('daily_report',{count,note},['id'],[check_today_sadhana.id]);
        return resp.json({status:0,code:200,message:['updated activity!']}) }
     const insert_data=await insertRecord('daily_report',['user_id','activity_id','note','count'],
        [user_id,activity_id,note,count]);
     if(insert_data){
        return resp.json({status:1,code:200,message:['today report added successfully!']})
     }


})

export const editSadhna= asyncHandler(async(req,resp)=>{

    const {activity_id,note,time}=req.body;
    const today_time=moment("Y-M-D h:i:s");
     const update_data=await db.execute(`UPDATE daily_report set note=? time=? where activity_id=?`,[note,time,activity_id]);
     if(update_data){
        return resp.josn({status:1,code:200,message:['report updated successfully!']})
     }
})


export const activity_list= asyncHandler(async(req,resp)=>{

    const {user_id}=req.body;
    const today_time=moment("Y-M-D h:i:s");
     const [[user_activity]]=await db.execute(`SELECT * FROM  user_activity where user_id=?`,[user_id]);

     if(user_activity){
        return resp.josn({status:1,code:200,data:user_activity,message:['report updated successfully!']})
     }
     

})