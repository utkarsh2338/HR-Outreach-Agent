/**
 * seed-contacts.js
 *
 * Seeds MongoDB with contacts from the sample-contacts.csv in test-data/.
 * The CSV uses different column names than the Contact schema, so this script
 * maps them and generates placeholder emails from the company domain.
 *
 * Usage:
 *   node src/scripts/seed-contacts.js
 *
 * Options (env vars):
 *   DRY_RUN=true   — Parse and print stats without writing to DB.
 *   LIMIT=50       — Only import first N rows (default: all).
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Papa from 'papaparse';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import Contact from '../models/Contact.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.resolve(__dirname, '../test-data/sample-contacts.csv');

const DRY_RUN = process.env.DRY_RUN === 'true';
const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : Infinity;

// Map CSV status values → Contact schema enum values
const STATUS_MAP = {
  'in talks': 'replied',
  'invitation sent': 'sent',
  'follow-up 1': 'sent',
  'follow-up 2': 'sent',
  'no openings': 'not_interested',
  'not interested': 'not_interested',
  'connected': 'sent',
  'no response': 'no_response',
  'closed': 'closed',
};

function mapStatus(raw) {
  if (!raw) return 'new';
  const normalized = raw.trim().toLowerCase();
  return STATUS_MAP[normalized] ?? 'new';
}

/**
 * Derive a company domain from the Company Website column.
 * e.g. "http://www.gokwik.co/" → "gokwik.co"
 */
function extractDomain(websiteUrl) {
  if (!websiteUrl) return null;
  try {
    const url = new URL(websiteUrl.trim());
    return url.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Generate a guessed email from name + domain.
 * e.g. "Chetna Gogia" + "gokwik.co" → "chetna.gogia@gokwik.co"
 */
function generateEmail(name, domain) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .trim()
    .replace(/\s+/g, '.');

  const safeDomain = domain || 'example.com';
  return `${slug}@${safeDomain}`;
}

async function main() {
  console.log(`\n📂 Reading CSV: ${CSV_PATH}\n`);

  const rawCsv = fs.readFileSync(CSV_PATH, 'utf-8');

  // The first line is a disclaimer — skip it by splitting and rejoining from line 2
  const lines = rawCsv.split('\n');
  const csvWithoutDisclaimer = lines.slice(1).join('\n');

  const { data: rows, errors } = Papa.parse(csvWithoutDisclaimer, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (errors.length > 0) {
    console.warn('⚠️  CSV parse warnings:', errors.slice(0, 5));
  }

  console.log(`✅ Parsed ${rows.length} rows from CSV.\n`);

  const contacts = [];
  const skipped = [];
  const emailsSeen = new Set();

  const limit = Math.min(LIMIT, rows.length);

  for (let i = 0; i < limit; i++) {
    const row = rows[i];

    const name = row['Name']?.trim();
    const company = row['Company Name']?.trim();
    const roleTitle = row['Job Title']?.trim();
    const website = row['Company Website']?.trim();
    const linkedinUrl = row['Linkedin URL']?.trim();
    const rawStatus = row['Status'];

    if (!name || !company) {
      skipped.push({ row: i + 2, reason: `Missing name or company (name="${name}", company="${company}")` });
      continue;
    }

    const domain = extractDomain(website);
    const email = generateEmail(name, domain);

    // Skip duplicate emails within batch
    if (emailsSeen.has(email)) {
      skipped.push({ row: i + 2, reason: `Duplicate generated email: ${email}` });
      continue;
    }
    emailsSeen.add(email);

    contacts.push({
      name,
      email,
      company,
      role_title: roleTitle || undefined,
      company_domain: domain || undefined,
      status: mapStatus(rawStatus),
      source: 'csv_seed',
      notes: linkedinUrl ? `LinkedIn: ${linkedinUrl}` : undefined,
    });
  }

  console.log(`📊 Summary:`);
  console.log(`   Rows read:     ${limit}`);
  console.log(`   To import:     ${contacts.length}`);
  console.log(`   Skipped:       ${skipped.length}`);

  if (skipped.length > 0) {
    console.log('\n⚠️  Skipped rows:');
    skipped.slice(0, 10).forEach((s) => console.log(`   Row ${s.row}: ${s.reason}`));
    if (skipped.length > 10) console.log(`   ... and ${skipped.length - 10} more`);
  }

  if (DRY_RUN) {
    console.log('\n🔍 DRY RUN — no data written to MongoDB.');
    console.log('\nFirst 3 contacts that would be inserted:');
    contacts.slice(0, 3).forEach((c) => console.log(' ', JSON.stringify(c, null, 2)));
    process.exit(0);
  }

  // Connect to MongoDB
  await connectDB();

  // Find emails that already exist in DB
  const allEmails = contacts.map((c) => c.email);
  const existing = await Contact.find({ email: { $in: allEmails } }).select('email');
  const existingSet = new Set(existing.map((c) => c.email.toLowerCase()));

  const toInsert = contacts.filter((c) => !existingSet.has(c.email));
  const dbSkipped = contacts.length - toInsert.length;

  console.log(`\n🗄️  DB duplicates skipped: ${dbSkipped}`);
  console.log(`🚀 Inserting ${toInsert.length} new contacts...`);

  if (toInsert.length === 0) {
    console.log('ℹ️  Nothing to insert — all contacts already exist in DB.');
    await mongoose.disconnect();
    process.exit(0);
  }

  try {
    const result = await Contact.insertMany(toInsert, { ordered: false });
    console.log(`\n✅ Successfully inserted ${result.length} contacts!\n`);
  } catch (err) {
    // ordered:false means partial success is possible
    if (err.insertedDocs) {
      console.log(`⚠️  Partial insert: ${err.insertedDocs.length} contacts saved.`);
    } else {
      console.error('❌ Insert error:', err.message);
    }
  }

  await mongoose.disconnect();
  console.log('🔌 Disconnected from MongoDB. Done.\n');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
