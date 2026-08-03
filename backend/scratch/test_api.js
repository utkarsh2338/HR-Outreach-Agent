import express from 'express';
import contactsRouter from '../src/routes/contacts.js';
import Contact from '../src/models/Contact.js';
import User from '../src/models/User.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { generateToken } from '../src/middleware/authMiddleware.js';

dotenv.config();

const app = express();
app.use(express.json());
app.use('/api/contacts', contactsRouter);

async function runTests() {
  if (!process.env.MONGODB_URI) {
    console.error('No MONGODB_URI found in env');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB!');

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

  // Cleanup test data for this test user
  await Contact.deleteMany({ user_id: testUser._id, email: /@test-hr-agent\.com$/ });

  // Start test server
  const server = app.listen(5099, async () => {
    try {
      console.log('Test server running on port 5099');

      // 1. Create single contact
      const createRes = await fetch('http://localhost:5099/api/contacts', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: 'Jane Doe',
          email: 'jane.doe@test-hr-agent.com',
          company: 'Acme Corp',
          role_title: 'Senior Recruiter',
          tags: ['tech', 'engineering']
        })
      });
      const created = await createRes.json();
      console.log('POST /api/contacts status:', createRes.status);
      console.log('Created ID:', created._id);

      // 2. Duplicate create test
      const dupRes = await fetch('http://localhost:5099/api/contacts', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: 'Jane Duplicate',
          email: 'jane.doe@test-hr-agent.com',
          company: 'Acme Corp'
        })
      });
      console.log('POST /api/contacts duplicate status (expected 409):', dupRes.status);

      // 3. Bulk import
      const bulkRes = await fetch('http://localhost:5099/api/contacts/bulk', {
        method: 'POST',
        headers,
        body: JSON.stringify([
          { name: 'John Smith', email: 'john.smith@test-hr-agent.com', company: 'TechCorp' },
          { name: 'Alice Walker', email: 'alice.walker@test-hr-agent.com', company: 'InnovateInc' },
          { name: 'Jane Duplicate', email: 'jane.doe@test-hr-agent.com', company: 'Acme Corp' } // Should be skipped
        ])
      });
      const bulkData = await bulkRes.json();
      console.log('POST /api/contacts/bulk status:', bulkRes.status);
      console.log('Bulk summary:', { created: bulkData.created, skipped: bulkData.skipped, errors: bulkData.errors.length });

      // 4. GET list with filtering
      const listRes = await fetch('http://localhost:5099/api/contacts?company=Acme&page=1&limit=10', { headers });
      const listData = await listRes.json();
      console.log('GET /api/contacts status:', listRes.status, 'Total items:', listData.total);

      // 5. GET by ID
      const getRes = await fetch(`http://localhost:5099/api/contacts/${created._id}`, { headers });
      const getData = await getRes.json();
      console.log('GET /api/contacts/:id status:', getRes.status, 'Name:', getData.name);

      // 6. PATCH contact
      const patchRes = await fetch(`http://localhost:5099/api/contacts/${created._id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: 'queued', notes: 'First touch scheduled' })
      });
      const patchData = await patchRes.json();
      console.log('PATCH /api/contacts/:id status:', patchRes.status, 'Updated Status:', patchData.status);

      // 7. DELETE contact
      const delRes = await fetch(`http://localhost:5099/api/contacts/${created._id}`, {
        method: 'DELETE',
        headers
      });
      console.log('DELETE /api/contacts/:id status:', delRes.status);

      // Cleanup remaining test data
      await Contact.deleteMany({ user_id: testUser._id, email: /@test-hr-agent\.com$/ });
      console.log('All tests completed successfully!');
    } catch (err) {
      console.error('Test execution error:', err);
    } finally {
      server.close();
      await mongoose.disconnect();
      process.exit(0);
    }
  });
}

runTests();
