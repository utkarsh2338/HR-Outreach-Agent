import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import authRouter from './routes/auth.js';
import contactsRouter from './routes/contacts.js';
import batchDraftRouter from './routes/batchDraft.js';
import sendTestRouter from './routes/sendTest.js';
import generateDraftRouter from './routes/generateDraft.js';
import approveSendRouter from './routes/approveSend.js';
import profileRouter from './routes/profile.js';
import { registerUserAgentCron } from './jobs/userAgentCron.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true
  })
);
app.use(express.json());
app.use(cookieParser());

// Routes
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'hr-outreach-agent',
    message: 'HR Outreach Agent Backend is operational',
    timestamp: new Date().toISOString(),
    cron_enabled: process.env.ENABLE_CRON === 'true'
  });
});

// Auth route
app.use('/api/auth', authRouter);

// Profile & Resume route
app.use('/api/profile', profileRouter);

// Static-path contact routes must be mounted BEFORE parameterized /:id routes
app.use('/api/contacts', contactsRouter);
app.use('/api/contacts', batchDraftRouter);
// Parameterized /:id contact routes
app.use('/api/contacts', generateDraftRouter);
app.use('/api/contacts', sendTestRouter);
// Email log routes
app.use('/api/email-logs', approveSendRouter);

// Global 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start Server
const startServer = async () => {
  app.listen(PORT, () => {
    console.log(`HR Outreach Agent Local Server running on port ${PORT}`);
    console.log(`Local Storage Mode Active (Data files in backend/data/ & CSV trimming enabled)`);

    if (process.env.ENABLE_CRON === 'true') {
      console.log('[cron] ENABLE_CRON=true — registering unified agent job...');
      registerUserAgentCron();
    } else {
      console.log('[cron] ENABLE_CRON not set — scheduled jobs are disabled.');
    }
  });
};

startServer();
