import mongoose from 'mongoose';

/**
 * Simple key-value settings store for persisting runtime state
 * like last_poll_at across server restarts.
 */
const settingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
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

/**
 * Upsert a setting by key.
 */
settingsSchema.statics.set = async function (key, value) {
  return this.findOneAndUpdate(
    { key },
    { key, value },
    { upsert: true, returnDocument: 'after' }
  );
};

/**
 * Get a setting by key, returning defaultValue if not found.
 */
settingsSchema.statics.get = async function (key, defaultValue = null) {
  const doc = await this.findOne({ key });
  return doc ? doc.value : defaultValue;
};

const Settings = mongoose.model('Settings', settingsSchema);

export default Settings;
