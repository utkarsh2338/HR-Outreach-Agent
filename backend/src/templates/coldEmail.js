import { fileDb } from '../utils/fileDb.js';

/**
 * Dynamic Personal Cold Email Template
 * Renders tailored outreach emails using the active candidate's profile (name, headline/education, projects, links)
 * with a clean, direct, human-to-human layout (NO corporate disclaimers or footers).
 *
 * @param {object} params
 * @param {string} params.name        - Recipient's name
 * @param {string} params.company     - Recipient's company name
 * @param {string} [params.role_title] - Recipient's target job title
 * @param {string} [params.opener]    - Optional personalized AI opener line
 * @param {object} [params.candidate] - Active UserProfile object or parsed_profile
 * @returns {{ subject: string, htmlBody: string, textBody: string }}
 */
export const buildColdEmail = ({ name, company, role_title, opener, candidate }) => {
  const greeting = name ? name.trim().split(' ')[0] : 'there';
  const companyName = company ? company.trim() : 'your company';

  // Extract candidate data from UserProfile or fallback object
  const activeProfile = fileDb.getProfile();
  const profile = candidate?.parsed_profile || candidate || activeProfile?.parsed_profile || {};
  let candidateName = profile.name || candidate?.name || activeProfile?.name || 'Tanish Patidar';
  candidateName = candidateName.replace(/Email:.*$/i, '').trim() || 'Tanish Patidar';

  const linkedinUrl = candidate?.linkedin_url || profile.linkedin_url || activeProfile?.linkedin_url || 'https://www.linkedin.com/in/tanish07patidar-/';
  const githubUrl = candidate?.github_url || profile.github_url || activeProfile?.github_url || 'https://github.com/TechTAnish-07';
  const portfolioUrl = candidate?.portfolio_url || profile.portfolio_url || activeProfile?.portfolio_url || '';
  const resumeUrl = candidate?.resume_url || profile.resume_url || activeProfile?.resume_url || '';
  const phone = profile.contact_info?.phone || candidate?.phone || '';

  // Candidate headline or education summary
  const candidateHeadline =
    profile.career_focus ||
    profile.headline ||
    (profile.education?.[0]
      ? `${profile.education[0].degree || 'Software Engineering student'} at ${profile.education[0].institution || 'university'}`
      : 'Full-Stack Software Engineering candidate');

  // Candidate's target role is derived from candidate's profile/resume, NOT the recruiter's HR title
  const targetRole =
    profile.career_focus ||
    profile.target_role ||
    (profile.headline && !profile.headline.toLowerCase().includes('recruiter') ? profile.headline : null) ||
    'Software Engineer / Full-Stack Developer';

  // Clean ASCII hyphen to prevent UTF-8 header double-encoding corruption
  const subject = `Exploring ${targetRole} Roles at ${companyName} - ${candidateName}`;

  const personalizedHook = opener ? `${opener}\n\n` : '';
  const personalizedHookHtml = opener ? `<p style="margin-bottom: 16px;">${opener}</p>` : '';

  // Dynamically extract background bullet points from candidate profile
  let bulletPoints = [];

  if (Array.isArray(profile.work_experience) && profile.work_experience.length > 0) {
    const exp = profile.work_experience[0];
    bulletPoints.push(
      `Currently ${exp.title || 'Software Developer'} at ${exp.company || 'company'}${exp.description ? `: ${exp.description}` : ''}`.trim()
    );
  }

  if (Array.isArray(profile.projects) && profile.projects.length > 0) {
    profile.projects.slice(0, 2).forEach((proj) => {
      const techStr = Array.isArray(proj.tech_stack) && proj.tech_stack.length > 0 ? ` (${proj.tech_stack.join(', ')})` : '';
      bulletPoints.push(`Built ${proj.title || 'full-stack project'}: ${proj.description || ''}${techStr}`.trim());
    });
  }

  if (Array.isArray(profile.achievements) && profile.achievements.length > 0) {
    bulletPoints.push(profile.achievements.slice(0, 2).join('; '));
  }

  // Fallback bullet points tailored for candidate Tanish Patidar
  if (bulletPoints.length === 0) {
    bulletPoints = [
      'Full-stack developer experienced in building scalable, production-ready web applications using React, Node.js, Express, and modern database architectures.',
      'Engineered end-to-end RESTful APIs, real-time WebSocket integrations, authentication systems, and responsive, high-performance UI components.',
      'Strong problem-solving foundation with deep expertise in JavaScript/TypeScript, data structures, and software engineering best practices.'
    ];
  }

  const textBullets = bulletPoints.map((b) => `• ${b}`).join('\n');
  const htmlBullets = bulletPoints.map((b) => `<li style="margin-bottom: 8px;">${b}</li>`).join('\n');

  const linksText = [
    linkedinUrl ? `LinkedIn: ${linkedinUrl}` : '',
    githubUrl ? `GitHub: ${githubUrl}` : '',
    portfolioUrl ? `Portfolio: ${portfolioUrl}` : '',
    resumeUrl ? `Resume PDF: ${resumeUrl}` : ''
  ].filter(Boolean).join('\n');

  const linksHtml = [
    linkedinUrl ? `LinkedIn: <a href="${linkedinUrl}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline; font-weight: 600;">${linkedinUrl}</a>` : '',
    githubUrl ? `GitHub: <a href="${githubUrl}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline; font-weight: 600;">${githubUrl}</a>` : '',
    portfolioUrl ? `Portfolio: <a href="${portfolioUrl}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline; font-weight: 600;">${portfolioUrl}</a>` : '',
    resumeUrl ? `Resume PDF: <a href="${resumeUrl}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline; font-weight: 600;">${resumeUrl}</a>` : ''
  ].filter(Boolean).join('<br>');

  const textBody = `Hi ${greeting},

${personalizedHook}I'm ${candidateName}, ${candidateHeadline}, reaching out to express interest in ${targetRole} opportunities at ${companyName}.

A quick snapshot of my background:
${textBullets}

I'd welcome the opportunity to discuss any open ${targetRole} or internship roles that might be a fit, and I'm happy to share more details or complete any assessments as needed.

Thank you for your time and consideration.

Best regards,
${candidateName}
${phone ? `${phone} | ` : ''}${linksText}`;

  const htmlBody = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14.5px; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0; padding: 12px 0;">

  <p style="margin-bottom: 16px;">Hi ${greeting},</p>

  ${personalizedHookHtml}

  <p style="margin-bottom: 16px;">
    I'm <strong>${candidateName}</strong>, ${candidateHeadline}, reaching out to express interest in <strong>${targetRole} opportunities</strong> at ${companyName}.
  </p>

  <p style="margin-bottom: 8px;">A quick snapshot of my background:</p>
  <ul style="margin: 0 0 16px 0; padding-left: 20px; color: #374151;">
    ${htmlBullets}
  </ul>

  <p style="margin-bottom: 16px;">
    I'd welcome the opportunity to discuss any open <strong>${targetRole}</strong> or internship roles that might be a fit, and I'm happy to share more details or complete any assessments as needed.
  </p>

  <p style="margin-bottom: 24px;">Thank you for your time and consideration.</p>

  <p style="margin: 0; color: #111827;">
    Best regards,<br>
    <strong>${candidateName}</strong><br>
    <span style="color: #4b5563; font-size: 13.5px;">
      ${phone ? `${phone} | ` : ''}
      ${linksHtml}
    </span>
  </p>

</body>
</html>`;

  return { subject, htmlBody, textBody };
};
