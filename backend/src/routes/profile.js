import express from 'express';
import multer from 'multer';
import { fileDb } from '../utils/fileDb.js';
import { parseResumeBuffer } from '../services/resumeParserService.js';
import { fetchGithubProfile, fetchLinkedinProfile } from '../services/profileFetcherService.js';
import { synthesizeUserProfile } from '../services/profileAnalysisService.js';
import { generateFullPersonalizedEmail } from '../services/groqService.js';
import { buildColdEmail } from '../templates/coldEmail.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(requireAuth);

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
 * @desc    Get candidate profile & resume metadata from local fileDb
 */
router.get('/', async (req, res) => {
  try {
    const profile = fileDb.getProfile();
    return res.status(200).json({
      success: true,
      profile: {
        id: profile.id || 'local_user_1',
        resume_file_name: profile.resume_file_name || null,
        resume_mime_type: profile.resume_mime_type || null,
        has_resume: Boolean(profile.resume_text),
        resume_text_length: profile.resume_text ? profile.resume_text.length : 0,
        github_url: profile.github_url || '',
        linkedin_url: profile.linkedin_url || '',
        portfolio_url: profile.portfolio_url || '',
        resume_url: profile.resume_url || '',
        parsed_profile: profile.parsed_profile || null,
        raw_github_data: profile.raw_github_data || null,
        raw_linkedin_data: profile.raw_linkedin_data || null,
        last_analyzed_at: profile.last_analyzed_at || null,
        updated_at: profile.updatedAt || new Date().toISOString()
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

      const extractedText = await parseResumeBuffer(buffer, mimetype, originalname);

      const profile = fileDb.saveProfile({
        resume_file_name: originalname,
        resume_mime_type: mimetype,
        resume_text: extractedText
      });

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
 * @route   POST /api/profile/urls (and legacy /links)
 * @desc    Update GitHub, LinkedIn, Portfolio, and Resume PDF links
 */
const handleSaveUrls = async (req, res) => {
  try {
    const { github_url, linkedin_url, portfolio_url, resume_url } = req.body;

    const updates = {};
    if (github_url !== undefined) updates.github_url = github_url.trim();
    if (linkedin_url !== undefined) updates.linkedin_url = linkedin_url.trim();
    if (portfolio_url !== undefined) updates.portfolio_url = portfolio_url.trim();
    if (resume_url !== undefined) updates.resume_url = resume_url.trim();

    const profile = fileDb.saveProfile(updates);

    return res.status(200).json({
      message: 'Profile links updated successfully',
      github_url: profile.github_url,
      linkedin_url: profile.linkedin_url,
      portfolio_url: profile.portfolio_url,
      resume_url: profile.resume_url
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update profile URLs', details: err.message });
  }
};

router.post('/urls', handleSaveUrls);
router.post('/links', handleSaveUrls);

/**
 * @route   POST /api/profile/analyze
 * @desc    Analyze uploaded resume + fetch GitHub/LinkedIn profile data + synthesize using Groq AI
 */
router.post('/analyze', async (req, res) => {
  try {
    const profile = fileDb.getProfile();

    const resumeText = profile.resume_text || '';
    const githubUrl = profile.github_url || '';
    const linkedinUrl = profile.linkedin_url || '';

    if (!resumeText && !githubUrl && !linkedinUrl) {
      return res.status(400).json({
        error: 'Please upload a resume or provide GitHub/LinkedIn URLs before running AI synthesis.'
      });
    }

    const [githubData, linkedinData] = await Promise.all([
      githubUrl ? fetchGithubProfile(githubUrl) : Promise.resolve(null),
      linkedinUrl ? fetchLinkedinProfile(linkedinUrl) : Promise.resolve(null)
    ]);

    const parsedProfile = await synthesizeUserProfile({
      resumeText,
      githubData,
      linkedinData
    });

    const updated = fileDb.saveProfile({
      raw_github_data: githubData,
      raw_linkedin_data: linkedinData,
      parsed_profile: parsedProfile,
      last_analyzed_at: new Date().toISOString()
    });

    return res.status(200).json({
      message: 'Candidate profile analyzed and synthesized successfully!',
      parsed_profile: parsedProfile,
      last_analyzed_at: updated.last_analyzed_at
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

    const profile = fileDb.getProfile();

    let result = await generateFullPersonalizedEmail({
      userProfile: profile,
      contact: { company, role_title, name, notes }
    });

    if (!result) {
      const fallback = buildColdEmail({ name, company, role_title, candidate: profile });
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
