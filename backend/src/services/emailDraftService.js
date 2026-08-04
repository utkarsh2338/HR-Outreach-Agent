import UserProfile from '../models/UserProfile.js';
import { generatePersonalizedOpener } from './groqService.js';
import { buildColdEmail } from '../templates/coldEmail.js';
import { verifyEmail, VerificationResult } from './emailVerifierService.js';

/**
 * Generates a personalized email draft for a contact.
 *
 * Architecture:
 * 1. Performs multi-stage Email Verification (Syntax, DNS MX Lookup, SMTP Handshake).
 *    If email is INVALID or FORMAT_ERROR, draft generation is aborted.
 * 2. Uses Groq (Llama 3.3 70B) to generate a tailored 1-sentence opening hook.
 * 3. Assembles the email body using candidate's UserProfile (Resume, GitHub, LinkedIn)
 *    and structured template engine (coldEmail.js).
 *
 * @param {object} contact - A Contact document or plain object from CSV/storage
 * @param {string} [fallbackUserId]
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
  const { name, company, role_title, notes, user_id, email } = contact || {};

  // Step 1: Real-time Email Verification (Syntax, DNS MX, SMTP Socket Handshake)
  const verification = await verifyEmail(email);

  if (verification.status === VerificationResult.FORMAT_ERROR || verification.status === VerificationResult.INVALID) {
    throw new Error(`Email verification failed for "${email || 'missing'}" (${verification.status}): ${verification.reason}. Draft generation aborted.`);
  }

  // Step 2: Fetch active candidate profile
  let userProfile = null;
  try {
    const targetUserId = user_id || fallbackUserId;
    if (targetUserId) {
      userProfile = await UserProfile.getProfile(targetUserId);
    }
    if (!userProfile) {
      userProfile = await UserProfile.findOne({});
    }
  } catch (err) {
    console.warn(`[emailDraftService] Profile fetch warning: ${err.message}`);
  }

  // Step 3: Generate personalized opener via Groq
  const { opener, llm_generated } = await generatePersonalizedOpener({
    name,
    company,
    role_title,
    notes
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
