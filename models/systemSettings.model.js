const mongoose = require('mongoose');

const systemSettingsSchema = new mongoose.Schema({
  general: {
    siteName: {
      type: String,
      default: 'MySl8te'
    },
    siteDescription: {
      type: String,
      default: 'A comprehensive learning management system'
    },
    maintenanceMode: {
      type: Boolean,
      default: false
    },
    maxFileSize: {
      type: Number,
      default: 10 // MB
    },
    allowedFileTypes: {
      type: [String],
      default: ['pdf', 'doc', 'docx', 'jpg', 'png', 'mp4']
    }
  },
  security: {
    passwordMinLength: {
      type: Number,
      default: 8
    },
    requireStrongPassword: {
      type: Boolean,
      default: true
    },
    sessionTimeout: {
      type: Number,
      default: 30 // minutes
    },
    maxLoginAttempts: {
      type: Number,
      default: 5
    },
    enableTwoFactor: {
      type: Boolean,
      default: false
    },
    disablePublicRegistration: {
      type: Boolean,
      default: false
    }
  },
  email: {
    smtpHost: {
      type: String,
      default: ''
    },
    smtpPort: {
      type: Number,
      default: 587
    },
    smtpUser: {
      type: String,
      default: ''
    },
    smtpPassword: {
      type: String,
      default: ''
    },
    fromEmail: {
      type: String,
      default: ''
    },
    fromName: {
      type: String,
      default: 'MySl8te'
    }
  },
  storage: {
    maxStoragePerUser: {
      type: Number,
      default: 100 // GB
    },
    compressionEnabled: {
      type: Boolean,
      default: true
    },
    backupFrequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      default: 'daily'
    },
    retentionDays: {
      type: Number,
      default: 30
    },
    deletedBlobRetentionDays: {
      type: Number,
      default: 30
    },
    deletedFileRetentionDays: {
      type: Number,
      default: 30
    },
    zipRetentionHours: {
      type: Number,
      default: 72
    }
  },
  messaging: {
    mode: {
      type: String,
      enum: ['open', 'course_scoped', 'admin_only'],
      default: 'course_scoped',
    },
    allowStudentToStudent: {
      type: Boolean,
      default: false,
    },
    allowCrossCourse: {
      type: Boolean,
      default: false,
    },
    maxRecipientsPerMessage: {
      type: Number,
      default: 50,
    },
    maxSendIndividuallyBatch: {
      type: Number,
      default: 25,
    },
  },
  /** Institution-wide school/college calendar and defaults. */
  academic: {
    institutionMode: {
      type: String,
      enum: ['college', 'school', 'mixed'],
      default: 'mixed',
    },
    defaultScheduleType: {
      type: String,
      enum: ['single_term', 'full_year', 'custom'],
      default: 'single_term',
    },
    calendarStyle: {
      type: String,
      enum: ['us', 'india'],
      default: 'us',
    },
    calendarPreset: {
      type: String,
      default: 'us_quarters',
    },
    academicYearStart: { type: Number, default: null },
    useInstitutionCalendar: { type: Boolean, default: true },
    defaultCreditHoursSchool: { type: Number, default: 0 },
    defaultCreditHoursCollege: { type: Number, default: 3 },
    reportingTermSchool: { type: String, default: 'Academic Year' },
    reportingTermCollege: { type: String, default: 'Fall' },
  },
}, {
  timestamps: true
});

systemSettingsSchema.add({
  rootAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account',
  },
});

systemSettingsSchema.index(
  { rootAccountId: 1 },
  { unique: true, partialFilterExpression: { rootAccountId: { $type: 'objectId' } } }
);

/**
 * Per-root-account settings (Canvas account settings).
 * @param {import('mongoose').Types.ObjectId|string} [rootAccountId]
 */
systemSettingsSchema.statics.getSettings = async function (rootAccountId) {
  const { getTenantRootAccountId } = require('../utils/tenantContext');
  let id = rootAccountId || getTenantRootAccountId();

  if (!id) {
    // Legacy / early boot: prefer any claimed doc, else create unscoped then claim later
    let settings = await this.findOne({ rootAccountId: { $ne: null } }).sort({ updatedAt: -1 });
    if (!settings) {
      settings = await this.findOne();
    }
    if (!settings) {
      settings = await this.create({});
    }
    return settings;
  }

  let settings = await this.findOne({ rootAccountId: id });
  if (!settings) {
    // Adopt a single legacy unscoped document once
    const orphan = await this.findOne({
      $or: [{ rootAccountId: null }, { rootAccountId: { $exists: false } }],
    });
    if (orphan) {
      orphan.rootAccountId = id;
      await orphan.save();
      return orphan;
    }
    settings = await this.create({ rootAccountId: id });
  }
  return settings;
};

module.exports = mongoose.model('SystemSettings', systemSettingsSchema);

