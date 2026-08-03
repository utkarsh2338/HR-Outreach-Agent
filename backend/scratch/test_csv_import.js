import express from 'express';
import contactsRouter from '../src/routes/contacts.js';
import Contact from '../src/models/Contact.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const app = express();
app.use(express.json());
app.use('/api/contacts', contactsRouter);

async function runCsvTest() {
  if (!process.env.MONGODB_URI) {
    console.error('No MONGODB_URI found in env');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI);

  // Clean up any old test contacts from previous runs
  await Contact.deleteMany({
    email: {
      $in: [
        'sarah.j@alpha-tech.com',
        'michael.chang@beta-labs.io',
        'amanda.ross@gamma-corp.org',
        'david.kim@delta-solutions.com',
        'emily.watson@epsilon-inc.net'
      ]
    }
  });

  const server = app.listen(5098, async () => {
    try {
      console.log('Test server running on port 5098');

      const csvFilePath = path.resolve('src/test-data/sample-contacts.csv');
      const csvBuffer = fs.readFileSync(csvFilePath);

      // Create FormData request using standard Node 18+ Blob / FormData
      const blob = new Blob([csvBuffer], { type: 'text/csv' });
      const formData = new FormData();
      formData.append('file', blob, 'sample-contacts.csv');

      const res = await fetch('http://localhost:5098/api/contacts/import-csv', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      console.log('POST /api/contacts/import-csv status code:', res.status);
      console.log('Import Response Summary:', JSON.stringify(data, null, 2));

      // Test re-importing the same CSV to verify deduplication
      const resDup = await fetch('http://localhost:5098/api/contacts/import-csv', {
        method: 'POST',
        body: formData
      });
      const dataDup = await resDup.json();
      console.log('\nRe-import Response (testing DB deduplication):', JSON.stringify(dataDup, null, 2));

      // Clean up imported test contacts
      await Contact.deleteMany({
        email: {
          $in: [
            'sarah.j@alpha-tech.com',
            'michael.chang@beta-labs.io',
            'amanda.ross@gamma-corp.org',
            'david.kim@delta-solutions.com',
            'emily.watson@epsilon-inc.net'
          ]
        }
      });
      console.log('\nTest cleanup complete.');
    } catch (err) {
      console.error('CSV import test error:', err);
    } finally {
      server.close();
      await mongoose.disconnect();
      process.exit(0);
    }
  });
}

runCsvTest();
