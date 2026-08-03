import cron from 'node-cron';
import EmailLog from '../models/EmailLog.js';
import Contact from '../models/Contact.js';
import JobLog from '../models/JobLog.js';
import Settings from '../models/Settings.js';
import { pollInbox } from '../services/gmailInboxService.js';
import { classifyReply } from '../services/replyClassifierService.js';

const SETTINGS_KEY = 'reply_poll_last_run_at';

// Contact statuses that should be updated when an inbound reply is received
// "interested" → contact stays as-is but needs_attention is set
// Other classifications update status to "replied"
const CLASSIFICATION_TO_STATUS = {
  interested: 'replied',    // Keep status as "replied", set needs_attention=true
  not_interested: 'replied',
  auto_reply: 'replied',
  bounce: 'replied',
  out_of_office: 'replied',
  unclear: 'replied'
};

/**
 * Reply Poll Job
 *
 * Polls the Gmail inbox for new messages received since the last run.
 * Matches replies to outbound EmailLog entries via gmail_thread_id.
 * Classifies each reply using Groq and logs it as an inbound EmailLog.
 * Updates contact status to "replied" and sets needs_attention=true for
 * "interested" classifications.
 *
 * Does NOT auto-close, auto-reject, or take any action beyond triage.
 * All decisions remain with the human operator.
 */
export const registerReplyPollJob = () => {
  const schedule = process.env.REPLY_POLL_CRON || '*/30 * * * *'; // every 30 min
  const defaultLookbackHours = parseInt(process.env.REPLY_POLL_LOOKBACK_HOURS || '48', 10);

  if (!cron.validate(schedule)) {
    console.error(`[replyPollJob] Invalid cron expression: "${schedule}". Job not registered.`);
    return;
  }

  cron.schedule(schedule, async () => {
    const runAt = new Date();
    console.log(`[replyPollJob] Starting at ${runAt.toISOString()}`);

    let jobStatus = 'success';
    let summary = {};
    let errorMsg;

    try {
      // Determine polling window: since last run, or fallback to N hours ago
      const lastPollValue = await Settings.get(SETTINGS_KEY);
      const sinceDate = lastPollValue
        ? new Date(lastPollValue)
        : new Date(Date.now() - defaultLookbackHours * 60 * 60 * 1000);

      console.log(`[replyPollJob] Polling inbox since: ${sinceDate.toISOString()}`);

      // Fetch all outbound thread IDs we've sent (only those that have a thread ID)
      const sentLogs = await EmailLog.find({
        direction: 'outbound',
        log_status: 'sent',
        gmail_thread_id: { $exists: true, $ne: null }
      }).select('gmail_thread_id contact_id');

      const threadToContactMap = new Map();
      for (const log of sentLogs) {
        threadToContactMap.set(log.gmail_thread_id, log.contact_id);
      }

      if (threadToContactMap.size === 0) {
        console.log('[replyPollJob] No outbound emails with thread IDs found. Skipping inbox poll.');
        jobStatus = 'skipped';
        summary = { inbox_messages_fetched: 0, matched: 0, classified: 0, already_logged: 0 };
        await Settings.set(SETTINGS_KEY, runAt.toISOString());
        await JobLog.create({ job_name: 'reply_poll', run_at: runAt, status: jobStatus, summary });
        return;
      }

      // Poll inbox for new messages
      const inboxMessages = await pollInbox(sinceDate);
      console.log(`[replyPollJob] Fetched ${inboxMessages.length} inbox messages`);

      let matched = 0;
      let classified = 0;
      let alreadyLogged = 0;
      const classificationResults = [];

      for (const msg of inboxMessages) {
        // Only process messages whose threadId matches one of our outbound threads
        const contactId = threadToContactMap.get(msg.gmail_thread_id);
        if (!contactId) continue;
        matched++;

        // Skip if we've already logged this specific message
        const existing = await EmailLog.findOne({ gmail_message_id: msg.gmail_message_id });
        if (existing) {
          alreadyLogged++;
          continue;
        }

        // Classify the reply
        const { classification, reason, llm_classified } = await classifyReply({
          subject: msg.subject,
          body: msg.textBody,
          from: msg.from
        });
        classified++;

        // Log the inbound reply
        await EmailLog.create({
          contact_id: contactId,
          direction: 'inbound',
          subject: msg.subject,
          body: msg.textBody,
          log_status: 'received',
          classification,
          classification_reason: reason,
          llm_generated: false,
          raw_reply_text: msg.textBody,
          gmail_message_id: msg.gmail_message_id,
          gmail_thread_id: msg.gmail_thread_id,
          sent_at: msg.date
        });

        // Update contact — always set to "replied"
        // "interested" also sets needs_attention=true for quick surfacing
        const contactUpdate = {
          status: CLASSIFICATION_TO_STATUS[classification] ?? 'replied'
        };
        if (classification === 'interested') {
          contactUpdate.needs_attention = true;
        }
        await Contact.findByIdAndUpdate(contactId, contactUpdate);

        classificationResults.push({
          gmail_message_id: msg.gmail_message_id,
          contact_id: contactId,
          from: msg.from,
          classification,
          reason
        });

        console.log(`[replyPollJob] Logged reply from ${msg.from}: ${classification} — ${reason}`);
      }

      // Persist the poll timestamp for the next run
      await Settings.set(SETTINGS_KEY, runAt.toISOString());

      summary = {
        inbox_messages_fetched: inboxMessages.length,
        matched_to_threads: matched,
        classified,
        already_logged: alreadyLogged,
        results: classificationResults
      };

      if (classified === 0 && matched === 0) {
        jobStatus = 'skipped';
        console.log('[replyPollJob] No matching replies found.');
      } else {
        console.log(`[replyPollJob] Complete: ${classified} new replies classified, ${alreadyLogged} already logged.`);
      }
    } catch (err) {
      jobStatus = 'failed';
      errorMsg = err.message;
      console.error(`[replyPollJob] Job crashed: ${err.message}`);
    }

    // Always write to JobLog
    try {
      await JobLog.create({
        job_name: 'reply_poll',
        run_at: runAt,
        status: jobStatus,
        summary,
        error: errorMsg
      });
    } catch (logErr) {
      console.error(`[replyPollJob] Failed to write JobLog: ${logErr.message}`);
    }
  });

  console.log(`[replyPollJob] Registered — schedule: "${schedule}"`);
};
