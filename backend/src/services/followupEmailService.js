import Groq from 'groq-sdk';
import EmailLog from '../models/EmailLog.js';
import { LLM_MODEL } from '../config/llm.js';

const CLICHE_PATTERNS = [
  /i hope this (email |message )?(finds|reaches) you/i,
  /i was (thrilled|excited|delighted)/i,
  /just (wanted to|checking in to) (circle back|follow up|touch base|reach out)/i,
  /as an? (ai|language model)/i,
  /^sure[,!]?\s/i,
  /^of course[,!]?\s/i,
  /^certainly[,!]?\s/i,
  /^opening line:/i
];

const isWeakResponse = (text) => {
  if (!text || text.trim().length < 15) return true;
  if (text.trim().split(/\s+/).length > 60) return true;
  return CLICHE_PATTERNS.some((p) => p.test(text));
};

const getFallbackNudge = (company) =>
  `I wanted to follow up on my previous note about potential opportunities at ${company} — still very interested if the timing works.`;

/**
 * Generates a short, human-sounding follow-up nudge sentence using Groq.
 *
 * @param {{ name: string, company: string, role_title: string, followup_count: number, originalOpener?: string }} params
 * @returns {Promise<{ nudge: string, llm_generated: boolean }>}
 */
export const generateFollowupNudge = async ({ name, company, role_title, followup_count, originalOpener }) => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return { nudge: getFallbackNudge(company), llm_generated: false };
  }

  const attemptLabel = followup_count === 1 ? 'first' : 'second';
  const roleCtx = role_title ? ` (${role_title})` : '';
  const originalCtx = originalOpener ? `\nOriginal initial email context: "${originalOpener}"` : '';

  const systemPrompt = `You write concise follow-up nudges for cold emails in a job search context.

Rules you MUST follow:
- Write exactly 1 sentence, plain text only, under 35 words
- Reference that a previous email was sent — do NOT pretend it's a first contact
- Be polite and low-pressure — no urgency, no desperation
- Avoid: "just following up", "circle back", "touch base", "I hope this finds you", "reaching out again"
- Sound like a real person, not a sales bot
- Output ONLY the nudge sentence — no preamble, no label`;

  const userPrompt = `Write a follow-up nudge for my ${attemptLabel} follow-up email.

Recipient: ${name || 'the recruiter'}${roleCtx}
Company: ${company}${originalCtx}

Return only the nudge sentence.`;

  try {
    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
      model: LLM_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.65,
      max_tokens: 70,
      stream: false
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() ?? '';
    if (isWeakResponse(raw)) {
      console.warn(`[followupEmail] Weak LLM nudge for "${company}", using fallback.`);
      return { nudge: getFallbackNudge(company), llm_generated: false };
    }

    return { nudge: raw, llm_generated: true };
  } catch (err) {
    console.error(`[followupEmail] Groq error: ${err.message}`);
    return { nudge: getFallbackNudge(company), llm_generated: false };
  }
};

/**
 * Builds a full follow-up email draft (plain-text + HTML) for a contact.
 *
 * @param {object} contact - Contact mongoose document
 * @returns {Promise<{ subject: string, htmlBody: string, textBody: string, llm_generated: boolean }>}
 */
export const generateFollowupEmail = async (contact) => {
  const { name, company, role_title, followup_count, _id, user_id } = contact;
  const greeting = name ? name.split(' ')[0] : 'there';

  // Find original outbound email log to preserve context
  let originalOpener = '';
  let originalSubject = `Exploring opportunities at ${company}`;

  if (_id) {
    const priorLog = await EmailLog.findOne({ contact_id: _id, direction: 'outbound' }).sort({ createdAt: 1 });
    if (priorLog) {
      originalSubject = priorLog.subject ? `Re: ${priorLog.subject.replace(/^Re:\s*/i, '')}` : originalSubject;
      originalOpener = priorLog.body ? priorLog.body.slice(0, 150) : '';
    }
  }

  const { nudge, llm_generated } = await generateFollowupNudge({
    name,
    company,
    role_title,
    followup_count,
    originalOpener
  });

  const subject = originalSubject;

  const textBody = `Hi ${greeting},

${nudge}

I'll keep this brief — I'm a software developer with full-stack experience (Node.js, React, MongoDB) and I'd genuinely love to explore whether there's a fit at ${company}, now or in the future.

Happy to send more details or jump on a quick call whenever suits you.

Best regards,
Utkarsh Shukla`;

  const htmlBody = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; line-height: 1.7; color: #2c2c2c; max-width: 560px; margin: 0 auto; padding: 24px;">

  <p>Hi ${greeting},</p>

  <p>${nudge}</p>

  <p>I'll keep this brief — I'm a software developer with full-stack experience (Node.js, React, MongoDB) and I'd genuinely love to explore whether there's a fit at <strong>${company}</strong>, now or in the future.</p>

  <p>Happy to send more details or jump on a quick call whenever suits you.</p>

  <p style="margin-top: 28px;">
    Best regards,<br>
    <strong>Utkarsh Shukla</strong>
  </p>

</body>
</html>`;

  return { subject, textBody, htmlBody, llm_generated };
};

// Backward-compatible alias
export const generateFollowupDraft = generateFollowupEmail;
