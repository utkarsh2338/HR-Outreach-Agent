import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

// Ensures a 32-byte key is derived from the ENCRYPTION_KEY environment variable or a fallback default
const getEncryptionKey = () => {
  const secret = process.env.ENCRYPTION_KEY || 'hr_outreach_default_secret_key_32_bytes!!';
  return crypto.createHash('sha256').update(secret).digest();
};

/**
 * Encrypts a text string at rest.
 * Returns formatted string: "iv:authTag:encryptedText"
 *
 * @param {string} text - Plaintext to encrypt
 * @returns {string} Encrypted string format
 */
export const encrypt = (text) => {
  if (!text) return text;
  const iv = crypto.randomBytes(12);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
};

/**
 * Decrypts a formatted encrypted string.
 *
 * @param {string} encryptedData - Encrypted string formatted as "iv:authTag:encryptedText"
 * @returns {string} Decrypted plaintext
 */
export const decrypt = (encryptedData) => {
  if (!encryptedData || !encryptedData.includes(':')) return encryptedData;
  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) return encryptedData;

    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const key = getEncryptionKey();

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (err) {
    console.error('[crypto] Decryption failed:', err.message);
    return encryptedData;
  }
};
