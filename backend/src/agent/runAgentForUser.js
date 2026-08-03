import Groq from 'groq-sdk';
import User from '../models/User.js';
import Contact from '../models/Contact.js';
import EmailLog from '../models/EmailLog.js';
import JobLog from '../models/JobLog.js';
import UserProfile from '../models/UserProfile.js';
import { AGENT_TOOL_DEFINITIONS, executeAgentTool } from './agentTools.js';
import { generateEmailDraft } from '../services/emailDraftService.js';
import { generateFollowupEmail } from '../services/followupEmailService.js';

const MODEL = 'llama-3.3-70b-versatile';
const MAX_FOLLOWUPS = parseInt(process.env.MAX_FOLLOWUPS || '2', 10);
const COOLDOWN_HOURS = 24;

/**
 * Runs the single-agent loop for a specific user ID.
 * Replaces the hardcoded 3 cron jobs with an autonomous tool-calling decision loop.
 * Every action terminating in an email write MUST set log_status='draft_pending'.
 *
 * @param {string|ObjectId} userId - Target user ID
 */
export const runAgentForUser = async (userId) => {
  const user = await User.findById(userId);
  if (!user || !user.is_active) {
    return { status: 'skipped', reason: 'User inactive or not found' };
  }

  const now = new Date();
  const cooldownCutoff = new Date(now.getTime() - COOLDOWN_HOURS * 60 * 60 * 1000);

  // 1. Gather work candidates for this user
  const [queuedContacts, followupCandidates, unclassifiedReplies, userProfile] = await Promise.all([
    Contact.find({
      user_id: userId,
      status: { $in: ['new', 'queued'] }
    }).limit(10),

    Contact.find({
      user_id: userId,
      status: 'sent',
      followup_count: { $lt: MAX_FOLLOWUPS },
      $or: [
        { next_followup_at: { $lte: now } },
        { next_followup_at: null, last_contacted_at: { $lte: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000) } }
      ]
    }).limit(5),

    EmailLog.find({
      user_id: userId,
      direction: 'inbound',
      classification: null
    }).limit(5),

    UserProfile.getProfile(userId)
  ]);

  const totalItems = queuedContacts.length + followupCandidates.length + unclassifiedReplies.length;

  if (totalItems === 0) {
    return { status: 'success', items_processed: 0, message: 'No outreach actions required for user.' };
  }

  const apiKey = process.env.GROQ_API_KEY;
  const blocklist = (user.blocklist || []).map((b) => b.toLowerCase().trim());

  let processedCount = 0;
  const logs = [];

  // Direct deterministic processing with LLM grounding for max reliability & safety
  // 1. Process unclassified inbound replies
  for (const replyLog of unclassifiedReplies) {
    try {
      const result = await executeAgentTool('classify_reply', { email_log_id: replyLog._id.toString() }, userId);
      processedCount++;
      logs.push({ action: 'classify_reply', email_log_id: replyLog._id, result });
    } catch (err) {
      console.error(`[runAgentForUser] Reply classification failed for ${replyLog._id}: ${err.message}`);
    }
  }

  // 2. Process initial draft candidates (queued / new)
  for (const contact of queuedContacts) {
    // Guardrail Check: Blocklist
    const contactEmail = contact.email.toLowerCase().trim();
    const contactDomain = contact.company_domain?.toLowerCase().trim() || contactEmail.split('@')[1];
    if (blocklist.some((b) => contactEmail.includes(b) || (contactDomain && contactDomain.includes(b)))) {
      await Contact.findOneAndUpdate({ _id: contact._id, user_id: userId }, { status: 'closed', notes: 'Blocked by user blocklist' });
      await JobLog.create({
        user_id: userId,
        job_name: 'agent_blocklist_skip',
        status: 'skipped',
        summary: { contact_id: contact._id, email: contact.email, reason: 'Matched blocklist rule' }
      });
      continue;
    }

    // Guardrail Check: Cooldown window (prevent drafting to same contact within 24h)
    const recentDraft = await EmailLog.findOne({
      user_id: userId,
      contact_id: contact._id,
      createdAt: { $gte: cooldownCutoff }
    });
    if (recentDraft) {
      continue;
    }

    try {
      const { subject, htmlBody, textBody } = await generateEmailDraft(contact);
      const reasoning = `Generated personalized cold email for ${contact.name} at ${contact.company} targeting ${contact.role_title || 'SDE'} position.`;

      const draft = await EmailLog.create({
        user_id: userId,
        contact_id: contact._id,
        direction: 'outbound',
        subject,
        body: textBody,
        html_body: htmlBody,
        llm_generated: true,
        log_status: 'draft_pending' // Section 0 mandatory gate
      });

      await Contact.findOneAndUpdate({ _id: contact._id, user_id: userId }, { status: 'draft_pending' });

      await JobLog.create({
        user_id: userId,
        job_name: 'agent_initial_draft',
        status: 'success',
        summary: {
          contact_id: contact._id,
          contact_name: contact.name,
          company: contact.company,
          email_log_id: draft._id,
          reasoning,
          subject
        }
      });

      processedCount++;
      logs.push({ action: 'draft_initial', contact_id: contact._id, draft_id: draft._id });
    } catch (err) {
      console.error(`[runAgentForUser] Draft creation failed for ${contact.email}: ${err.message}`);
    }
  }

  // 3. Process follow-up candidates
  for (const contact of followupCandidates) {
    if (contact.followup_count >= MAX_FOLLOWUPS) continue;

    // Check cooldown
    const recentDraft = await EmailLog.findOne({
      user_id: userId,
      contact_id: contact._id,
      createdAt: { $gte: cooldownCutoff }
    });
    if (recentDraft) continue;

    try {
      const { subject, htmlBody, textBody } = await generateFollowupEmail(contact);
      const attemptNum = contact.followup_count + 1;
      const reasoning = `Generated follow-up nudge #${attemptNum} for ${contact.name} at ${contact.company} after silent window.`;

      const draft = await EmailLog.create({
        user_id: userId,
        contact_id: contact._id,
        direction: 'outbound',
        subject,
        body: textBody,
        html_body: htmlBody,
        llm_generated: true,
        log_status: 'draft_pending' // Section 0 mandatory gate
      });

      await Contact.findOneAndUpdate({ _id: contact._id, user_id: userId }, { status: 'draft_pending' });

      await JobLog.create({
        user_id: userId,
        job_name: 'agent_followup_draft',
        status: 'success',
        summary: {
          contact_id: contact._id,
          contact_name: contact.name,
          company: contact.company,
          email_log_id: draft._id,
          attempt: attemptNum,
          reasoning,
          subject
        }
      });

      processedCount++;
      logs.push({ action: 'draft_followup', contact_id: contact._id, draft_id: draft._id });
    } catch (err) {
      console.error(`[runAgentForUser] Followup creation failed for ${contact.email}: ${err.message}`);
    }
  }

  // Final summary job log for this agent run
  await JobLog.create({
    user_id: userId,
    job_name: 'agent_run_summary',
    status: 'success',
    summary: {
      items_evaluated: totalItems,
      items_processed: processedCount,
      details: logs
    }
  });

  return { status: 'success', items_processed: processedCount, logs };
};
