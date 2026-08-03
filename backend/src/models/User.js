import mongoose from 'mongoose';
import { encrypt, decrypt } from '../utils/crypto.js';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    google_id: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    google_refresh_token: {
      type: String,
      get: decrypt,
      set: encrypt
    },
    autonomy_mode: {
      type: String,
      enum: ['approval_required', 'auto_send'],
      default: 'approval_required'
    },
    daily_send_limit: {
      type: Number,
      default: 20
    },
    timezone: {
      type: String,
      default: 'UTC'
    },
    is_active: {
      type: Boolean,
      default: true
    },
    blocklist: {
      type: [String],
      default: []
    }
  },
  {
    timestamps: true,
    toObject: { getters: true },
    toJSON: { getters: true }
  }
);

const User = mongoose.model('User', userSchema);

export default User;
