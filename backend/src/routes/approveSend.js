import express from 'express';
import { fileDb } from '../utils/fileDb.js';
import { sendEmail } from '../services/gmailService.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(requireAuth);

/**
 * @route   GET /api/email-logs/pending
 * @desc    List all draft_pending & failed EmailLogs from fileDb
 */
router.get('/pending', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page ?? 1, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit ?? 20, 10) || 20));
    const skip = (page - 1) * limit;

    const logs = fileDb.getEmailLogs();
    const pendingLogs = logs.filter(
      (l) => l.log_status === 'draft_pending' || l.log_status === 'failed'
    );

    const total = pendingLogs.length;
    const paginated = pendingLogs.slice(skip, skip + limit);

    return res.status(200).json({
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      drafts: paginated.map((d) => ({
        draft_id: d._id,
        contact: d.contact || {
          _id: d.contact_id,
          name: d.contact_name || 'Recruiter',
          email: d.contact_email || 'hr@company.com',
          company: d.company || 'Company',
          role_title: d.role_title || 'Talent Acquisition'
        },
        subject: d.subject,
        body: d.body,
        html_body: d.html_body,
        llm_generated: d.llm_generated,
        log_status: d.log_status,
        created_at: d.createdAt || d.created_at
      }))
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to retrieve pending drafts',
      details: error.message
    });
  }
});

/**
 * @route   PATCH /api/email-logs/:id/discard
 * @desc    Discard a draft_pending / failed EmailLog
 */
router.patch('/:id/discard', async (req, res) => {
  try {
    const { id } = req.params;
    const logs = fileDb.getEmailLogs();
    const draft = logs.find((l) => l._id === id);

    if (!draft) return res.status(404).json({ error: 'Email log not found' });

    if (draft.log_status !== 'draft_pending' && draft.log_status !== 'failed') {
      return res.status(409).json({
        error: `Only pending or failed logs can be discarded. Current status: "${draft.log_status}"`
      });
    }

    fileDb.updateEmailLog(id, { log_status: 'failed' });
    return res.status(200).json({ message: 'Draft discarded.', email_log_id: id });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to discard draft', details: error.message });
  }
});

/**
 * @route   PATCH /api/email-logs/:id
 * @desc    Update a draft_pending / failed EmailLog's subject and body
 */
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { subject, body, html_body } = req.body;
    const logs = fileDb.getEmailLogs();
    const draft = logs.find((l) => l._id === id);

    if (!draft) return res.status(404).json({ error: 'Email log not found' });

    if (draft.log_status !== 'draft_pending' && draft.log_status !== 'failed') {
      return res.status(409).json({
        error: `Only pending or failed logs can be updated. Current status: "${draft.log_status}"`
      });
    }

    const updates = {};
    if (subject !== undefined) updates.subject = subject;
    if (body !== undefined) {
      updates.body = body;
      updates.html_body = html_body || body.replace(/\n/g, '<br>');
    } else if (html_body !== undefined) {
      updates.html_body = html_body;
    }

    const updated = fileDb.updateEmailLog(id, updates);

    return res.status(200).json({
      message: 'Draft updated successfully',
      draft: {
        draft_id: updated._id,
        subject: updated.subject,
        body: updated.body,
        html_body: updated.html_body
      }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update draft', details: error.message });
  }
});

/**
 * Helper to process single email send and auto-trim CSV
 */
const processSingleSend = async (draftId, user, customSubject, customBody, customHtmlBody) => {
  const logs = fileDb.getEmailLogs();
  const draft = logs.find((l) => l._id === draftId);
  if (!draft) throw new Error('Draft not found');

  if (draft.log_status !== 'draft_pending' && draft.log_status !== 'failed') {
    throw new Error(`Draft cannot be sent. Current status: "${draft.log_status}"`);
  }

  const subject = customSubject ?? draft.subject;
  const textBody = customBody ?? draft.body;
  const htmlBody = customHtmlBody ?? draft.html_body ?? textBody.replace(/\n/g, '<br>');
  const recipientEmail = draft.contact?.email || draft.contact_email;

  if (!recipientEmail) throw new Error('Recipient email is missing');

  // Send via Gmail API
  const { gmail_message_id, gmail_thread_id } = await sendEmail({
    to: recipientEmail,
    subject,
    htmlBody,
    textBody,
    user
  });

  const sentAt = new Date().toISOString();

  // Update EmailLog
  fileDb.updateEmailLog(draftId, {
    subject,
    body: textBody,
    html_body: htmlBody,
    log_status: 'sent',
    sent_at: sentAt,
    gmail_message_id,
    gmail_thread_id
  });

  // Auto-trim contact from sample-contacts.csv and append to sent_contacts.csv
  fileDb.trimContactFromCsv(recipientEmail);

  return {
    draft_id: draftId,
    recipient_email: recipientEmail,
    sent_at: sentAt,
    gmail_message_id
  };
};

/**
 * @route   POST /api/email-logs/:id/approve-and-send
 * @desc    Approve & send single email draft via Gmail API + trim CSV
 */
router.post('/:id/approve-and-send', async (req, res) => {
  try {
    const { id } = req.params;
    const { subject, body, html_body } = req.body || {};

    const result = await processSingleSend(id, req.user, subject, body, html_body);

    return res.status(200).json({
      message: 'Draft approved and email sent successfully. Recipient removed from sample-contacts.csv!',
      ...result
    });
  } catch (error) {
    console.error('[approveSend error]', error.message);
    if (req.params.id) {
      fileDb.updateEmailLog(req.params.id, { log_status: 'failed' });
    }

    return res.status(500).json({
      error: 'Failed to send approved draft',
      details: error.message
    });
  }
});

/**
 * @route   POST /api/email-logs/approve-batch
 * @desc    Approve and send multiple selected drafts in bulk loop
 */
router.post('/approve-batch', async (req, res) => {
  try {
    const { draft_ids } = req.body;
    if (!Array.isArray(draft_ids) || draft_ids.length === 0) {
      return res.status(400).json({ error: 'Please provide an array of draft_ids to send.' });
    }

    const sent = [];
    const failed = [];

    for (const draftId of draft_ids) {
      try {
        const result = await processSingleSend(draftId, req.user);
        sent.push(result);
      } catch (err) {
        console.error(`[approveBatch] Error sending draft ${draftId}: ${err.message}`);
        fileDb.updateEmailLog(draftId, { log_status: 'failed' });
        failed.push({ draft_id: draftId, reason: err.message });
      }
    }

    return res.status(200).json({
      message: `Batch send complete. ${sent.length} sent successfully, ${failed.length} failed.`,
      sent_count: sent.length,
      failed_count: failed.length,
      sent,
      failed
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Batch send failed',
      details: error.message
    });
  }
});

export default router;
