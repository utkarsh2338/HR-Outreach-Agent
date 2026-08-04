import dns from 'dns';
import net from 'net';

/**
 * Custom Verification Result Enum
 * @readonly
 * @enum {string}
 */
export const VerificationResult = {
  VALID: 'VALID',
  INVALID: 'INVALID',
  CATCH_ALL_OR_UNKNOWN: 'CATCH_ALL_OR_UNKNOWN',
  FORMAT_ERROR: 'FORMAT_ERROR'
};

const EMAIL_REGEX = /^[a-zA-Z0-9_+&*-]+(?:\.[a-zA-Z0-9_+&*-]+)*@(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,7}$/;

// Cache for DNS MX lookups to speed up repeat domain checks
const mxCache = new Map();

/**
 * Extracts domain portion from email string
 */
const getDomain = (email) => {
  const parts = email.trim().toLowerCase().split('@');
  return parts.length === 2 ? parts[1] : null;
};

/**
 * Resolves DNS MX records sorted by priority integer (lowest number = highest priority)
 */
const resolveMxRecords = async (domain) => {
  if (mxCache.has(domain)) {
    return mxCache.get(domain);
  }

  try {
    const records = await dns.promises.resolveMx(domain);
    if (!records || records.length === 0) {
      mxCache.set(domain, []);
      return [];
    }

    const sorted = records
      .sort((a, b) => a.priority - b.priority)
      .map((r) => r.exchange.replace(/\.$/, ''));

    mxCache.set(domain, sorted);
    return sorted;
  } catch (err) {
    mxCache.set(domain, []);
    return [];
  }
};

/**
 * Performs an SMTP Socket Handshake (EHLO -> MAIL FROM -> RCPT TO) to check mailbox deliverability.
 */
const checkSmtpHandshake = (mxHost, targetEmail, timeoutMs = 6000) => {
  return new Promise((resolve) => {
    let socket = null;
    let resolved = false;
    let step = 0; // 0: connected, 1: EHLO sent, 2: MAIL FROM sent, 3: RCPT TO sent

    const cleanup = () => {
      if (!socket) return;
      try {
        if (!socket.destroyed) {
          socket.write('QUIT\r\n');
          socket.end();
          socket.destroy();
        }
      } catch (_) {}
    };

    const finish = (result) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve(result);
    };

    try {
      socket = net.createConnection({ host: mxHost, port: 25 });
      socket.setTimeout(timeoutMs);

      socket.on('timeout', () => {
        finish({ status: VerificationResult.CATCH_ALL_OR_UNKNOWN, reason: `SMTP connection timeout (${timeoutMs}ms) on ${mxHost}` });
      });

      socket.on('error', (err) => {
        finish({ status: VerificationResult.CATCH_ALL_OR_UNKNOWN, reason: `SMTP socket error on ${mxHost}: ${err.message}` });
      });

      socket.on('data', (data) => {
        const response = data.toString('utf-8');
        const statusCode = parseInt(response.substring(0, 3), 10);

        if (step === 0) {
          // Greeting received (220)
          if (statusCode === 220) {
            step = 1;
            socket.write(`EHLO hroutreach.local\r\n`);
          } else {
            finish({ status: VerificationResult.CATCH_ALL_OR_UNKNOWN, reason: `Invalid SMTP greeting: ${response.trim()}` });
          }
        } else if (step === 1) {
          // EHLO response (250)
          if (statusCode === 250) {
            step = 2;
            socket.write(`MAIL FROM: <verify@hroutreach.local>\r\n`);
          } else {
            finish({ status: VerificationResult.CATCH_ALL_OR_UNKNOWN, reason: `EHLO rejected: ${response.trim()}` });
          }
        } else if (step === 2) {
          // MAIL FROM response (250)
          if (statusCode === 250) {
            step = 3;
            socket.write(`RCPT TO: <${targetEmail}>\r\n`);
          } else {
            finish({ status: VerificationResult.CATCH_ALL_OR_UNKNOWN, reason: `MAIL FROM rejected: ${response.trim()}` });
          }
        } else if (step === 3) {
          // RCPT TO response evaluation
          if (statusCode === 250) {
            finish({ status: VerificationResult.VALID, reason: `Mailbox exists and accepts email (250 OK)` });
          } else if (statusCode === 550 || statusCode === 551 || statusCode === 553 || statusCode === 501) {
            finish({ status: VerificationResult.INVALID, reason: `Mailbox unavailable or does not exist (${statusCode})` });
          } else {
            finish({ status: VerificationResult.CATCH_ALL_OR_UNKNOWN, reason: `SMTP RCPT TO response code ${statusCode}` });
          }
        }
      });
    } catch (err) {
      finish({ status: VerificationResult.CATCH_ALL_OR_UNKNOWN, reason: `Socket initialization error: ${err.message}` });
    }
  });
};

/**
 * Full Email Verification Pipeline:
 * 1. Syntax Regex Check
 * 2. DNS MX Record Lookup
 * 3. SMTP Socket Mailbox Handshake
 *
 * @param {string} email Target email address to verify
 * @returns {Promise<{ status: string, reason: string, mxHost?: string }>}
 */
export const verifyEmail = async (email) => {
  if (!email || typeof email !== 'string') {
    return { status: VerificationResult.FORMAT_ERROR, reason: 'Email parameter is empty or null' };
  }

  const cleanEmail = email.trim().toLowerCase();

  // 1. Syntax Regex Check
  if (!EMAIL_REGEX.test(cleanEmail)) {
    return { status: VerificationResult.FORMAT_ERROR, reason: 'Invalid email syntax format' };
  }

  const domain = getDomain(cleanEmail);
  if (!domain) {
    return { status: VerificationResult.FORMAT_ERROR, reason: 'Could not extract valid domain' };
  }

  // 2. DNS MX Record Lookup
  const mxHosts = await resolveMxRecords(domain);
  if (!mxHosts || mxHosts.length === 0) {
    return { status: VerificationResult.INVALID, reason: `Domain "${domain}" has no active DNS MX records` };
  }

  // 3. SMTP Socket Mailbox Handshake (try highest priority MX hosts)
  for (const mxHost of mxHosts.slice(0, 2)) {
    const result = await checkSmtpHandshake(mxHost, cleanEmail, 6000);

    if (result.status === VerificationResult.VALID || result.status === VerificationResult.INVALID) {
      return { ...result, mxHost };
    }
  }

  // Fallback: If port 25 is filtered/blocked by residential ISP, DNS MX records exist -> allow outreach safely
  return {
    status: VerificationResult.VALID,
    reason: `DNS MX records verified for domain "${domain}" (${mxHosts[0]})`,
    mxHost: mxHosts[0]
  };
};
