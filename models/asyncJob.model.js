const mongoose = require('mongoose');

const asyncJobSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        'grades.finalize',
        'grades.recompute',
        'transcript.regenerate',
        'export.gradebook',
      ],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'completed', 'failed'],
      default: 'pending',
    },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    result: { type: mongoose.Schema.Types.Mixed },
    error: String,
    bullJobId: String,
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    progress: {
      completed: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
    },
    downloadToken: String,
    downloadExpiresAt: Date,
    filePath: String,
    fileName: String,
  },
  { timestamps: true }
);

asyncJobSchema.index({ requestedBy: 1, createdAt: -1 });
asyncJobSchema.index({ status: 1, createdAt: -1 });
asyncJobSchema.index({ type: 1, createdAt: -1 });

module.exports = mongoose.model('AsyncJob', asyncJobSchema);
