
import { Router } from "express";

import { Register } from "../SadhanaGPT/Controllers/CommonControllers.js";
import { Authorization } from "../middleware/AuthorizationMiddleware.js";
const router = Router();


const authzAndAuthRoutes = [
      { method: 'get',  path: '/register',           handler: Register }  
];
    authzAndAuthRoutes.forEach(({ method, path, handler }) => {
    const middlewares = [];
 
    middlewares.push(Authorization);
    // middlewares.push(apiAuthentication);
    router[method](path, ...middlewares, handler);
    });

export default router;