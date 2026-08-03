/**
 * Personal Cold Email Template for Utkarsh Shukla
 * Clean, direct, human-to-human layout with NO corporate unsubscribe footers.
 *
 * @param {object} params
 * @param {string} params.name        - Recipient's name
 * @param {string} params.company     - Recipient's company name
 * @param {string} [params.role_title] - Recipient's job title (optional)
 * @param {string} [params.opener]    - Optional personalized AI opener line
 * @returns {{ subject: string, htmlBody: string, textBody: string }}
 */
export const buildColdEmail = ({ name, company, role_title, opener }) => {
  const greeting = name ? name.trim().split(' ')[0] : 'there';
  const companyName = company ? company.trim() : 'your company';

  const subject = `Exploring SDE-1 / Software Engineering Roles at ${companyName} — Utkarsh Shukla`;

  const personalizedHook = opener ? `${opener}\n\n` : '';
  const personalizedHookHtml = opener ? `<p style="margin-bottom: 16px;">${opener}</p>` : '';

  const textBody = `Hi ${greeting},

${personalizedHook}I'm Utkarsh Shukla, a final year Computer Science student at IIIT Tiruchirappalli, reaching out to express interest in SDE-1 / Software Engineering opportunities at ${companyName}.

A quick snapshot of my background:
• Currently Technical Lead at Atyant, where I lead a team of 11 developers and built a production platform end-to-end — 100+ REST APIs, real-time WebSocket infrastructure, Redis caching, and JWT/OAuth authentication, serving 1,500+ users.
• Independently built and shipped two full-stack projects: GymRatHub (a fitness tracking platform) and NexMeet (a WebRTC-based video conferencing app).
• Strong problem-solving foundation: 1,300+ DSA problems solved, LeetCode Knight (1830 rating), Codeforces Pupil (1206 rating).

I've attached my resume for your reference. I'd welcome the opportunity to discuss any open SDE-1 or internship roles that might be a fit, and I'm happy to share more details or complete any assessments as needed.

Thank you for your time and consideration.

Best regards,
Utkarsh Shukla
+91 7905342263 | LinkedIn: https://www.linkedin.com/in/utkarshshukla1007/ | GitHub: https://github.com/utkarsh2338`;

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
    I'm Utkarsh Shukla, a final year Computer Science student at IIIT Tiruchirappalli, reaching out to express interest in <strong>SDE-1 / Software Engineering opportunities</strong> at ${companyName}.
  </p>

  <p style="margin-bottom: 8px;">A quick snapshot of my background:</p>
  <ul style="margin: 0 0 16px 0; padding-left: 20px; color: #374151;">
    <li style="margin-bottom: 8px;">
      <strong>Currently Technical Lead at Atyant</strong>, where I lead a team of 11 developers and built a production platform end-to-end — 100+ REST APIs, real-time WebSocket infrastructure, Redis caching, and JWT/OAuth authentication, serving 1,500+ users.
    </li>
    <li style="margin-bottom: 8px;">
      <strong>Independently built and shipped full-stack projects</strong>: <em>GymRatHub</em> (fitness tracking platform) and <em>NexMeet</em> (WebRTC video conferencing app).
    </li>
    <li style="margin-bottom: 8px;">
      <strong>Strong problem-solving foundation</strong>: 1,300+ DSA problems solved, LeetCode Knight (1830 rating), Codeforces Pupil (1206 rating).
    </li>
  </ul>

  <p style="margin-bottom: 16px;">
    I've attached my resume for your reference. I'd welcome the opportunity to discuss any open SDE-1 or internship roles that might be a fit, and I'm happy to share more details or complete any assessments as needed.
  </p>

  <p style="margin-bottom: 24px;">Thank you for your time and consideration.</p>

  <p style="margin: 0; color: #111827;">
    Best regards,<br>
    <strong>Utkarsh Shukla</strong><br>
    <span style="color: #4b5563; font-size: 13.5px;">
      +91 7905342263 |
      <a href="https://www.linkedin.com/in/utkarshshukla1007/" style="color: #2563eb; text-decoration: none;">LinkedIn</a> |
      <a href="https://github.com/utkarsh2338" style="color: #2563eb; text-decoration: none;">GitHub</a>
    </span>
  </p>

</body>
</html>`;

  return { subject, htmlBody, textBody };
};
