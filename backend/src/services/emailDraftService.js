import { fileDb } from '../utils/fileDb.js';
import { generatePersonalizedOpener } from './groqService.js';
import { buildColdEmail } from '../templates/coldEmail.js';
import { verifyEmail, VerificationResult } from './emailVerifierService.js';

/**
 * Generates a personalized email draft for a contact.
 *
 * Pipeline:
 * 1. Basic email format check.
 * 2. Real-time Email Verification (Syntax, DNS MX, SMTP Socket Handshake).
 *    Aborts immediately if email is undeliverable — saves Groq API tokens.
 * 3. Fetches active candidate profile from local fileDb storage.
 * 4. Uses Groq (Llama 3.3 70B) to generate a tailored 1-2 sentence opening hook (with candidate projects).
 * 5. Assembles the full email body using deterministic template engine (coldEmail.js).
 *    Guarantees 100% link accuracy (LinkedIn, GitHub, Portfolio, Resume PDF),
 *    clean subject encoding, and correct target role mapping.
 *
 * @param {object} contact - A Contact document or plain object from CSV/storage
 * @param {string} [fallbackUserId] - Unused in local mode, retained for API signature compat
 * @returns {Promise<{
 *   subject: string,
 *   htmlBody: string,
 *   textBody: string,
 *   llm_generated: boolean,
 *   opener?: string,
 *   verification: object
 * }>}
 */
export const generateEmailDraft = async (contact, fallbackUserId) => {
  const { name, company, role_title, notes, email } = contact || {};

  // Basic email presence check
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const cleanEmail = (email || '').trim().toLowerCase();

  if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
    throw new Error(`Contact "${name || 'Recruiter'}" lacks a valid email address ("${cleanEmail || 'missing'}"). Draft generation skipped.`);
  }

  // Step 1: Real-time Email Verification (Syntax, DNS MX, SMTP Socket Handshake)
  const verification = await verifyEmail(cleanEmail);

  if (verification.status === VerificationResult.FORMAT_ERROR || verification.status === VerificationResult.INVALID) {
    throw new Error(`Email verification failed for "${cleanEmail}" (${verification.status}): ${verification.reason}. Draft generation aborted.`);
  }

  // Step 2: Fetch active candidate profile from local storage engine
  const userProfile = fileDb.getProfile();

  // Step 3: Generate personalized opener via Groq (with candidate projects & background)
  const { opener, llm_generated } = await generatePersonalizedOpener({
    name,
    company,
    role_title,
    notes,
    candidate: userProfile
  });

  // Step 4: Assemble full draft via deterministic template engine (coldEmail.js)
  const { subject, htmlBody, textBody } = buildColdEmail({
    name,
    company,
    role_title,
    opener,
    candidate: userProfile
  });

  return {
    subject,
    htmlBody,
    textBody,
    llm_generated,
    opener,
    verification
  };
};
