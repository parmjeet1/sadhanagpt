
import { Router } from "express";

import { Register } from "../SadhanaGPT/Controllers/CommonControllers.js";
import { Authorization } from "../middleware/AuthorizationMiddleware.js";
import { addactivity, addSadhna, deleteActivity, detailReport, editActivity, forgetPassword, listActivities, login, logout, studentRegister, todayReportlist, verifyOTP ,Registertest} from "../SadhanaGPT/Student/Controllers/StudentController.js";
import { apiAuthentication } from "../middleware/apiAuthenticationMiddleware.js";
import { activitydetail, chartdetail, counslerRegister, listcounsler, studentList} from "../SadhanaGPT/counsellor/Controllers/CounslerController.js";
const router = Router();


const authzAndAuthRoutes = [
 {method: 'post', path: '/student-register', handler: studentRegister},
 //
 {method: 'post', path: '/register-test', handler: Registertest},

    
    // {method: 'get', path: '/google-call-back', handler: googleLogin},
    
 {method: 'post', path: '/login', handler: login},
    {method: 'post', path: '/logout', handler: logout},  
 

      


      {method: 'post', path: '/counsller-register', handler: counslerRegister},
         
          {method: 'get', path: '/counsller-list', handler: listcounsler},
          
];
    authzAndAuthRoutes.forEach(({ method, path, handler }) => {
    const middlewares = [];
 
    middlewares.push(Authorization);
    // middlewares.push(apiAuthentication);
    router[method](path, ...middlewares, handler);
    });

    const LoggedinRoute = [
        //student routes
        
        {method: 'post', path: '/add-acitivity', handler: addactivity},
        {method: 'post', path: '/edit-acitivity', handler: editActivity},
        {method: 'post', path: '/delete-acitivity', handler: deleteActivity},
        {method: 'get', path: '/acitivity-list', handler: listActivities},
    
        {method: 'post', path: '/add-daily-report', handler: addSadhna},
    
        {method: 'get', path: '/today-report', handler: todayReportlist},
        {method: 'get', path: '/detail-report', handler: detailReport},
             {method: 'post', path: '/forget-password', handler: forgetPassword}, 
     {method: 'post', path: '/verify-otp', handler: verifyOTP},

        // counsler routes
        {method: 'get', path: '/student-list', handler: studentList},
        {method: 'get', path: '/chart-details', handler: chartdetail},
        {method: 'get', path: '/user-activity-details', handler: activitydetail},

        

        //student detail page.
        

    
        
    
        
    
          
    ];
    LoggedinRoute.forEach(({ method, path, handler }) => {
        const middlewares = [Authorization];  // rateLimit
        middlewares.push(apiAuthentication)
            router[method](path, ...middlewares, handler);
    });
    

export default router;