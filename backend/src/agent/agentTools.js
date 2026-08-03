import Contact from '../models/Contact.js';
import EmailLog from '../models/EmailLog.js';
import User from '../models/User.js';
import JobLog from '../models/JobLog.js';
import { searchCompanyContext } from './companyLookupService.js';
import { classifyReply } from '../services/replyClassifierService.js';

/**
 * Tool definitions exposed to the Groq LLM agent (JSON Schema format)
 */
export const AGENT_TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'search_company_context',
      description: 'Search for real company context, engineering focus, and recent initiatives to personalize email outreach without inventing facts.',
      parameters: {
        type: 'object',
        properties: {
          company: { type: 'string', description: 'Target company name' }
        },
        required: ['company']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_contact_history',
      description: 'Fetch prior email logs and interaction history for a contact.',
      parameters: {
        type: 'object',
        properties: {
          contact_id: { type: 'string', description: 'Contact MongoDB ID' }
        },
        required: ['contact_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'check_send_quota',
      description: 'Check the user remaining daily send quota and sent count in last 24 hours.',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'draft_email',
      description: 'Queue an initial or follow-up email draft for human approval. Writes draft_pending EmailLog and updates contact status.',
      parameters: {
        type: 'object',
        properties: {
          contact_id: { type: 'string', description: 'Contact ID' },
          subject: { type: 'string', description: 'Email subject line' },
          body: { type: 'string', description: 'Plain text email body' },
          reasoning: { type: 'string', description: 'Stated reasoning for drafting this email' }
        },
        required: ['contact_id', 'subject', 'body', 'reasoning']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'classify_reply',
      description: 'Classify an unclassified inbound reply email log using the LLM classifier.',
      parameters: {
        type: 'object',
        properties: {
          email_log_id: { type: 'string', description: 'Inbound EmailLog ID' }
        },
        required: ['email_log_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'schedule_followup',
      description: 'Schedule next follow-up date for a contact.',
      parameters: {
        type: 'object',
        properties: {
          contact_id: { type: 'string', description: 'Contact ID' },
          days: { type: 'number', description: 'Days from now when follow-up is due' }
        },
        required: ['contact_id', 'days']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'mark_needs_attention',
      description: 'Flag a contact as needing human review/attention.',
      parameters: {
        type: 'object',
        properties: {
          contact_id: { type: 'string', description: 'Contact ID' },
          reason: { type: 'string', description: 'Reason for human attention' }
        },
        required: ['contact_id', 'reason']
      }
    }
  }
];

/**
 * Tool execution handlers
 */
export const executeAgentTool = async (name, args, userId) => {
  switch (name) {
    case 'search_company_context': {
      const context = await searchCompanyContext(args.company);
      return { company: args.company, context };
    }

    case 'get_contact_history': {
      const logs = await EmailLog.find({ user_id: userId, contact_id: args.contact_id })
        .sort({ createdAt: -1 })
        .limit(10);
      return { contact_id: args.contact_id, logs_count: logs.length, logs };
    }

    case 'check_send_quota': {
      const user = await User.findById(userId);
      const limit = user?.daily_send_limit || 20;
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const sent_24h = await EmailLog.countDocuments({
        user_id: userId,
        direction: 'outbound',
        log_status: 'sent',
        sent_at: { $gte: since }
      });
      return { daily_limit: limit, sent_24h, remaining: Math.max(0, limit - sent_24h) };
    }

    case 'draft_email': {
      const contact = await Contact.findOne({ _id: args.contact_id, user_id: userId });
      if (!contact) return { error: 'Contact not found for user' };

      const html_body = args.body.replace(/\n/g, '<br>');

      const draft = await EmailLog.create({
        user_id: userId,
        contact_id: contact._id,
        direction: 'outbound',
        subject: args.subject,
        body: args.body,
        html_body,
        llm_generated: true,
        log_status: 'draft_pending'
      });

      await Contact.findOneAndUpdate(
        { _id: contact._id, user_id: userId },
        { status: 'draft_pending' }
      );

      // Audit agent reasoning in JobLog
      await JobLog.create({
        user_id: userId,
        job_name: 'agent_draft_email',
        status: 'success',
        summary: {
          contact_id: contact._id,
          contact_name: contact.name,
          email_log_id: draft._id,
          reasoning: args.reasoning,
          subject: args.subject
        }
      });

      return { success: true, draft_id: draft._id, status: 'draft_pending' };
    }

    case 'classify_reply': {
      const emailLog = await EmailLog.findOne({ _id: args.email_log_id, user_id: userId, direction: 'inbound' });
      if (!emailLog) return { error: 'Inbound email log not found' };

      const { classification, confidence, reason } = await classifyReply({
        from: emailLog.subject,
        subject: emailLog.subject,
        body: emailLog.body || emailLog.raw_reply_text
      });

      emailLog.classification = classification;
      emailLog.classification_reason = reason;
      await emailLog.save();

      const needsAttention = confidence === 'low' || classification === 'interested';

      await Contact.findOneAndUpdate(
        { _id: emailLog.contact_id, user_id: userId },
        {
          status: classification,
          needs_attention: needsAttention
        }
      );

      return { classification, confidence, reason, needs_attention: needsAttention };
    }

    case 'schedule_followup': {
      const followupDate = new Date();
      followupDate.setDate(followupDate.getDate() + (args.days || 5));

      await Contact.findOneAndUpdate(
        { _id: args.contact_id, user_id: userId },
        { next_followup_at: followupDate }
      );

      return { success: true, contact_id: args.contact_id, next_followup_at: followupDate };
    }

    case 'mark_needs_attention': {
      await Contact.findOneAndUpdate(
        { _id: args.contact_id, user_id: userId },
        { needs_attention: true }
      );

      await JobLog.create({
        user_id: userId,
        job_name: 'agent_mark_attention',
        status: 'success',
        summary: {
          contact_id: args.contact_id,
          reasoning: args.reason
        }
      });

      return { success: true, contact_id: args.contact_id, needs_attention: true };
    }

    default:
      throw new Error(`Unknown tool name: ${name}`);
  }
};
