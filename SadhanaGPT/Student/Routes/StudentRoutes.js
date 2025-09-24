
import { Router } from "express";
import { Authorization } from '../../../middleware/AuthorizationMiddleware.js';
import { addactivity, addSadhna, deleteActivity, editActivity, listActivities, login, studentRegister } from "../Controllers/StudentController.js";
import { apiAuthentication } from "../../../middleware/apiAuthenticationMiddleware.js";
const router = Router();

/* -- Api Auth Middleware -- */
const authzRoutes = [
    {method: 'post', path: '/student-register', handler: studentRegister},
    
    {method: 'post', path: '/login', handler: login},  
];
const LoggedinRoute = [
    {method: 'post', path: '/student-register', handler: addSadhna},
    {method: 'post', path: '/add-acitivity', handler: addactivity},
    {method: 'post', path: '/edit-acitivity', handler: editActivity},
    {method: 'post', path: '/delete-acitivity', handler: deleteActivity},
    {method: 'post', path: '/acitivity-list', handler: listActivities},

    // {method: 'post', path: '/daily-report', handler: dailyRport},


    

    

      
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