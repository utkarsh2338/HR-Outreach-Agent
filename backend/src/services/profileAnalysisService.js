import Groq from 'groq-sdk';
import { LLM_MODEL } from '../config/llm.js';

/**
 * 100% Generic & Dynamic Resume Text Parser.
 * Works for ANY candidate's uploaded resume PDF/DOCX or text.
 * Dynamically extracts sections: Name, Contact Info, Experience, Projects, Skills, Education, and Achievements.
 */
export const parseResumeTextIntelligently = (resumeText = '', githubData = null, linkedinData = null) => {
  const text = (resumeText || '').trim();

  // 1. Dynamic Name Extraction — stops at first line that looks like a real name
  let name = '';
  if (text) {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    for (const l of lines.slice(0, 5)) {
      const clean = l
        .replace(/Email:.*$/i, '')
        .replace(/Mobile:.*$/i, '')
        .replace(/Phone:.*$/i, '')
        .replace(/LinkedIn:.*$/i, '')
        .replace(/GitHub:.*$/i, '')
        .replace(/Portfolio:.*$/i, '')
        .replace(/[^a-zA-Z\s]/g, '')
        .trim();
      const words = clean.split(/\s+/);
      if (words.length >= 1 && words.length <= 4 && clean.length >= 3 && clean.length <= 35) {
        name = clean;
        break;
      }
    }
  }
  if (!name && githubData?.name) name = githubData.name;
  if (!name) name = 'Candidate';

  // 2. Contact Info — broad international phone support (fix #6)
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const phoneMatch = text.match(
    /(?:\+?(?:\d{1,3})[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\d{10}|\d{5}[-.\s]\d{5})/
  );
  const email = emailMatch ? emailMatch[0] : (githubData?.email || '');
  const phone = phoneMatch ? phoneMatch[0] : '';

  // Helper: extract date ranges like "Jan 2024 – May 2025", "2022 - Present", "May 2026 – July 2026"
  const extractDate = (str) => {
    const m = str.match(
      /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)?\.?\s*\d{4}\s*[-–—]\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)?\.?\s*(?:\d{4}|Present|Current)/i
    );
    return m ? m[0].trim() : '';
  };

  // 3. Section Locator — finds start/end of each named section in the raw text
  const SECTION_TITLES = [
    'Education', 'Experience', 'Work Experience', 'Professional Experience', 'Employment History',
    'Technical Skills', 'Skills', 'Projects', 'Personal Projects', 'Side Projects',
    'Programming Achievements', 'Achievements', 'Awards', 'Certifications',
    'Honors', 'Extracurriculars', 'Activities'
  ];
  const sectionRegex = new RegExp(
    `(?:^|\\n)[ \\t]*(${SECTION_TITLES.map((s) => s.replace(/\s+/g, '\\s+')).join('|')})\\s*(?::|\\n|$)`,
    'gi'
  );

  const sectionMatches = [];
  let match;
  while ((match = sectionRegex.exec(text)) !== null) {
    sectionMatches.push({ title: match[1].trim().toLowerCase(), index: match.index });
  }

  const getSectionText = (keywords) => {
    const found = sectionMatches.find((s) => keywords.some((k) => s.title.includes(k)));
    if (!found) return '';
    const next = sectionMatches.find((s) => s.index > found.index);
    const raw = text.substring(found.index, next ? next.index : text.length);
    // Strip the section heading line itself before returning (fix #3, #4 root cause)
    return raw.replace(/^[^\n]*\n/, '').trim();
  };

  const expText  = getSectionText(['experience', 'employment']);
  const projText = getSectionText(['projects', 'personal project', 'side project']);
  const skillText = getSectionText(['skills', 'technical']);
  const eduText  = getSectionText(['education']);
  const achText  = getSectionText(['achievements', 'certifications', 'honors', 'awards']);

  // 4. Work Experience — header line vs. bullet lines correctly separated (fix #2)
  const work_experience = [];
  if (expText) {
    // Split into job blocks: a new block starts on a non-bullet line
    const jobBlocks = expText
      .split(/\n(?=[^•◦*\-\s])/)
      .map((b) => b.trim())
      .filter((b) => b.length > 5);

    for (const block of jobBlocks.slice(0, 3)) {
      const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const header = lines[0].replace(/^[•◦*\-]\s*/, '');

      // Skip pure bullet lines and standalone date-only lines as job headers
      if (/^[•◦*\-]/.test(lines[0])) continue;
      if (/^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}/i.test(header)) continue;

      const sepMatch = header.match(/^(.+?)(?:\s*[|@]\s*|\s+at\s+|\s*[–-]\s*)(.+?)(?:\s*[|@].*)?$/i);
      let title = '', company = '';
      if (sepMatch) {
        title = sepMatch[1].trim();
        company = sepMatch[2].trim();
        // If company absorbed a date, clean it
        company = company.replace(/\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec).*$/i, '').trim();
      } else {
        title = header;
        // next non-bullet, non-date line = company
        const compLine = lines.slice(1).find(
          (l) => !/^[•◦*\-]/.test(l) && !/^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(l)
        );
        company = compLine || '';
      }

      // Duration: look in header, all early lines
      const duration = extractDate(header) || extractDate(lines.slice(1, 3).join(' '));

      // Collect bullet-point description lines only
      const bullets = lines
        .slice(1)
        .filter((l) => /^[•◦*\-]/.test(l))
        .map((l) => l.replace(/^[•◦*\-]\s*/, '').trim())
        .filter(Boolean);

      // Skip if title looks like a section heading or a date
      if (!title || title.length > 60 || /^(experience|employment|work)/i.test(title)) continue;

      work_experience.push({ title, company: company || 'Company', duration, description: bullets.join(' ') });
    }
  }

  // 5. Projects — section heading NOT included as a project (fix #3)
  const projects = [];
  if (projText) {
    // Merge "Tech Stack: ..." lines back into the preceding project block so they aren't split off
    const rawProjBlocks = projText.split(/\n(?=[^•◦*\-\s\n])/).map((b) => b.trim()).filter((b) => b.length > 10);
    const projBlocks = [];
    for (const blk of rawProjBlocks) {
      if (/^tech(\s+stack)?\s*[:\s]/i.test(blk) && projBlocks.length > 0) {
        projBlocks[projBlocks.length - 1] += '\n' + blk;
      } else {
        projBlocks.push(blk);
      }
    }

    for (const block of projBlocks.slice(0, 3)) {
      const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const rawHeader = lines[0].replace(/^[•◦*\-]\s*/, '');

      // Skip section-heading-like lines
      if (/^(projects?|personal projects?|side projects?)\s*:?\s*$/i.test(rawHeader)) continue;
      if (/^tech(\s+stack)?\s*[:\s]/i.test(rawHeader)) continue;

      // Project title = text before first —, –, |
      const titleMatch = rawHeader.match(/^([A-Za-z0-9_\s.:'-]+?)(?:\s*[—–|]|$)/);
      const title = (titleMatch ? titleMatch[1].trim() : rawHeader.split(/[—–|]/)[0].trim()).replace(/\s*\|.*$/, '');

      if (!title || title.length < 2) continue;

      // Tech stack: explicit label (anywhere in block) OR parenthesised list
      const techMatch = block.match(/Tech(?:\s+Stack)?[:\s]+([^\n]+)/i) ||
                        block.match(/\(([^)]{3,80})\)/);
      const tech_stack = techMatch
        ? techMatch[1].split(/[,|]/).map((s) => s.trim()).filter(Boolean)
        : [];

      // Description: bullet lines, skip tech-stack lines
      const descLines = lines
        .slice(1)
        .filter((l) => !/^tech(\s+stack)?\s*[:\s]/i.test(l))
        .map((l) => l.replace(/^[•◦*\-]\s*/, '').trim())
        .filter(Boolean);

      const repoUrl = githubData?.repositories?.find(
        (r) => r.name.toLowerCase().replace(/-/g, ' ') === title.toLowerCase().replace(/-/g, ' ')
      )?.url || '';

      projects.push({ title, description: descLines.join(' ').trim() || rawHeader, tech_stack, url: repoUrl });
    }
  }

  // Add GitHub repos not already listed
  if (githubData?.repositories && Array.isArray(githubData.repositories)) {
    githubData.repositories.forEach((repo) => {
      if (
        repo.name &&
        !projects.some((p) => p.title.toLowerCase() === repo.name.toLowerCase()) &&
        repo.name.toLowerCase() !== name.toLowerCase()
      ) {
        projects.push({
          title: repo.name,
          description: repo.description || 'Software Engineering Project',
          tech_stack: repo.language ? [repo.language] : [],
          url: repo.url
        });
      }
    });
  }

  // 6. Skills — handles "Label: skill1, skill2" AND inline comma-separated (fix #4)
  let skills = [];
  if (skillText) {
    // First pass: handle labeled categories like "Backend: Node.js, Express"
    const labeledSkills = [...skillText.matchAll(/[A-Za-z &]+:\s*([^\n]+)/g)]
      .flatMap(([, val]) => val.split(/[,|]/).map((s) => s.trim()))
      .filter((s) => s.length >= 2 && s.length <= 40);

    // Second pass: bare comma/bullet lists
    const bareSkills = skillText
      .split(/[,•◦*|\n]/)
      .map((s) => s.replace(/^[^:]+:\s*/, '').trim())
      .filter((s) => s.length >= 2 && s.length <= 40 && !s.includes(':') && !/^\d+$/.test(s));

    const combined = [...new Set([...labeledSkills, ...bareSkills])];
    skills = combined.slice(0, 25);
  }
  if (skills.length === 0 && githubData?.top_languages) {
    skills = githubData.top_languages;
  }

  // 7. Achievements — cleaned bullet lines
  const achievements = [];
  if (achText) {
    const achLines = achText.split(/\r?\n/).map((l) => l.replace(/^[•◦*-]\s*/, '').trim()).filter((l) => l.length > 15);
    achLines.slice(0, 4).forEach((l) => achievements.push(l));
  }

  // 8. Education — correctly assigns institution vs. degree (fix #1)
  const education = [];
  if (eduText) {
    const eduLines = eduText
      .split(/\r?\n/)
      .map((l) => l.replace(/^[•◦*\-]\s*/, '').trim())
      .filter(Boolean);

    // Institution line: contains university/college/institute keywords
    const instIdx = eduLines.findIndex((l) =>
      /university|college|institute|school|\biit\b|\bnit\b|\biiit\b/i.test(l)
    );
    // Degree line: B.Tech, B.S., B.A., Bachelor of, M.S., Master of, MBA, Ph.D etc.
    const degIdx = eduLines.findIndex((l) =>
      /\b(B\.?\s?Tech|B\.?\s?E\.?|B\.?\s?Sc|B\.?\s?S\.?|B\.?\s?A\.?|M\.?\s?Tech|M\.?\s?S\.?|M\.?\s?Sc|MBA|Bachelor|Master|Ph\.?D|B\.?\s?Com)\b/i.test(l)
    );

    // institution comes from the keyword-matched line; degree from the degree-matched line
    const institution = instIdx >= 0 ? eduLines[instIdx] : (degIdx >= 0 ? '' : eduLines[0] || '');
    const degree      = degIdx >= 0 ? eduLines[degIdx]  : (instIdx >= 0 ? eduLines.find((l, i) => i !== instIdx) || '' : '');

    const allEduText = eduLines.join(' ');
    const year = extractDate(allEduText) || '';
    const gpaMatch = allEduText.match(/(?:GPA|CGPA|Grade)[\s:]+([\d.]+)/i);
    const details = gpaMatch ? `${gpaMatch[0].split(':')[0]}: ${gpaMatch[1]}` : eduLines.filter((l, i) => i !== instIdx && i !== degIdx).join(' ');

    if (institution || degree) {
      education.push({ degree, institution, year, details });
    }
  }

  // Generic Professional Headline
  const headline = work_experience.length > 0
    ? `${work_experience[0].title} | ${skills.slice(0, 3).join(', ')} Developer`
    : (education[0] ? `${education[0].degree} Student | Software Developer` : 'Full-Stack Software Engineering Candidate');

  return {
    name,
    headline,
    skills: skills.length > 0 ? skills.slice(0, 20) : ['JavaScript', 'TypeScript', 'React', 'Node.js'],
    projects: projects.slice(0, 3),
    work_experience,
    education,
    achievements,
    open_source: projects.map((p) => p.title),
    career_focus: 'Software Engineering / Full Stack Development',
    contact_info: {
      email,
      phone,
      location: ''
    }
  };
};

/**
 * Uses Groq LLM (or dynamic parser fallback) to analyze, deduplicate, and synthesize
 * raw resume text, GitHub repositories data, and LinkedIn profile info into a unified candidate profile JSON.
 *
 * @param {object} params
 * @param {string} [params.resumeText]
 * @param {object} [params.githubData]
 * @param {object} [params.linkedinData]
 * @returns {Promise<object>} Synthesized candidate profile object
 */
export const synthesizeUserProfile = async ({ resumeText = '', githubData = null, linkedinData = null }) => {
  const rawKey = process.env.GROQ_API_KEY || '';
  const apiKey = rawKey.trim().replace(/^["']|["']$/g, '');

  // Run dynamic parser on the uploaded input
  const dynamicProfile = parseResumeTextIntelligently(resumeText, githubData, linkedinData);

  if (!apiKey || apiKey === 'your_groq_api_key' || apiKey.includes('your_')) {
    console.log('[profileAnalysisService] Using dynamic resume text parser');
    return dynamicProfile;
  }

  const inputsSummary = [];

  if (resumeText) {
    inputsSummary.push(`=== UPLOADED RESUME TEXT ===\n${resumeText.slice(0, 8000)}`);
  }

  if (githubData) {
    inputsSummary.push(`=== GITHUB DATA ===\n${JSON.stringify(githubData, null, 2)}`);
  }

  if (linkedinData) {
    inputsSummary.push(`=== LINKEDIN DATA ===\n${JSON.stringify(linkedinData, null, 2)}`);
  }

  if (inputsSummary.length === 0) {
    return dynamicProfile;
  }

  const systemPrompt = `You are a universal resume parser and technical background analyst.
Analyze the candidate's raw uploaded resume text, GitHub repositories, and LinkedIn data provided.
Synthesize all inputs into a high-quality, comprehensive, deduplicated candidate profile JSON tailored strictly to the candidate's uploaded resume.

CRITICAL INSTRUCTIONS:
- Derive candidate name, title, education, skills, work experience, projects, and achievements EXCLUSIVELY from the provided text.
- Do NOT invent or hardcode candidate details, names, or fake companies.
- Clean candidate's name — do NOT append "Email:" or phone numbers into the name string.
- Output raw JSON ONLY matching this format:

{
  "name": "Candidate Full Name extracted from resume",
  "headline": "Professional headline summarizing candidate's education/experience and core skills",
  "skills": ["Language 1", "Framework 2", "Database 3", "Tool 4"],
  "projects": [
    {
      "title": "Project Name",
      "description": "Key features, technical architecture, and impact",
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
      "details": "CGPA/GPA or key coursework"
    }
  ],
  "achievements": [
    "Competitive programming ratings, awards, hackathons, certifications, metrics"
  ],
  "open_source": [
    "Key open source contributions or public GitHub repositories"
  ],
  "career_focus": "Target career focus derived from resume (e.g. Software Engineering / Full Stack Development)",
  "contact_info": {
    "email": "Email address extracted from resume",
    "phone": "Phone number extracted from resume",
    "location": "City/Country if found"
  }
}`;

  const userPrompt = `Synthesize the provided candidate inputs into the required JSON format:

${inputsSummary.join('\n\n')}

Return raw JSON only.`;

  try {
    const groq = new Groq({ apiKey });

    const completion = await groq.chat.completions.create({
      model: LLM_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
      stream: false
    });

    let raw = completion.choices?.[0]?.message?.content?.trim() ?? '';

    if (raw.startsWith('```')) {
      raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    }

    const parsed = JSON.parse(raw);

    // Sanitize name
    if (parsed.name) {
      parsed.name = parsed.name.replace(/Email:.*$/i, '').replace(/Mobile:.*$/i, '').replace(/Phone:.*$/i, '').trim();
    }

    return parsed;
  } catch (err) {
    console.error(`[profileAnalysisService] LLM synthesis failed: ${err.message}. Using dynamic parser fallback.`);
    return dynamicProfile;
  }
};
