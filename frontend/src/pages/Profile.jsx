import { useState, useEffect } from 'react';
import {
  RiFileUploadLine,
  RiFileTextLine,
  RiGithubLine,
  RiLinkedinBoxLine,
  RiSparklingLine,
  RiCheckLine,
  RiErrorWarningLine,
  RiUser3Line,
  RiCodeSSlashLine,
  RiBriefcaseLine,
  RiGraduationCapLine,
  RiTrophyLine,
  RiMailSendLine,
  RiRefreshLine,
  RiLinksLine
} from 'react-icons/ri';
import { AppLayout, PageHeader } from '../components/layout/AppLayout.jsx';
import { Button } from '../components/common/Button.jsx';
import { ErrorState } from '../components/common/ErrorState.jsx';
import {
  useProfile,
  useUploadResume,
  useUpdateProfileUrls,
  useAnalyzeProfile,
  useTestGenerateDraft
} from '../hooks/useProfile.js';
import { relativeTime } from '../utils/format.js';

export const Profile = () => {
  const { data, isLoading, isError, refetch } = useProfile();
  const uploadResumeMutation = useUploadResume();
  const updateUrlsMutation = useUpdateProfileUrls();
  const analyzeProfileMutation = useAnalyzeProfile();
  const testGenerateMutation = useTestGenerateDraft();

  const profile = data?.profile;

  // Form states
  const [githubUrl, setGithubUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [resumeUrl, setResumeUrl] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null); // { type: 'success'|'error', text: '' }

  // Test generator sandbox state
  const [testCompany, setTestCompany] = useState('Stripe');
  const [testRole, setTestRole] = useState('Software Engineer (SDE-1)');
  const [testRecruiter, setTestRecruiter] = useState('Sarah Jenkins');
  const [testNotes, setTestNotes] = useState('');
  const [generatedTestDraft, setGeneratedTestDraft] = useState(null);

  useEffect(() => {
    if (profile) {
      setGithubUrl(profile.github_url || '');
      setLinkedinUrl(profile.linkedin_url || '');
      setPortfolioUrl(profile.portfolio_url || '');
      setResumeUrl(profile.resume_url || '');

      if (profile.parsed_profile) {
        try {
          localStorage.setItem('hr_agent_parsed_profile', JSON.stringify(profile.parsed_profile));
          localStorage.setItem('hr_agent_resume_info', JSON.stringify({
            file_name: profile.resume_file_name,
            last_analyzed: profile.last_analyzed_at
          }));
        } catch (_) {}
      }
    }
  }, [profile]);

  const handleSaveUrls = async (e) => {
    e.preventDefault();
    setStatusMessage(null);
    try {
      await updateUrlsMutation.mutateAsync({
        github_url: githubUrl,
        linkedin_url: linkedinUrl,
        portfolio_url: portfolioUrl,
        resume_url: resumeUrl
      });
      setStatusMessage({ type: 'success', text: 'Profile, Portfolio, and Resume links saved successfully!' });
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to save profile URLs.' });
    }
  };

  const handleFileChange = async (file) => {
    if (!file) return;

    const allowedExts = ['.pdf', '.docx', '.doc'];
    const isAllowed = allowedExts.some((ext) => file.name.toLowerCase().endsWith(ext));

    if (!isAllowed) {
      setStatusMessage({ type: 'error', text: 'Invalid file format. Please upload a PDF (.pdf) or DOCX (.docx) document.' });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setStatusMessage({ type: 'error', text: 'File size exceeds 10MB limit.' });
      return;
    }

    setStatusMessage(null);
    try {
      const res = await uploadResumeMutation.mutateAsync(file);
      setStatusMessage({
        type: 'success',
        text: `Uploaded "${res.resume_file_name}" (${res.word_count} words parsed). Click "Analyze Profile with AI" below to synthesize.`
      });
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to parse resume.' });
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleAnalyze = async () => {
    setStatusMessage(null);
    try {
      const result = await analyzeProfileMutation.mutateAsync();
      setStatusMessage({
        type: 'success',
        text: 'AI Analysis complete! Your candidate profile has been synthesized across your resume and profiles.'
      });
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to analyze profile with AI.' });
    }
  };

  const handleTestGenerate = async (e) => {
    e.preventDefault();
    setGeneratedTestDraft(null);
    try {
      const res = await testGenerateMutation.mutateAsync({
        company: testCompany,
        role_title: testRole,
        name: testRecruiter,
        notes: testNotes
      });
      setGeneratedTestDraft(res.draft);
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to generate test cold email.' });
    }
  };

  const parsed = profile?.parsed_profile;

  return (
    <AppLayout>
      <PageHeader
        title="My Profile & Resume"
        description="Upload your resume and connect GitHub & LinkedIn profiles to power personalized cold email generation."
        actions={
          <Button
            variant="primary"
            size="md"
            loading={analyzeProfileMutation.isPending}
            disabled={analyzeProfileMutation.isPending || (!profile?.has_resume && !profile?.github_url)}
            onClick={handleAnalyze}
          >
            <RiSparklingLine className="w-4 h-4" />
            {analyzeProfileMutation.isPending ? 'Synthesizing with AI…' : 'Analyze Profile with AI'}
          </Button>
        }
      />

      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Status Notification */}
        {statusMessage && (
          <div
            className={`p-4 rounded-md flex items-start gap-3 border text-sm ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-red-50 text-red-800 border-red-200'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <RiCheckLine className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" />
            ) : (
              <RiErrorWarningLine className="w-5 h-5 shrink-0 text-red-600 mt-0.5" />
            )}
            <div className="flex-1">{statusMessage.text}</div>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-gray-400 hover:text-gray-600 font-bold"
            >
              ×
            </button>
          </div>
        )}

        {isError && <ErrorState message="Could not load user profile" onRetry={refetch} />}

        {isLoading ? (
          <div className="p-12 text-center text-gray-500 animate-pulse">Loading candidate profile...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Upload & Profiles (1 col) */}
            <div className="space-y-6">
              {/* 1. Resume Upload Card */}
              <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <RiFileTextLine className="w-4 h-4 text-indigo-600" />
                    Resume (PDF / DOCX)
                  </h3>
                  {profile?.has_resume && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-2xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Uploaded
                    </span>
                  )}
                </div>

                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-lg p-5 text-center transition-colors cursor-pointer ${
                    dragActive ? 'border-indigo-500 bg-indigo-50/50' : 'border-gray-300 hover:border-indigo-400 bg-gray-50/40'
                  }`}
                  onClick={() => document.getElementById('resume-file-input').click()}
                >
                  <input
                    id="resume-file-input"
                    type="file"
                    accept=".pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="hidden"
                    onChange={(e) => handleFileChange(e.target.files[0])}
                  />

                  {uploadResumeMutation.isPending ? (
                    <div className="space-y-2 py-2">
                      <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
                      <p className="text-xs text-indigo-600 font-medium">Parsing document text...</p>
                    </div>
                  ) : (
                    <>
                      <RiFileUploadLine className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-xs font-medium text-gray-700">
                        {profile?.resume_file_name ? (
                          <span className="text-indigo-600 font-semibold">{profile.resume_file_name}</span>
                        ) : (
                          'Drop your resume here or click to browse'
                        )}
                      </p>
                      <p className="text-2xs text-gray-400 mt-1">Supports PDF and DOCX (up to 10MB)</p>
                    </>
                  )}
                </div>

                {profile?.has_resume && (
                  <div className="bg-gray-50 p-3 rounded text-xs text-gray-600 space-y-1 border border-gray-100">
                    <div className="flex justify-between text-gray-500">
                      <span>Parsed Text Length:</span>
                      <strong className="text-gray-800">{profile.resume_text_length} chars</strong>
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Public Profiles Card */}
              <form onSubmit={handleSaveUrls} className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <RiLinksLine className="w-4 h-4 text-indigo-600" />
                  Public Profiles
                </h3>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                    <RiGithubLine className="w-3.5 h-3.5 text-gray-600" />
                    GitHub Profile URL
                  </label>
                  <input
                    type="url"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    placeholder="https://github.com/username"
                    className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                    <RiLinkedinBoxLine className="w-3.5 h-3.5 text-blue-600" />
                    LinkedIn Profile URL
                  </label>
                  <input
                    type="url"
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                    placeholder="https://www.linkedin.com/in/username"
                    className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                    <RiLinksLine className="w-3.5 h-3.5 text-emerald-600" />
                    Portfolio Website Link
                  </label>
                  <input
                    type="url"
                    value={portfolioUrl}
                    onChange={(e) => setPortfolioUrl(e.target.value)}
                    placeholder="https://yourportfolio.com"
                    className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                    <RiFileTextLine className="w-3.5 h-3.5 text-amber-600" />
                    Hosted Resume PDF Link (Google Drive / Cloud)
                  </label>
                  <input
                    type="url"
                    value={resumeUrl}
                    onChange={(e) => setResumeUrl(e.target.value)}
                    placeholder="https://drive.google.com/file/d/your-resume-link"
                    className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <Button
                  type="submit"
                  variant="secondary"
                  size="sm"
                  loading={updateUrlsMutation.isPending}
                  className="w-full"
                >
                  Save Profile Links
                </Button>
              </form>
            </div>

            {/* Right Column: AI Profile Analysis & Sandbox (2 cols) */}
            <div className="lg:col-span-2 space-y-6">
              {/* Synthesized Profile Display */}
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 bg-gray-50/70 border-b border-gray-200 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                      <RiUser3Line className="w-4 h-4 text-indigo-600" />
                      AI-Synthesized Candidate Background
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {profile?.last_analyzed_at
                        ? `Last analyzed ${relativeTime(profile.last_analyzed_at)}`
                        : 'Upload resume and click "Analyze Profile with AI" to generate'}
                    </p>
                  </div>
                  {parsed && (
                    <span className="inline-flex items-center gap-1 text-xs text-indigo-700 bg-indigo-50 font-medium px-2.5 py-1 rounded-full border border-indigo-200">
                      <RiSparklingLine className="w-3.5 h-3.5" />
                      Groq Llama 3.3 70B
                    </span>
                  )}
                </div>

                {!parsed ? (
                  <div className="p-10 text-center space-y-3">
                    <RiSparklingLine className="w-10 h-10 text-gray-300 mx-auto" />
                    <p className="text-sm text-gray-600 font-medium">No synthesized profile yet</p>
                    <p className="text-xs text-gray-400 max-w-md mx-auto">
                      Upload your PDF/DOCX resume and add your GitHub profile link, then click <strong>"Analyze Profile with AI"</strong>.
                    </p>
                  </div>
                ) : (
                  <div className="p-6 space-y-6 text-sm">
                    {/* Name & Headline */}
                    <div className="border-b border-gray-100 pb-4">
                      <h4 className="text-base font-bold text-gray-900">{parsed.name}</h4>
                      {parsed.headline && <p className="text-xs text-indigo-600 font-medium mt-0.5">{parsed.headline}</p>}
                      {parsed.career_focus && (
                        <p className="text-xs text-gray-600 mt-2 bg-gray-50 p-2.5 rounded border border-gray-100 leading-relaxed">
                          <strong>Career Focus:</strong> {parsed.career_focus}
                        </p>
                      )}
                    </div>

                    {/* Skills */}
                    {parsed.skills?.length > 0 && (
                      <div>
                        <h5 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                          <RiCodeSSlashLine className="w-3.5 h-3.5 text-indigo-600" />
                          Skills &amp; Technologies
                        </h5>
                        <div className="flex flex-wrap gap-1.5">
                          {parsed.skills.map((skill, idx) => (
                            <span
                              key={idx}
                              className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded text-xs font-medium border border-indigo-100"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Projects */}
                    {parsed.projects?.length > 0 && (
                      <div>
                        <h5 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                          <RiCodeSSlashLine className="w-3.5 h-3.5 text-indigo-600" />
                          Key Projects &amp; Contributions
                        </h5>
                        <div className="space-y-3">
                          {parsed.projects.map((proj, idx) => (
                            <div key={idx} className="p-3 bg-gray-50/70 rounded-md border border-gray-200/80 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-xs text-gray-900">{proj.title}</span>
                                {proj.url && (
                                  <a
                                    href={proj.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-2xs text-indigo-600 hover:underline"
                                  >
                                    View Project →
                                  </a>
                                )}
                              </div>
                              <p className="text-xs text-gray-600 leading-relaxed">{proj.description}</p>
                              {proj.tech_stack?.length > 0 && (
                                <div className="flex flex-wrap gap-1 pt-1">
                                  {proj.tech_stack.map((t, tIdx) => (
                                    <span key={tIdx} className="px-1.5 py-0.5 bg-white text-gray-600 rounded text-2xs border border-gray-200">
                                      {t}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Work Experience */}
                    {parsed.work_experience?.length > 0 && (
                      <div>
                        <h5 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                          <RiBriefcaseLine className="w-3.5 h-3.5 text-indigo-600" />
                          Work Experience
                        </h5>
                        <div className="space-y-3">
                          {parsed.work_experience.map((exp, idx) => (
                            <div key={idx} className="border-l-2 border-indigo-400 pl-3 py-0.5 space-y-0.5">
                              <div className="flex items-center justify-between text-xs font-semibold text-gray-900">
                                <span>{exp.title} — {exp.company}</span>
                                <span className="text-2xs text-gray-400 font-normal">{exp.duration}</span>
                              </div>
                              <p className="text-xs text-gray-600 leading-relaxed">{exp.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Education & Achievements */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                      {parsed.education?.length > 0 && (
                        <div>
                          <h5 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                            <RiGraduationCapLine className="w-3.5 h-3.5 text-indigo-600" />
                            Education
                          </h5>
                          {parsed.education.map((edu, idx) => (
                            <div key={idx} className="text-xs space-y-0.5">
                              <p className="font-semibold text-gray-900">{edu.degree}</p>
                              <p className="text-gray-600">{edu.institution} ({edu.year})</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {parsed.achievements?.length > 0 && (
                        <div>
                          <h5 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                            <RiTrophyLine className="w-3.5 h-3.5 text-amber-500" />
                            Achievements &amp; Metrics
                          </h5>
                          <ul className="text-xs space-y-1 text-gray-600 list-disc pl-4">
                            {parsed.achievements.map((ach, idx) => (
                              <li key={idx}>{ach}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Sandbox: Live Test Email Generator */}
              <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <RiMailSendLine className="w-4 h-4 text-indigo-600" />
                    Test Cold Email Draft Generator
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Generate a live sample email to see how the AI agent merges your background with target company details.
                  </p>
                </div>

                <form onSubmit={handleTestGenerate} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-2xs font-semibold text-gray-600 uppercase mb-1">Target Company</label>
                    <input
                      type="text"
                      value={testCompany}
                      onChange={(e) => setTestCompany(e.target.value)}
                      placeholder="e.g. Stripe"
                      className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-2xs font-semibold text-gray-600 uppercase mb-1">Target Role</label>
                    <input
                      type="text"
                      value={testRole}
                      onChange={(e) => setTestRole(e.target.value)}
                      placeholder="e.g. Software Engineer"
                      className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-2xs font-semibold text-gray-600 uppercase mb-1">Recruiter Name</label>
                    <input
                      type="text"
                      value={testRecruiter}
                      onChange={(e) => setTestRecruiter(e.target.value)}
                      placeholder="e.g. Sarah Jenkins"
                      className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="sm:col-span-3 flex justify-end">
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      loading={testGenerateMutation.isPending}
                    >
                      <RiRefreshLine className="w-3.5 h-3.5" />
                      Generate Sample Cold Email
                    </Button>
                  </div>
                </form>

                {generatedTestDraft && (
                  <div className="mt-4 p-4 border border-indigo-200 rounded-md bg-indigo-50/30 space-y-3">
                    <div>
                      <span className="text-2xs font-bold uppercase text-indigo-700 tracking-wider">Subject Line</span>
                      <p className="text-xs font-semibold text-gray-900 mt-0.5">{generatedTestDraft.subject}</p>
                    </div>
                    <div>
                      <span className="text-2xs font-bold uppercase text-indigo-700 tracking-wider">Tailored Body</span>
                      <pre className="text-xs text-gray-800 font-sans whitespace-pre-wrap leading-relaxed mt-1 p-3 bg-white border border-gray-200 rounded">
                        {generatedTestDraft.textBody}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Profile;
