import Groq from 'groq-sdk';

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
