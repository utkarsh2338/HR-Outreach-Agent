import Groq from 'groq-sdk';
import { buildColdEmail } from '../templates/coldEmail.js';

const MODEL = 'llama-3.3-70b-versatile';

// Generic fallback opener used when Groq fails or returns a weak result
const FALLBACK_OPENER =
  `I came across ${'{company}'}` +
  ` and noticed your team is actively building — I'd love to explore if my background could be a fit.`;

const getFallbackOpener = (company) =>
  `I came across ${company} and noticed your team is actively building — I'd love to explore if my background could be a fit.`;

const CLICHE_PATTERNS = [
  /i hope this (email |message )?(finds|reaches) you/i,
  /i was (thrilled|excited|delighted|so excited)/i,
  /i came across your (profile|linkedin)/i,
  /as an? (ai|language model)/i,
  /i (cannot|can't|am unable to)/i,
  /here is (your|the) (personalized|opening)/i,
  /^sure[,!]?\s/i,
  /^of course[,!]?\s/i,
  /^certainly[,!]?\s/i,
  /^opening line:/i,
  /^personalized opener:/i
];

/**
 * Returns true if the text looks like a cliché, refusal, or preamble from the LLM.
 */
const isWeakResponse = (text) => {
  if (!text || text.trim().length < 15) return true;
  // Reject anything with more than ~60 words (limit is 40 — give some leeway)
  const wordCount = text.trim().split(/\s+/).length;
  if (wordCount > 60) return true;
  return CLICHE_PATTERNS.some((pattern) => pattern.test(text));
};

/**
 * Generates a personalized 1-2 sentence cold email opener using Groq's Llama 3.3 70B model.
 * Falls back gracefully to a neutral static opener on any error or weak response.
 *
 * @param {object} params
 * @param {string} params.name        - Recipient's name
 * @param {string} params.company     - Recipient's company name
 * @param {string} params.role_title  - Recipient's job title (optional)
 * @param {string} params.notes       - Internal notes that may contain useful context (optional)
 * @returns {Promise<{ opener: string, llm_generated: boolean }>}
 */
export const generatePersonalizedOpener = async ({ name, company, role_title, notes }) => {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    console.warn('[groqService] GROQ_API_KEY not set — using fallback opener');
    return { opener: getFallbackOpener(company), llm_generated: false };
  }

  const roleContext = role_title ? ` (${role_title})` : '';
  const notesContext = notes ? `\nAdditional context: ${notes}` : '';

  const systemPrompt = `You write cold email openers for a software developer reaching out to HR professionals and recruiters.

Rules you MUST follow:
- Write exactly 1-2 sentences, plain text only
- Stay under 40 words total
- Reference something specific and plausible about the company or role — NOT generic praise
- Do NOT use: "I hope this email finds you well", "I was thrilled", "I was excited", "I came across your profile", "I stumbled upon"
- Do NOT include any preamble, label, or explanation — output ONLY the opener text itself
- Sound like a real person, not a marketing email`;

  const userPrompt = `Write the personalized opening line for a cold email to a recruiter.

Recipient: ${name || 'the recruiter'}
Company: ${company}
Role: ${role_title || 'HR / Talent Acquisition'}${notesContext}

Return only the opener text, nothing else.`;

  try {
    const groq = new Groq({ apiKey });

    const completion = await groq.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 80,
      stream: false
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() ?? '';

    if (isWeakResponse(raw)) {
      console.warn(`[groqService] LLM response failed quality check for "${company}", using fallback. Response: "${raw}"`);
      return { opener: getFallbackOpener(company), llm_generated: false };
    }

    return { opener: raw, llm_generated: true };
  } catch (error) {
    console.error(`[groqService] Groq API call failed: ${error.message}`);
    return { opener: getFallbackOpener(company), llm_generated: false };
  }
};

/**
 * Generates a full personalized cold email based on the candidate's active UserProfile.
 * Uses Groq (Llama 3.3 70B) to synthesize resume + GitHub + LinkedIn data into a targeted outreach email.
 *
 * @param {object} params
 * @param {object} params.userProfile - Candidate profile object from database
 * @param {object} params.contact     - Recipient contact mongoose doc or object
 * @returns {Promise<{ subject: string, textBody: string, htmlBody: string, llm_generated: boolean }>}
 */
export const generateFullPersonalizedEmail = async ({ userProfile, contact }) => {
  const { name: recruiterName, company, role_title, notes } = contact || {};
  const companyName = company ? company.trim() : 'your team';

  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    const fallback = buildColdEmail({ name: recruiterName, company: companyName, role_title, candidate: userProfile });
    return {
      subject: fallback.subject,
      textBody: fallback.textBody,
      htmlBody: fallback.htmlBody,
      llm_generated: false
    };
  }

  const profile = userProfile?.parsed_profile || {};
  const candidateName = profile.name || 'Applicant';
  const githubUrl = userProfile?.github_url || profile.github_url || '';
  const linkedinUrl = userProfile?.linkedin_url || profile.linkedin_url || '';

  const systemPrompt = `You are an expert executive email writer crafting a highly personalized, high-converting cold email for a software developer candidate.

RULES:
1. Sound genuine, natural, concise, and professional — like a real engineer writing directly to a recruiter.
2. DO NOT use generic phrases like "I hope this email finds you well", "I stumbled upon", "I am thrilled", "I am writing to express my enthusiasm", or corporate jargon.
3. Tailor the email directly using the candidate's actual projects, achievements, and skills from their background.
4. Output JSON ONLY matching this exact format with NO markdown wrapping:
{
  "subject": "Compelling subject line mentioning role/company and key strength or name",
  "textBody": "Full plain text email body including greeting, tailored hook, background highlights (bullet points or short paragraphs), call to action, and signature",
  "htmlBody": "HTML formatted version of the exact same email body with clean inline CSS styling"
}`;

  const userPrompt = `CANDIDATE BACKGROUND:
Name: ${candidateName}
Headline/Status: ${profile.headline || 'Software Engineering Candidate'}
Skills: ${Array.isArray(profile.skills) ? profile.skills.join(', ') : ''}
Projects: ${JSON.stringify(profile.projects || [])}
Work Experience: ${JSON.stringify(profile.work_experience || [])}
Education: ${JSON.stringify(profile.education || [])}
Achievements: ${Array.isArray(profile.achievements) ? profile.achievements.join('; ') : ''}
GitHub: ${githubUrl}
LinkedIn: ${linkedinUrl}

RECIPIENT / TARGET:
Recruiter Name: ${recruiterName || 'HR / Talent Team'}
Company Name: ${companyName}
Target Role Title: ${role_title || 'Software Engineering / SDE-1'}
Additional Context/Notes: ${notes || 'None'}

Write a complete recruiter-ready cold email. Output raw JSON only.`;

  try {
    const groq = new Groq({ apiKey });

    const completion = await groq.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.5,
      max_tokens: 1000,
      stream: false
    });

    let raw = completion.choices?.[0]?.message?.content?.trim() ?? '';

    // Extract JSON object from raw response
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      raw = jsonMatch[0];
    }

    // Sanitize unescaped control characters inside JSON string literals
    const sanitizedRaw = raw.replace(/[\u0000-\u001F\u007F-\u009F]/g, (match) => {
      if (match === '\n') return '\\n';
      if (match === '\r') return '\\r';
      if (match === '\t') return '\\t';
      return '';
    });

    const result = JSON.parse(sanitizedRaw);

    if (result?.subject && (result?.textBody || result?.htmlBody)) {
      return {
        subject: result.subject,
        textBody: result.textBody,
        htmlBody: result.htmlBody || result.textBody.replace(/\n/g, '<br>'),
        llm_generated: true
      };
    }

    const fallback = buildColdEmail({ name: recruiterName, company: companyName, role_title, candidate: userProfile });
    return {
      subject: fallback.subject,
      textBody: fallback.textBody,
      htmlBody: fallback.htmlBody,
      llm_generated: false
    };
  } catch (err) {
    console.error(`[groqService] generateFullPersonalizedEmail failed: ${err.message}`);
    const fallback = buildColdEmail({ name: recruiterName, company: companyName, role_title, candidate: userProfile });
    return {
      subject: fallback.subject,
      textBody: fallback.textBody,
      htmlBody: fallback.htmlBody,
      llm_generated: false
    };
  }
};
