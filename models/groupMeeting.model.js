const mongoose = require('mongoose');

const groupMeetingSchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: false,
      index: true,
      default: null,
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: 4000,
    },
    startTime: {
      type: Date,
      required: true,
      index: true,
    },
    durationMinutes: {
      type: Number,
      required: true,
      min: 1,
      max: 1440,
    },
    joinUrl: {
      type: String,
      required: true,
      trim: true,
    },
    recordingUrl: {
      type: String,
      default: '',
      trim: true,
    },
    provider: {
      type: String,
      enum: ['zoho_meeting'],
      default: 'zoho_meeting',
    },
    status: {
      type: String,
      enum: ['scheduled', 'cancelled'],
      default: 'scheduled',
      index: true,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

groupMeetingSchema.index({ group: 1, startTime: 1 });
groupMeetingSchema.index({ course: 1, startTime: 1 });

const { portabilityMetadataPlugin } = require('./plugins/portabilityMetadata.plugin');
groupMeetingSchema.plugin(portabilityMetadataPlugin);

module.exports = mongoose.model('GroupMeeting', groupMeetingSchema);
