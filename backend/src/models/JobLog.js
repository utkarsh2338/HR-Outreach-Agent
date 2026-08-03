import mongoose from 'mongoose';

const jobLogSchema = new mongoose.Schema(
  {
    job_name: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    run_at: {
      type: Date,
      required: true,
      default: () => new Date()
    },
    // "success" | "partial" | "failed" | "skipped"
    status: {
      type: String,
      enum: ['success', 'partial', 'failed', 'skipped'],
      required: true
    },
    summary: {
      type: mongoose.Schema.Types.Mixed, // flexible JSON summary per job type
      default: {}
    },
    error: {
      type: String // top-level error message if job itself crashed
    }
  },
  {
    timestamps: true
  }
);

// Index to query recent runs per job efficiently
jobLogSchema.index({ job_name: 1, run_at: -1 });

const JobLog = mongoose.model('JobLog', jobLogSchema);

export default JobLog;
