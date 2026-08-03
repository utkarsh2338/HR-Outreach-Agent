import express from 'express';
import multer from 'multer';
import UserProfile from '../models/UserProfile.js';
import { parseResumeBuffer } from '../services/resumeParserService.js';
import { fetchGithubProfile, fetchLinkedinProfile } from '../services/profileFetcherService.js';
import { synthesizeUserProfile } from '../services/profileAnalysisService.js';
import { generateFullPersonalizedEmail } from '../services/groqService.js';
import { buildColdEmail } from '../templates/coldEmail.js';

const router = express.Router();

// Multer memory storage configuration (10MB max file size)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'
    ];
    const isAllowedExt = /\.(pdf|docx|doc)$/i.test(file.originalname);

    if (allowedTypes.includes(file.mimetype) || isAllowedExt) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file format. Please upload a PDF (.pdf) or Word document (.docx).'));
    }
  }
});

/**
 * @route   GET /api/profile
 * @desc    Get current candidate profile & resume metadata
 */
router.get('/', async (req, res) => {
  try {
    const profile = await UserProfile.getProfile();
    return res.status(200).json({
      success: true,
      profile: {
        id: profile._id,
        resume_file_name: profile.resume_file_name || null,
        resume_mime_type: profile.resume_mime_type || null,
        has_resume: Boolean(profile.resume_text),
        resume_text_length: profile.resume_text ? profile.resume_text.length : 0,
        github_url: profile.github_url || '',
        linkedin_url: profile.linkedin_url || '',
        parsed_profile: profile.parsed_profile || null,
        raw_github_data: profile.raw_github_data || null,
        raw_linkedin_data: profile.raw_linkedin_data || null,
        last_analyzed_at: profile.last_analyzed_at || null,
        updated_at: profile.updatedAt
      }
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch user profile', details: err.message });
  }
});

/**
 * @route   POST /api/profile/upload-resume
 * @desc    Upload PDF/DOCX resume, parse plain text, and update profile
 */
router.post('/upload-resume', (req, res) => {
  upload.single('resume')(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large. Maximum size allowed is 10MB.' });
      }
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Please select a PDF or DOCX file to upload.' });
    }

    try {
      const { buffer, mimetype, originalname } = req.file;

      // Extract text from PDF / DOCX
      const extractedText = await parseResumeBuffer(buffer, mimetype, originalname);

      const profile = await UserProfile.getProfile();
      profile.resume_file_name = originalname;
      profile.resume_mime_type = mimetype;
      profile.resume_text = extractedText;

      await profile.save();

      return res.status(200).json({
        message: 'Resume uploaded and parsed successfully!',
        resume_file_name: originalname,
        char_count: extractedText.length,
        word_count: extractedText.split(/\s+/).length,
        preview_text: extractedText.slice(0, 300) + (extractedText.length > 300 ? '...' : '')
      });
    } catch (parseErr) {
      return res.status(422).json({
        error: 'Failed to parse resume content',
        details: parseErr.message
      });
    }
  });
});

/**
 * @route   POST /api/profile/urls
 * @desc    Update candidate's GitHub and LinkedIn URLs
 */
router.post('/urls', async (req, res) => {
  try {
    const { github_url, linkedin_url } = req.body;

    const profile = await UserProfile.getProfile();
    if (github_url !== undefined) profile.github_url = github_url.trim();
    if (linkedin_url !== undefined) profile.linkedin_url = linkedin_url.trim();

    await profile.save();

    return res.status(200).json({
      message: 'Profile URLs updated successfully',
      github_url: profile.github_url,
      linkedin_url: profile.linkedin_url
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update profile URLs', details: err.message });
  }
});

/**
 * @route   POST /api/profile/analyze
 * @desc    Triggers AI background analysis combining Resume + GitHub + LinkedIn
 */
router.post('/analyze', async (req, res) => {
  try {
    const profile = await UserProfile.getProfile();

    const resumeText = profile.resume_text || '';
    const githubUrl = profile.github_url || '';
    const linkedinUrl = profile.linkedin_url || '';

    if (!resumeText && !githubUrl && !linkedinUrl) {
      return res.status(400).json({
        error: 'Please upload a resume or provide at least one profile URL (GitHub/LinkedIn) before starting analysis.'
      });
    }

    // 1. Fetch public profile data concurrently
    const [githubData, linkedinData] = await Promise.all([
      githubUrl ? fetchGithubProfile(githubUrl) : Promise.resolve(null),
      linkedinUrl ? fetchLinkedinProfile(linkedinUrl) : Promise.resolve(null)
    ]);

    // 2. Synthesize using Groq LLM
    const parsedProfile = await synthesizeUserProfile({
      resumeText,
      githubData,
      linkedinData
    });

    // 3. Save results to UserProfile
    profile.raw_github_data = githubData;
    profile.raw_linkedin_data = linkedinData;
    profile.parsed_profile = parsedProfile;
    profile.last_analyzed_at = new Date();

    await profile.save();

    return res.status(200).json({
      message: 'Candidate profile analyzed and synthesized successfully!',
      parsed_profile: parsedProfile,
      last_analyzed_at: profile.last_analyzed_at
    });
  } catch (err) {
    return res.status(500).json({
      error: 'Profile analysis failed',
      details: err.message
    });
  }
});

/**
 * @route   POST /api/profile/test-generate
 * @desc    Generate a test email draft live for preview
 */
router.post('/test-generate', async (req, res) => {
  try {
    const { company = 'Stripe', role_title = 'Software Engineer', name = 'Hiring Manager', notes = '' } = req.body;

    const profile = await UserProfile.getProfile();

    let result = await generateFullPersonalizedEmail({
      userProfile: profile,
      contact: { company, role_title, name, notes }
    });

    if (!result) {
      const fallback = buildColdEmail({ name, company, role_title });
      result = {
        subject: fallback.subject,
        textBody: fallback.textBody,
        htmlBody: fallback.htmlBody,
        llm_generated: false
      };
    }

    return res.status(200).json({
      message: 'Test cold email generated successfully!',
      draft: result
    });
  } catch (err) {
    return res.status(500).json({
      error: 'Failed to generate test draft',
      details: err.message
    });
  }
});

export default router;
