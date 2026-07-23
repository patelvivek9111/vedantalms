const mongoose = require('mongoose');
const { immutableAppendOnlyPlugin } = require('./plugins/immutableAppendOnly.plugin');
const { tenantScopePlugin } = require('./plugins/tenantScope.plugin');

/**
 * Official transcript issuance record (registrar).
 * Stores immutable hash of issued course rows for audit / verification.
 */
const transcriptIssueLogSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    term: {
      type: String,
      required: true,
    },
    year: {
      type: Number,
      required: true,
    },
    issuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    transcriptHash: {
      type: String,
      required: true,
    },
    courseCount: {
      type: Number,
      default: 0,
    },
    payloadSummary: {
      type: mongoose.Schema.Types.Mixed,
    },
    notes: String,
    ip: String,
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TranscriptTemplate',
    },
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TranscriptRequest',
    },
    verifyUrl: String,
  },
  { timestamps: true }
);

transcriptIssueLogSchema.plugin(tenantScopePlugin);

transcriptIssueLogSchema.index({ student: 1, term: 1, year: 1, createdAt: -1 });
transcriptIssueLogSchema.index({ transcriptHash: 1 });
transcriptIssueLogSchema.index({ rootAccountId: 1, student: 1, createdAt: -1 });

transcriptIssueLogSchema.plugin(immutableAppendOnlyPlugin, { mode: 'transcript_issue' });
const { portabilityMetadataPlugin } = require('./plugins/portabilityMetadata.plugin');
transcriptIssueLogSchema.plugin(portabilityMetadataPlugin);

module.exports = mongoose.model('TranscriptIssueLog', transcriptIssueLogSchema);
