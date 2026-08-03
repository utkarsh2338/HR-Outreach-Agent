import express from 'express';
import contactsRouter from '../src/routes/contacts.js';
import batchDraftRouter from '../src/routes/batchDraft.js';
import generateDraftRouter from '../src/routes/generateDraft.js';
import approveSendRouter from '../src/routes/approveSend.js';
import Contact from '../src/models/Contact.js';
import EmailLog from '../src/models/EmailLog.js';
import User from '../src/models/User.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { generateToken } from '../src/middleware/authMiddleware.js';

dotenv.config();

const app = express();
app.use(express.json());
app.use('/api/contacts', contactsRouter);
app.use('/api/contacts', batchDraftRouter);
app.use('/api/contacts', generateDraftRouter);
app.use('/api/email-logs', approveSendRouter);

const TEST_EMAIL_DOMAIN = '@batch-test-hr-agent.com';

async function runTests() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  let testUser = await User.findOne({ email: 'utkarshshukla1007@gmail.com' });
  if (!testUser) {
    testUser = await User.create({
      name: 'Utkarsh Shukla',
      email: 'utkarshshukla1007@gmail.com',
      google_id: 'test_legacy_google_id_001'
    });
  }

  const token = generateToken(testUser);
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // Clean up test data for test user
  await Contact.deleteMany({ user_id: testUser._id, email: { $regex: TEST_EMAIL_DOMAIN } });
  await EmailLog.deleteMany({ user_id: testUser._id, log_status: 'draft_pending' });

  // Seed 4 test contacts (mix of new/queued)
  const seeds = [
    { user_id: testUser._id, name: 'Alice HR', email: `alice${TEST_EMAIL_DOMAIN}`, company: 'Nexus Labs', role_title: 'Head of Talent', status: 'queued' },
    { user_id: testUser._id, name: 'Bob Recruit', email: `bob${TEST_EMAIL_DOMAIN}`, company: 'Quantum Systems', role_title: 'Technical Recruiter', status: 'new' },
    { user_id: testUser._id, name: 'Carol Hiring', email: `carol${TEST_EMAIL_DOMAIN}`, company: 'Vertex AI', role_title: 'People Operations Lead', status: 'queued', notes: 'Fast-growing ML infrastructure team' },
    { user_id: testUser._id, name: 'Dan Talent', email: `dan${TEST_EMAIL_DOMAIN}`, company: 'CloudEdge Inc', role_title: 'Talent Acquisition Specialist', status: 'new' },
  ];
  await Contact.insertMany(seeds);
  console.log('Seeded 4 test contacts');

  const server = app.listen(5097, async () => {
    try {
      // 1. Batch generate drafts (limit=3)
      console.log('\n--- POST /api/contacts/batch-generate-drafts (limit=3) ---');
      const batchRes = await fetch('http://localhost:5097/api/contacts/batch-generate-drafts', {
        method: 'POST',
        headers,
        body: JSON.stringify({ limit: 3 })
      });
      const batchData = await batchRes.json();
      console.log('Status:', batchRes.status);
      console.log('Drafted:', batchData.drafted, '| Failed:', batchData.failed_count);

      // 2. GET /api/email-logs/pending
      console.log('\n--- GET /api/email-logs/pending ---');
      const pendingRes = await fetch('http://localhost:5097/api/email-logs/pending', { headers });
      const pendingData = await pendingRes.json();
      console.log('Status:', pendingRes.status);
      console.log('Total pending drafts:', pendingData.total);
      if (pendingData.drafts && pendingData.drafts.length > 0) {
        const d = pendingData.drafts[0];
        console.log('First draft subject:', d.subject);
        console.log('First draft contact:', d.contact?.name, '<' + d.contact?.email + '>');
      }

      // 3. Verify contact statuses were updated
      const updatedContacts = await Contact.find({ user_id: testUser._id, email: { $regex: TEST_EMAIL_DOMAIN } }).select('name status');
      console.log('\nUpdated contact statuses:');
      updatedContacts.forEach(c => console.log(` ${c.name}: ${c.status}`));

    } catch (err) {
      console.error('Test error:', err);
    } finally {
      // Cleanup
      await Contact.deleteMany({ user_id: testUser._id, email: { $regex: TEST_EMAIL_DOMAIN } });
      server.close();
      await mongoose.disconnect();
      process.exit(0);
    }
  });
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
