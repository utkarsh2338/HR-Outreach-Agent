# HR Outreach Agent — Backend API Documentation

An automated personalized cold email system backend built with Node.js, Express, and MongoDB.

---

## 🚀 Quick Start

### 1. Environment Setup
Copy `.env.example` to `.env` and fill in your credentials:
```bash
cp .env.example .env
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Run Development Server
```bash
npm run dev
```

The server runs by default on `http://localhost:5000`.

---

## 📚 Contact API Documentation

Base URL: `/api/contacts`

### Data Model Schema

| Field | Type | Description |
|---|---|---|
| `name` | String (Required) | Contact's full name |
| `email` | String (Required, Unique) | Valid lowercased email address |
| `company` | String (Required) | Target company name |
| `role_title` | String | Job title (e.g., "Senior Technical Recruiter") |
| `company_domain` | String | Domain name (e.g., "acme.com") |
| `status` | Enum | `new`, `queued`, `sent`, `opened`, `replied`, `interested`, `not_interested`, `no_response`, `closed` (Default: `new`) |
| `tags` | Array of Strings | Categories/labels (e.g. `["tech", "fintech"]`) |
| `source` | String | Data origin (e.g. "manual", "hunter.io", "referral", "csv_import") |
| `notes` | String | Internal notes |
| `last_contacted_at` | Date | Timestamp of last email sent |
| `next_followup_at` | Date | Timestamp scheduled for follow-up |
| `followup_count` | Number | Number of follow-ups sent (Default: `0`) |

---

### Endpoints Overview

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/contacts` | Create a single contact |
| `POST` | `/api/contacts/bulk` | Bulk import contacts from JSON array (skips duplicates) |
| `POST` | `/api/contacts/import-csv` | Import contacts from an uploaded CSV file |
| `POST` | `/api/contacts/batch-generate-drafts` | Batch-generate LLM drafts for N queued/new contacts |
| `GET` | `/api/contacts/needs-attention` | List contacts with interested replies awaiting action |
| `GET` | `/api/contacts` | List contacts with filtering, search, and pagination |
| `GET` | `/api/contacts/:id` | Get details for a specific contact |
| `PATCH` | `/api/contacts/:id` | Update contact fields / status |
| `DELETE` | `/api/contacts/:id` | Delete contact |
| `POST` | `/api/contacts/:id/send-test` | Send cold email directly to a contact via Gmail API |
| `POST` | `/api/contacts/:id/generate-draft` | Generate a personalized LLM draft (human approval required) |
| `GET` | `/api/email-logs/pending` | List all drafts awaiting human approval |
| `POST` | `/api/email-logs/:id/approve-and-send` | Approve a pending draft and send it |

---

### Endpoint Specifications & Examples

#### 1. Create Contact
- **Method:** `POST /api/contacts`
- **Request Body:**
```json
{
  "name": "Jane Doe",
  "email": "jane.doe@acme.com",
  "company": "Acme Corp",
  "role_title": "Lead Recruiter",
  "company_domain": "acme.com",
  "tags": ["tech", "engineering"],
  "source": "manual"
}
```
- **Response (201 Created):**
```json
{
  "_id": "66ae8f12a4b3c70012e8f9a1",
  "name": "Jane Doe",
  "email": "jane.doe@acme.com",
  "company": "Acme Corp",
  "role_title": "Lead Recruiter",
  "company_domain": "acme.com",
  "status": "new",
  "tags": ["tech", "engineering"],
  "source": "manual",
  "followup_count": 0,
  "createdAt": "2026-08-02T15:50:00.000Z",
  "updatedAt": "2026-08-02T15:50:00.000Z"
}
```
- **Error Response (409 Conflict):**
```json
{
  "error": "Contact with this email already exists"
}
```

---

#### 2. Bulk Import Contacts (JSON)
- **Method:** `POST /api/contacts/bulk`
- **Description:** Imports multiple contacts in a single JSON batch. Automatically validates input and skips existing emails in MongoDB.
- **Request Body:**
```json
[
  {
    "name": "John Smith",
    "email": "john.smith@techcorp.com",
    "company": "TechCorp",
    "role_title": "HR Director"
  },
  {
    "name": "Alice Walker",
    "email": "alice.walker@innovate.io",
    "company": "Innovate",
    "tags": ["startup"]
  }
]
```
- **Response (201 Created):**
```json
{
  "created": 2,
  "skipped": 0,
  "errors": [],
  "contacts": [
    {
      "_id": "66ae8f12a4b3c70012e8f9a2",
      "name": "John Smith",
      "email": "john.smith@techcorp.com",
      "company": "TechCorp",
      "status": "new",
      "createdAt": "2026-08-02T15:50:00.000Z"
    },
    {
      "_id": "66ae8f12a4b3c70012e8f9a3",
      "name": "Alice Walker",
      "email": "alice.walker@innovate.io",
      "company": "Innovate",
      "status": "new",
      "createdAt": "2026-08-02T15:50:00.000Z"
    }
  ]
}
```

---

#### 3. CSV Import Contacts
- **Method:** `POST /api/contacts/import-csv`
- **Content-Type:** `multipart/form-data`
- **Form Field:** `file` (CSV File)
- **Expected Columns:** `name`, `email`, `company`, `role_title`, `company_domain`, `source`, `notes`
- **Example cURL Command:**
```bash
curl -X POST http://localhost:5000/api/contacts/import-csv \
  -F "file=@src/test-data/sample-contacts.csv"
```
- **Response (201 Created):**
```json
{
  "imported": 5,
  "skipped_duplicates": 1,
  "invalid_rows": [
    {
      "row": 7,
      "reason": "Missing required field: name"
    },
    {
      "row": 8,
      "reason": "Invalid email format: invalid-email-string"
    }
  ]
}
```

---

#### 4. List Contacts (Filtered & Paginated)
- **Method:** `GET /api/contacts`
- **Query Parameters:**
  - `status` (optional): Filter by status (e.g. `queued`, `sent`, `replied`)
  - `company` (optional): Case-insensitive partial company match
  - `tag` (optional): Filter by exact tag in tags array
  - `search` (optional): Partial match across name, email, or company
  - `page` (optional): Page number (default: `1`)
  - `limit` (optional): Items per page (default: `10`, max: `100`)
- **Example Request:** `GET /api/contacts?status=new&company=Acme&page=1&limit=10`
- **Response (200 OK):**
```json
{
  "contacts": [
    {
      "_id": "66ae8f12a4b3c70012e8f9a1",
      "name": "Jane Doe",
      "email": "jane.doe@acme.com",
      "company": "Acme Corp",
      "status": "new",
      "tags": ["tech"]
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 10,
  "totalPages": 1
}
```

---

#### 5. Get Contact by ID
- **Method:** `GET /api/contacts/:id`
- **Response (200 OK):**
```json
{
  "_id": "66ae8f12a4b3c70012e8f9a1",
  "name": "Jane Doe",
  "email": "jane.doe@acme.com",
  "company": "Acme Corp",
  "status": "new"
}
```
- **Error Response (404 Not Found):**
```json
{
  "error": "Contact not found"
}
```

---

#### 6. Update Contact
- **Method:** `PATCH /api/contacts/:id`
- **Request Body:**
```json
{
  "status": "queued",
  "notes": "Introductory outreach queued for tomorrow morning",
  "next_followup_at": "2026-08-07T09:00:00.000Z"
}
```
- **Response (200 OK):**
```json
{
  "_id": "66ae8f12a4b3c70012e8f9a1",
  "name": "Jane Doe",
  "email": "jane.doe@acme.com",
  "company": "Acme Corp",
  "status": "queued",
  "notes": "Introductory outreach queued for tomorrow morning",
  "next_followup_at": "2026-08-07T09:00:00.000Z",
  "updatedAt": "2026-08-02T15:52:00.000Z"
}
```

---

#### 7. Delete Contact
- **Method:** `DELETE /api/contacts/:id`
- **Response (200 OK):**
```json
{
  "message": "Contact deleted successfully",
  "id": "66ae8f12a4b3c70012e8f9a1"
}
```

---

#### 8. Send Test Email
- **Method:** `POST /api/contacts/:id/send-test`
- **Description:** Sends the cold email template to the contact via Gmail API. Enforces a 24-hour rate limit (default 20 emails/day, configurable via `DAILY_SEND_LIMIT` in `.env`). Updates contact status to `sent` and records an `EmailLog` entry.
- **Example Request:** `POST /api/contacts/66ae8f12a4b3c70012e8f9a1/send-test`
- **Response (200 OK):**
```json
{
  "message": "Email sent successfully",
  "contact": {
    "id": "66ae8f12a4b3c70012e8f9a1",
    "name": "Jane Doe",
    "email": "jane.doe@acme.com",
    "status": "sent",
    "last_contacted_at": "2026-08-02T10:30:00.000Z"
  },
  "email_log_id": "66ae8f13a4b3c70012e8f9b2",
  "subject": "Quick intro — software developer open to opportunities at Acme Corp",
  "sent_at": "2026-08-02T10:30:00.000Z",
  "daily_quota": {
    "sent_in_last_24h": 1,
    "limit": 20,
    "remaining": 19
  }
}
```
- **Error Response (429 Too Many Requests — rate limit hit):**
```json
{
  "error": "Daily send limit reached (20 emails/24h). Try again later.",
  "sent_in_last_24h": 20,
  "limit": 20
}
```
- **Error Response (500 — Gmail not configured):**
```json
{
  "error": "Gmail credentials not configured",
  "details": "Gmail OAuth2 credentials are missing. Ensure GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN are set in .env"
}
```

---

#### 9. Generate Personalized Draft (LLM)
- **Method:** `POST /api/contacts/:id/generate-draft`
- **Description:** Calls Groq (Llama 3.3 70B) to generate a personalized 1-2 sentence opener for the contact, merges it into the fixed email template, and stores the full draft as a `draft_pending` EmailLog entry. **Does not send the email.** Returns the full draft for review.
- **Example Request:** `POST /api/contacts/66ae8f12a4b3c70012e8f9a1/generate-draft`
- **Response (201 Created):**
```json
{
  "message": "Draft generated successfully — review and approve before sending.",
  "draft_id": "66ae9a00b2c3d80023f9c012",
  "contact": {
    "id": "66ae8f12a4b3c70012e8f9a1",
    "name": "Jane Doe",
    "email": "jane.doe@acme.com",
    "company": "Acme Corp"
  },
  "draft": {
    "subject": "Quick intro — software developer open to opportunities at Acme Corp",
    "opener": "Acme Corp's focus on developer tooling caught my attention — the shift toward self-serve infrastructure is exactly the kind of problem I find interesting.",
    "body": "Hi Jane,\n\nAcme Corp's focus on...",
    "llm_generated": true,
    "log_status": "draft_pending",
    "created_at": "2026-08-02T10:51:00.000Z"
  }
}
```

> **Note:** If `GROQ_API_KEY` is not set, or if Groq returns a cliché/empty response, the draft falls back to a neutral static opener and `llm_generated` is `false`.

---

#### 10. Approve Draft and Send
- **Method:** `POST /api/email-logs/:id/approve-and-send`
- **Description:** Takes a `draft_pending` EmailLog by ID, sends the stored email via the Gmail API, updates the log status to `sent`, and marks the contact as `sent`. Enforces the daily send rate limit. This is the explicit human-approval step — drafts never auto-send.
- **Example Request:** `POST /api/email-logs/66ae9a00b2c3d80023f9c012/approve-and-send`
- **Response (200 OK):**
```json
{
  "message": "Draft approved and email sent successfully.",
  "email_log_id": "66ae9a00b2c3d80023f9c012",
  "contact": {
    "id": "66ae8f12a4b3c70012e8f9a1",
    "name": "Jane Doe",
    "email": "jane.doe@acme.com",
    "status": "sent",
    "last_contacted_at": "2026-08-02T10:55:00.000Z"
  },
  "subject": "Quick intro — software developer open to opportunities at Acme Corp",
  "sent_at": "2026-08-02T10:55:00.000Z",
  "llm_generated": true,
  "daily_quota": {
    "sent_in_last_24h": 1,
    "limit": 20,
    "remaining": 19
  }
}
```
- **Error Response (409 Conflict — wrong status):**
```json
{
  "error": "This draft cannot be sent. Current status: \"sent\". Only \"draft_pending\" drafts can be approved."
}
```

---

#### 11. Batch Generate Drafts
- **Method:** `POST /api/contacts/batch-generate-drafts`
- **Description:** Selects up to `limit` contacts with status `queued` or `new` (oldest first), generates a personalized LLM draft for each via Groq, stores each as a `draft_pending` EmailLog, and updates each contact's status to `draft_pending`. One failure does not abort the batch. A 1.5-second delay is applied between Groq calls to avoid rate limiting (configurable via `GROQ_BATCH_DELAY_MS` env var).
- **Request Body:**
```json
{ "limit": 10 }
```
- **Response (200 OK):**
```json
{
  "message": "Batch draft generation complete. 3 drafted, 0 failed.",
  "drafted": 3,
  "failed_count": 0,
  "results": [
    {
      "contact_id": "66ae8f12a4b3c70012e8f9a1",
      "contact_name": "Jane Doe",
      "contact_email": "jane.doe@acme.com",
      "company": "Acme Corp",
      "draft_id": "66ae9a00b2c3d80023f9c012",
      "llm_generated": true
    }
  ],
  "failed": []
}
```
- **Response with partial failures:**
```json
{
  "drafted": 2,
  "failed_count": 1,
  "failed": [
    {
      "contact_id": "66ae8f12a4b3c70012e8f9a3",
      "contact_name": "John Smith",
      "contact_email": "john@corp.com",
      "reason": "Groq API error: Rate limit exceeded"
    }
  ]
}
```

---

#### 12. List Pending Drafts
- **Method:** `GET /api/email-logs/pending`
- **Description:** Returns all `draft_pending` EmailLog entries with populated contact info, sorted newest first. Use this to review drafts before approving them with `approve-and-send`.
- **Query Parameters:** `page` (default: 1), `limit` (default: 20, max: 100)
- **Example Request:** `GET /api/email-logs/pending?page=1&limit=20`
- **Response (200 OK):**
```json
{
  "total": 3,
  "page": 1,
  "limit": 20,
  "totalPages": 1,
  "drafts": [
    {
      "draft_id": "66ae9a00b2c3d80023f9c012",
      "contact": {
        "_id": "66ae8f12a4b3c70012e8f9a1",
        "name": "Jane Doe",
        "email": "jane.doe@acme.com",
        "company": "Acme Corp",
        "role_title": "Lead Recruiter",
        "status": "draft_pending"
      },
      "subject": "Quick intro — software developer open to opportunities at Acme Corp",
      "body": "Hi Jane,\n\nAcme Corp's focus on...",
      "llm_generated": true,
      "log_status": "draft_pending",
      "created_at": "2026-08-02T10:51:00.000Z"
    }
  ]
}
```

---

#### 13. Get Contacts Needing Attention
- **Method:** `GET /api/contacts/needs-attention`
- **Description:** Returns contacts where `needs_attention=true` (set automatically when a reply is classified as `interested`). Each result includes the contact data and their most recent inbound reply with classification. Supports pagination.
- **Response (200 OK):**
```json
{
  "total": 1,
  "page": 1,
  "limit": 20,
  "totalPages": 1,
  "contacts": [
    {
      "contact": {
        "_id": "66ae8f12a4b3c70012e8f9a1",
        "name": "Jane Doe",
        "email": "jane.doe@acme.com",
        "company": "Acme Corp",
        "status": "replied",
        "needs_attention": true
      },
      "latest_reply": {
        "direction": "inbound",
        "subject": "Re: Quick intro",
        "body": "Hi, thanks for reaching out! Could you send over your resume?",
        "classification": "interested",
        "classification_reason": "Recruiter requests CV and implies interest in a call.",
        "gmail_thread_id": "18b9e7f2c4d1a2b3",
        "sent_at": "2026-08-03T08:12:00.000Z"
      }
    }
  ]
}
```

> **Note:** `needs_attention` is only cleared when you explicitly `PATCH /api/contacts/:id` with `{ "needs_attention": false }` after you've acted on the lead. Classification is triage-only — no contacts are auto-closed or auto-rejected.

---

### Scheduled Jobs (ENABLE_CRON=true)

| Job | Schedule | What it does |
|---|---|---|
| `daily_draft` | `DAILY_DRAFT_CRON` (9:00am) | Picks up `queued`/`new` contacts, generates drafts via Groq, stores as `draft_pending` |
| `followup_draft` | `FOLLOWUP_CRON` (9:30am) | Finds `sent` contacts silent for `FOLLOWUP_DAYS` days, generates follow-up drafts |
| `reply_poll` | `REPLY_POLL_CRON` (every 30 min) | Polls Gmail inbox, matches replies by thread ID, classifies with Groq, logs inbound entries, sets `needs_attention` on interested replies |

All job runs are logged to the `joblogs` MongoDB collection with `job_name`, `run_at`, `status`, and a full `summary` object.

### Reply Classification Labels

| Label | Meaning |
|---|---|
| `interested` | Recruiter shows genuine interest — sets `needs_attention=true` |
| `not_interested` | Explicit decline |
| `auto_reply` | Automated acknowledgement (no human decision) |
| `bounce` | Delivery failure / mailer daemon |
| `out_of_office` | Human-set absence notification |
| `unclear` | Ambiguous or off-topic |

All classifications are triage aids only — no automated action changes contact status beyond `replied`.
