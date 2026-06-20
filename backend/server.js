import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import net from 'net';
import { spawn } from 'child_process';

import connectDB from './src/config/db.js';
import { initSocket } from './src/config/socket.js';
import authRoutes from './src/routes/authRoutes.js';
import settingsRoutes from './src/routes/settingsRoutes.js';
import facultyRoutes from './src/routes/facultyRoutes.js';
import classRoutes from './src/routes/classRoutes.js';
import subjectRoutes from './src/routes/subjectRoutes.js';
import timetableRoutes from './src/routes/timetableRoutes.js';
import attendanceRoutes from './src/routes/attendanceRoutes.js';
import leaveRoutes from './src/routes/leaveRoutes.js';
import dashboardRoutes from './src/routes/dashboardRoutes.js';
import roleRoutes from './src/routes/roleRoutes.js';
import periodRoutes from './src/routes/periodRoutes.js';
import academicYearRoutes from './src/routes/academicYearRoutes.js';
import { startComplianceJob } from './src/utils/complianceJob.js';

dotenv.config();

if (process.env.DEBUG) {
  process.env.DEBUG = process.env.DEBUG.toLowerCase();
}

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
initSocket(server);

// Database Connection
connectDB();

// Start timetable compliance monitoring background job
startComplianceJob();

// Create uploads folder if missing
const uploadsDir = path.resolve('uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Global Middlewares
const allowedOrigins = [
  'https://ink-edu-platform.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.error(`CORS Blocked Origin: ${origin}`);
    return callback(new Error(`CORS: Origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Cache-Control',
    'Pragma',
    'Expires'
  ],
  exposedHeaders: ['Content-Disposition']
}));

app.options('*', cors());
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  const originalJson = res.json;
  res.json = function (body) {
    console.log(`Response Status: ${res.statusCode}, Body:`, JSON.stringify(body).slice(0, 500));
    return originalJson.apply(this, arguments);
  };
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});
app.use(express.json({ limit: '50mb' })); // Support base64 image payloads
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Register Routes
app.use('/api/auth', authRoutes);
app.use('/api/school-settings', settingsRoutes);
app.use('/api/faculty', facultyRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/timetables', timetableRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/periods', periodRoutes);
app.use('/api/academic-years', academicYearRoutes);

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ status: false, message: err.message || 'Something went wrong on the server' });
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Node Server running on port ${PORT}`);
  // Trigger restart for Vidya AI backend updates 4
  const isPortOpen = (port) => {
    return new Promise((resolve) => {
      const client = new net.Socket();
      client.once('connect', () => {
        client.destroy();
        resolve(true); // Port is in use
      });
      client.once('error', () => {
        resolve(false); // Port is free
      });
      client.connect(port, '127.0.0.1');
    });
  };

  const startVidyaAI = async () => {
    let vidyaBase = process.env.VIDYA_AI_PATH;

    if (vidyaBase) {
      vidyaBase = path.resolve(vidyaBase);
    } else {
      const possibleDirs = [
        path.join(process.cwd(), '..', 'vidya-ai'),
        path.join(process.cwd(), '..', '..', 'Vidya-AI-main'),
        path.join(process.cwd(), '..', 'Vidya-AI-main'),
        'C:\\Users\\srake\\Downloads\\Vidya-AI-main\\Vidya-AI-main',
        'C:\\Users\\srake\\Downloads\\Vidya-AI-main'
      ];
      for (const dir of possibleDirs) {
        if (fs.existsSync(dir) && (fs.existsSync(path.join(dir, 'backend')) || fs.existsSync(path.join(dir, 'Vidya-AI-main', 'backend')))) {
          vidyaBase = dir;
          break;
        }
      }
      if (!vidyaBase) {
        vidyaBase = path.join(process.cwd(), '..', 'vidya-ai');
      }
    }

    if (fs.existsSync(path.join(vidyaBase, 'Vidya-AI-main', 'backend'))) {
      vidyaBase = path.join(vidyaBase, 'Vidya-AI-main');
    }

    if (!fs.existsSync(path.join(vidyaBase, 'backend')) || !fs.existsSync(path.join(vidyaBase, 'frontend'))) {
      console.warn(`[Warning] Vidya AI integration directories not found at: "${vidyaBase}"`);
      console.warn('To resolve this, please define the correct absolute path to the Vidya AI folder in face-auth/backend/.env as: VIDYA_AI_PATH=...');
      return;
    }

    try {
      const backendRunning = await isPortOpen(8081);
      if (!backendRunning) {
        const pyPath = path.join(vidyaBase, 'backend', '.venv', 'Scripts', 'python.exe');
        const serverPy = path.join(vidyaBase, 'backend');
        console.log('Spawning Vidya AI Backend on port 8081...');
        
        const backendLogPath = path.join(process.cwd(), 'vidya_backend.log');
        const outBackend = fs.openSync(backendLogPath, 'a');
        const vidyaBackend = spawn(pyPath, ['-m', 'uvicorn', 'server:app', '--host', '0.0.0.0', '--port', '8081'], {
          cwd: serverPy,
          stdio: ['ignore', outBackend, outBackend],
          shell: true
        });
        vidyaBackend.on('error', (err) => {
          console.error('Vidya AI Backend spawn error:', err);
        });
        vidyaBackend.on('exit', (code, signal) => {
          console.log(`Vidya AI Backend exited with code ${code} and signal ${signal}`);
        });
      } else {
        console.log('Vidya AI Backend is already running on port 8081.');
      }

      const frontendRunning = await isPortOpen(3002);
      if (!frontendRunning) {
        console.log('Spawning Vidya AI Frontend on port 3002...');
        const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
        
        const frontendLogPath = path.join(process.cwd(), 'vidya_frontend.log');
        const outFrontend = fs.openSync(frontendLogPath, 'a');
        const vidyaFrontend = spawn(npmCmd, ['run', 'start'], {
          cwd: path.join(vidyaBase, 'frontend'),
          stdio: ['ignore', outFrontend, outFrontend],
          shell: true,
          env: {
            ...process.env,
            PORT: '3002',
            BROWSER: 'none'
          }
        });
        vidyaFrontend.on('error', (err) => {
          console.error('Vidya AI Frontend spawn error:', err);
        });
        vidyaFrontend.on('exit', (code, signal) => {
          console.log(`Vidya AI Frontend exited with code ${code} and signal ${signal}`);
        });
      } else {
        console.log('Vidya AI Frontend is already running on port 3002.');
      }
    } catch (err) {
      console.error('Failed to auto-start Vidya AI services:', err);
    }
  };

  startVidyaAI();
});

// Trigger restart 5

