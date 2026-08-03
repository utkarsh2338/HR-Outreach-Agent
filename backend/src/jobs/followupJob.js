import cron from 'node-cron';
import Contact from '../models/Contact.js';
import EmailLog from '../models/EmailLog.js';
import JobLog from '../models/JobLog.js';
import { generateFollowupDraft } from '../services/followupEmailService.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Follow-up Job
 *
 * Runs on a configurable cron schedule (env: FOLLOWUP_CRON, default: "30 9 * * *" = 9:30am daily).
 * Finds contacts where:
 *   - status = "sent"
 *   - followup_count < MAX_FOLLOWUPS (env, default 2)
 *   - last_contacted_at older than FOLLOWUP_DAYS days (env, default 5)
 *   - next_followup_at is null OR has passed (i.e., <= now)
 *
 * For each eligible contact:
 *   - Generates a short follow-up draft via followupEmailService (Groq + fallback)
 *   - Stores it as a draft_pending EmailLog
 *   - Increments followup_count
 *   - Sets next_followup_at = now + FOLLOWUP_DAYS days (for any potential third-party extension)
 *
 * Does NOT send — all drafts require manual approval.
 */
export const registerFollowupJob = () => {
  const schedule = process.env.FOLLOWUP_CRON || '30 9 * * *';
  const followupDays = parseInt(process.env.FOLLOWUP_DAYS || '5', 10);
  const maxFollowups = parseInt(process.env.MAX_FOLLOWUPS || '2', 10);
  const delayMs = parseInt(process.env.GROQ_BATCH_DELAY_MS || '1500', 10);

  if (!cron.validate(schedule)) {
    console.error(`[followupJob] Invalid cron expression: "${schedule}". Job not registered.`);
    return;
  }

  cron.schedule(schedule, async () => {
    const runAt = new Date();
    console.log(`[followupJob] Starting at ${runAt.toISOString()} — followupDays: ${followupDays}, maxFollowups: ${maxFollowups}`);

    let jobStatus = 'success';
    let summary = {};
    let errorMsg;

    try {
      const cutoffDate = new Date(Date.now() - followupDays * 24 * 60 * 60 * 1000);
      const now = new Date();

      // Find all contacts eligible for a follow-up
      const eligibleContacts = await Contact.find({
        status: 'sent',
        followup_count: { $lt: maxFollowups },
        last_contacted_at: { $lte: cutoffDate },
        $or: [
          { next_followup_at: null },
          { next_followup_at: { $exists: false } },
          { next_followup_at: { $lte: now } }
        ]
      }).sort({ last_contacted_at: 1 }); // oldest last-contact first

      console.log(`[followupJob] ${eligibleContacts.length} contacts eligible for follow-up`);

      if (eligibleContacts.length === 0) {
        jobStatus = 'skipped';
        summary = { contacts_processed: 0, drafted: 0, failed: 0 };
        console.log('[followupJob] No contacts due for follow-up. Skipping.');
      } else {
        const drafted = [];
        const failed = [];

        for (let i = 0; i < eligibleContacts.length; i++) {
          const contact = eligibleContacts[i];

          if (i > 0) {
            await sleep(delayMs);
          }

          try {
            const { subject, textBody, htmlBody, llm_generated } = await generateFollowupDraft(contact);

            // Store as draft_pending EmailLog
            const draft = await EmailLog.create({
              contact_id: contact._id,
              direction: 'outbound',
              subject,
              body: textBody,
              html_body: htmlBody,
              llm_generated,
              log_status: 'draft_pending'
            });

            // Increment followup_count and set next_followup_at
            const nextFollowupAt = new Date(Date.now() + followupDays * 24 * 60 * 60 * 1000);
            await Contact.findByIdAndUpdate(contact._id, {
              $inc: { followup_count: 1 },
              next_followup_at: nextFollowupAt,
              status: 'draft_pending'
            });

            drafted.push({
              contact_id: contact._id,
              contact_name: contact.name,
              contact_email: contact.email,
              company: contact.company,
              followup_count: contact.followup_count + 1,
              draft_id: draft._id,
              llm_generated
            });

            console.log(`[followupJob] Draft queued for ${contact.email} (follow-up #${contact.followup_count + 1})`);
          } catch (err) {
            console.error(`[followupJob] Failed for ${contact.email}: ${err.message}`);
            failed.push({
              contact_id: contact._id,
              contact_name: contact.name,
              contact_email: contact.email,
              reason: err.message
            });
          }
        }

        summary = {
          contacts_checked: eligibleContacts.length,
          drafted: drafted.length,
          failed: failed.length,
          drafted_ids: drafted.map((d) => d.draft_id),
          failures: failed.map((f) => ({ contact_id: f.contact_id, reason: f.reason }))
        };

        if (failed.length > 0 && drafted.length === 0) {
          jobStatus = 'failed';
        } else if (failed.length > 0) {
          jobStatus = 'partial';
        }

        console.log(`[followupJob] Complete: ${drafted.length} follow-up drafts, ${failed.length} failed.`);
      }
    } catch (err) {
      jobStatus = 'failed';
      errorMsg = err.message;
      console.error(`[followupJob] Job crashed: ${err.message}`);
    }

    // Always persist the run result to JobLog
    try {
      await JobLog.create({
        job_name: 'followup_draft',
        run_at: runAt,
        status: jobStatus,
        summary,
        error: errorMsg
      });
    } catch (logErr) {
      console.error(`[followupJob] Failed to write JobLog: ${logErr.message}`);
    }
  });

  console.log(`[followupJob] Registered — schedule: "${schedule}", followupDays: ${followupDays}, maxFollowups: ${maxFollowups}`);
};
