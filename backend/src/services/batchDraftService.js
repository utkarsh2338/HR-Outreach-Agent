import Contact from '../models/Contact.js';
import EmailLog from '../models/EmailLog.js';
import { generateEmailDraft } from './emailDraftService.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Core batch draft generation logic, usable by both the HTTP route
 * and the daily cron job without duplicating code.
 *
 * Selects up to `limit` contacts with status "queued" or "new" (FIFO),
 * generates a personalized draft for each, stores a draft_pending EmailLog,
 * and updates the contact status to "draft_pending".
 *
 * @param {object} options
 * @param {number} options.limit              - Max contacts to process
 * @param {number} [options.delayMs=1500]     - Inter-call delay between Groq requests (ms)
 * @returns {Promise<{
 *   drafted: Array,
 *   failed: Array
 * }>}
 */
export const runBatchDraftGeneration = async ({ limit, delayMs = 1500 }) => {
  const contacts = await Contact.find({ status: { $in: ['queued', 'new'] } })
    .sort({ createdAt: 1 }) // oldest first — FIFO
    .limit(limit);

  if (contacts.length === 0) {
    return { drafted: [], failed: [] };
  }

  const drafted = [];
  const failed = [];

  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];

    if (i > 0) {
      await sleep(delayMs);
    }

    try {
      const { subject, htmlBody, textBody, llm_generated } = await generateEmailDraft(contact);

      const draft = await EmailLog.create({
        contact_id: contact._id,
        direction: 'outbound',
        subject,
        body: textBody,
        html_body: htmlBody,
        llm_generated,
        log_status: 'draft_pending'
      });

      await Contact.findByIdAndUpdate(contact._id, { status: 'draft_pending' });

      drafted.push({
        contact_id: contact._id,
        contact_name: contact.name,
        contact_email: contact.email,
        company: contact.company,
        draft_id: draft._id,
        llm_generated
      });
    } catch (err) {
      console.error(`[batchDraftCore] Failed for ${contact.email}: ${err.message}`);
      failed.push({
        contact_id: contact._id,
        contact_name: contact.name,
        contact_email: contact.email,
        reason: err.message
      });
    }
  }

  return { drafted, failed };
};
