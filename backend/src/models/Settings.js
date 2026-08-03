import mongoose from 'mongoose';

/**
 * Simple key-value settings store for persisting runtime state
 * like last_poll_at across server restarts.
 */
const settingsSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    key: {
      type: String,
      required: true,
      trim: true
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    description: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

settingsSchema.index({ user_id: 1, key: 1 }, { unique: true });

/**
 * Upsert a setting by key for a user.
 */
settingsSchema.statics.set = async function (userId, key, value) {
  return this.findOneAndUpdate(
    { user_id: userId, key },
    { user_id: userId, key, value },
    { upsert: true, returnDocument: 'after' }
  );
};

/**
 * Get a setting by key for a user, returning defaultValue if not found.
 */
settingsSchema.statics.get = async function (userId, key, defaultValue = null) {
  const doc = await this.findOne({ user_id: userId, key });
  return doc ? doc.value : defaultValue;
};

const Settings = mongoose.model('Settings', settingsSchema);

export default Settings;
