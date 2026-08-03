import { google } from 'googleapis';

export const getGmailClient = (user) => {
  const { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET } = process.env;
  const refreshToken = user?.google_refresh_token || process.env.GMAIL_REFRESH_TOKEN;

  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !refreshToken) {
    throw new Error(
      'Gmail OAuth2 credentials are missing. Ensure GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and user refresh token are set.'
    );
  }

  const redirectUri = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback';

  const oauth2Client = new google.auth.OAuth2(
    GMAIL_CLIENT_ID,
    GMAIL_CLIENT_SECRET,
    redirectUri
  );

  oauth2Client.setCredentials({ refresh_token: refreshToken });

  return google.gmail({ version: 'v1', auth: oauth2Client });
};

/**
 * Encodes an email message to RFC 2822 base64url format.
 */
const buildRawMessage = ({ to, subject, htmlBody, textBody }) => {
  const boundary = `----=_Part_${Date.now()}`;
  const lines = [
    `To: ${to}`,
    'From: me',
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    textBody,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    htmlBody,
    '',
    `--${boundary}--`
  ];

  const raw = lines.join('\r\n');
  return Buffer.from(raw).toString('base64url');
};

/**
 * Sends an email via the Gmail API for a specific user.
 *
 * @param {object} options
 * @param {string} options.to       - Recipient email address
 * @param {string} options.subject  - Email subject line
 * @param {string} options.htmlBody - HTML body content
 * @param {string} options.textBody - Plain-text body content (fallback)
 * @param {object} [options.user]   - User object for refresh token
 * @returns {Promise<{ gmail_message_id: string, gmail_thread_id: string }>}
 */
export const sendEmail = async ({ to, subject, htmlBody, textBody, user }) => {
  const gmail = getGmailClient(user);

  const raw = buildRawMessage({ to, subject, htmlBody, textBody });

  const response = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw }
  });

  return {
    gmail_message_id: response.data.id,
    gmail_thread_id: response.data.threadId
  };
};
