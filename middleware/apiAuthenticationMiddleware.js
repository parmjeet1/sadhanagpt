import db from "../config/database.js";
import { mergeParam } from "../utils/utils.js";

export const apiAuthentication = async (req, resp, next) => {
  try{  

     const token = req.headers["accesstoken"];
    const {user_id} = mergeParam(req);
     
    //  const db=req.db;

  
    if (!token) {
      return resp.status(401).json({ message: 'Access Token key is missing', code: 400, data: {}, status: 0 });
    }
    
    if (!user_id || typeof user_id !== 'string' || user_id.trim() === ''){
      return resp.status(400).json({ message: 'User ID is missing', code: 400, data: {}, status: 0 });
    }
  
    const [[result]] = await db.execute(`SELECT COUNT(*) AS count FROM users WHERE access_token = ? AND user_id = ?`,[token, user_id]);
    
    if (result.count === 0){
      return resp.status(401).json({ message: 'Access Denied. Invalid Access Token key', code: 401, data: {}, status: 0 });
    }
  
    next();
  } catch (error) {
    return resp.status(500).json({message: 'Internal Server Error',code: 500,data: {},status: 0,});
  }
};
