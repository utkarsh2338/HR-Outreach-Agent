import cron from 'node-cron';
import User from '../models/User.js';
import { runAgentForUser } from '../agent/runAgentForUser.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Executes agent decisions for all active users sequentially.
 */
export const runAgentForAllUsers = async () => {
  console.log('[cron] 🤖 Starting unified agent run for active users...');

  try {
    const activeUsers = await User.find({ is_active: true });

    if (activeUsers.length === 0) {
      console.log('[cron] No active users found.');
      return;
    }

    for (let i = 0; i < activeUsers.length; i++) {
      const user = activeUsers[i];
      if (i > 0) {
        await sleep(2000); // 2-second inter-tenant rate throttle
      }

      try {
        console.log(`[cron] Running agent for user ${user.email} (${user._id})...`);
        const result = await runAgentForUser(user._id);
        console.log(`[cron] Completed agent run for ${user.email}:`, result.status, `(${result.items_processed || 0} items)`);
      } catch (userErr) {
        console.error(`[cron] Error running agent for user ${user.email}: ${userErr.message}`);
      }
    }

    console.log('[cron] ✅ Unified agent run finished across all users.');
  } catch (err) {
    console.error(`[cron] Unified agent cron job error: ${err.message}`);
  }
};

/**
 * Registers the unified scheduled agent task in node-cron.
 * Defaults to running every hour or using AGENT_CRON env var.
 */
export const registerUserAgentCron = () => {
  const cronSchedule = process.env.AGENT_CRON || '0 * * * *'; // Default: top of every hour

  if (!cron.validate(cronSchedule)) {
    console.error(`[cron] Invalid AGENT_CRON schedule: "${cronSchedule}". Cron NOT registered.`);
    return;
  }

  cron.schedule(cronSchedule, () => {
    runAgentForAllUsers();
  });

  console.log(`[cron] Registered unified agent cron job with schedule "${cronSchedule}".`);
};
