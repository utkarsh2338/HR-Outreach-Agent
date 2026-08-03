import express from 'express';
import { google } from 'googleapis';
import User from '../models/User.js';
import { generateToken, requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

const getOAuth2Client = (redirectUri) => {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const callbackUrl = redirectUri || process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback';

  return new google.auth.OAuth2(clientId, clientSecret, callbackUrl);
};

/**
 * Helper to check if an email is permitted by the allowlist.
 */
const isEmailAllowed = (email) => {
  const allowlistEnv = process.env.ALLOWED_EMAILS;
  if (!allowlistEnv) return true; // If not configured, allow signup/login
  const allowed = allowlistEnv.split(',').map((e) => e.trim().toLowerCase());
  return allowed.includes(email.toLowerCase());
};

/**
 * @route   GET /api/auth/google/url
 * @desc    Get Google OAuth login URL
 */
router.get('/google/url', (req, res) => {
  try {
    const oauth2Client = getOAuth2Client();
    const scopes = [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://mail.google.com/'
    ];

    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: scopes
    });

    return res.status(200).json({ url });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to generate OAuth URL', details: err.message });
  }
});

/**
 * @route   GET /api/auth/google/callback
 * @desc    Handle Google OAuth callback code
 */
router.get('/google/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: 'Authorization code missing' });
  }

  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: googleUser } = await oauth2.userinfo.get();

    if (!googleUser.email) {
      return res.status(400).json({ error: 'Google user email not accessible' });
    }

    // Verify email against invite allowlist
    if (!isEmailAllowed(googleUser.email)) {
      return res.status(403).json({
        error: `Access restricted. ${googleUser.email} is not on the invitation allowlist.`
      });
    }

    let user = await User.findOne({ google_id: googleUser.id });

    if (!user) {
      // Check if user exists by email
      user = await User.findOne({ email: googleUser.email.toLowerCase() });
      if (user) {
        user.google_id = googleUser.id;
      }
    }

    if (!user) {
      user = new User({
        name: googleUser.name || googleUser.email.split('@')[0],
        email: googleUser.email.toLowerCase(),
        google_id: googleUser.id,
        google_refresh_token: tokens.refresh_token
      });
    } else {
      if (tokens.refresh_token) {
        user.google_refresh_token = tokens.refresh_token;
      }
    }

    await user.save();

    const token = generateToken(user);

    // Set httpOnly cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    return res.redirect(`${frontendUrl}/?auth=success`);
  } catch (err) {
    console.error('[authRoute] Google Callback error:', err.message);
    return res.status(500).json({ error: 'OAuth authentication failed', details: err.message });
  }
});

/**
 * @route   GET /api/auth/me
 * @desc    Get currently authenticated user
 */
router.get('/me', requireAuth, (req, res) => {
  return res.status(200).json({
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      autonomy_mode: req.user.autonomy_mode,
      daily_send_limit: req.user.daily_send_limit,
      timezone: req.user.timezone,
      blocklist: req.user.blocklist || [],
      created_at: req.user.createdAt
    }
  });
});

/**
 * @route   POST /api/auth/dev-login
 * @desc    Quick dev login for local testing without Google OAuth console setup
 */
router.post('/dev-login', async (req, res) => {
  try {
    const email = req.body?.email || process.env.LEGACY_USER_EMAIL || 'utkarshshukla1007@gmail.com';
    let user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      user = await User.create({
        name: 'Utkarsh Shukla',
        email: email.toLowerCase(),
        google_id: 'dev_user_google_id_001',
        google_refresh_token: process.env.GMAIL_REFRESH_TOKEN || undefined,
        autonomy_mode: 'approval_required',
        daily_send_limit: parseInt(process.env.DAILY_SEND_LIMIT || '20', 10),
        timezone: 'Asia/Kolkata',
        is_active: true
      });
    }

    const token = generateToken(user);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.status(200).json({
      message: 'Dev login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        autonomy_mode: user.autonomy_mode,
        daily_send_limit: user.daily_send_limit,
        timezone: user.timezone,
        blocklist: user.blocklist || [],
        created_at: user.createdAt
      }
    });
  } catch (err) {
    return res.status(500).json({ error: 'Dev login failed', details: err.message });
  }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Clear session cookie
 */
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  return res.status(200).json({ message: 'Logged out successfully' });
});

export default router;
