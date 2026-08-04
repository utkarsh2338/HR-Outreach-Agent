import { fileDb } from '../utils/fileDb.js';
import { generateEmailDraft } from './emailDraftService.js';
import { verifyEmail, VerificationResult } from './emailVerifierService.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Core batch draft generation logic.
 * Reads top `limit` contacts starting from row 1 of `sample-contacts.csv`,
 * pre-verifies email deliverability, generates drafts, and saves to `email_logs.json`.
 * If an email is invalid (no MX records or bad format), it is automatically trimmed from sample-contacts.csv.
 *
 * @param {object} options
 * @param {number} options.limit - Max contacts to process
 */
export const runBatchDraftGeneration = async ({ userId, limit }) => {
  const allContacts = fileDb.getContactsFromCsv();

  const existingLogs = fileDb.getEmailLogs();
  const existingEmails = new Set(
    existingLogs
      .filter((l) => l.log_status === 'draft_pending' || l.log_status === 'sent')
      .map((l) => (l.contact_email || l.contact?.email || '').toLowerCase())
  );

  const rawEligible = allContacts.filter(
    (c) => c.email && !existingEmails.has(c.email.toLowerCase())
  );

  const eligibleContacts = [];
  for (const contact of rawEligible) {
    if (eligibleContacts.length >= limit) break;

    const check = await verifyEmail(contact.email);
    if (check.status === VerificationResult.FORMAT_ERROR || check.status === VerificationResult.INVALID) {
      console.warn(`[batchDraftService] Auto-trimming non-deliverable contact "${contact.email}": ${check.reason}`);
      fileDb.trimContactFromCsv(contact.email || contact.name);
      continue;
    }

    eligibleContacts.push(contact);
  }

  if (eligibleContacts.length === 0) {
    return { drafted: [], failed: [] };
  }

  return runDraftsForSelectedContacts({ contacts: eligibleContacts, userId });
};

/**
 * Generates email drafts specifically for an array of contact objects.
 */
export const runDraftsForSelectedContacts = async ({ contacts, userId }) => {
  const drafted = [];
  const failed = [];

  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];
    try {
      const { subject, htmlBody, textBody, llm_generated, verification } = await generateEmailDraft(contact, userId);

      const draft = fileDb.saveEmailLog({
        contact_id: contact._id,
        contact_name: contact.name,
        contact_email: contact.email,
        company: contact.company,
        role_title: contact.role_title,
        contact: {
          _id: contact._id,
          name: contact.name,
          email: contact.email,
          company: contact.company,
          role_title: contact.role_title
        },
        direction: 'outbound',
        subject,
        body: textBody,
        html_body: htmlBody,
        llm_generated,
        verification_status: verification?.status || 'VALID',
        log_status: 'draft_pending'
      });

      drafted.push({
        contact_id: contact._id,
        contact_name: contact.name,
        contact_email: contact.email,
        company: contact.company,
        draft_id: draft._id,
        llm_generated,
        verification
      });
    } catch (err) {
      console.error(`[selectedDraftsCore] Failed for ${contact.email}: ${err.message}`);

      // Auto-trim invalid HR contact from CSV so UI updates cleanly
      if (err.message.includes('Email verification failed') || err.message.includes('lacks a valid email')) {
        fileDb.trimContactFromCsv(contact.email || contact.name);
        console.log(`[batchDraftService] Auto-trimmed invalid contact "${contact.email}" from sample-contacts.csv`);
      }

      failed.push({
        contact_id: contact._id,
        contact_name: contact.name,
        contact_email: contact.email,
        reason: err.message
      });
    }
  }

  return { drafted, failed };
};
