import { generatePersonalizedOpener } from './groqService.js';
import { buildColdEmail } from '../templates/coldEmail.js';

/**
 * Generates a full personalized email draft for a contact.
 * Calls Groq for the opener, then merges it into the fixed template.
 *
 * @param {object} contact - A Contact mongoose document (or plain object)
 * @returns {Promise<{
 *   subject: string,
 *   htmlBody: string,
 *   textBody: string,
 *   llm_generated: boolean,
 *   opener: string
 * }>}
 */
export const generateEmailDraft = async (contact) => {
  const { name, company, role_title, notes } = contact;

  // Step 1: Get personalized opener from Groq (with fallback)
  const { opener, llm_generated } = await generatePersonalizedOpener({
    name,
    company,
    role_title,
    notes
  });

  // Step 2: Merge opener into the fixed template
  const { subject, htmlBody, textBody } = buildColdEmail({
    name,
    company,
    role_title,
    opener
  });

  return {
    subject,
    htmlBody,
    textBody,
    llm_generated,
    opener
  };
};
