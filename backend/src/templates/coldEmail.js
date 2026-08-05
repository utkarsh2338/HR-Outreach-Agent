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

  const personalizedHookText = opener ? `${opener}\n\n` : '';
  const personalizedHookHtml = opener
    ? `<p style="margin-bottom: 16px; color: #374151;">${opener}</p>`
    : '';

  // Dynamically extract background bullet points from candidate profile
  // Each entry: { text: string, url?: string, linkLabel?: string }
  let bulletItems = [];

  // 1. Work experience — most impressive signal for recruiters
  if (Array.isArray(profile.work_experience) && profile.work_experience.length > 0) {
    const exp = profile.work_experience[0];
    const desc = exp.description
      ? exp.description.split('.')[0].trim()
      : '';
    bulletItems.push({
      text: `${exp.title || 'Software Developer'} at ${exp.company || 'company'}${desc ? ' — ' + desc : ''}.`
    });
  }

  // 2. Top 2 projects — make project title a clickable link
  if (Array.isArray(profile.projects) && profile.projects.length > 0) {
    profile.projects.slice(0, 2).forEach((proj) => {
      const techStr = Array.isArray(proj.tech_stack) && proj.tech_stack.length > 0
        ? ` (${proj.tech_stack.slice(0, 4).join(', ')})`
        : '';
      const desc = proj.description && proj.description.length > 10 && !proj.description.toLowerCase().includes('github repository')
        ? proj.description
        : null;
      const label = proj.title || 'Project';
      bulletItems.push({
        linkLabel: label,
        url: proj.url || null,
        text: desc ? `${desc}${techStr}` : techStr
      });
    });
  }

  // 3. One strong achievement only — skip weak entries
  const WEAK_ACHIEVEMENT_PATTERNS = [/^\d+\s+github stars?/i, /^competitive programming$/i, /^open source/i];
  if (Array.isArray(profile.achievements) && profile.achievements.length > 0) {
    const strongAchievement = profile.achievements.find(
      (a) => a && a.trim().length > 20 && !WEAK_ACHIEVEMENT_PATTERNS.some((p) => p.test(a.trim()))
    );
    if (strongAchievement) {
      bulletItems.push({ text: strongAchievement });
    }
  }

  // Fallback
  if (bulletItems.length === 0) {
    bulletItems = [
      { text: 'Full-stack developer with production experience in React, Node.js, Express, and modern database architectures.' },
      { text: 'Engineered RESTful APIs, real-time WebSocket systems, OAuth authentication, and high-performance UI components.' },
      { text: 'Strong foundation in JavaScript / TypeScript, data structures, and software engineering best practices.' }
    ];
  }

  // Plain text bullets — show URL in parens after project title
  const textBullets = bulletItems.map((b) => {
    if (b.linkLabel) {
      const urlStr = b.url ? ` ( ${b.url} )` : '';
      return `  • ${b.linkLabel}${urlStr}${b.text ? ' — ' + b.text : ''}`;
    }
    return `  • ${b.text}`;
  }).join('\n');

  // HTML bullet rows — project title is a clickable hyperlink
  const htmlBullets = bulletItems
    .map((b, i) => {
      let content;
      if (b.linkLabel && b.url) {
        content = `<a href="${b.url}" target="_blank" rel="noopener noreferrer"
               style="color: #1d4ed8; font-weight: 700; text-decoration: underline;">${b.linkLabel}</a>${b.text ? ' — ' + b.text : ''}`;
      } else if (b.linkLabel) {
        content = `<strong>${b.linkLabel}</strong>${b.text ? ' — ' + b.text : ''}`;
      } else {
        content = b.text;
      }
      return `<tr style="background: ${i % 2 === 0 ? '#f9fafb' : '#ffffff'};">
          <td style="padding: 10px 14px; font-size: 14px; color: #374151;">
            <span style="color: #2563eb; font-weight: 700; margin-right: 8px;">▸</span>${content}
          </td>
        </tr>`;
    })
    .join('\n');

  // Signature links — text version (one per line)
  const linksText = [
    linkedinUrl ? `LinkedIn   ${linkedinUrl}` : '',
    githubUrl ? `GitHub     ${githubUrl}` : '',
    portfolioUrl ? `Portfolio  ${portfolioUrl}` : '',
    resumeUrl ? `Resume PDF ${resumeUrl}` : ''
  ]
    .filter(Boolean)
    .join('\n');

  // Signature links — HTML version (icon + label + clickable full URL)
  const linkItems = [
    linkedinUrl
      ? { label: 'LinkedIn', icon: '🔗', url: linkedinUrl }
      : null,
    githubUrl
      ? { label: 'GitHub', icon: '💻', url: githubUrl }
      : null,
    portfolioUrl
      ? { label: 'Portfolio', icon: '🌐', url: portfolioUrl }
      : null,
    resumeUrl
      ? { label: 'Resume PDF', icon: '📄', url: resumeUrl }
      : null
  ].filter(Boolean);

  const linksHtml = linkItems
    .map(
      ({ label, icon, url }) =>
        `<div style="margin-bottom: 5px;">
          <span style="margin-right: 6px;">${icon}</span>
          <strong style="color: #374151; margin-right: 4px;">${label}:</strong>
          <a href="${url}" target="_blank" rel="noopener noreferrer"
             style="color: #2563eb; text-decoration: underline; word-break: break-all;">${url}</a>
        </div>`
    )
    .join('\n');

  // ── Plain Text Body ──────────────────────────────────────────────────────────
  const textBody = `Hi ${greeting},

${personalizedHookText}I'm ${candidateName} — ${candidateHeadline}. I'm reaching out about ${targetRole} opportunities at ${companyName}.

Here's a quick snapshot of my work:

${textBullets}

I'd love to explore whether there's a fit for an open ${targetRole} or internship role on your team. Happy to share more details or complete any assessments as needed.

Thank you for your time, ${greeting}.

Best regards,
${candidateName}${phone ? `\n${phone}` : ''}
${linksText}`;

  // ── HTML Body ────────────────────────────────────────────────────────────────
  const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">

  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f3f4f6; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600"
               style="max-width: 600px; background-color: #ffffff; border-radius: 10px;
                      border: 1px solid #e5e7eb; overflow: hidden;">

          <!-- Header accent bar -->
          <tr>
            <td style="background: linear-gradient(90deg, #1d4ed8 0%, #2563eb 100%); height: 4px;"></td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px 36px 24px;">

              <!-- Greeting -->
              <p style="margin: 0 0 18px 0; font-size: 15px; color: #111827;">Hi ${greeting},</p>

              <!-- Personalized opener (Groq-generated) -->
              ${personalizedHookHtml}

              <!-- Intro paragraph -->
              <p style="margin: 0 0 20px 0; font-size: 15px; color: #1f2937; line-height: 1.65;">
                I'm <strong style="color: #111827;">${candidateName}</strong> — ${candidateHeadline}.
                I'm reaching out about
                <strong style="color: #1d4ed8;">${targetRole}</strong> opportunities at
                <strong style="color: #111827;">${companyName}</strong>.
              </p>

              <!-- Background bullets -->
              <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: 600; color: #6b7280;
                         text-transform: uppercase; letter-spacing: 0.05em;">
                Quick snapshot
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
                     style="border-radius: 6px; overflow: hidden; border: 1px solid #e5e7eb; margin-bottom: 22px;">
                ${htmlBullets}
              </table>

              <!-- CTA paragraph -->
              <p style="margin: 0 0 20px 0; font-size: 15px; color: #1f2937; line-height: 1.65;">
                I'd love to explore whether there's a fit for an open
                <strong>${targetRole}</strong> or internship role on your team.
                Happy to share more details or complete any assessments as needed.
              </p>

              <!-- Closing -->
              <p style="margin: 0 0 24px 0; font-size: 15px; color: #1f2937;">
                Thank you for your time, ${greeting}.
              </p>

              <!-- Divider -->
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 0 0 20px 0;">

              <!-- Signature -->
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin: 0 0 2px 0; font-size: 15px; font-weight: 700; color: #111827;">
                      ${candidateName}
                    </p>
                    <p style="margin: 0 0 14px 0; font-size: 13px; color: #6b7280;">
                      ${candidateHeadline}${phone ? ' &nbsp;·&nbsp; ' + phone : ''}
                    </p>
                    <div style="font-size: 13.5px; line-height: 1.7; color: #374151;">
                      ${linksHtml}
                    </div>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer bar -->
          <tr>
            <td style="background-color: #f9fafb; padding: 12px 36px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 11.5px; color: #9ca3af; text-align: center;">
                This email was sent by ${candidateName} as a personal outreach message.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;

  return { subject, htmlBody, textBody };
};
