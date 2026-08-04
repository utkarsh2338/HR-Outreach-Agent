import express from 'express';
import { fileDb } from '../utils/fileDb.js';
import { generateEmailDraft } from '../services/emailDraftService.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(requireAuth);

/**
 * @route   POST /api/contacts/:id/generate-draft
 * @desc    Generate a personalized email draft using local fileDb
 */
router.post('/:id/generate-draft', async (req, res) => {
  try {
    const { id } = req.params;
    const contacts = fileDb.getContactsFromCsv();
    const contact = contacts.find((c) => c._id === id || c.email === id);

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    const { subject, htmlBody, textBody, llm_generated, opener } = await generateEmailDraft(contact, req.user._id);

    const draft = fileDb.saveEmailLog({
      contact_id: contact._id,
      contact_name: contact.name,
      contact_email: contact.email,
      company: contact.company,
      role_title: contact.role_title,
      contact,
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
