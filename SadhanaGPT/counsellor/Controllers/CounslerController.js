import { insertRecord } from "../../../utils/dbUtils.js";
import { asyncHandler, checkNumber, mergeParam } from "../../../utils/utils.js";
import db from '../../../config/database.js'
import validateFields from "../../../utils/validation.js";
import bcrypt from "bcrypt"

import crypto from "crypto"


export const counslerRegister = asyncHandler(async (req, resp) => {
const {name,temple,country_code="+91",user_type='counsellor',mobile,email,password,added_from='andorid',device_name="web"}=mergeParam(req)
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

    const [[counsler_list]] = await db.execute(`SELECT user_id,name, email 
        FROM users WHERE user_type=? and status=1`,['counsellor']);

    if (counsler_list && counsler_list.length=== 0) {
    return resp.json({ status: 0, code: 404, message: ['No counsler list found for this user'] });
    }
    return resp.json({ status: 1, code: 200, data: counsler_list, message:['counsller list fetch successfully'] });


});