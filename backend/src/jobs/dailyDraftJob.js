import cron from 'node-cron';
import JobLog from '../models/JobLog.js';
import { runBatchDraftGeneration } from '../services/batchDraftService.js';

/**
 * Daily Draft Job
 *
 * Runs on a configurable cron schedule (env: DAILY_DRAFT_CRON, default: "0 9 * * *" = 9am daily).
 * Selects up to DAILY_SEND_LIMIT contacts with status "queued" or "new",
 * generates a personalized draft for each, and stores them as draft_pending EmailLogs.
 *
 * Does NOT send any email — all drafts require manual approval via:
 *   POST /api/email-logs/:id/approve-and-send
 */
export const registerDailyDraftJob = () => {
  const schedule = process.env.DAILY_DRAFT_CRON || '0 9 * * *';
  const limit = parseInt(process.env.DAILY_SEND_LIMIT || '20', 10);
  const delayMs = parseInt(process.env.GROQ_BATCH_DELAY_MS || '1500', 10);

  if (!cron.validate(schedule)) {
    console.error(`[dailyDraftJob] Invalid cron expression: "${schedule}". Job not registered.`);
    return;
  }

  cron.schedule(schedule, async () => {
    const runAt = new Date();
    console.log(`[dailyDraftJob] Starting at ${runAt.toISOString()} — limit: ${limit}`);

    let jobStatus = 'success';
    let summary = {};
    let errorMsg;

    try {
      const { drafted, failed } = await runBatchDraftGeneration({ limit, delayMs });

      summary = {
        contacts_processed: drafted.length + failed.length,
        drafted: drafted.length,
        failed: failed.length,
        drafted_ids: drafted.map((d) => d.draft_id),
        failures: failed.map((f) => ({ contact_id: f.contact_id, reason: f.reason }))
      };

      if (drafted.length === 0 && failed.length === 0) {
        jobStatus = 'skipped';
        console.log('[dailyDraftJob] No eligible contacts found (queued or new). Skipping.');
      } else if (failed.length > 0 && drafted.length === 0) {
        jobStatus = 'failed';
        console.error(`[dailyDraftJob] All ${failed.length} contacts failed.`);
      } else if (failed.length > 0) {
        jobStatus = 'partial';
        console.warn(`[dailyDraftJob] Partial: ${drafted.length} drafted, ${failed.length} failed.`);
      } else {
        console.log(`[dailyDraftJob] Complete: ${drafted.length} drafts generated.`);
      }
    } catch (err) {
      jobStatus = 'failed';
      errorMsg = err.message;
      console.error(`[dailyDraftJob] Job crashed: ${err.message}`);
    }

    // Always persist the run result to JobLog
    try {
      await JobLog.create({
        job_name: 'daily_draft',
        run_at: runAt,
        status: jobStatus,
        summary,
        error: errorMsg
      });
    } catch (logErr) {
      console.error(`[dailyDraftJob] Failed to write JobLog: ${logErr.message}`);
    }
  });

  console.log(`[dailyDraftJob] Registered — schedule: "${schedule}", limit: ${limit}`);
};
