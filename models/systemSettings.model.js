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
    }
  }
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

