import express from 'express';
import { runBatchDraftGeneration } from '../services/batchDraftService.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(requireAuth);

/**
 * @route   POST /api/contacts/batch-generate-drafts
 * @desc    Select up to N contacts for logged in user with status "queued" or "new",
 *          generate a personalized draft for each, store as draft_pending EmailLogs.
 *
 * @body    { limit: number }  — defaults to 10, max 50
 */
router.post('/batch-generate-drafts', async (req, res) => {
  const rawLimit = parseInt(req.body?.limit ?? 10, 10);
  const limit = Math.min(Math.max(1, isNaN(rawLimit) ? 10 : rawLimit), 50);
  const delayMs = parseInt(process.env.GROQ_BATCH_DELAY_MS ?? '1500', 10);

  try {
    const { drafted, failed } = await runBatchDraftGeneration({
      userId: req.user._id,
      limit,
      delayMs
    });

    if (drafted.length === 0 && failed.length === 0) {
      return res.status(200).json({
        message: 'No contacts with status "queued" or "new" found.',
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

export default router;
