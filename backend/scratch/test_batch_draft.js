import express from 'express';
import contactsRouter from '../src/routes/contacts.js';
import batchDraftRouter from '../src/routes/batchDraft.js';
import generateDraftRouter from '../src/routes/generateDraft.js';
import approveSendRouter from '../src/routes/approveSend.js';
import Contact from '../src/models/Contact.js';
import EmailLog from '../src/models/EmailLog.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

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

  // Clean up test data
  await Contact.deleteMany({ email: { $regex: TEST_EMAIL_DOMAIN } });
  await EmailLog.deleteMany({});

  // Seed 4 test contacts (mix of new/queued)
  const seeds = [
    { name: 'Alice HR', email: `alice${TEST_EMAIL_DOMAIN}`, company: 'Nexus Labs', role_title: 'Head of Talent', status: 'queued' },
    { name: 'Bob Recruit', email: `bob${TEST_EMAIL_DOMAIN}`, company: 'Quantum Systems', role_title: 'Technical Recruiter', status: 'new' },
    { name: 'Carol Hiring', email: `carol${TEST_EMAIL_DOMAIN}`, company: 'Vertex AI', role_title: 'People Operations Lead', status: 'queued', notes: 'Fast-growing ML infrastructure team' },
    { name: 'Dan Talent', email: `dan${TEST_EMAIL_DOMAIN}`, company: 'CloudEdge Inc', role_title: 'Talent Acquisition Specialist', status: 'new' },
  ];
  await Contact.insertMany(seeds);
  console.log('Seeded 4 test contacts');

  const server = app.listen(5097, async () => {
    try {
      // 1. Batch generate drafts (limit=3)
      console.log('\n--- POST /api/contacts/batch-generate-drafts (limit=3) ---');
      const batchRes = await fetch('http://localhost:5097/api/contacts/batch-generate-drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 3 })
      });
      const batchData = await batchRes.json();
      console.log('Status:', batchRes.status);
      console.log('Drafted:', batchData.drafted, '| Failed:', batchData.failed_count);
      if (batchData.results.length > 0) {
        console.log('Sample result:', JSON.stringify(batchData.results[0], null, 2));
      }
      if (batchData.failed.length > 0) {
        console.log('Failures:', JSON.stringify(batchData.failed, null, 2));
      }

      // 2. GET /api/email-logs/pending
      console.log('\n--- GET /api/email-logs/pending ---');
      const pendingRes = await fetch('http://localhost:5097/api/email-logs/pending');
      const pendingData = await pendingRes.json();
      console.log('Status:', pendingRes.status);
      console.log('Total pending drafts:', pendingData.total);
      if (pendingData.drafts.length > 0) {
        const d = pendingData.drafts[0];
        console.log('First draft subject:', d.subject);
        console.log('First draft contact:', d.contact?.name, '<' + d.contact?.email + '>');
        console.log('LLM generated:', d.llm_generated);
      }

      // 3. Verify contact statuses were updated
      const updatedContacts = await Contact.find({ email: { $regex: TEST_EMAIL_DOMAIN } }).select('name status');
      console.log('\nUpdated contact statuses:');
      updatedContacts.forEach(c => console.log(` ${c.name}: ${c.status}`));

    } catch (err) {
      console.error('Test error:', err);
    } finally {
      // Cleanup
      await Contact.deleteMany({ email: { $regex: TEST_EMAIL_DOMAIN } });
      await EmailLog.deleteMany({ contact_id: { $in: (await Contact.find({ email: { $regex: TEST_EMAIL_DOMAIN } })).map(c => c._id) } });
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
