import EmailLog from '../models/EmailLog.js';
import User from '../models/User.js';

const COOLDOWN_HOURS = 24;

/**
 * Checks if a contact is within the 24-hour communication cooldown window.
 *
 * @param {string|ObjectId} userId
 * @param {string|ObjectId} contactId
 * @returns {Promise<boolean>} True if contact is in cooldown (less than 24h since last email draft/send)
 */
export const isContactInCooldown = async (userId, contactId) => {
  const cutoff = new Date(Date.now() - COOLDOWN_HOURS * 60 * 60 * 1000);
  const recentLog = await EmailLog.findOne({
    user_id: userId,
    contact_id: contactId,
    createdAt: { $gte: cutoff }
  });
  return Boolean(recentLog);
};

/**
 * Checks if a email address or domain is present on a user's blocklist.
 *
 * @param {object} user - User document
 * @param {string} email - Contact email
 * @param {string} [domain] - Contact domain
 * @returns {boolean} True if email/domain is blocked
 */
export const isBlocked = (user, email, domain) => {
  if (!user || !user.blocklist || user.blocklist.length === 0) return false;

  const emailLower = (email || '').toLowerCase().trim();
  const domainLower = (domain || emailLower.split('@')[1] || '').toLowerCase().trim();

  return user.blocklist.some((item) => {
    const itemLower = item.toLowerCase().trim();
    return emailLower.includes(itemLower) || (domainLower && domainLower.includes(itemLower));
  });
};

/**
 * Checks user daily quota limit.
 *
 * @param {string|ObjectId} userId
 * @returns {Promise<{ allowed: boolean, sent_24h: number, limit: number, remaining: number }>}
 */
export const checkDailyQuota = async (userId) => {
  const user = await User.findById(userId);
  const limit = user?.daily_send_limit || 20;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const sent_24h = await EmailLog.countDocuments({
    user_id: userId,
    direction: 'outbound',
    log_status: 'sent',
    sent_at: { $gte: since }
  });

  const remaining = Math.max(0, limit - sent_24h);
  return {
    allowed: remaining > 0,
    sent_24h,
    limit,
    remaining
  };
};
