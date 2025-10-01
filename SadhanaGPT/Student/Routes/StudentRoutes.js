
import { Router } from "express";
import { Authorization } from '../../../middleware/AuthorizationMiddleware.js';
import { addactivity, addSadhna, deleteActivity, detailReport, editActivity, forgetPassword, listActivities, login, studentRegister, todayReportlist } from "../Controllers/StudentController.js";
import { apiAuthentication } from "../../../middleware/apiAuthenticationMiddleware.js";
const router = Router();

/* -- Api Auth Middleware -- */
const authzRoutes = [
    {method: 'post', path: '/student-register', handler: studentRegister},
    
    {method: 'post', path: '/login', handler: login},  
        {method: 'post', path: '/forget-password', handler: forgetPassword},  

];
const LoggedinRoute = [
    
    {method: 'post', path: '/add-acitivity', handler: addactivity},
    {method: 'post', path: '/edit-acitivity', handler: editActivity},
    {method: 'post', path: '/delete-acitivity', handler: deleteActivity},
    {method: 'get', path: '/acitivity-list', handler: listActivities},

    {method: 'post', path: '/add-daily-report', handler: addSadhna},

    {method: 'get', path: '/today-report', handler: todayReportlist},
    {method: 'get', path: '/detail-report', handler: detailReport},

    

    

      
];

authzRoutes.forEach(({ method, path, handler }) => {
    const middlewares = [Authorization];  // rateLimit
        router[method](path, ...middlewares, handler);
});

LoggedinRoute.forEach(({ method, path, handler }) => {
    const middlewares = [Authorization];  // rateLimit
    middlewares.push(apiAuthentication)
        router[method](path, ...middlewares, handler);
});


export default router;