/**
 * Helper to extract username from a GitHub URL or string.
 * e.g. "https://github.com/utkarsh2338/" -> "utkarsh2338"
 */
const extractGithubUsername = (url) => {
  if (!url) return null;
  const clean = url.trim().replace(/\/+$/, '');
  const match = clean.match(/(?:github\.com\/|^)([a-zA-Z0-9_-]+)$/i);
  return match ? match[1] : null;
};

/**
 * Helper to extract handle from LinkedIn URL.
 * e.g. "https://www.linkedin.com/in/utkarshshukla1007/" -> "utkarshshukla1007"
 */
const extractLinkedinHandle = (url) => {
  if (!url) return null;
  const clean = url.trim().replace(/\/+$/, '');
  const match = clean.match(/(?:linkedin\.com\/in\/|^)([a-zA-Z0-9_-]+)$/i);
  return match ? match[1] : null;
};

/**
 * Fetches public GitHub profile and repository information using GitHub REST API.
 * Gracefully handles missing input, rate limits, or network errors.
 *
 * @param {string} url - GitHub profile URL or username
 * @returns {Promise<object|null>} GitHub summary data or null if invalid/unavailable
 */
export const fetchGithubProfile = async (url) => {
  const username = extractGithubUsername(url);
  if (!username) return null;

  try {
    const headers = {
      'User-Agent': 'HR-Outreach-Agent-App',
      Accept: 'application/vnd.github.v3+json'
    };

    // 1. User details
    const userRes = await fetch(`https://api.github.com/users/${username}`, { headers });
    if (!userRes.ok) {
      console.warn(`[profileFetcherService] GitHub user API returned status ${userRes.status} for ${username}`);
      return { username, error: `GitHub API status ${userRes.status}` };
    }
    const userData = await userRes.json();

    // 2. Repositories (top 15 sorted by updated)
    const reposRes = await fetch(`https://api.github.com/users/${username}/repos?sort=updated&per_page=15`, { headers });
    let reposData = [];
    if (reposRes.ok) {
      reposData = await reposRes.json();
    }

    const repos = Array.isArray(reposData)
      ? reposData.map((r) => ({
          name: r.name,
          description: r.description || '',
          url: r.html_url,
          stars: r.stargazers_count,
          forks: r.forks_count,
          language: r.language,
          topics: r.topics || [],
          is_fork: r.fork
        }))
      : [];

    // Calculate aggregated stats
    const totalStars = repos.reduce((acc, r) => acc + (r.stars || 0), 0);
    const languagesSet = new Set(repos.map((r) => r.language).filter(Boolean));

    return {
      username: userData.login,
      name: userData.name || userData.login,
      bio: userData.bio || '',
      public_repos_count: userData.public_repos,
      followers: userData.followers,
      profile_url: userData.html_url,
      total_stars: totalStars,
      top_languages: Array.from(languagesSet),
      repositories: repos.slice(0, 10) // Keep top 10 relevant repos
    };
  } catch (err) {
    console.error(`[profileFetcherService] Failed to fetch GitHub profile for ${username}: ${err.message}`);
    return { username, error: err.message };
  }
};

/**
 * Attempts to extract public LinkedIn metadata from a LinkedIn profile URL.
 * Gracefully handles anti-scraping protections or missing input.
 *
 * @param {string} url - LinkedIn profile URL
 * @returns {Promise<object|null>} LinkedIn summary or null
 */
export const fetchLinkedinProfile = async (url) => {
  const handle = extractLinkedinHandle(url);
  if (!url || !handle) return null;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!res.ok) {
      return {
        handle,
        profile_url: url,
        status: 'linked',
        note: `Profile linked (${url})`
      };
    }

    const html = await res.text();
    const titleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i);
    const descMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i);

    return {
      handle,
      profile_url: url,
      title: titleMatch ? titleMatch[1] : '',
      description: descMatch ? descMatch[1] : '',
      status: 'fetched'
    };
  } catch (err) {
    return {
      handle,
      profile_url: url,
      status: 'linked',
      note: `Profile URL configured: ${url}`
    };
  }
};
