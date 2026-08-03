import express from 'express';
import mongoose from 'mongoose';
import Contact from '../models/Contact.js';
import EmailLog from '../models/EmailLog.js';
import { sendEmail } from '../services/gmailService.js';

const router = express.Router();

/**
 * @route   GET /api/email-logs/pending
 * @desc    List all draft_pending EmailLogs with contact info populated.
 *          Supports pagination via ?page and ?limit query params.
 */
router.get('/pending', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page ?? 1, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit ?? 20, 10) || 20));
    const skip = (page - 1) * limit;

    const [drafts, total] = await Promise.all([
      EmailLog.find({ log_status: 'draft_pending' })
        .populate('contact_id', 'name email company role_title status tags')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      EmailLog.countDocuments({ log_status: 'draft_pending' })
    ]);

    return res.status(200).json({
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      drafts: drafts.map((d) => ({
        draft_id: d._id,
        contact: d.contact_id,
        subject: d.subject,
        body: d.body,
        html_body: d.html_body,
        llm_generated: d.llm_generated,
        log_status: d.log_status,
        created_at: d.createdAt
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
 * @desc    Discard a draft_pending EmailLog — sets log_status to "failed"
 *          and reverts the contact status to "queued" for re-processing.
 */
router.patch('/:id/discard', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid email log ID format' });
    }

    const draft = await EmailLog.findById(id);
    if (!draft) return res.status(404).json({ error: 'Email log not found' });

    if (draft.log_status !== 'draft_pending') {
      return res.status(409).json({
        error: `Only draft_pending logs can be discarded. Current status: "${draft.log_status}"`
      });
    }

    draft.log_status = 'failed';
    await draft.save();

    if (draft.contact_id) {
      await Contact.findByIdAndUpdate(draft.contact_id, { status: 'queued' });
    }

    return res.status(200).json({ message: 'Draft discarded.', email_log_id: draft._id });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to discard draft', details: error.message });
  }
});

/**
 * @route   PATCH /api/email-logs/:id
 * @desc    Update a draft_pending EmailLog's subject, body, and/or html_body
 */
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid email log ID format' });
    }

    const { subject, body, html_body } = req.body;
    const draft = await EmailLog.findById(id);
    if (!draft) return res.status(404).json({ error: 'Email log not found' });

    if (draft.log_status !== 'draft_pending') {
      return res.status(409).json({
        error: `Only draft_pending logs can be updated. Current status: "${draft.log_status}"`
      });
    }

    if (subject !== undefined) draft.subject = subject;
    if (body !== undefined) {
      draft.body = body;
      if (html_body === undefined) {
        draft.html_body = body.replace(/\n/g, '<br>');
      }
    }
    if (html_body !== undefined) draft.html_body = html_body;

    await draft.save();

    return res.status(200).json({
      message: 'Draft updated successfully',
      draft: {
        draft_id: draft._id,
        subject: draft.subject,
        body: draft.body,
        html_body: draft.html_body
      }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update draft', details: error.message });
  }
});

/**
 * @route   POST /api/email-logs/:id/approve-and-send
 * @desc    Human-approval step: take a draft_pending EmailLog, send it via Gmail,
 *          update log status to "sent", and update the contact status to "sent".
 */
router.post('/:id/approve-and-send', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid email log ID format' });
    }

    // Fetch the draft
    const draft = await EmailLog.findById(id).populate('contact_id');
    if (!draft) {
      return res.status(404).json({ error: 'Email log (draft) not found' });
    }

    if (draft.log_status !== 'draft_pending') {
      return res.status(409).json({
        error: `This draft cannot be sent. Current status: "${draft.log_status}". Only "draft_pending" drafts can be approved.`
      });
    }

    // Allow overriding subject/body directly at approve time if passed
    const { subject: customSubject, body: customBody, html_body: customHtmlBody } = req.body || {};
    if (customSubject !== undefined) draft.subject = customSubject;
    if (customBody !== undefined) {
      draft.body = customBody;
      draft.html_body = customHtmlBody || customBody.replace(/\n/g, '<br>');
    } else if (customHtmlBody !== undefined) {
      draft.html_body = customHtmlBody;
    }

    const contact = draft.contact_id;
    if (!contact) {
      return res.status(404).json({ error: 'Contact associated with this draft no longer exists' });
    }

    // --- Rate Limiter ---
    const DAILY_SEND_LIMIT = parseInt(process.env.DAILY_SEND_LIMIT || '20', 10);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const sentCount = await EmailLog.countDocuments({
      direction: 'outbound',
      log_status: 'sent',
      sent_at: { $gte: since }
    });

    if (sentCount >= DAILY_SEND_LIMIT) {
      return res.status(429).json({
        error: `Daily send limit reached (${DAILY_SEND_LIMIT} emails/24h). Try again later.`,
        sent_in_last_24h: sentCount,
        limit: DAILY_SEND_LIMIT
      });
    }

    // Send via Gmail API
    const { gmail_message_id, gmail_thread_id } = await sendEmail({
      to: contact.email,
      subject: draft.subject,
      htmlBody: draft.html_body || draft.body,
      textBody: draft.body
    });

    const sentAt = new Date();

    // Update draft log to "sent" and store Gmail thread identifiers
    draft.log_status = 'sent';
    draft.sent_at = sentAt;
    draft.gmail_message_id = gmail_message_id;
    draft.gmail_thread_id = gmail_thread_id;
    await draft.save();

    // Update contact status and last_contacted_at
    await Contact.findByIdAndUpdate(contact._id, {
      status: 'sent',
      last_contacted_at: sentAt
    });

    return res.status(200).json({
      message: 'Draft approved and email sent successfully.',
      email_log_id: draft._id,
      contact: {
        id: contact._id,
        name: contact.name,
        email: contact.email,
        status: 'sent',
        last_contacted_at: sentAt
      },
      subject: draft.subject,
      sent_at: sentAt,
      llm_generated: draft.llm_generated,
      daily_quota: {
        sent_in_last_24h: sentCount + 1,
        limit: DAILY_SEND_LIMIT,
        remaining: DAILY_SEND_LIMIT - sentCount - 1
      }
    });
  } catch (error) {
    // Mark draft as failed so the user knows
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      try {
        await EmailLog.findByIdAndUpdate(req.params.id, { log_status: 'failed' });
      } catch (_) {
        // Ignore secondary error
      }
    }

    if (error.message?.includes('Gmail OAuth2 credentials')) {
      return res.status(500).json({
        error: 'Gmail credentials not configured',
        details: error.message
      });
    }
    if (error.code === 401 || error.response?.status === 401) {
      return res.status(500).json({
        error: 'Gmail authentication failed. Check your OAuth2 credentials and refresh token.',
        details: error.message
      });
    }

    return res.status(500).json({
      error: 'Failed to send approved draft',
      details: error.message
    });
  }
});

export default router;
