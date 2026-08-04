import Groq from 'groq-sdk';
import { buildColdEmail } from '../templates/coldEmail.js';
import { LLM_MODEL } from '../config/llm.js';

// Generic fallback opener used when Groq fails or returns a weak result
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
  const wordCount = text.trim().split(/\s+/).length;
  if (wordCount > 60) return true;
  return CLICHE_PATTERNS.some((pattern) => pattern.test(text));
};

/**
 * Robust JSON parser for LLM outputs that safely handles literal unescaped
 * control characters (newlines/tabs) inside string values without breaking structural JSON syntax.
 */
const safeParseJSON = (rawText) => {
  if (!rawText || typeof rawText !== 'string') return null;

  let text = rawText.trim();

  // Strip markdown code fences if present
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  // Extract outermost JSON object {}
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    text = match[0];
  }

  // 1. Try direct JSON.parse first
  try {
    return JSON.parse(text);
  } catch (_) {
    // Direct parse failed, proceed to string-aware sanitization
  }

  // 2. Sanitize unescaped newlines and control characters inside string values ONLY
  try {
    let insideString = false;
    let escaped = false;
    let sanitized = '';

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      if (char === '"' && !escaped) {
        insideString = !insideString;
        sanitized += char;
      } else if (insideString) {
        if (char === '\n') {
          sanitized += '\\n';
        } else if (char === '\r') {
          sanitized += '\\r';
        } else if (char === '\t') {
          sanitized += '\\t';
        } else {
          sanitized += char;
        }
      } else {
        sanitized += char;
      }

      if (char === '\\' && !escaped) {
        escaped = true;
      } else {
        escaped = false;
      }
    }

    return JSON.parse(sanitized);
  } catch (err) {
    // 3. Fallback: Regex extraction for key properties if JSON syntax is damaged
    const subjectMatch = text.match(/"subject"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i);
    const textBodyMatch = text.match(/"textBody"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i);
    const htmlBodyMatch = text.match(/"htmlBody"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i);

    if (subjectMatch || textBodyMatch) {
      return {
        subject: subjectMatch ? subjectMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') : '',
        textBody: textBodyMatch ? textBodyMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') : '',
        htmlBody: htmlBodyMatch ? htmlBodyMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') : ''
      };
    }

    throw err;
  }
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

  const notesContext = notes ? `\nAdditional context: ${notes}` : '';

  const systemPrompt = `You write cold email openers for a software developer reaching out to HR professionals and recruiters.

Rules you MUST follow:
- Write exactly 1-2 sentences, plain text only, under 40 words total
- ONLY reference a specific company/role detail if it is explicitly present in the "Additional context" below — never invent facts, products, initiatives, funding, or team details you weren't given
- If no specific context is provided, write a warm, role-focused opener without fake specificity — genuine and plain beats invented detail
- Do NOT use: "I hope this email finds you well", "I was thrilled", "I was excited", "I came across your profile", "I stumbled upon"
- Output ONLY the opener text — no preamble, label, or explanation
- Sound like a real person, not a marketing email

Example (good, grounded in given context): "Noticed Acme's engineering blog post on their move to event-driven architecture — that's the kind of systems problem I'd want to be working on."
Example (good, no context given): "I'd love to learn more about the engineering team at Acme and whether there's a fit for a full-stack developer."
Example (bad — never do this): "I was excited to learn about Acme's innovative culture and cutting-edge technology."`;

  const userPrompt = `Write the personalized opening line for a cold email to a recruiter.

Recipient: ${name || 'the recruiter'}
Company: ${company}
Role: ${role_title || 'HR / Talent Acquisition'}${notesContext}

Return only the opener text, nothing else.`;

  try {
    const groq = new Groq({ apiKey });

    const completion = await groq.chat.completions.create({
      model: LLM_MODEL,
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
  const candidateName = profile.name || 'Tanish Patidar';
  const githubUrl = userProfile?.github_url || profile.github_url || 'https://github.com/TechTAnish-07';
  const linkedinUrl = userProfile?.linkedin_url || profile.linkedin_url || 'https://www.linkedin.com/in/tanish07patidar-/';
  const portfolioUrl = userProfile?.portfolio_url || profile.portfolio_url || '';
  const resumeUrl = userProfile?.resume_url || profile.resume_url || '';

  const systemPrompt = `You are an expert executive email writer crafting a highly personalized, high-converting cold email for a software developer candidate.

RULES:
1. Sound genuine, natural, concise, and professional — like a real engineer writing directly to a recruiter.
2. DO NOT use generic phrases like "I hope this email finds you well", "I stumbled upon", "I am thrilled", "I am writing to express my enthusiasm", or corporate jargon.
3. Tailor the email directly using the candidate's actual projects, achievements, and skills from their background.
4. Do NOT invent facts about the recipient's company (funding, initiatives, team size, products). Keep the email concise and focused on genuine candidate-role fit.
5. In the email signature, ALWAYS output full, complete URLs for candidate links so they are automatically clickable (e.g. LinkedIn: ${linkedinUrl} | GitHub: ${githubUrl}).
6. Output JSON ONLY matching this exact format with NO markdown wrapping:
{
  "subject": "Compelling subject line mentioning role/company and key strength or candidate name",
  "textBody": "Full plain text email body including greeting, tailored hook, background highlights (bullet points or short paragraphs), call to action, and signature with full URLs"
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
Portfolio: ${portfolioUrl}
Resume Link: ${resumeUrl}

RECIPIENT / TARGET:
Recruiter Name: ${recruiterName || 'HR / Talent Team'}
Company Name: ${companyName}
Target Role Title: ${role_title || 'Software Engineering / SDE-1'}
Additional Context/Notes: ${notes || 'None'}

Write a complete recruiter-ready cold email. Output raw JSON only.`;

  try {
    const groq = new Groq({ apiKey });

    const completion = await groq.chat.completions.create({
      model: LLM_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.5,
      max_tokens: 2500,
      response_format: { type: 'json_object' },
      stream: false
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() ?? '';
    const result = safeParseJSON(raw);

    if (result?.subject && result?.textBody) {
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
