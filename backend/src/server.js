import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import contactsRouter from './routes/contacts.js';
import batchDraftRouter from './routes/batchDraft.js';
import sendTestRouter from './routes/sendTest.js';
import generateDraftRouter from './routes/generateDraft.js';
import approveSendRouter from './routes/approveSend.js';
import profileRouter from './routes/profile.js';
import { registerDailyDraftJob } from './jobs/dailyDraftJob.js';
import { registerFollowupJob } from './jobs/followupJob.js';
import { registerReplyPollJob } from './jobs/replyPollJob.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

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
  await connectDB();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);

    // Register cron jobs only when explicitly enabled
    if (process.env.ENABLE_CRON === 'true') {
      console.log('[cron] ENABLE_CRON=true — registering scheduled jobs...');
      registerDailyDraftJob();
      registerFollowupJob();
      registerReplyPollJob();
    } else {
      console.log('[cron] ENABLE_CRON not set — scheduled jobs are disabled.');
    }
  });
};

startServer();
