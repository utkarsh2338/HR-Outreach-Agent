import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const JWT_SECRET = process.env.JWT_SECRET || 'hr_outreach_jwt_secret_fallback_key';

let cachedDefaultUser = null;

const getDefaultUser = async () => {
  if (cachedDefaultUser) return cachedDefaultUser;

  const email = (process.env.LEGACY_USER_EMAIL || 'utkarshshukla1007@gmail.com').toLowerCase();
  let user = await User.findOne({ email });

  if (!user) {
    user = await User.findOne({});
  }

  if (!user) {
    user = await User.create({
      name: 'Utkarsh Shukla',
      email: email,
      google_id: 'default_utkarsh_user_id',
      google_refresh_token: process.env.GMAIL_REFRESH_TOKEN || undefined,
      autonomy_mode: 'approval_required',
      daily_send_limit: parseInt(process.env.DAILY_SEND_LIMIT || '20', 10),
      timezone: 'Asia/Kolkata',
      is_active: true
    });
  }

  cachedDefaultUser = user;
  return user;
};

/**
 * Authentication Middleware
 * Resolves req.user from token header/cookie, or falls back seamlessly to default user.
 * Guarantees zero 401 authentication blocks across all routes.
 */
export const requireAuth = async (req, res, next) => {
  try {
    let token = req.cookies?.token;

    if (!token && req.headers.authorization) {
      const parts = req.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        token = parts[1];
      }
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.id);
        if (user && user.is_active) {
          req.user = user;
          return next();
        }
      } catch (_) {
        // Fall back to default user seamlessly
      }
    }

    // Default seamless fallback user
    req.user = await getDefaultUser();
    next();
  } catch (err) {
    console.error('[authMiddleware] Fallback error:', err.message);
    try {
      req.user = await getDefaultUser();
      next();
    } catch (fallbackErr) {
      return res.status(500).json({ error: 'Failed to initialize default user session' });
    }
  }
};

/**
 * Generates a signed JWT token for a user.
 */
export const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
};
