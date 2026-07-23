const mongoose = require('mongoose');
const { tenantScopePlugin } = require('./plugins/tenantScope.plugin');

/**
 * Log of grade passback exports to SIS (CSV/REST).
 */
const gradePassbackRecordSchema = new mongoose.Schema(
  {
    term: { type: String, required: true },
    year: { type: Number, required: true },
    academicTermId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AcademicTerm',
      default: null,
    },
    provider: { type: String, default: 'csv' },
    channel: { type: String, enum: ['csv', 'rest', 'lti_ags'], default: 'csv' },
    status: {
      type: String,
      enum: ['preview', 'exported', 'sent', 'failed'],
      default: 'exported',
    },
    rowCount: { type: Number, default: 0 },
    csvText: { type: String, default: '' },
    rows: { type: mongoose.Schema.Types.Mixed, default: [] },
    batchId: { type: String, default: '' },
    exportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    notes: { type: String, default: '' },
    errorMessage: { type: String, default: '' },
  },
  { timestamps: true }
);

gradePassbackRecordSchema.plugin(tenantScopePlugin);
gradePassbackRecordSchema.index({ rootAccountId: 1, term: 1, year: 1, createdAt: -1 });

module.exports = mongoose.model('GradePassbackRecord', gradePassbackRecordSchema);
