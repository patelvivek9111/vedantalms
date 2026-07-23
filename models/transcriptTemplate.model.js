const mongoose = require('mongoose');
const { tenantScopePlugin } = require('./plugins/tenantScope.plugin');

/**
 * Official transcript / credential document template (PDF or XLSX layout).
 */
const transcriptTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    format: { type: String, enum: ['pdf', 'xlsx'], default: 'pdf' },
    locale: { type: String, enum: ['en', 'hi'], default: 'en' },
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    includes: {
      type: [String],
      default: ['gpa', 'credits', 'grading_scale_legend', 'affiliation'],
    },
    /** GPA scale used when rendering / computing legend */
    gpaScale: {
      type: String,
      enum: ['us_4', 'india_10', 'cbse_cgpa'],
      default: 'india_10',
    },
    /** How repeated courses are resolved for GPA */
    repeatedCoursePolicy: {
      type: String,
      enum: ['highest', 'latest', 'average'],
      default: 'highest',
    },
    layoutConfig: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({
        title: 'Official Academic Transcript',
        showQr: true,
        headerLines: [],
        footerLines: ['Verify authenticity via the QR code or verification URL.'],
      }),
    },
  },
  { timestamps: true }
);

transcriptTemplateSchema.plugin(tenantScopePlugin);

transcriptTemplateSchema.index({ rootAccountId: 1, name: 1 });
transcriptTemplateSchema.index({ rootAccountId: 1, isDefault: 1, isActive: 1 });

module.exports = mongoose.model('TranscriptTemplate', transcriptTemplateSchema);
