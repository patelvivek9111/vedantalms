const mongoose = require('mongoose');
const { tenantScopePlugin } = require('./plugins/tenantScope.plugin');

/**
 * Student / registrar request queue for transcripts and related credentials.
 * Bonafide / migration TC full workflows land in R8; model is shared.
 */
const transcriptRequestSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    term: { type: String, required: true, trim: true },
    year: { type: Number, required: true },
    type: {
      type: String,
      enum: ['unofficial', 'official', 'bonafide', 'migration_tc'],
      default: 'official',
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'issued', 'rejected'],
      default: 'pending',
      index: true,
    },
    copies: { type: Number, default: 1, min: 1, max: 20 },
    deliveryMethod: {
      type: String,
      enum: ['download', 'email', 'pickup'],
      default: 'download',
    },
    feeRef: { type: String, default: '', trim: true },
    notes: { type: String, default: '', trim: true },
    rejectionReason: { type: String, default: '', trim: true },
    requestedAt: { type: Date, default: Date.now },
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    issuedAt: { type: Date, default: null },
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TranscriptTemplate',
      default: null,
    },
    issueLogId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TranscriptIssueLog',
      default: null,
    },
  },
  { timestamps: true }
);

transcriptRequestSchema.plugin(tenantScopePlugin);

transcriptRequestSchema.index({ rootAccountId: 1, status: 1, requestedAt: -1 });
transcriptRequestSchema.index({ rootAccountId: 1, studentId: 1, createdAt: -1 });

module.exports = mongoose.model('TranscriptRequest', transcriptRequestSchema);
