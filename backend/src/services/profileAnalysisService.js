import Groq from 'groq-sdk';
import { LLM_MODEL } from '../config/llm.js';

/**
 * Clean and normalize PDF-extracted text (rejoins fragmented lines & fixes squished headers)
 */
const normalizeResumeText = (rawText = '') => {
  if (!rawText) return '';

  let text = rawText;

  // Fix squished date patterns (e.g. "47BillionMay 2026" -> "47Billion May 2026")
  text = text.replace(/([a-zA-Z])(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*(\d{4})/gi, '$1 $2 $3');
  // Fix squished title patterns (e.g. "InternIndore" -> "Intern Indore")
  text = text.replace(/([a-z])([A-Z][a-z]+)/g, '$1 $2');
  // Remove link noise (e.g. "| Code | Live", "(Certificate)")
  text = text.replace(/\|\s*(Code|Live|Demo)\s*/gi, '');
  text = text.replace(/\(Certificate\)/gi, '');

  return text.trim();
};

/**
 * 100% Generic & Dynamic Resume Text Parser.
 * Works for ANY candidate's uploaded resume PDF/DOCX or text.
 * STICKLY PRIORITIZES THE UPLOADED RESUME OVER GITHUB DATA.
 */
export const parseResumeTextIntelligently = (resumeText = '', githubData = null, linkedinData = null) => {
  const text = normalizeResumeText(resumeText);

  // 1. Dynamic Name Extraction
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

  // 2. Contact Info
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const phoneMatch = text.match(
    /(?:\+?(?:\d{1,3})[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\d{10}|\d{5}[-.\s]\d{5})/
  );
  const email = emailMatch ? emailMatch[0] : (githubData?.email || '');
  const phone = phoneMatch ? phoneMatch[0] : '';

  // Helper: extract date ranges
  const extractDate = (str) => {
    const m = str.match(
      /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)?\.?\s*\d{4}\s*[-–—]\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)?\.?\s*(?:\d{4}|Present|Current)/i
    );
    return m ? m[0].trim() : '';
  };

  // 3. Section Locator
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
    return raw.replace(/^[^\n]*\n/, '').trim();
  };

  const expText = getSectionText(['experience', 'employment']);
  const projText = getSectionText(['projects', 'personal project', 'side project']);
  const skillText = getSectionText(['skills', 'technical']);
  const eduText = getSectionText(['education']);
  const achText = getSectionText(['achievements', 'certifications', 'honors', 'awards']);

  // 4. Work Experience — strictly parse resume text
  const work_experience = [];
  if (expText) {
    const jobBlocks = expText
      .split(/\n(?=[•◦*-]?\s*[A-Z0-9][a-zA-Z0-9\s—–|-]+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\d{4}))/i)
      .map((b) => b.trim())
      .filter((b) => b.length > 10);

    const fallbackBlocks = jobBlocks.length > 0 ? jobBlocks : expText.split(/\n(?=[^•◦*\-\s])/).map((b) => b.trim()).filter((b) => b.length > 10);

    for (const block of fallbackBlocks.slice(0, 3)) {
      const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const header = lines[0].replace(/^[•◦*\-]\s*/, '');

      if (/^[•◦*\-]/.test(lines[0])) continue;

      const sepMatch = header.match(/^(.+?)(?:\s*[|@]\s*|\s+at\s+|\s*[–-]\s*)(.+?)(?:\s*[|@].*)?$/i);
      let title = '', company = '';
      if (sepMatch) {
        title = sepMatch[1].trim();
        company = sepMatch[2].trim().replace(/\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec).*$/i, '').trim();
      } else {
        title = header.split(/–|-|\d{4}/)[0].trim();
        const compLine = lines.slice(1).find(
          (l) => !/^[•◦*\-]/.test(l) && !/^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(l)
        );
        company = compLine || '';
      }

      const duration = extractDate(header) || extractDate(lines.slice(1, 3).join(' '));

      const bullets = lines
        .slice(1)
        .filter((l) => /^[•◦*\-]/.test(l) || l.length > 20)
        .map((l) => l.replace(/^[•◦*\-]\s*/, '').trim())
        .filter((l) => l.length > 10 && !/^(experience|employment|work)/i.test(l));

      if (!title || title.length > 60 || /^(experience|employment|work)/i.test(title)) continue;

      work_experience.push({
        title,
        company: company || 'Company',
        duration,
        description: bullets.join(' ')
      });
    }
  }

  // 5. Projects — STICKLY DERIVED FROM RESUME TEXT ONLY
  const projects = [];
  if (projText) {
    const rawProjBlocks = projText.split(/\n(?=[•◦*-]?\s*[A-Z0-9][a-zA-Z0-9\s.:'-]+[—–|]|\n\s*•|\n\s*◦)/).map((b) => b.trim()).filter((b) => b.length > 10);

    for (const block of rawProjBlocks.slice(0, 3)) {
      const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const rawHeader = lines[0].replace(/^[•◦*\-]\s*/, '');

      if (/^(projects?|personal projects?|side projects?|programming achievements?)\s*:?\s*$/i.test(rawHeader)) continue;
      if (/^tech(\s+stack)?\s*[:\s]/i.test(rawHeader)) continue;
      if (rawHeader.length < 5 || rawHeader.endsWith('.')) continue; // ignore broken fragment lines ending in period

      const titleMatch = rawHeader.match(/^([A-Za-z0-9_\s.:'-]+?)(?:\s*[—–|]|$)/);
      const title = (titleMatch ? titleMatch[1].trim() : rawHeader.split(/[—–|]/)[0].trim()).replace(/\s*\|.*$/, '');

      if (!title || title.length < 3 || /^(latency|guarantee|engineered|implemented|secured)/i.test(title)) continue;

      const techMatch = block.match(/Tech(?:\s+Stack)?[:\s]+([^\n]+)/i) || block.match(/\(([^)]{3,80})\)/);
      const tech_stack = techMatch ? techMatch[1].split(/[,|]/).map((s) => s.trim()).filter(Boolean) : [];

      const descLines = lines
        .slice(1)
        .filter((l) => !/^tech(\s+stack)?\s*[:\s]/i.test(l))
        .map((l) => l.replace(/^[•◦*\-]\s*/, '').trim())
        .filter((l) => l.length > 8);

      const repoUrl = githubData?.repositories?.find(
        (r) => r.name.toLowerCase().replace(/[-_]/g, ' ') === title.toLowerCase().replace(/[-_]/g, ' ')
      )?.url || '';

      projects.push({
        title,
        description: descLines.join(' ').trim() || rawHeader,
        tech_stack,
        url: repoUrl
      });
    }
  }

  // ONLY use GitHub repos if resume yielded ZERO projects
  if (projects.length === 0 && githubData?.repositories && Array.isArray(githubData.repositories)) {
    githubData.repositories.slice(0, 2).forEach((repo) => {
      if (repo.name && !['portfolio', name.toLowerCase()].includes(repo.name.toLowerCase())) {
        projects.push({
          title: repo.name,
          description: repo.description || 'Full-Stack Software Engineering Project',
          tech_stack: repo.language ? [repo.language] : [],
          url: repo.url
        });
      }
    });
  }

  // 6. Skills
  let skills = [];
  if (skillText) {
    const labeledSkills = [...skillText.matchAll(/[A-Za-z &]+:\s*([^\n]+)/g)]
      .flatMap(([, val]) => val.split(/[,|]/).map((s) => s.trim()))
      .filter((s) => s.length >= 2 && s.length <= 40);

    const bareSkills = skillText
      .split(/[,•◦*|\n]/)
      .map((s) => s.replace(/^[^:]+:\s*/, '').trim())
      .filter((s) => s.length >= 2 && s.length <= 40 && !s.includes(':') && !/^\d+$/.test(s));

    skills = [...new Set([...labeledSkills, ...bareSkills])].slice(0, 25);
  }
  if (skills.length === 0 && githubData?.top_languages) {
    skills = githubData.top_languages;
  }

  // 7. Achievements
  const achievements = [];
  if (achText) {
    achText
      .split(/\r?\n/)
      .map((l) => l.replace(/^[•◦*\-]\s*/, '').trim())
      .filter((l) => l.length > 15 && !/^(programming achievements|certifications|extracurriculars)$/i.test(l))
      .slice(0, 4)
      .forEach((l) => achievements.push(l));
  }

  // 8. Education
  const education = [];
  if (eduText) {
    const eduLines = eduText
      .split(/\r?\n/)
      .map((l) => l.replace(/^[•◦*\-]\s*/, '').trim())
      .filter(Boolean);

    const instIdx = eduLines.findIndex((l) =>
      /university|college|institute|school|\biit\b|\bnit\b|\biiit\b/i.test(l)
    );
    const degIdx = eduLines.findIndex((l) =>
      /\b(B\.?\s?Tech|B\.?\s?E\.?|B\.?\s?Sc|B\.?\s?S\.?|B\.?\s?A\.?|M\.?\s?Tech|M\.?\s?S\.?|M\.?\s?Sc|MBA|Bachelor|Master|Ph\.?D|B\.?\s?Com)\b/i.test(l)
    );

    const institution = instIdx >= 0 ? eduLines[instIdx] : (degIdx >= 0 ? '' : eduLines[0] || '');
    const degree = degIdx >= 0 ? eduLines[degIdx] : (instIdx >= 0 ? eduLines.find((l, i) => i !== instIdx) || '' : '');

    const allEduText = eduLines.join(' ');
    const year = extractDate(allEduText) || '';
    const gpaMatch = allEduText.match(/(?:GPA|CGPA|Grade)[\s:]+([\d.]+)/i);
    const details = gpaMatch ? `CGPA: ${gpaMatch[1]}` : eduLines.filter((l, i) => i !== instIdx && i !== degIdx).join(' ');

    if (institution || degree) {
      education.push({ degree, institution, year, details });
    }
  }

  // Headline
  const headline = work_experience.length > 0
    ? `${work_experience[0].title}${work_experience[0].company ? ' @ ' + work_experience[0].company : ''}`
    : (education[0] ? `${education[0].degree} Student | Software Developer` : 'Full-Stack Software Engineering Candidate');

  return {
    name,
    headline,
    skills: skills.length > 0 ? skills : ['JavaScript', 'TypeScript', 'React', 'Node.js'],
    projects: projects.slice(0, 3),
    work_experience,
    education,
    achievements,
    open_source: projects.map((p) => p.title).filter(Boolean),
    career_focus: 'Software Engineering / Full Stack Development',
    contact_info: { email, phone, location: '' }
  };
};

/**
 * Uses Groq LLM (or dynamic parser fallback) to analyze, deduplicate, and synthesize
 * raw resume text, GitHub repositories data, and LinkedIn profile info into a unified candidate profile JSON.
 */
export const synthesizeUserProfile = async ({ resumeText = '', githubData = null, linkedinData = null }) => {
  const rawKey = process.env.GROQ_API_KEY || '';
  const apiKey = rawKey.trim().replace(/^["']|["']$/g, '');

  const dynamicProfile = parseResumeTextIntelligently(resumeText, githubData, linkedinData);

  if (!apiKey || apiKey === 'your_groq_api_key' || apiKey.includes('your_')) {
    console.log('[profileAnalysisService] Using dynamic resume text parser');
    return dynamicProfile;
  }

  const inputsSummary = [];

  if (resumeText) {
    inputsSummary.push(`=== UPLOADED RESUME TEXT (PRIMARY SOURCE OF TRUTH) ===\n${resumeText.slice(0, 8000)}`);
  }

  if (githubData) {
    inputsSummary.push(`=== GITHUB DATA (SECONDARY REFERENCE ONLY) ===\nUsername: ${githubData.username}\nProfile URL: ${githubData.profile_url}`);
  }

  if (linkedinData) {
    inputsSummary.push(`=== LINKEDIN DATA ===\n${JSON.stringify(linkedinData, null, 2)}`);
  }

  if (inputsSummary.length === 0) {
    return dynamicProfile;
  }

  const systemPrompt = `You are an expert technical recruiter and resume parser.
Analyze the candidate's raw uploaded resume text as the PRIMARY SOURCE OF TRUTH.

CRITICAL DIRECTIVES:
1. Extract Work Experience, Projects, Education, Achievements, and Skills STRICTLY from the UPLOADED RESUME TEXT.
2. Do NOT list raw/random GitHub repositories as projects unless they are explicitly detailed in the resume.
3. Do NOT fragment sentences or bullet points into separate fake projects or jobs (e.g. "latency." or "guarantee strict state...").
4. Keep project titles clean (e.g. "LiveInterview", "Sangraj Rentals").
5. Clean candidate's name — do NOT append "Email:" or phone numbers into the name.
6. Output raw JSON ONLY with no markdown wrappers matching this structure:

{
  "name": "Candidate Full Name",
  "headline": "Professional headline summarizing education/experience and skills",
  "skills": ["Skill 1", "Skill 2"],
  "projects": [
    {
      "title": "Project Name",
      "description": "Clean 1-2 sentence description of architecture and metrics",
      "tech_stack": ["React", "Spring Boot"],
      "url": "https://..."
    }
  ],
  "work_experience": [
    {
      "title": "Job Title",
      "company": "Company Name",
      "duration": "Dates/Duration",
      "description": "Key contributions and achievements"
    }
  ],
  "education": [
    {
      "degree": "Degree & Major",
      "institution": "University / Institution Name",
      "year": "Dates",
      "details": "CGPA/GPA"
    }
  ],
  "achievements": [
    "Competitive programming awards, Flipkart Grid semi-finalist, certifications"
  ],
  "open_source": ["Project Title 1", "Project Title 2"],
  "career_focus": "Software Engineering / Full Stack Development",
  "contact_info": {
    "email": "Email address",
    "phone": "Phone number",
    "location": ""
  }
}
`;

  const userPrompt = `Synthesize the candidate's uploaded resume into the required JSON format:

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
