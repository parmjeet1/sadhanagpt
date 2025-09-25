
import { Router } from "express";
import { Authorization } from '../../../middleware/AuthorizationMiddleware.js';
import { addactivity, addSadhna, deleteActivity, editActivity, listActivities, login, studentRegister, todayReport } from "../Controllers/StudentController.js";
import { apiAuthentication } from "../../../middleware/apiAuthenticationMiddleware.js";
const router = Router();

/* -- Api Auth Middleware -- */
const authzRoutes = [
    {method: 'post', path: '/student-register', handler: studentRegister},
    
    {method: 'post', path: '/login', handler: login},  
];
const LoggedinRoute = [
    
    {method: 'post', path: '/add-acitivity', handler: addactivity},
    {method: 'post', path: '/edit-acitivity', handler: editActivity},
    {method: 'post', path: '/delete-acitivity', handler: deleteActivity},
    {method: 'get', path: '/acitivity-list', handler: listActivities},

    {method: 'post', path: '/add-daily-report', handler: addSadhna},

    {method: 'get', path: '/today-report', handler: todayReport},

    

    

      
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