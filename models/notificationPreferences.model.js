const mongoose = require('mongoose');

const notificationPreferencesSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  // Email notification preferences
  email: {
    messages: { type: Boolean, default: true },
    grades: { type: Boolean, default: true },
    announcements: { type: Boolean, default: true },
    assignmentsDue: { type: Boolean, default: true },
    assignmentsGraded: { type: Boolean, default: true },
    enrollments: { type: Boolean, default: true },
    discussions: { type: Boolean, default: false },
    submissions: { type: Boolean, default: true },
    system: { type: Boolean, default: true }
  },
  // In-app notification preferences
  inApp: {
    messages: { type: Boolean, default: true },
    grades: { type: Boolean, default: true },
    announcements: { type: Boolean, default: true },
    assignmentsDue: { type: Boolean, default: true },
    assignmentsGraded: { type: Boolean, default: true },
    enrollments: { type: Boolean, default: true },
    discussions: { type: Boolean, default: true },
    submissions: { type: Boolean, default: true },
    system: { type: Boolean, default: true }
  },
  // Browser push notification preferences
  push: {
    enabled: { type: Boolean, default: false },
    messages: { type: Boolean, default: true },
    grades: { type: Boolean, default: true },
    announcements: { type: Boolean, default: true },
    assignmentsDue: { type: Boolean, default: true },
    assignmentsGraded: { type: Boolean, default: true },
    enrollments: { type: Boolean, default: false },
    discussions: { type: Boolean, default: false },
    submissions: { type: Boolean, default: false },
    system: { type: Boolean, default: false }
  },
  // Push notification subscription (for browser push)
  pushSubscription: {
    endpoint: String,
    keys: {
      p256dh: String,
      auth: String
    }
  },
  // Quiet hours (don't send notifications during these times)
  quietHours: {
    enabled: { type: Boolean, default: false },
    start: { type: String, default: '22:00' }, // 10 PM
    end: { type: String, default: '08:00' }    // 8 AM
  },
  // Assignment due reminder settings
  assignmentReminders: {
    enabled: { type: Boolean, default: true },
    daysBefore: { type: [Number], default: [7, 3, 1] }, // Remind 7, 3, and 1 day before
    weeklySummary: { type: Boolean, default: true } // Weekly summary of assignments due this week by Sunday
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('NotificationPreferences', notificationPreferencesSchema);

