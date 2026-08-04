import express from 'express';
import { fileDb } from '../utils/fileDb.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(requireAuth);

/**
 * @route   GET /api/contacts/needs-attention
 * @desc    Return contacts needing attention from fileDb
 */
router.get('/needs-attention', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page ?? 1, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit ?? 20, 10) || 20));

    const logs = fileDb.getEmailLogs();
    const interestedLogs = logs.filter((l) => l.classification === 'interested' || l.needs_attention);

    return res.status(200).json({
      total: interestedLogs.length,
      page,
      limit,
      totalPages: Math.ceil(interestedLogs.length / limit) || 1,
      contacts: interestedLogs.map((l) => ({
        contact: l.contact || { _id: l.contact_id, name: l.contact_name, email: l.contact_email, company: l.company },
        latest_reply: l
      }))
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to retrieve contacts needing attention', details: error.message });
  }
});

/**
 * @route   GET /api/contacts
 * @desc    List contacts directly from sample-contacts.csv with pagination & search
 */
router.get('/', async (req, res) => {
  try {
    const { status, company, search, page = 1, limit = 10 } = req.query;
    let contacts = fileDb.getContactsFromCsv();

    if (company) {
      contacts = contacts.filter((c) => c.company.toLowerCase().includes(company.toLowerCase()));
    }

    if (search) {
      const query = search.toLowerCase();
      contacts = contacts.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.email.toLowerCase().includes(query) ||
          c.company.toLowerCase().includes(query)
      );
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const total = contacts.length;
    const paginated = contacts.slice(skip, skip + limitNum);

    return res.status(200).json({
      contacts: paginated,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to retrieve contacts', details: error.message });
  }
});

/**
 * @route   GET /api/contacts/:id
 * @desc    Get single contact by ID from CSV
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const contacts = fileDb.getContactsFromCsv();
    const contact = contacts.find((c) => c._id === id || c.email === id);

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    return res.status(200).json(contact);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to retrieve contact', details: error.message });
  }
});

export default router;
