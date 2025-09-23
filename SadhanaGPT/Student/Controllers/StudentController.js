
import { configDotenv } from "dotenv";
import bcrypt from "bcrypt"

import crypto from "crypto"

import { asyncHandler, checkNumber, mergeParam } from "../../../utils/utils.js";
import validateFields from "../../../utils/validation.js";
import { deleteRecord, insertRecord, queryDB, updateRecord } from "../../../utils/dbUtils.js";
import moment from "moment";
import db from '../../../config/database.js'

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

export const addactivity= asyncHandler(async(req,resp)=>{

    const {user_id,name,description,count_type,activity_type}=req.body;
const { isValid, errors } = validateFields(mergeParam(req), {
        user_id: ["required"], 
        name: ["required"],
        description: ["required"],
        count_type: ["required"],
        activity_type: ["required"],
        
    });

    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const insert_data=await insertRecord('activities',['user_id','name','description','count_type','activity_type'],
        [user_id,name,description,count_type,activity_type]
     );
     if(insert_data){
        return resp.json({status:1,code:200,message:['report added successfully!']})
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

    const activities = await getRecords(
        'activities',
        ['id', 'user_id', 'name', 'description', 'count_type', 'activity_type', 'created_at', 'updated_at'],
        'user_id',
        user_id
    );

    if (activities && activities.length > 0) {
        return resp.json({ status: 1, code: 200, data: activities });
    }

    return resp.json({ status: 0, code: 404, message: ['No activities found for this user'] });
});


export const addSadhna= asyncHandler(async(req,resp)=>{

    const {activity_id,note,time}=req.body;
    const today_time=moment("Y-M-D h:i:s");
    check_today_sadhana=await queryDB(`SELECT *  from daily_report where activity_id=? created_at=? `,[activity_id,today_time]);
    if(check_today_sadhana){ return resp.json({status:0,code:200,message:['You have already subbmit for this activity!']}) }
     const insert_data=await insertRecord('daily_report',{activity_id,note});
     if(insert_data){
        return resp.josn({status:1,code:200,message:['report added successfully!']})
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