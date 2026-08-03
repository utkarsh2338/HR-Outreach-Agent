import express from 'express';
import mongoose from 'mongoose';
import Contact from '../models/Contact.js';
import EmailLog from '../models/EmailLog.js';
import { sendEmail } from '../services/gmailService.js';
import { buildColdEmail } from '../templates/coldEmail.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(requireAuth);

/**
 * @route   POST /api/contacts/:id/send-test
 * @desc    Generate draft, transition to draft_pending, then approve and send.
 *          Gated through draft_pending state per Section 0.
 */
router.post('/:id/send-test', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid contact ID format' });
    }

    const contact = await Contact.findOne({ _id: id, user_id: req.user._id });
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    // --- Rate Limiter (User specific) ---
    const DAILY_SEND_LIMIT = req.user.daily_send_limit || parseInt(process.env.DAILY_SEND_LIMIT || '20', 10);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const sentCount = await EmailLog.countDocuments({
      user_id: req.user._id,
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

    // Build email from template
    const { subject, htmlBody, textBody } = buildColdEmail({
      name: contact.name,
      company: contact.company,
      role_title: contact.role_title
    });

    // Step 1: Create draft_pending row (Section 0 requirement)
    const draft = await EmailLog.create({
      user_id: req.user._id,
      contact_id: contact._id,
      direction: 'outbound',
      subject,
      body: textBody,
      html_body: htmlBody,
      llm_generated: false,
      log_status: 'draft_pending'
    });

    // Step 2: Send via Gmail API
    const { gmail_message_id, gmail_thread_id } = await sendEmail({
      to: contact.email,
      subject,
      htmlBody,
      textBody,
      user: req.user
    });

    const sentAt = new Date();

    // Step 3: Transition draft_pending -> sent
    draft.log_status = 'sent';
    draft.sent_at = sentAt;
    draft.gmail_message_id = gmail_message_id;
    draft.gmail_thread_id = gmail_thread_id;
    await draft.save();

    await Contact.findOneAndUpdate(
      { _id: id, user_id: req.user._id },
      { status: 'sent', last_contacted_at: sentAt }
    );

    return res.status(200).json({
      message: 'Email sent successfully via draft_pending state',
      contact: {
        id: contact._id,
        name: contact.name,
        email: contact.email,
        status: 'sent',
        last_contacted_at: sentAt
      },
      email_log_id: draft._id,
      subject,
      sent_at: sentAt,
      daily_quota: {
        sent_in_last_24h: sentCount + 1,
        limit: DAILY_SEND_LIMIT,
        remaining: DAILY_SEND_LIMIT - sentCount - 1
      }
    });
  } catch (error) {
    if (error.message?.includes('Gmail OAuth2 credentials')) {
      return res.status(500).json({
        error: 'Gmail credentials not configured',
        details: error.message
      });
    }
    return res.status(500).json({
      error: 'Failed to send email',
      details: error.message
    });
  }
});

export default router;
