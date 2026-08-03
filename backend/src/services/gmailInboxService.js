import { google } from 'googleapis';

/**
 * Returns an authenticated Gmail API client using env credentials.
 */
const getGmailClient = () => {
  const { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN } = process.env;

  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN) {
    throw new Error(
      'Gmail OAuth2 credentials are missing. Ensure GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN are set in .env'
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    GMAIL_CLIENT_ID,
    GMAIL_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground'
  );
  oauth2Client.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN });
  return google.gmail({ version: 'v1', auth: oauth2Client });
};

/**
 * Extracts plain-text body from a Gmail message payload.
 * Handles both simple and MIME multipart messages.
 */
const extractTextBody = (payload) => {
  if (!payload) return '';

  // Direct plain-text body
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64').toString('utf-8');
  }

  // Recurse through MIME parts
  if (payload.parts && Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64').toString('utf-8');
      }
      // Recurse into nested multipart
      if (part.parts) {
        const nested = extractTextBody(part);
        if (nested) return nested;
      }
    }
  }

  return '';
};

/**
 * Extracts a specific header value from Gmail message headers array.
 */
const getHeader = (headers = [], name) => {
  const header = headers.find(
    (h) => h.name.toLowerCase() === name.toLowerCase()
  );
  return header?.value ?? '';
};

/**
 * Polls the Gmail inbox for messages received since `sinceDate`.
 *
 * Strategy: Query for messages with `in:inbox` newer than sinceDate,
 * then check each message's threadId against our outbound EmailLog entries.
 * This is more reliable than searching by To/From when dealing with forwarded
 * or alias addresses.
 *
 * @param {Date} sinceDate - Only fetch messages received after this timestamp
 * @returns {Promise<Array<{
 *   gmail_message_id: string,
 *   gmail_thread_id: string,
 *   from: string,
 *   subject: string,
 *   date: Date,
 *   textBody: string
 * }>>}
 */
export const pollInbox = async (sinceDate) => {
  const gmail = getGmailClient();

  // Convert sinceDate to Unix epoch seconds for Gmail query
  const afterEpoch = Math.floor(sinceDate.getTime() / 1000);
  const query = `in:inbox after:${afterEpoch}`;

  let allMessageIds = [];
  let pageToken;

  // Paginate through results
  do {
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 100,
      ...(pageToken ? { pageToken } : {})
    });

    const messages = listRes.data.messages || [];
    allMessageIds.push(...messages.map((m) => m.id));
    pageToken = listRes.data.nextPageToken;
  } while (pageToken);

  if (allMessageIds.length === 0) {
    return [];
  }

  // Fetch full message details for each ID
  const results = [];
  for (const msgId of allMessageIds) {
    try {
      const msgRes = await gmail.users.messages.get({
        userId: 'me',
        id: msgId,
        format: 'full'
      });

      const msg = msgRes.data;
      const headers = msg.payload?.headers ?? [];

      results.push({
        gmail_message_id: msg.id,
        gmail_thread_id: msg.threadId,
        from: getHeader(headers, 'From'),
        subject: getHeader(headers, 'Subject'),
        date: new Date(parseInt(msg.internalDate, 10)),
        textBody: extractTextBody(msg.payload)
      });
    } catch (err) {
      // Log and skip individual fetch failures
      console.warn(`[gmailInboxService] Failed to fetch message ${msgId}: ${err.message}`);
    }
  }

  return results;
};
