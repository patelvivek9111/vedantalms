const mongoose = require('mongoose');

const systemSettingsSchema = new mongoose.Schema({
  general: {
    siteName: {
      type: String,
      default: 'Learning Management System'
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
      default: 'LMS'
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

// Ensure only one settings document exists
systemSettingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

module.exports = mongoose.model('SystemSettings', systemSettingsSchema);

