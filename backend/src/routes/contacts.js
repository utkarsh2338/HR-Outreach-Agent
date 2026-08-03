import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import Papa from 'papaparse';
import Contact from '../models/Contact.js';
import EmailLog from '../models/EmailLog.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB file limit
});

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_STATUSES = [
  'new',
  'queued',
  'draft_pending',
  'sent',
  'opened',
  'replied',
  'interested',
  'not_interested',
  'no_response',
  'closed'
];

/**
 * @route   POST /api/contacts
 * @desc    Create a new contact
 */
router.post('/', async (req, res) => {
  try {
    const { name, email, company, status } = req.body;

    // Input validation
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Email is required' });
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    if (!company || !company.trim()) {
      return res.status(400).json({ error: 'Company is required' });
    }
    if (status && !ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Allowed values: ${ALLOWED_STATUSES.join(', ')}`
      });
    }

    const newContact = await Contact.create(req.body);
    return res.status(201).json(newContact);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: 'Contact with this email already exists' });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Failed to create contact', details: error.message });
  }
});

/**
 * @route   POST /api/contacts/bulk
 * @desc    Bulk import contacts from JSON array, skipping duplicates by email
 */
router.post('/bulk', async (req, res) => {
  try {
    const contactsInput = Array.isArray(req.body) ? req.body : req.body.contacts;

    if (!Array.isArray(contactsInput)) {
      return res.status(400).json({
        error: 'Invalid input format. Expected an array of contacts or an object with a contacts array.'
      });
    }

    const errors = [];
    const candidates = [];
    const emailsInBatch = new Set();
    let batchDuplicatesCount = 0;

    // Phase 1: Validate individual incoming contacts
    contactsInput.forEach((item, index) => {
      if (!item || typeof item !== 'object') {
        errors.push({ index, error: 'Item must be a valid object' });
        return;
      }

      const name = item.name ? String(item.name).trim() : '';
      const email = item.email ? String(item.email).trim().toLowerCase() : '';
      const company = item.company ? String(item.company).trim() : '';

      if (!name) {
        errors.push({ index, email, error: 'Name is required' });
        return;
      }
      if (!email) {
        errors.push({ index, name, error: 'Email is required' });
        return;
      }
      if (!EMAIL_REGEX.test(email)) {
        errors.push({ index, email, error: 'Invalid email format' });
        return;
      }
      if (!company) {
        errors.push({ index, email, error: 'Company is required' });
        return;
      }
      if (item.status && !ALLOWED_STATUSES.includes(item.status)) {
        errors.push({
          index,
          email,
          error: `Invalid status. Allowed values: ${ALLOWED_STATUSES.join(', ')}`
        });
        return;
      }

      // Check duplicates within batch
      if (emailsInBatch.has(email)) {
        batchDuplicatesCount++;
        return;
      }

      emailsInBatch.add(email);
      candidates.push({ ...item, email, name, company });
    });

    if (candidates.length === 0) {
      return res.status(200).json({
        created: 0,
        skipped: batchDuplicatesCount,
        errors,
        contacts: []
      });
    }

    // Phase 2: Query DB for existing emails
    const candidateEmails = candidates.map((c) => c.email);
    const existingContacts = await Contact.find({ email: { $in: candidateEmails } }).select('email');
    const existingEmailSet = new Set(existingContacts.map((c) => c.email.toLowerCase()));

    const toInsert = candidates.filter((c) => !existingEmailSet.has(c.email));
    const dbSkippedCount = candidates.length - toInsert.length;
    const totalSkipped = batchDuplicatesCount + dbSkippedCount;

    let createdContacts = [];
    if (toInsert.length > 0) {
      createdContacts = await Contact.insertMany(toInsert, { ordered: false });
    }

    return res.status(201).json({
      created: createdContacts.length,
      skipped: totalSkipped,
      errors,
      contacts: createdContacts
    });
  } catch (error) {
    return res.status(500).json({ error: 'Bulk import failed', details: error.message });
  }
});

/**
 * @route   POST /api/contacts/import-csv
 * @desc    Import contacts from uploaded CSV file
 */
router.post('/import-csv', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file provided. Attach file in form-data under key "file".' });
    }

    const csvText = req.file.buffer.toString('utf-8');
    const parseResult = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim()
    });

    if (parseResult.errors && parseResult.errors.length > 0) {
      const criticalError = parseResult.errors.find((e) => e.type === 'Quotes' || e.type === 'Delimiter');
      if (criticalError) {
        return res.status(400).json({
          error: 'Malformed CSV file',
          details: criticalError.message
        });
      }
    }

    const rows = parseResult.data;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'CSV file contains no data rows.' });
    }

    const invalid_rows = [];
    const candidates = [];
    const emailsInBatch = new Set();
    let batchDuplicatesCount = 0;

    rows.forEach((row, index) => {
      const rowNum = index + 2; // Original CSV row number (accounting for 1 header row)

      const name = row.name ? String(row.name).trim() : '';
      const email = row.email ? String(row.email).trim().toLowerCase() : '';
      const company = row.company ? String(row.company).trim() : '';

      if (!name) {
        invalid_rows.push({ row: rowNum, reason: 'Missing required field: name' });
        return;
      }
      if (!email) {
        invalid_rows.push({ row: rowNum, reason: 'Missing required field: email' });
        return;
      }
      if (!EMAIL_REGEX.test(email)) {
        invalid_rows.push({ row: rowNum, reason: `Invalid email format: ${email}` });
        return;
      }
      if (!company) {
        invalid_rows.push({ row: rowNum, reason: 'Missing required field: company' });
        return;
      }

      if (emailsInBatch.has(email)) {
        batchDuplicatesCount++;
        return;
      }

      emailsInBatch.add(email);
      candidates.push({
        name,
        email,
        company,
        role_title: row.role_title ? String(row.role_title).trim() : undefined,
        company_domain: row.company_domain ? String(row.company_domain).trim() : undefined,
        source: row.source ? String(row.source).trim() : 'csv_import',
        notes: row.notes ? String(row.notes).trim() : undefined
      });
    });

    let dbSkippedCount = 0;
    let createdContacts = [];

    if (candidates.length > 0) {
      const candidateEmails = candidates.map((c) => c.email);
      const existingContacts = await Contact.find({ email: { $in: candidateEmails } }).select('email');
      const existingEmailSet = new Set(existingContacts.map((c) => c.email.toLowerCase()));

      const toInsert = candidates.filter((c) => !existingEmailSet.has(c.email));
      dbSkippedCount = candidates.length - toInsert.length;

      if (toInsert.length > 0) {
        createdContacts = await Contact.insertMany(toInsert, { ordered: false });
      }
    }

    const skipped_duplicates = batchDuplicatesCount + dbSkippedCount;

    return res.status(201).json({
      imported: createdContacts.length,
      skipped_duplicates,
      invalid_rows
    });
  } catch (error) {
    return res.status(500).json({ error: 'CSV import failed', details: error.message });
  }
});

/**
 * @route   GET /api/contacts/needs-attention
 * @desc    Return contacts with needs_attention=true (classified as "interested"),
 *          joined with their most recent inbound reply, sorted newest first.
 *          Supports pagination via ?page and ?limit.
 */
router.get('/needs-attention', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page ?? 1, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit ?? 20, 10) || 20));
    const skip = (page - 1) * limit;

    const [contacts, total] = await Promise.all([
      Contact.find({ needs_attention: true })
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit),
      Contact.countDocuments({ needs_attention: true })
    ]);

    // Fetch most recent inbound reply for each contact
    const contactIds = contacts.map((c) => c._id);
    const recentReplies = await EmailLog.find({
      contact_id: { $in: contactIds },
      direction: 'inbound'
    }).sort({ createdAt: -1 });

    // Build a map: contact_id -> most recent reply
    const replyMap = new Map();
    for (const reply of recentReplies) {
      const key = reply.contact_id.toString();
      if (!replyMap.has(key)) {
        replyMap.set(key, reply);
      }
    }

    const result = contacts.map((c) => ({
      contact: c,
      latest_reply: replyMap.get(c._id.toString()) ?? null
    }));

    return res.status(200).json({
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      contacts: result
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to retrieve contacts needing attention',
      details: error.message
    });
  }
});

/**
 * @route   GET /api/contacts
 * @desc    List contacts with filtering & pagination
 */
router.get('/', async (req, res) => {
  try {
    const { status, company, tag, search, page = 1, limit = 10 } = req.query;

    const query = {};

    if (status) {
      query.status = status;
    }
    if (company) {
      query.company = { $regex: company, $options: 'i' };
    }
    if (tag) {
      query.tags = tag;
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } }
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const [contacts, total] = await Promise.all([
      Contact.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      Contact.countDocuments(query)
    ]);

    return res.status(200).json({
      contacts,
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
 * @desc    Get a single contact by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid contact ID format' });
    }

    const contact = await Contact.findById(id);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    return res.status(200).json(contact);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to retrieve contact', details: error.message });
  }
});

/**
 * @route   PATCH /api/contacts/:id
 * @desc    Update contact fields
 */
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid contact ID format' });
    }

    const { email, status } = req.body;

    if (email !== undefined) {
      if (!email.trim() || !EMAIL_REGEX.test(email.trim())) {
        return res.status(400).json({ error: 'Invalid email format' });
      }
    }

    if (status !== undefined && !ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Allowed values: ${ALLOWED_STATUSES.join(', ')}`
      });
    }

    const updatedContact = await Contact.findByIdAndUpdate(id, req.body, {
      returnDocument: 'after',
      runValidators: true
    });

    if (!updatedContact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    return res.status(200).json(updatedContact);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: 'Contact with this email already exists' });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Failed to update contact', details: error.message });
  }
});

/**
 * @route   DELETE /api/contacts/:id
 * @desc    Delete a contact by ID
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid contact ID format' });
    }

    const deletedContact = await Contact.findByIdAndDelete(id);
    if (!deletedContact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    return res.status(200).json({
      message: 'Contact deleted successfully',
      id
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to delete contact', details: error.message });
  }
});

export default router;
