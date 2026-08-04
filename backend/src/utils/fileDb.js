import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Papa from 'papaparse';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Data paths
const DATA_DIR = path.resolve(__dirname, '../../data');
const USER_PROFILE_FILE = path.join(DATA_DIR, 'user_profile.json');
const EMAIL_LOGS_FILE = path.join(DATA_DIR, 'email_logs.json');
const SAMPLE_CONTACTS_CSV = path.resolve(__dirname, '../test-data/sample-contacts.csv');
const SENT_CONTACTS_CSV = path.join(DATA_DIR, 'sent_contacts.csv');

// Ensure directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial defaults
const DEFAULT_USER_PROFILE = {
  id: 'local_user_1',
  name: 'Tanish Patidar',
  email: 'patidar29tanish@gmail.com',
  github_url: 'https://github.com/TechTAnish-07',
  linkedin_url: 'https://www.linkedin.com/in/tanish07patidar-/',
  portfolio_url: '',
  resume_url: '',
  resume_file_name: '',
  resume_text: '',
  parsed_profile: null,
  autonomy_mode: 'approval_required',
  daily_send_limit: 20,
  blocklist: []
};

// Helper: Atomic JSON Read/Write
const readJson = (filePath, fallback) => {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2), 'utf-8');
      return fallback;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content || JSON.stringify(fallback));
  } catch (err) {
    console.error(`[fileDb] Error reading ${filePath}: ${err.message}`);
    return fallback;
  }
};

const writeJson = (filePath, data) => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error(`[fileDb] Error writing ${filePath}: ${err.message}`);
    return false;
  }
};

// Helper: CSV Read/Write
export const readContactsFromCSV = () => {
  try {
    if (!fs.existsSync(SAMPLE_CONTACTS_CSV)) return [];
    let content = fs.readFileSync(SAMPLE_CONTACTS_CSV, 'utf-8');

    const lines = content.split(/\r?\n/);
    if (lines[0] && lines[0].includes('educational')) {
      content = lines.slice(1).join('\n');
    }

    const parsed = Papa.parse(content, { header: true, skipEmptyLines: true });
    return (parsed.data || [])
      .map((row, idx) => {
        const name = (row.Name || row.name || '').trim();
        const company = (row['Company Name'] || row.Company || row.company || '').trim();
        const role_title = (row['Job Title'] || row.role_title || row.title || '').trim();
        const rawEmail = (row.Email || row.email || row.EmailAddress || '').trim().toLowerCase();

        const cleanName = name.replace(/[^a-zA-Z0-9]/g, '.').toLowerCase();
        const cleanComp = company.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const email = rawEmail || (name && company ? `${cleanName}@${cleanComp || 'company'}.com` : '');

        return {
          _id: `csv_${idx}_${cleanName}_${cleanComp}`,
          name: name || 'Recruiter',
          email,
          company: company || 'Company',
          role_title: role_title || 'Talent Acquisition',
          company_domain: row['Company Website'] || row.company_domain || '',
          status: 'queued',
          source: 'csv',
          notes: row.notes || ''
        };
      })
      .filter((c) => c.name && c.company);
  } catch (err) {
    console.error(`[fileDb] Failed to read sample-contacts.csv: ${err.message}`);
    return [];
  }
};

export const trimContactFromCSV = (targetIdentifier) => {
  if (!targetIdentifier || !fs.existsSync(SAMPLE_CONTACTS_CSV)) return false;
  const searchStr = targetIdentifier.trim().toLowerCase();

  try {
    const rawContent = fs.readFileSync(SAMPLE_CONTACTS_CSV, 'utf-8');
    const lines = rawContent.split(/\r?\n/);
    let headerOffset = 0;
    let contentToParse = rawContent;

    if (lines[0] && lines[0].includes('educational')) {
      headerOffset = 1;
      contentToParse = lines.slice(1).join('\n');
    }

    const parsed = Papa.parse(contentToParse, { header: true, skipEmptyLines: true });
    const rows = parsed.data || [];

    const removedRows = [];
    const remainingRows = [];

    rows.forEach((row) => {
      const rowName = (row.Name || row.name || '').trim().toLowerCase();
      const rowEmail = (row.Email || row.email || '').trim().toLowerCase();
      const rowComp = (row['Company Name'] || row.Company || row.company || '').trim().toLowerCase();

      const generatedEmail = `${rowName.replace(/[^a-z0-9]/g, '.')}@${rowComp.replace(/[^a-z0-9]/g, '') || 'company'}.com`;

      if (
        (rowEmail && rowEmail === searchStr) ||
        generatedEmail === searchStr ||
        (rowName && searchStr.includes(rowName))
      ) {
        removedRows.push(row);
      } else {
        remainingRows.push(row);
      }
    });

    if (removedRows.length > 0) {
      const disclaimer = headerOffset === 1 ? `${lines[0]}\n` : '';
      const newCsvContent = disclaimer + Papa.unparse(remainingRows);
      fs.writeFileSync(SAMPLE_CONTACTS_CSV, newCsvContent, 'utf-8');

      const appendHeader = !fs.existsSync(SENT_CONTACTS_CSV);
      const sentRows = removedRows.map((r) => ({ ...r, sent_at: new Date().toISOString() }));
      const sentCsvContent = Papa.unparse(sentRows, { header: appendHeader });
      fs.appendFileSync(SENT_CONTACTS_CSV, (appendHeader ? '' : '\n') + sentCsvContent, 'utf-8');

      console.log(`[fileDb] Successfully trimmed "${targetIdentifier}" from sample-contacts.csv and appended to sent_contacts.csv`);
      return true;
    }
  } catch (err) {
    console.error(`[fileDb] Error trimming CSV for ${targetIdentifier}: ${err.message}`);
  }
  return false;
};

// Database interface export
export const fileDb = {
  // Profile
  getProfile: () => readJson(USER_PROFILE_FILE, DEFAULT_USER_PROFILE),
  saveProfile: (updates) => {
    const current = readJson(USER_PROFILE_FILE, DEFAULT_USER_PROFILE);
    const updated = { ...current, ...updates, updatedAt: new Date().toISOString() };
    writeJson(USER_PROFILE_FILE, updated);
    return updated;
  },

  // Email Logs
  getEmailLogs: () => readJson(EMAIL_LOGS_FILE, []),
  saveEmailLog: (log) => {
    const logs = readJson(EMAIL_LOGS_FILE, []);
    const newLog = {
      _id: log._id || `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...log
    };
    logs.unshift(newLog);
    writeJson(EMAIL_LOGS_FILE, logs);
    return newLog;
  },
  updateEmailLog: (id, updates) => {
    const logs = readJson(EMAIL_LOGS_FILE, []);
    const index = logs.findIndex((l) => l._id === id);
    if (index === -1) return null;
    logs[index] = { ...logs[index], ...updates, updatedAt: new Date().toISOString() };
    writeJson(EMAIL_LOGS_FILE, logs);
    return logs[index];
  },
  deleteEmailLog: (id) => {
    const logs = readJson(EMAIL_LOGS_FILE, []);
    const filtered = logs.filter((l) => l._id !== id);
    writeJson(EMAIL_LOGS_FILE, filtered);
    return true;
  },

  // Contacts
  getContactsFromCsv: readContactsFromCSV,
  trimContactFromCsv: trimContactFromCSV
};
