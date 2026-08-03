import Groq from 'groq-sdk';

const MODEL = 'llama-3.3-70b-versatile';

/**
 * Uses Groq LLM to analyze, deduplicate, and synthesize raw resume text,
 * GitHub repositories data, and LinkedIn profile info into a unified candidate profile JSON.
 *
 * @param {object} params
 * @param {string} [params.resumeText]
 * @param {object} [params.githubData]
 * @param {object} [params.linkedinData]
 * @returns {Promise<object>} Synthesized candidate profile object
 */
export const synthesizeUserProfile = async ({ resumeText = '', githubData = null, linkedinData = null }) => {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    console.warn('[profileAnalysisService] GROQ_API_KEY not set — using basic text extraction fallback');
    return buildFallbackProfile(resumeText, githubData, linkedinData);
  }

  const inputsSummary = [];

  if (resumeText) {
    inputsSummary.push(`=== RESUME TEXT ===\n${resumeText.slice(0, 8000)}`);
  }

  if (githubData) {
    inputsSummary.push(`=== GITHUB DATA ===\n${JSON.stringify(githubData, null, 2)}`);
  }

  if (linkedinData) {
    inputsSummary.push(`=== LINKEDIN DATA ===\n${JSON.stringify(linkedinData, null, 2)}`);
  }

  if (inputsSummary.length === 0) {
    return buildFallbackProfile('', null, null);
  }

  const systemPrompt = `You are an expert HR background analyst and resume parser.
Analyze the candidate's raw resume text, GitHub repositories, and LinkedIn data provided.
Synthesize all inputs into a single, comprehensive, deduplicated JSON profile.

Return ONLY valid JSON matching this exact structure with NO markdown wrappers around it (no backticks):
{
  "name": "Candidate Full Name",
  "headline": "Current title, status, or role (e.g. Final Year CS Student @ University / Tech Lead)",
  "skills": ["Language 1", "Framework 2", "Database 3", "Tool 4"],
  "projects": [
    {
      "title": "Project Name",
      "description": "2-3 sentences describing key features, architecture, and impact/metrics",
      "tech_stack": ["React", "Node.js"],
      "url": "https://..."
    }
  ],
  "work_experience": [
    {
      "title": "Job Title",
      "company": "Company Name",
      "duration": "Dates/Duration",
      "description": "Key contributions, technical achievements, metrics"
    }
  ],
  "education": [
    {
      "degree": "Degree & Major",
      "institution": "University / Institution Name",
      "year": "Graduation Year / Span",
      "details": "GPA or key coursework"
    }
  ],
  "achievements": [
    "Competitive programming ratings, hackathon wins, DSA problems solved, certifications, metrics"
  ],
  "open_source": [
    "Key open source contributions or notable public GitHub repositories"
  ],
  "career_focus": "Target roles, technical interests, and professional focus",
  "contact_info": {
    "email": "Email address if found, else empty string",
    "phone": "Phone number if found, else empty string",
    "location": "City/Country if found, else empty string"
  }
}`;

  const userPrompt = `Synthesize the following candidate inputs into the required JSON format:

${inputsSummary.join('\n\n')}

Remember: Output raw JSON only. Do not include markdown code block syntax.`;

  try {
    const groq = new Groq({ apiKey });

    const completion = await groq.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2,
      max_tokens: 1500,
      stream: false
    });

    let raw = completion.choices?.[0]?.message?.content?.trim() ?? '';

    // Strip markdown code fences if LLM accidentally included them
    if (raw.startsWith('```')) {
      raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    }

    const parsed = JSON.parse(raw);
    return parsed;
  } catch (err) {
    console.error(`[profileAnalysisService] LLM synthesis failed: ${err.message}`);
    return buildFallbackProfile(resumeText, githubData, linkedinData);
  }
};

/**
 * Basic non-LLM fallback if Groq API is missing or fails.
 */
const buildFallbackProfile = (resumeText, githubData, linkedinData) => {
  const lines = resumeText ? resumeText.split('\n').map((l) => l.trim()).filter(Boolean) : [];
  const name = lines.length > 0 ? lines[0] : (githubData?.name || 'Applicant');

  return {
    name,
    headline: githubData?.bio || 'Software Engineer',
    skills: githubData?.top_languages || [],
    projects: (githubData?.repositories || []).slice(0, 3).map((r) => ({
      title: r.name,
      description: r.description || 'GitHub Repository',
      tech_stack: r.language ? [r.language] : [],
      url: r.url
    })),
    work_experience: [],
    education: [],
    achievements: githubData?.total_stars ? [`${githubData.total_stars} GitHub Stars`] : [],
    open_source: githubData?.repositories ? githubData.repositories.map((r) => r.name) : [],
    career_focus: 'Software Engineering / Full Stack Development',
    contact_info: {
      email: '',
      phone: '',
      location: ''
    }
  };
};
