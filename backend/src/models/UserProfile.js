import mongoose from 'mongoose';
import { fileDb } from '../utils/fileDb.js';

const userProfileSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    resume_file_name: {
      type: String
    },
    resume_mime_type: {
      type: String
    },
    resume_text: {
      type: String
    },
    github_url: {
      type: String,
      trim: true
    },
    linkedin_url: {
      type: String,
      trim: true
    },
    parsed_profile: {
      name: { type: String },
      headline: { type: String },
      skills: [{ type: String }],
      projects: [
        {
          title: { type: String },
          description: { type: String },
          tech_stack: [{ type: String }],
          url: { type: String }
        }
      ],
      work_experience: [
        {
          title: { type: String },
          company: { type: String },
          duration: { type: String },
          description: { type: String }
        }
      ],
      education: [
        {
          degree: { type: String },
          institution: { type: String },
          year: { type: String },
          details: { type: String }
        }
      ],
      achievements: [{ type: String }],
      open_source: [{ type: String }],
      career_focus: { type: String },
      contact_info: {
        email: { type: String },
        phone: { type: String },
        location: { type: String }
      }
    },
    raw_github_data: {
      type: mongoose.Schema.Types.Mixed
    },
    raw_linkedin_data: {
      type: mongoose.Schema.Types.Mixed
    },
    last_analyzed_at: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

/**
 * Returns the UserProfile instance for a specific user (or creates default if missing)
 */
userProfileSchema.statics.getProfile = async function (userId) {
  if (!userId) throw new Error('userId is required for getProfile');
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return fileDb.getProfile();
    }
    let profile = await this.findOne({ user_id: userId });
    if (!profile) {
      profile = await this.create({ user_id: userId });
    }
    return profile;
  } catch (err) {
    return fileDb.getProfile();
  }
};

const UserProfile = mongoose.model('UserProfile', userProfileSchema);

export default UserProfile;
