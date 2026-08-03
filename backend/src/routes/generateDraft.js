import express from 'express';
import mongoose from 'mongoose';
import Contact from '../models/Contact.js';
import EmailLog from '../models/EmailLog.js';
import { generateEmailDraft } from '../services/emailDraftService.js';

const router = express.Router();

/**
 * @route   POST /api/contacts/:id/generate-draft
 * @desc    Generate a personalized email draft using Groq + fixed template.
 *          Stores it as a draft_pending EmailLog. Does NOT send.
 */
router.post('/:id/generate-draft', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid contact ID format' });
    }

    const contact = await Contact.findById(id);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    // Generate personalized draft (Groq + template)
    const { subject, htmlBody, textBody, llm_generated, opener } = await generateEmailDraft(contact);

    // Store as a pending draft in EmailLog
    const draft = await EmailLog.create({
      contact_id: contact._id,
      direction: 'outbound',
      subject,
      body: textBody,
      html_body: htmlBody,
      llm_generated,
      log_status: 'draft_pending'
    });

    return res.status(201).json({
      message: 'Draft generated successfully — review and approve before sending.',
      draft_id: draft._id,
      contact: {
        id: contact._id,
        name: contact.name,
        email: contact.email,
        company: contact.company
      },
      draft: {
        subject,
        opener,
        body: textBody,
        llm_generated,
        log_status: 'draft_pending',
        created_at: draft.createdAt
      }
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to generate draft',
      details: error.message
    });
  }
});

export default router;
