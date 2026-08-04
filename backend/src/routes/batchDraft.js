import express from 'express';
import { runBatchDraftGeneration, runDraftsForSelectedContacts } from '../services/batchDraftService.js';
import { fileDb } from '../utils/fileDb.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(requireAuth);

/**
 * @route   POST /api/contacts/batch-generate-drafts
 * @desc    Select up to N contacts starting from top of CSV and generate drafts
 */
router.post('/batch-generate-drafts', async (req, res) => {
  const rawLimit = parseInt(req.body?.limit ?? 10, 10);
  const limit = Math.min(Math.max(1, isNaN(rawLimit) ? 10 : rawLimit), 100);
  const delayMs = parseInt(process.env.GROQ_BATCH_DELAY_MS ?? '1500', 10);

  try {
    const { drafted, failed } = await runBatchDraftGeneration({
      userId: req.user._id,
      limit,
      delayMs
    });

    if (drafted.length === 0 && failed.length === 0) {
      return res.status(200).json({
        message: 'No un-contacted HRs found in CSV queue.',
        drafted: 0,
        failed_count: 0,
        results: [],
        failed: []
      });
    }

    return res.status(200).json({
      message: `Batch draft generation complete. ${drafted.length} drafted, ${failed.length} failed.`,
      drafted: drafted.length,
      failed_count: failed.length,
      results: drafted,
      failed
    });
  } catch (err) {
    return res.status(500).json({
      error: 'Batch draft generation failed',
      details: err.message
    });
  }
});

/**
 * @route   POST /api/contacts/generate-selected-drafts
 * @desc    Generate email drafts specifically for selected HR contacts
 */
router.post('/generate-selected-drafts', async (req, res) => {
  try {
    const { contact_ids, contacts: incomingContacts } = req.body;
    let targetContacts = [];

    const allContacts = fileDb.getContactsFromCsv();

    if (Array.isArray(contact_ids) && contact_ids.length > 0) {
      targetContacts = allContacts.filter((c) => contact_ids.includes(c._id) || contact_ids.includes(c.email));
    } else if (Array.isArray(incomingContacts) && incomingContacts.length > 0) {
      targetContacts = incomingContacts;
    } else {
      targetContacts = allContacts.slice(0, 10);
    }

    if (targetContacts.length === 0) {
      return res.status(400).json({ error: 'No valid HR contacts selected.' });
    }

    const { drafted, failed } = await runDraftsForSelectedContacts({
      contacts: targetContacts,
      userId: req.user._id
    });

    return res.status(200).json({
      message: `Generated ${drafted.length} email draft(s) for selected HR contact(s).`,
      drafted: drafted.length,
      failed_count: failed.length,
      results: drafted,
      failed
    });
  } catch (err) {
    return res.status(500).json({
      error: 'Selected draft generation failed',
      details: err.message
    });
  }
});

export default router;
