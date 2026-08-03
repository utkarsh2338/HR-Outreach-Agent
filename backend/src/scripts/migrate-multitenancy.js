import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import User from '../models/User.js';
import Contact from '../models/Contact.js';
import EmailLog from '../models/EmailLog.js';
import JobLog from '../models/JobLog.js';
import Settings from '../models/Settings.js';
import UserProfile from '../models/UserProfile.js';

async function migrate() {
  console.log('🔄 Starting multi-tenancy database migration...\n');
  await connectDB();

  const legacyEmail = process.env.LEGACY_USER_EMAIL || 'utkarshshukla1007@gmail.com';

  // 1. Create or retrieve legacy primary user
  let legacyUser = await User.findOne({ email: legacyEmail.toLowerCase() });
  if (!legacyUser) {
    legacyUser = await User.create({
      name: 'Utkarsh Shukla',
      email: legacyEmail.toLowerCase(),
      google_id: process.env.LEGACY_GOOGLE_ID || 'legacy_utkarsh_shukla_google_id_001',
      google_refresh_token: process.env.GMAIL_REFRESH_TOKEN || undefined,
      autonomy_mode: 'approval_required',
      daily_send_limit: parseInt(process.env.DAILY_SEND_LIMIT || '20', 10),
      timezone: 'Asia/Kolkata',
      is_active: true
    });
    console.log(`✅ Created legacy primary User: ${legacyUser.email} (_id: ${legacyUser._id})`);
  } else {
    console.log(`ℹ️  Found existing legacy User: ${legacyUser.email} (_id: ${legacyUser._id})`);
  }

  const userId = legacyUser._id;

  // 2. Backfill Contact records
  const contactRes = await Contact.updateMany(
    { $or: [{ user_id: { $exists: false } }, { user_id: null }] },
    { $set: { user_id: userId } }
  );
  console.log(`📦 Contacts backfilled: ${contactRes.modifiedCount}`);

  // 3. Backfill EmailLog records
  const emailRes = await EmailLog.updateMany(
    { $or: [{ user_id: { $exists: false } }, { user_id: null }] },
    { $set: { user_id: userId } }
  );
  console.log(`✉️  EmailLogs backfilled: ${emailRes.modifiedCount}`);

  // 4. Backfill JobLog records
  const jobRes = await JobLog.updateMany(
    { $or: [{ user_id: { $exists: false } }, { user_id: null }] },
    { $set: { user_id: userId } }
  );
  console.log(`📋 JobLogs backfilled: ${jobRes.modifiedCount}`);

  // 5. Backfill Settings records
  const settingsRes = await Settings.updateMany(
    { $or: [{ user_id: { $exists: false } }, { user_id: null }] },
    { $set: { user_id: userId } }
  );
  console.log(`⚙️  Settings backfilled: ${settingsRes.modifiedCount}`);

  // 6. Backfill UserProfile records
  const profileRes = await UserProfile.updateMany(
    { $or: [{ user_id: { $exists: false } }, { user_id: null }] },
    { $set: { user_id: userId } }
  );
  console.log(`👤 UserProfiles backfilled: ${profileRes.modifiedCount}`);

  console.log('\n🎉 Multi-tenancy migration completed successfully!');
  await mongoose.disconnect();
  process.exit(0);
}

migrate().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
