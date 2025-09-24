
import { Router } from "express";
import { Authorization } from '../../../middleware/AuthorizationMiddleware.js';
import { apiAuthentication } from "../../../middleware/apiAuthenticationMiddleware.js";
import { counslerRegister, listcounsler } from "../Controllers/CounslerController.js";
const router = Router();

/* -- Api Auth Middleware -- */
const authzRoutes = [
    {method: 'post', path: '/counsller-register', handler: counslerRegister},
   
    {method: 'get', path: '/counsller-list', handler: listcounsler},

];
const LoggedinRoute = [
 
    // {method: 'post', path: '/counsller-list', handler: listActivities},

    // {method: 'post', path: '/daily-report', handler: dailyRport},


    

    

      
];

authzRoutes.forEach(({ method, path, handler }) => {
    const middlewares = [Authorization];  // rateLimit
        router[method](path, ...middlewares, handler);
});

// LoggedinRoute.forEach(({ method, path, handler }) => {
//     const middlewares = [Authorization];  // rateLimit
//     middlewares.push(apiAuthentication)
//         router[method](path, ...middlewares, handler);
// });


export default router;