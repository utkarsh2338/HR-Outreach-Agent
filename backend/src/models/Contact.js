import mongoose from 'mongoose';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const contactSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
      match: [EMAIL_REGEX, 'Please provide a valid email address']
    },
    company: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true
    },
    role_title: {
      type: String,
      trim: true
    },
    company_domain: {
      type: String,
      trim: true
    },
    status: {
      type: String,
      enum: [
        'new',
        'queued',
        'draft_pending',
        'sent',
        'opened',
        'replied',
        'interested',
        'not_interested',
        'no_response',
        'closed'
      ],
      default: 'new'
    },
    tags: {
      type: [String],
      default: []
    },
    source: {
      type: String,
      trim: true
    },
    notes: {
      type: String
    },
    last_contacted_at: {
      type: Date
    },
    next_followup_at: {
      type: Date
    },
    followup_count: {
      type: Number,
      default: 0
    },
    // Set to true when a reply is classified as "interested" — cleared manually
    needs_attention: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Compound index for user-scoped email uniqueness and text search
contactSchema.index({ user_id: 1, email: 1 }, { unique: true });
contactSchema.index({ user_id: 1, name: 'text', email: 'text', company: 'text' });

const Contact = mongoose.model('Contact', contactSchema);

export default Contact;
