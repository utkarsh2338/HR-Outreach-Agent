import jwt from 'jsonwebtoken';
import { fileDb } from '../utils/fileDb.js';

const JWT_SECRET = process.env.JWT_SECRET || 'hr_outreach_jwt_secret_fallback_key';

export const requireAuth = async (req, res, next) => {
  try {
    const profile = fileDb.getProfile();
    req.user = {
      _id: profile.id || 'local_user_1',
      name: profile.name || 'Tanish Patidar',
      email: profile.email || 'patidar29tanish@gmail.com',
      google_refresh_token: process.env.GMAIL_REFRESH_TOKEN || profile.google_refresh_token,
      autonomy_mode: profile.autonomy_mode || 'approval_required',
      daily_send_limit: profile.daily_send_limit || parseInt(process.env.DAILY_SEND_LIMIT || '20', 10),
      blocklist: profile.blocklist || []
    };
    next();
  } catch (err) {
    console.error('[authMiddleware] Error setting local user context:', err.message);
    req.user = {
      _id: 'local_user_1',
      name: 'Tanish Patidar',
      email: 'patidar29tanish@gmail.com',
      daily_send_limit: 20
    };
    next();
  }
};

export const generateToken = (user) => {
  return jwt.sign(
    { id: user._id || 'local_user_1', email: user.email },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
};
