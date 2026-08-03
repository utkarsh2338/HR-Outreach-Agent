import Groq from 'groq-sdk';

const MODEL = 'llama-3.3-70b-versatile';

const VALID_CLASSIFICATIONS = [
  'interested',
  'not_interested',
  'auto_reply',
  'bounce',
  'out_of_office',
  'unclear'
];

/**
 * Classifies an inbound reply using Groq (Llama 3.3 70B).
 * Returns a classification label and a one-line reasoning string.
 *
 * Falls back to "unclear" with a note if Groq is unavailable or returns
 * an unrecognised label.
 *
 * @param {object} params
 * @param {string} params.subject  - Email subject line
 * @param {string} params.body     - Plain-text body of the reply
 * @param {string} params.from     - Sender email / name string
 * @returns {Promise<{ classification: string, reason: string, llm_classified: boolean }>}
 */
export const classifyReply = async ({ subject, body, from }) => {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return {
      classification: 'unclear',
      reason: 'GROQ_API_KEY not configured — classification skipped.',
      llm_classified: false
    };
  }

  // Truncate body to avoid token waste on long email threads
  const truncatedBody = body?.slice(0, 1500) ?? '(empty)';

  const systemPrompt = `You are an email reply classifier for a job-search cold email system.

Classify the following email reply into EXACTLY ONE of these labels:
- interested: The HR/recruiter shows genuine interest in the candidate (e.g. asks for CV, proposes a call, says they'll forward to hiring manager)
- not_interested: Explicitly declines or says there are no suitable openings right now
- auto_reply: An automated out-of-office or acknowledgement system reply (no human decision)
- bounce: A delivery failure notification or mailer daemon error
- out_of_office: A human-set temporary absence notification
- unclear: Anything ambiguous, off-topic, or that doesn't fit the above categories

Respond in this EXACT format with no other text:
CLASSIFICATION: <label>
REASON: <one sentence explaining why, max 20 words>`;

  const userPrompt = `From: ${from || 'unknown'}
Subject: ${subject || '(no subject)'}
Body:
${truncatedBody}`;

  try {
    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1, // Low temperature for deterministic classification
      max_tokens: 80,
      stream: false
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() ?? '';

    // Parse structured response
    const classMatch = raw.match(/^CLASSIFICATION:\s*(\S+)/im);
    const reasonMatch = raw.match(/^REASON:\s*(.+)/im);

    const label = classMatch?.[1]?.toLowerCase().trim() ?? '';
    const reason = reasonMatch?.[1]?.trim() ?? 'No reasoning provided.';

    if (!VALID_CLASSIFICATIONS.includes(label)) {
      console.warn(`[replyClassifier] Unexpected label "${label}" for reply from ${from}, defaulting to unclear`);
      return {
        classification: 'unclear',
        reason: `LLM returned unrecognised label: "${label}"`,
        llm_classified: false
      };
    }

    return {
      classification: label,
      reason,
      llm_classified: true
    };
  } catch (err) {
    console.error(`[replyClassifier] Groq error: ${err.message}`);
    return {
      classification: 'unclear',
      reason: `Classification failed: ${err.message}`,
      llm_classified: false
    };
  }
};
