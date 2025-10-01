import { insertRecord } from "../../../utils/dbUtils.js";
import { asyncHandler, checkNumber, mergeParam } from "../../../utils/utils.js";
import db from '../../../config/database.js'
import validateFields from "../../../utils/validation.js";
import bcrypt from "bcrypt"

import crypto from "crypto"


export const counslerRegister = asyncHandler(async (req, resp) => {
const {name,temple,country_code="+91",user_type='counsellor',mobile,email,password,added_from='andorid',device_name="web"}=mergeParam(req)
console.log("recived") 
const { isValid, errors } = validateFields(mergeParam(req), {
        name               : ["required"],
        mobile             : ["required"],
        email              : ["required"],
        password           : ["required"],
        temple          :['required']
       
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
console.log([ 'C', name, email,hashedPassword, mobile,  ,temple,0, added_from || 'WEB',device_name,user_type ]);
    const counsellor = await insertRecord('users', [
        'user_id', 'name',  'email','password', 'mobile','temple', 'status', 'added_from','device_name','user_type'
    ],[ 'C', name, email,hashedPassword, mobile,  ,temple,1, added_from || 'WEB',device_name,user_type ]);
    
    if(!counsellor) return resp.json({status:0, code:405, message: ["Failed to register. Please Try Again"], error: true}); 
    
    const counsller_id = 'CN' + String(counsellor.insertId).padStart(4, '0');
    await db.execute('UPDATE users SET user_id = ? WHERE id = ?', [counsller_id, counsellor.insertId]);
    
    const result = {
        counsller_id     : counsller_id,
        name   : name,
        email  : email,
        country_code : country_code,
        mobile : mobile
    };
    return resp.json({ status:1, code:200, message: ["Counsller registered successfully"], data:{user:result}});
});


export const listcounsler = asyncHandler(async (req, resp) => {
    // const { user_id } = req.body;

    // const { isValid, errors } = validateFields(mergeParam(req), {
    //     user_id: ["required"],
    // });

    // if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const [counsler_list] = await db.execute(`SELECT user_id,name, email 
        FROM users WHERE user_type=? and status=1`,['counsellor']);

    if (counsler_list && counsler_list.length=== 0) {
    return resp.json({ status: 0, code: 404, message: ['No counsler list found for this user'] });
    }
    return resp.json({ status: 1, code: 200, data: counsler_list, message:['counsller list fetch successfully'] });


});

export const studentList = asyncHandler(async (req, resp) => {
    
    const {user_id, page_no=5, sort_by } = mergeParam(req);

     //latitude, longitude are discusable   
    
     const { isValid, errors } = validateFields(mergeParam(req), {
        user_id: ["required"] 
    });//page_no: ["required"]
   
     
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const limit = 2;
    const start = (page_no * limit) - limit;
    
    let countQuery = `SELECT COUNT(*) AS total FROM users where counsller_id=?`;
 

    const [[{ total }]] = await db.execute(countQuery,[user_id]);
    //  console.log("total",total)
    const total_page = Math.ceil(total / limit) || 1;
    

    
    let query = `
            SELECT name,user_id,email,mobile,age
        FROM 
            users where counsller_id=? and user_type=?
          `;
          let queryParams = [user_id,'student'];
    

    const sortOrder = (sort_by === 'd') ? 'DESC' : 'ASC';
    
    //  query +=` ity_station_list.station_id)`;
        query += ` ORDER BY user_id ${sortOrder} LIMIT ${start}, ${limit}`;
    
     const [users] = await db.execute(query, queryParams);
    // console.log(query,queryParams)
   

    return resp.json({
        message : ["Student List fetched successfully!"],
        // data   ,
        data :{users},
        total_page,
        status   : 1,
        code     : 200,
    }); 
});

export const userDetail = asyncHandler(async (req, resp) => {
    const { user_id,student_id} = req.body;

    const { isValid, errors } = validateFields(mergeParam(req), {
        user_id: ["required"],
    });

     let query = `
            SELECT dr.activity_id, u.name, u.user_id, u.email, u.mobile, u.age
        FROM 
            users u  
            JOIN  daily_report dr on dr.user_id=? 
            where u.student_id=?

          `;
          let queryParams = [student_id,student_id,'student'];
          const users= db.execute(query,queryParams);
          

    

    const [activity_details] = await db.execute(`SELECT 
      a.name, a.count_type, a.activity_type, DATE_FORMAT(a.created_at, '%Y-%m-%d') as created_at
       from fix_activities a 
       join 
       order by id DESC
        `);

         const [report] = await db.execute(`SELECT note,count,DATE_FORMAT(created_at, '%W') AS day,
            DATE_FORMAT(created_at, '%Y-%m-%d') as created_at
      from daily_report

       where  user_id=? 
        `,[user_id]);
       const  data={detail:activity_details,
        report
       }
    return resp.json({ status: 1, code: 200,message:['fixactivity data'], data});


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

export const chartdetail = asyncHandler(async (req, resp) => {
    const { user_id, student_id, activity_id } = req.body;

/*
    {
student_id:12,
activties{
date :
note:
count,
count_type

}


    }*/
    const { isValid, errors } = validateFields(mergeParam(req), {
        user_id: ["required"],
    });


    const [user_data] = await db.execute(`SELECT  u.name,u.mobile,u.email,DATE_FORMAT(u.created_at,'%Y-%m-%d') AS created_at  from 
       users u
         where 
        u.user_id=? 
      
        `,[student_id]);
        


        const [activity_details] = await db.execute(`
  SELECT 
      CASE 
          WHEN dr.activity_id LIKE 'f%' THEN 'fix'
          ELSE 'custom'
      END AS activity_source,
      COALESCE(fa.name, ac.name) AS name,
      COALESCE(fa.count_type, ac.count_type) AS count_type,
      COALESCE(fa.activity_type, ac.activity_type) AS activity_type,
      dr.note, dr.count,
      DATE_FORMAT(dr.created_at, '%Y-%m-%d') AS date
  FROM daily_report dr
  LEFT JOIN fix_activities fa ON fa.activity_id = dr.activity_id
  LEFT JOIN activities ac ON ac.id = dr.activity_id
  WHERE dr.user_id = ?
`, [student_id]);

return resp.json({
  status: 1,
  code: 200,
  data: { user_data,activity_details },
  message: ["chart details fetched successfully!"]
});

/*
let activity_details=[];
        if(fActivities.length>0){
             [activity_details] = await db.execute(`
    SELECT fa.name, fa.count_type, fa.activity_type,
           dr.note, dr.count,
           DATE_FORMAT(dr.created_at, '%Y-%m-%d') as date
    FROM daily_report dr
    JOIN fix_activities fa ON fa.activity_id = dr.activity_id
    WHERE dr.user_id = ?
  `, [student_id]);


        }else{
     [activity_details] = await db.execute(`
    SELECT ac.name, ac.count_type, ac.activity_type,
           dr.note, dr.count,
           DATE_FORMAT(dr.created_at, '%Y-%m-%d') as date
    FROM daily_report dr
    JOIN activities ac ON ac.id = dr.activity_id
    WHERE dr.user_id = ?
  `, [student_id]);
        }

          return resp.json({
    status: 1,
    code: 200,
    data: { activity_details },
    message: ["Activity details fetched successfully!"]
  });
        

   
*/
    

        


    // return resp.json({ status: 1, code: 200,message:['activity data'], data });


   

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


export const activitydetail = asyncHandler(async (req, resp) => {
    const { user_id, student_id, activity_id } = req.body;

/*
    {
student_id:12,
activties{
date :
note:
count,
count_type

}


    }*/
    const { isValid, errors } = validateFields(mergeParam(req), {
        user_id: ["required"],
    });


    const [user_data] = await db.execute(`SELECT  u.name,u.mobile,u.email,DATE_FORMAT(u.created_at,'%Y-%m-%d') AS created_at  from 
       users u
         where 
        u.user_id=? 

        `,[student_id]);
           if (activity_id.startsWith('f')) {
     const [activity_details] = await db.execute(`SELECT 
      a.name, a.count_type, a.activity_type, DATE_FORMAT(a.created_at, '%Y-%m-%d') as created_at
       from fix_activities a 
       where  a.activity_id=? limit 1
        `,[activity_id]);

         const [report] = await db.execute(`SELECT note,count,DATE_FORMAT(created_at, '%W') AS day,DATE_FORMAT(created_at, '%Y-%m-%d') as created_at
      from daily_report

       where  user_id=? and activity_id=?
        `,[student_id,activity_id]);
       const  data={detail:activity_details,
        report
       }
    return resp.json({ status: 1, code: 200,message:['fixactivity data'], data:{report}});


} else {

     const [activity_details] = await db.execute(`SELECT 
      a.name, a.count_type, a.activity_type, DATE_FORMAT(a.created_at, '%Y-%m-%d') as created_at
       from activities a 
       where  a.id=? limit 1
        `,[activity_id]);

         const [report] = await db.execute(`SELECT note,count,DATE_FORMAT(created_at, '%W') AS day,DATE_FORMAT(created_at, '%Y-%m-%d') as created_at
      from daily_report

       where  user_id=? and activity_id=?
        `,[student_id,activity_id]);
       const  data={detail:activity_details,
        report
       }


    return resp.json({ status: 1, code: 200,message:['activity data'], data });


} 


       

/*
let activity_details=[];
        if(fActivities.length>0){
             [activity_details] = await db.execute(`
    SELECT fa.name, fa.count_type, fa.activity_type,
           dr.note, dr.count,
           DATE_FORMAT(dr.created_at, '%Y-%m-%d') as date
    FROM daily_report dr
    JOIN fix_activities fa ON fa.activity_id = dr.activity_id
    WHERE dr.user_id = ?
  `, [student_id]);


        }else{
     [activity_details] = await db.execute(`
    SELECT ac.name, ac.count_type, ac.activity_type,
           dr.note, dr.count,
           DATE_FORMAT(dr.created_at, '%Y-%m-%d') as date
    FROM daily_report dr
    JOIN activities ac ON ac.id = dr.activity_id
    WHERE dr.user_id = ?
  `, [student_id]);
        }

          return resp.json({
    status: 1,
    code: 200,
    data: { activity_details },
    message: ["Activity details fetched successfully!"]
  });
        

   
*/
    

        


    // return resp.json({ status: 1, code: 200,message:['activity data'], data });


   

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

