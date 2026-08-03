# Product Requirements Document
## HR Outreach Agent — Automated Personalized Cold Email System

**Author:** Utkarsh
**Version:** 1.0
**Date:** August 2, 2026
**Status:** Draft

---

## 1. Overview

### 1.1 Problem Statement
Manually finding HR contacts, writing personalized emails, tracking follow-ups, and managing responses across dozens of target companies is time-consuming and inconsistent. As a result, outreach volume stays low and follow-through drops off.

### 1.2 Solution
An automated agent that maintains a database of HR/recruiter contacts, sends personalized cold emails on a schedule, tracks reply status, triggers follow-ups, and uses an LLM to generate contextual, non-generic email content per recipient.

### 1.3 Goals
- Increase consistent outreach volume (target: 10–20 quality emails/day) without manual repetition.
- Improve response rate through genuine personalization, not mail-merge spam.
- Maintain full visibility into pipeline status (sent / opened / replied / follow-up due).
- Stay within deliverability and legal safety margins (avoid spam flags, include opt-out).

### 1.4 Non-Goals (v1)
- No LinkedIn scraping or automated contact harvesting (ToS risk).
- No fully autonomous reply-and-negotiate behavior — human approves before any reply is sent.
- No multi-channel outreach (LinkedIn DMs, calls) in v1 — email only.

---

## 2. Users

| User | Description |
|---|---|
| Primary user (you) | Sole operator; manages contact list, approves email drafts, monitors dashboard |
| Recipients (HRs/recruiters) | Passive; receive emails, may reply |

---

## 3. Core Features

### 3.1 Contact Management
- Store contacts: `name, email, company, role_title, company_domain, source, status, tags, last_contacted_at, next_followup_at, notes`
- Manual add (form/CSV import) — no scraping.
- Deduplication by email.
- Status states: `new → queued → sent → opened → replied → interested / not_interested / no_response → closed`

### 3.2 Email Personalization Engine
- LLM (Groq/Llama 3.3 70B, consistent with AtyantEngine stack) generates:
  - A 1–2 line personalized opener referencing company/role context.
  - Fits into a fixed template structure (subject, opener, body, CTA, signature).
- Human-in-the-loop: drafts generated in batch, reviewable before send (v1 requires approval; v2 can allow auto-send for high-confidence templates).
- Fallback to a clean generic template if LLM personalization fails or context is insufficient.

### 3.3 Sending Engine
- Gmail API (OAuth2) or transactional provider (Resend/SendGrid) for delivery.
- Rate limiting: configurable daily cap per sending account (default 20/day) to protect deliverability.
- SPF/DKIM/DMARC setup checklist surfaced during onboarding (not automated — domain-level config).
- Unsubscribe/opt-out link included in every email (compliance).

### 3.4 Scheduling & Automation
- Cron-based scheduler (node-cron locally, or Render/GitHub Actions cron in production).
- Daily batch job: selects N contacts from `queued` status, generates drafts, sends (or queues for approval), updates status + timestamps.
- Automatic follow-up scheduling: if no reply after configurable N days (default 5), auto-queue a follow-up email (max 2 follow-ups per contact by default).

### 3.5 Reply Tracking
- Poll inbox via Gmail API (or webhook if using a provider that supports it).
- LLM classifies incoming replies: `interested / not interested / auto-reply / bounce / out-of-office / unclear`.
- Updates contact status accordingly; surfaces "interested" replies prominently for immediate manual action.

### 3.6 Dashboard
- Simple web view (React, consistent with existing frontend stack) showing:
  - Pipeline funnel (queued → sent → opened → replied → interested)
  - Today's scheduled sends / pending approvals
  - Contacts needing follow-up
  - Basic metrics: send volume, reply rate, bounce rate

---

## 4. Technical Architecture

| Layer | Choice | Rationale |
|---|---|---|
| Backend | Node.js + Express | Reuse existing AtyantEngine patterns |
| Database | MongoDB Atlas (M0 free tier to start) | Already in use across your projects |
| LLM | Groq API (Llama 3.3 70B primary), fallback to Gemini | Matches AtyantEngine/Citizen Fraud Shield pattern |
| Email sending | Gmail API (OAuth2) for v1; evaluate Resend/SendGrid for scale | Gmail API keeps cost at zero initially |
| Scheduler | node-cron (local) → Render Cron Job (hosted) | Matches existing Render deployment |
| Frontend | React + Vite (or reuse existing dashboard shell) | Consistent with Atyant frontend stack |
| Hosting | Render (backend) + Vercel (frontend, if separate) | Matches current deployment pattern |

### 4.1 Data Model (simplified)

```
Contact {
  _id, name, email, company, role_title, company_domain,
  status, tags[], source, notes,
  last_contacted_at, next_followup_at, followup_count,
  created_at, updated_at
}

EmailLog {
  _id, contact_id, direction (outbound/inbound),
  subject, body, llm_generated (bool),
  sent_at, opened_at, classification, raw_reply_text
}
```

---

## 5. Constraints & Risks

| Risk | Mitigation |
|---|---|
| Emails flagged as spam / domain reputation damage | Low daily volume cap, proper SPF/DKIM/DMARC, no scraped/unverified addresses, warm-up period |
| Legal (CAN-SPAM / GDPR / India IT Act) | Always include sender identity + unsubscribe link; only email publicly available business contacts |
| Generic-sounding "personalization" reduces trust | Human review step in v1; keep opener short and specific, avoid AI-cliché phrasing |
| LLM misclassifying replies (e.g., "interested" missed) | Human still checks all replies weekly regardless of classification; classification is a triage aid, not final decision |
| Contact list quality (bounces, wrong emails) | Verify via a tool like Hunter.io/NeverBounce before adding to `queued` |

---

## 6. Success Metrics
- Reply rate ≥ 8–10% (industry cold-email benchmark is 1–5%, personalization should push this higher).
- Bounce rate < 3%.
- Zero domain blacklisting incidents.
- Time saved: < 15 min/day of manual effort to maintain 15–20 daily sends.

---

## 7. Milestones (suggested build order)

1. **v0.1** — Contact DB + manual CRUD + CSV import (no sending yet).
2. **v0.2** — Static template sending via Gmail API, manual trigger, rate-limited.
3. **v0.3** — LLM personalization layer + approval queue.
4. **v0.4** — Cron scheduling + auto follow-up logic.
5. **v0.5** — Reply polling + classification.
6. **v1.0** — Dashboard UI + metrics.

---

## 8. Open Questions
- Will this run under your personal domain or a dedicated outreach sub-domain/email?
- Approval step: fully manual per email, or batch-approve per day?
- Target volume — is 15–20/day the right ceiling given your available HR contact sources?
