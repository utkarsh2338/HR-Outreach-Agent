import UserProfile from '../models/UserProfile.js';
import { generatePersonalizedOpener, generateFullPersonalizedEmail } from './groqService.js';
import { buildColdEmail } from '../templates/coldEmail.js';

/**
 * Generates a personalized email draft for a contact.
 *
 * Primary path: Uses candidate's active UserProfile (Resume, GitHub, LinkedIn analysis)
 * to generate a completely tailored, recruiter-ready cold email.
 *
 * Fallback path: Uses Groq opener + static template if no profile is available.
 *
 * @param {object} contact - A Contact mongoose document (or plain object)
 * @returns {Promise<{
 *   subject: string,
 *   htmlBody: string,
 *   textBody: string,
 *   llm_generated: boolean,
 *   opener?: string
 * }>}
 */
export const generateEmailDraft = async (contact) => {
  const { name, company, role_title, notes } = contact;

  // Step 1: Check if user profile is populated with analyzed resume / github / linkedin data
  try {
    const userProfile = await UserProfile.getProfile();

    if (userProfile && (userProfile.resume_text || userProfile.parsed_profile?.name || userProfile.github_url)) {
      const personalizedDraft = await generateFullPersonalizedEmail({ userProfile, contact });

      if (personalizedDraft) {
        return {
          subject: personalizedDraft.subject,
          textBody: personalizedDraft.textBody,
          htmlBody: personalizedDraft.htmlBody,
          llm_generated: true
        };
      }
    }
  } catch (err) {
    console.warn(`[emailDraftService] Profile fetch failed, resorting to standard opener template: ${err.message}`);
  }

  // Step 2: Fallback to single opener + template
  const { opener, llm_generated } = await generatePersonalizedOpener({
    name,
    company,
    role_title,
    notes
  });

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
