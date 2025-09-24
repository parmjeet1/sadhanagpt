import express from 'express';
import bodyParser from 'body-parser';
import commonRoutes from './routes/CommonRoutes.js';
import StudentRoutes from './SadhanaGPT/Student/Routes/StudentRoutes.js'
import counslerRoutes from './SadhanaGPT/counsellor/Routes/CounsllerRoutes.js'

import path from 'path';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';
import { errorHandler } from './middleware/errorHandler.js';
import dotenv from 'dotenv';
import http from 'http';

dotenv.config();

const app  = express();
app.set('trust proxy', true);
const PORT = process.env.PORT || 3333;


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const corsOptions = {
    origin : [
       
        'http://192.168.1.37:2424',
        'http://192.168.1.29:1112',
      
    ],
    // origin : "*",
    methods: 'GET, POST, PUT, DELETE',
    credentials: true
};

// app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), stripeWebhook);

app.use(cors(corsOptions));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(bodyParser.json());
app.use(cookieParser());


app.use(errorHandler);
app.use('/api',StudentRoutes );
app.use('/counsller-api',counslerRoutes );


app.use('/common',commonRoutes );
const server = http.createServer(app);
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
