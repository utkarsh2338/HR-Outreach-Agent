import express from 'express';
import mongoose from 'mongoose';
import Contact from '../models/Contact.js';
import EmailLog from '../models/EmailLog.js';
import { sendEmail } from '../services/gmailService.js';
import { buildColdEmail } from '../templates/coldEmail.js';

const router = express.Router();

/**
 * @route   POST /api/contacts/:id/send-test
 * @desc    Send a test cold email to a contact, log it, and update contact status
 */
router.post('/:id/send-test', async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid contact ID format' });
    }

    // Fetch contact
    const contact = await Contact.findById(id);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    // --- Rate Limiter ---
    const DAILY_SEND_LIMIT = parseInt(process.env.DAILY_SEND_LIMIT || '20', 10);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

    const sentCount = await EmailLog.countDocuments({
      direction: 'outbound',
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

    // Send via Gmail API
    const { gmail_message_id, gmail_thread_id } = await sendEmail({
      to: contact.email,
      subject,
      htmlBody,
      textBody
    });

    const sentAt = new Date();

    // Log the sent email with Gmail thread identifiers for reply tracking
    const emailLog = await EmailLog.create({
      contact_id: contact._id,
      direction: 'outbound',
      subject,
      body: textBody,
      llm_generated: false,
      log_status: 'sent',
      sent_at: sentAt,
      gmail_message_id,
      gmail_thread_id
    });

    // Update contact status and last_contacted_at
    await Contact.findByIdAndUpdate(id, {
      status: 'sent',
      last_contacted_at: sentAt
    });

    return res.status(200).json({
      message: 'Email sent successfully',
      contact: {
        id: contact._id,
        name: contact.name,
        email: contact.email,
        status: 'sent',
        last_contacted_at: sentAt
      },
      email_log_id: emailLog._id,
      subject,
      sent_at: sentAt,
      daily_quota: {
        sent_in_last_24h: sentCount + 1,
        limit: DAILY_SEND_LIMIT,
        remaining: DAILY_SEND_LIMIT - sentCount - 1
      }
    });
  } catch (error) {
    // Surface Gmail API errors clearly
    if (error.message.includes('Gmail OAuth2 credentials')) {
      return res.status(500).json({
        error: 'Gmail credentials not configured',
        details: error.message
      });
    }
    if (error.code === 401 || (error.response && error.response.status === 401)) {
      return res.status(500).json({
        error: 'Gmail authentication failed. Check your OAuth2 credentials and refresh token.',
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
